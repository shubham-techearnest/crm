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
  TechEarnestFormKitCreateView,
  TechEarnestFormSelect,
  useTechEarnestCreateFlow,
} from "@/components/TechEarnestCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { TechEarnestFilterSelect } from "@/components/TechEarnestCreate/TechEarnestFilterSelect";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { getMyFieldAcls } from "@/features/admin/studio/metadataApi";
import type { ApiResponse } from "@/types/api";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { listProjects } from "@/features/projects/projectApi";
import {
  createAllocation,
  deleteAllocation,
  listAllocations,
  listResources,
  updateAllocation,
  type Allocation,
  type UpdateAllocationBody,
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
  const hasRateViewPermission = useHasPermission("RATE_VIEW");
  const rateAclQuery = useQuery({
    queryKey: ["metadata", "field-acls", "me", "allocation"],
    queryFn: () => getMyFieldAcls("allocation"),
    staleTime: 60_000,
    retry: false,
  });
  const canViewAllocationRate = (field: "costRate" | "billingRate") => rateAclQuery.data?.[field] != null
    ? ["READ", "WRITE"].includes(rateAclQuery.data[field])
    : hasRateViewPermission;
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
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  const [allocationToDelete, setAllocationToDelete] = useState<Allocation | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<{ id: string; body: UpdateAllocationBody } | null>(null);

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
  const deleteMutation = useMutation({
    mutationFn: deleteAllocation,
    onSuccess: async () => {
      setDeleteError(null);
      setAllocationToDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["allocations"] });
      await queryClient.invalidateQueries({ queryKey: ["resources"] });
    },
    onError: (error) => setDeleteError(errorMessage(error, "Could not delete allocation.")),
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
  } = useTechEarnestCreateFlow({
    defaults: ALLOCATION_DEFAULTS,
    reset,
    setShowForm,
    setFormError,
    onResetExtras: () => {
      setShowMore(false);
      setOverAllocWarn(false);
      setPendingBody(null);
      setPendingUpdate(null);
      setEditingAllocation(null);
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

  const buildUpdateBody = (values: FormValues): UpdateAllocationBody => ({
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

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateAllocationBody }) => updateAllocation(id, body),
    onSuccess: async (allocation) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["allocations"] }),
        queryClient.invalidateQueries({ queryKey: ["resources"] }),
      ]);
      setShowForm(false);
      setEditingAllocation(null);
      setFormError(allocation.warning === "OVER_ALLOCATED" ? "Saved with over-allocation override." : null);
      setOverAllocWarn(false);
      setPendingUpdate(null);
      reset(ALLOCATION_DEFAULTS);
    },
    onError: (err) => setFormError(errorMessage(err, "Could not update allocation.")),
  });

  async function submitAllocation(values: FormValues, force = false) {
    if (editingAllocation) {
      const body = buildUpdateBody(values);
      if (!force) {
        try {
          const dry = await updateAllocation(editingAllocation.id, { ...body, dryRun: true });
          if (dry.warning === "OVER_ALLOCATED") {
            setPendingUpdate({ id: editingAllocation.id, body });
            setOverAllocWarn(true);
            setFormError(
              canOverride
                ? "This change exceeds capacity. Confirm to save with override."
                : "This change exceeds capacity. You need ALLOCATION_OVERRIDE to save.",
            );
            return;
          }
        } catch (err) {
          setFormError(errorMessage(err, "Could not validate allocation capacity."));
          return;
        }
      }
      updateMutation.mutate(force && pendingUpdate ? pendingUpdate : { id: editingAllocation.id, body });
      return;
    }
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

  function openEdit(allocation: Allocation) {
    setEditingAllocation(allocation);
    setPendingUpdate(null);
    setOverAllocWarn(false);
    setFormError(null);
    reset({
      projectId: allocation.projectId,
      resourceId: allocation.resourceId,
      startDate: allocation.startDate,
      endDate: allocation.endDate,
      allocatedHours: allocation.allocatedHours != null ? String(allocation.allocatedHours) : "",
      allocationPercentage: allocation.allocationPercentage != null ? String(allocation.allocationPercentage) : "",
      role: allocation.role ?? "",
      status: allocation.status,
    });
    setShowMore(true);
    setShowForm(true);
  }

  function confirmDelete(allocation: Allocation) {
    setDeleteError(null);
    setAllocationToDelete(allocation);
  }

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
          disabled={createMutation.isPending || updateMutation.isPending}
          onClick={() => {
            if (pendingUpdate) updateMutation.mutate(pendingUpdate);
            else if (pendingBody) createMutation.mutate(pendingBody);
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
          setPendingUpdate(null);
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
        <TechEarnestFormKitCreateView
          title={editingAllocation ? "Edit Allocation" : "Create Allocation"}
          tableCode="allocation"
          entityLabel="Allocation"
          pending={isSubmitting || createMutation.isPending || updateMutation.isPending}
          isDirty={isDirty}
          formError={formError}
          alert={overAllocAlert}
          onCancel={() => {
            if (editingAllocation) {
              setEditingAllocation(null);
              setShowForm(false);
              setOverAllocWarn(false);
              setPendingUpdate(null);
              setFormError(null);
              reset(ALLOCATION_DEFAULTS);
            } else cancelCreate(isDirty);
          }}
          onSave={() => void handleSubmit((values) => void submitAllocation(values))()}
          onSaveAndNew={!editingAllocation ? () => {
            setSaveAndNew(true);
            void handleSubmit((values) => void submitAllocation(values))();
          } : undefined}
          onSubmit={() => void handleSubmit((values) => void submitAllocation(values))()}
          photo={photo}
        >
          <FormSection title="Primary details" description="Who, which project, and when">
            <div className="col-md-4">
              <label className="form-label required">Project</label>
              <TechEarnestFormSelect
                control={control}
                name="projectId"
                options={projectOptions}
                searchPlaceholder="Search Projects"
                lookupIcon="apps"
                allowEmpty={false}
                placeholder="Select project"
                invalid={!!errors.projectId}
                disabled={!!editingAllocation}
              />
              {errors.projectId ? (
                <div className="invalid-feedback d-block">{errors.projectId.message}</div>
              ) : null}
            </div>
            <div className="col-md-4">
              <label className="form-label required">Resource</label>
              <TechEarnestFormSelect
                control={control}
                name="resourceId"
                options={resourceOptions}
                searchPlaceholder="Search Resources"
                lookupIcon="users"
                allowEmpty={false}
                placeholder="Select resource"
                invalid={!!errors.resourceId}
                disabled={!!editingAllocation}
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
                <TechEarnestFormSelect
                  control={control}
                  name="status"
                  options={allocationStatusOptions}
                  searchPlaceholder="Search Statuses"
                  allowEmpty={false}
                />
              </div>
            </FormSection>
          </FormMoreDetails>
        </TechEarnestFormKitCreateView>
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
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setEditingAllocation(null); setFormError(null); reset(ALLOCATION_DEFAULTS); setShowMore(false); setShowForm(true); }}>
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
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={ALLOCATION_STATUSES.map((value) => ({ value, label: value }))} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search allocation statuses" />
            <TechEarnestFilterSelect label="Project" value={projectFilter} onChange={setProjectFilter} options={projectOptions} placeholder="All projects" emptyLabel="All projects" searchPlaceholder="Search projects" />
            <TechEarnestFilterSelect label="Resource" value={resourceFilter} onChange={setResourceFilter} options={resourceOptions} placeholder="All resources" emptyLabel="All resources" searchPlaceholder="Search resources" />
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
            <ModuleListTable
              tableCode="allocation"
              defaultColumns={[
                { field: "projectId", label: "Project" },
                { field: "resourceId", label: "Resource" },
                { field: "startDate", label: "Start" },
                { field: "endDate", label: "End" },
                { field: "allocatedHours", label: "Hours" },
                { field: "allocationPercentage", label: "Allocation %" },
                { field: "role", label: "Role" },
                { field: "status", label: "Status" },
                { field: "warning", label: "Warning" },
                ...(canViewAllocationRate("costRate") ? [{ field: "costRate", label: "Cost rate" }] : []),
                ...(canViewAllocationRate("billingRate") ? [{ field: "billingRate", label: "Billing rate" }] : []),
              ]}
              rows={rows}
              rowKey={(allocation) => allocation.id}
              renderCell={(allocation, field) => {
                if (field === "projectId") return projectName(allocation.projectId);
                if (field === "resourceId") return resourceLabel(allocation.resourceId);
                if (field === "status") return <StatusBadge status={allocation.status} />;
                if (field === "warning") return allocation.warning ? <span className="badge bg-warning text-dark">{allocation.warning}</span> : "—";
                if (field === "costRate" || field === "billingRate") return allocation[field] == null ? "—" : Number(allocation[field]).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const value = (allocation as unknown as Record<string, unknown>)[field];
                return value == null || value === "" ? "—" : String(value);
              }}
              nameFields={["projectId"]}
              excludedFields={[
                ...(!canViewAllocationRate("costRate") ? ["costRate"] : []),
                ...(!canViewAllocationRate("billingRate") ? ["billingRate"] : []),
              ]}
              trailingColumn={canAllocate ? {
                header: "Actions",
                stopPropagation: true,
                render: (allocation) => (
                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => openEdit(allocation)}>Edit</button>
                    <button type="button" className="btn btn-outline-danger btn-sm" disabled={deleteMutation.isPending} onClick={() => confirmDelete(allocation)}>Delete</button>
                  </div>
                ),
              } : undefined}
              emptyMessage="No allocations match the current filters."
            />
          ) : (
            <div className="module-tile-grid">
              {rows.map((allocation) => (
                <article key={allocation.id} className="module-tile text-start">
                  <div className="tile-title">{projectName(allocation.projectId)}</div>
                  <div className="small text-muted">
                    {resourceLabel(allocation.resourceId)} · {allocation.startDate} – {allocation.endDate} · {allocation.status}
                  </div>
                  {canAllocate ? (
                    <div className="d-flex gap-2 mt-3">
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => openEdit(allocation)}>Edit</button>
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => confirmDelete(allocation)}>Delete</button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
          {deleteError ? <div className="alert alert-danger m-3 mb-0" role="alert">{deleteError}</div> : null}
        </div>
      ) : null}
    </ModuleListShell>
      )}
      {allocationToDelete ? (
        <div className="module-modal-backdrop" role="presentation" onClick={() => deleteMutation.isPending ? null : setAllocationToDelete(null)}>
          <section className="module-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-allocation-title" onClick={(event) => event.stopPropagation()}>
            <header className="d-flex align-items-center justify-content-between gap-3 mb-3">
              <h2 id="delete-allocation-title" className="h5 mb-0">Delete allocation?</h2>
              <button type="button" className="btn-close" aria-label="Close" disabled={deleteMutation.isPending} onClick={() => setAllocationToDelete(null)} />
            </header>
            <p>Remove the allocation for <strong>{resourceLabel(allocationToDelete.resourceId)}</strong> from <strong>{projectName(allocationToDelete.projectId)}</strong>?</p>
            {deleteError ? <div className="alert alert-danger py-2" role="alert">{deleteError}</div> : null}
            <footer className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={deleteMutation.isPending} onClick={() => setAllocationToDelete(null)}>Cancel</button>
              <button type="button" className="btn btn-danger btn-sm" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(allocationToDelete.id)}>
                {deleteMutation.isPending ? "Deleting…" : "Delete allocation"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
