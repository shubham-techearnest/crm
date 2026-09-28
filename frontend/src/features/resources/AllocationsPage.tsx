import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { FormField } from "@/components/FormField/FormField";
import { FormMoreDetails, FormSection } from "@/components/FormKit";
import {
  enumPickerOptions,
  optionsFromPairs,
  ZohoFormKitCreateView,
  ZohoFormSelect,
  useZohoCreateFlow,
} from "@/components/ZohoCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import type { ApiResponse } from "@/types/api";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { listProjects } from "@/features/projects/projectApi";
import {
  createAllocation,
  listAllocations,
  listResources,
} from "./resourceApi";

const schema = z.object({
  projectId: z.string().min(1, "Project is required"),
  resourceId: z.string().min(1, "Resource is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  allocatedHours: z.string().optional(),
  allocationPercentage: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const ALLOCATION_STATUSES = ["ACTIVE", "PLANNED", "COMPLETED", "CANCELLED"] as const;

const allocationStatusOptions = enumPickerOptions(ALLOCATION_STATUSES);

const ALLOCATION_DEFAULTS: FormValues = {
  projectId: "",
  resourceId: "",
  startDate: "",
  endDate: "",
  allocatedHours: "",
  allocationPercentage: "",
  role: "",
  status: "ACTIVE",
};

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const payload = err.response?.data as ApiResponse<unknown> | undefined;
    if (payload?.message) return payload.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function parseOptionalNumber(value?: string): number | undefined {
  if (!value?.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function AllocationsPage() {
  const queryClient = useQueryClient();
  const canAllocate = useHasPermission("RESOURCE_ALLOCATE");
  const canOverride = useHasPermission("ALLOCATION_OVERRIDE");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [overlapOnly, setOverlapOnly] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [pendingBody, setPendingBody] = useState<Parameters<typeof createAllocation>[0] | null>(null);
  const [overAllocWarn, setOverAllocWarn] = useState(false);

  const listParams = useMemo(
    () => ({
      status: statusFilter || undefined,
      projectId: projectFilter || undefined,
      resourceId: resourceFilter || undefined,
      overlapOnly: overlapOnly || undefined,
    }),
    [statusFilter, projectFilter, resourceFilter, overlapOnly],
  );

  const allocationsQuery = useQuery({
    queryKey: ["allocations", listParams],
    queryFn: () => listAllocations(listParams),
  });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => listProjects() });
  const resourcesQuery = useQuery({ queryKey: ["resources"], queryFn: () => listResources() });

  const projectOptions = useMemo(
    () =>
      optionsFromPairs(
        (projectsQuery.data ?? []).map((project) => ({ value: project.id, label: project.name })),
      ),
    [projectsQuery.data],
  );

  const resourceOptions = useMemo(
    () =>
      optionsFromPairs(
        (resourcesQuery.data ?? []).map((resource) => {
          const label =
            resource.employeeCode ?? resource.designation ?? resource.id.slice(0, 8);
          const subtitle =
            resource.designation && resource.employeeCode ? resource.designation : undefined;
          return { value: resource.id, label, subtitle };
        }),
      ),
    [resourcesQuery.data],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: ALLOCATION_DEFAULTS,
  });

  const {
    setSaveAndNew,
    photo,
    cancelCreate,
    afterCreateSuccess,
  } = useZohoCreateFlow({
    defaults: ALLOCATION_DEFAULTS,
    reset,
    setShowForm,
    setFormError,
    onResetExtras: () => {
      setShowMore(false);
      setOverAllocWarn(false);
      setPendingBody(null);
    },
  });

  const buildAllocationBody = (values: FormValues) => ({
    projectId: values.projectId,
    resourceId: values.resourceId,
    startDate: values.startDate,
    endDate: values.endDate,
    allocatedHours: parseOptionalNumber(values.allocatedHours) ?? null,
    allocationPercentage: parseOptionalNumber(values.allocationPercentage) ?? null,
    role: values.role || undefined,
    status: values.status || "ACTIVE",
  });

  const createMutation = useMutation({
    mutationFn: createAllocation,
    onSuccess: async (allocation) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["allocations"] }),
        queryClient.invalidateQueries({ queryKey: ["resources"] }),
      ]);
      setFormError(null);
      setOverAllocWarn(false);
      setPendingBody(null);
      if (allocation.warning === "OVER_ALLOCATED") {
        setFormError("Saved with over-allocation override.");
      }
      await afterCreateSuccess(allocation, "ALLOCATION");
    },
    onError: (err) =>
      setFormError(errorMessage(err, "Could not create allocation. Check capacity and dates.")),
  });

  async function submitAllocation(values: FormValues, force = false) {
    const body = buildAllocationBody(values);
    if (!force) {
      try {
        const dry = await createAllocation({ ...body, dryRun: true });
        if (dry.warning === "OVER_ALLOCATED") {
          setPendingBody(body);
          setOverAllocWarn(true);
          setFormError(
            canOverride
              ? "This allocation exceeds capacity. Confirm to save with override."
              : "This allocation exceeds capacity. You need ALLOCATION_OVERRIDE to save.",
          );
          return;
        }
      } catch (err) {
        setFormError(errorMessage(err, "Could not validate allocation capacity."));
        return;
      }
    }
    createMutation.mutate(force && pendingBody ? pendingBody : body);
  }

  const projectName = (id: string) =>
    projectsQuery.data?.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  const resourceLabel = (id: string) => {
    const r = resourcesQuery.data?.find((item) => item.id === id);
    if (!r) return id.slice(0, 8);
    return r.employeeCode ?? r.designation ?? id.slice(0, 8);
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (allocationsQuery.data ?? []).filter((allocation) => {
      if (!q) return true;
      return (
        projectName(allocation.projectId).toLowerCase().includes(q) ||
        resourceLabel(allocation.resourceId).toLowerCase().includes(q) ||
        (allocation.role ?? "").toLowerCase().includes(q)
      );
    });
  }, [allocationsQuery.data, search, projectsQuery.data, resourcesQuery.data]);

  const activeFilterCount = [
    search,
    statusFilter,
    projectFilter,
    resourceFilter,
    overlapOnly ? "1" : "",
  ].filter(Boolean).length;

  const overAllocAlert = overAllocWarn ? (
    <div className="alert alert-warning py-2 d-flex flex-wrap align-items-center gap-2">
      <span className="me-auto">Over-allocation detected for this resource/period.</span>
      {canOverride ? (
        <button
          type="button"
          className="btn btn-sm btn-warning"
          disabled={createMutation.isPending}
          onClick={() => {
            if (pendingBody) createMutation.mutate(pendingBody);
            else void handleSubmit((values) => void submitAllocation(values, true))();
          }}
        >
          Confirm override
        </button>
      ) : null}
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        onClick={() => {
          setOverAllocWarn(false);
          setPendingBody(null);
          setFormError(null);
        }}
      >
        Cancel
      </button>
    </div>
  ) : null;

  return (
    <>
      {showForm && canAllocate ? (
        <ZohoFormKitCreateView
          title="Create Allocation"
          tableCode="allocation"
          entityLabel="Allocation"
          pending={isSubmitting || createMutation.isPending}
          isDirty={isDirty}
          formError={formError}
          alert={overAllocAlert}
          onCancel={() => cancelCreate(isDirty)}
          onSave={() => void handleSubmit((values) => void submitAllocation(values))()}
          onSaveAndNew={() => {
            setSaveAndNew(true);
            void handleSubmit((values) => void submitAllocation(values))();
          }}
          onSubmit={() => void handleSubmit((values) => void submitAllocation(values))()}
          photo={photo}
        >
          <FormSection title="Primary details" description="Who, which project, and when">
            <div className="col-md-4">
              <label className="form-label required">Project</label>
              <ZohoFormSelect
                control={control}
                name="projectId"
                options={projectOptions}
                searchPlaceholder="Search Projects"
                lookupIcon="apps"
                allowEmpty={false}
                placeholder="Select project"
                invalid={!!errors.projectId}
              />
              {errors.projectId ? (
                <div className="invalid-feedback d-block">{errors.projectId.message}</div>
              ) : null}
            </div>
            <div className="col-md-4">
              <label className="form-label required">Resource</label>
              <ZohoFormSelect
                control={control}
                name="resourceId"
                options={resourceOptions}
                searchPlaceholder="Search Resources"
                lookupIcon="users"
                allowEmpty={false}
                placeholder="Select resource"
                invalid={!!errors.resourceId}
              />
              {errors.resourceId ? (
                <div className="invalid-feedback d-block">{errors.resourceId.message}</div>
              ) : null}
            </div>
            <div className="col-md-2">
              <FormField
                label="Start date"
                type="date"
                required
                error={errors.startDate}
                {...register("startDate")}
              />
            </div>
            <div className="col-md-2">
              <FormField
                label="End date"
                type="date"
                required
                error={errors.endDate}
                {...register("endDate")}
              />
            </div>
          </FormSection>
          <FormMoreDetails open={showMore} onToggle={() => setShowMore((v) => !v)}>
            <FormSection title="Effort & role">
              <div className="col-md-2">
                <FormField
                  label="Allocated hours"
                  type="number"
                  error={errors.allocatedHours}
                  {...register("allocatedHours")}
                />
              </div>
              <div className="col-md-2">
                <FormField
                  label="Percentage"
                  type="number"
                  error={errors.allocationPercentage}
                  {...register("allocationPercentage")}
                />
              </div>
              <div className="col-md-4">
                <FormField label="Role" error={errors.role} {...register("role")} />
              </div>
              <div className="col-md-2">
                <label className="form-label">Status</label>
                <ZohoFormSelect
                  control={control}
                  name="status"
                  options={allocationStatusOptions}
                  searchPlaceholder="Search Statuses"
                  allowEmpty={false}
                />
              </div>
            </FormSection>
          </FormMoreDetails>
        </ZohoFormKitCreateView>
      ) : (
    <ModuleListShell
      title="Allocations"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Allocations</span>}
      toolbarActions={
        <button
          type="button"
          className={`btn btn-sm ${filterOpen ? "btn-primary" : "btn-outline-secondary"}`}
          onClick={() => setFilterOpen((o) => !o)}
        >
          Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </button>
      }
      primaryAction={
        canAllocate ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
            Create Allocation
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Allocations by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Project, resource, or role"
            />
          </div>
          <div className="module-filter-section">
            <h3>Filter by fields</h3>
            <label className="form-label small mb-1">Status</label>
            <select
              className="form-select form-select-sm mb-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PLANNED">PLANNED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
            <label className="form-label small mb-1">Project</label>
            <select
              className="form-select form-select-sm mb-2"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="">All</option>
              {(projectsQuery.data ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <label className="form-label small mb-1">Resource</label>
            <select
              className="form-select form-select-sm mb-2"
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
            >
              <option value="">All</option>
              {(resourcesQuery.data ?? []).map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.employeeCode ?? resource.designation ?? resource.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <div className="form-check">
              <input
                id="overlapOnly"
                className="form-check-input"
                type="checkbox"
                checked={overlapOnly}
                onChange={(e) => setOverlapOnly(e.target.checked)}
              />
              <label className="form-check-label small" htmlFor="overlapOnly">
                Overlapping only
              </label>
            </div>
          </div>
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {allocationsQuery.isLoading ? <LoadingState label="Loading allocations..." /> : null}
      {allocationsQuery.error ? (
        <ErrorState title="Unable to load allocations" message="Try again." />
      ) : null}

      {!allocationsQuery.isLoading && !allocationsQuery.error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <div className="module-list-table-wrap">
              <table className="table module-list-table align-middle">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Resource</th>
                    <th>Dates</th>
                    <th>Hours</th>
                    <th>%</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Warning</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((allocation) => (
                    <tr key={allocation.id}>
                      <td className="lead-name">{projectName(allocation.projectId)}</td>
                      <td>{resourceLabel(allocation.resourceId)}</td>
                      <td className="small">
                        {allocation.startDate} → {allocation.endDate}
                      </td>
                      <td>{allocation.allocatedHours ?? "—"}</td>
                      <td>
                        {allocation.allocationPercentage != null
                          ? `${allocation.allocationPercentage}%`
                          : "—"}
                      </td>
                      <td>{allocation.role ?? "—"}</td>
                      <td>
                        <StatusBadge status={allocation.status} />
                      </td>
                      <td>
                        {allocation.warning ? (
                          <span className="badge bg-warning text-dark">{allocation.warning}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={8} className="text-center text-muted py-5">
                        No allocations match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="module-tile-grid">
              {rows.map((allocation) => (
                <div key={allocation.id} className="module-tile text-start">
                  <div className="tile-title">{projectName(allocation.projectId)}</div>
                  <div className="small text-muted">
                    {resourceLabel(allocation.resourceId)} · {allocation.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </ModuleListShell>
      )}
    </>
  );
}
