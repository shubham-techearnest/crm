import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormMoreDetails, FormSection } from "@/components/FormKit";
import {
  enumPickerOptions,
  ZohoFormKitCreateView,
  ZohoFormSelect,
  useZohoCreateFlow,
} from "@/components/ZohoCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import {
  createMilestone,
  listMilestones,
  listProjects,
  updateMilestone,
  type Milestone,
} from "./projectApi";

const MILESTONE_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

const milestoneStatusOptions = enumPickerOptions(MILESTONE_STATUSES);

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.string().optional(),
  sortOrder: z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

const MILESTONE_DEFAULTS: CreateFormValues = {
  name: "",
  description: "",
  dueDate: "",
  status: "PLANNED",
  sortOrder: "",
};

const updateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.string().min(1),
  sortOrder: z.string().optional(),
});

type UpdateFormValues = z.infer<typeof updateSchema>;

export function MilestonesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManage = useHasPermission("MILESTONE_MANAGE");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [projectId, setProjectId] = useState(searchParams.get("projectId") ?? "");
  const [statusFilter, setStatusFilter] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [selected, setSelected] = useState<Milestone | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    const fromQuery = searchParams.get("projectId") ?? "";
    if (fromQuery && fromQuery !== projectId) {
      setProjectId(fromQuery);
    }
  }, [searchParams, projectId]);

  const listParams = useMemo(
    () => ({
      projectId: projectId || undefined,
      status: statusFilter || undefined,
      dueFrom: dueFrom || undefined,
      dueTo: dueTo || undefined,
    }),
    [projectId, statusFilter, dueFrom, dueTo],
  );

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });

  const milestonesQuery = useQuery({
    queryKey: ["milestones", listParams],
    queryFn: () => listMilestones(listParams),
  });

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: MILESTONE_DEFAULTS,
  });

  const {
    setSaveAndNew,
    photo,
    cancelCreate,
    afterCreateSuccess,
  } = useZohoCreateFlow<CreateFormValues, Milestone>({
    defaults: MILESTONE_DEFAULTS,
    reset: createForm.reset,
    setShowForm,
    setFormError,
    setSelected,
    onResetExtras: () => setShowMore(false),
  });

  const buildMilestoneBody = (values: CreateFormValues) => ({
    name: values.name,
    description: values.description || undefined,
    dueDate: values.dueDate || undefined,
    status: values.status || "PLANNED",
    sortOrder: values.sortOrder ? Number(values.sortOrder) : undefined,
  });

  const updateForm = useForm<UpdateFormValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: { name: "", description: "", dueDate: "", status: "PLANNED", sortOrder: "" },
  });

  const selectProject = (id: string) => {
    setProjectId(id);
    setSelected(null);
    setShowForm(false);
    if (id) {
      setSearchParams({ projectId: id });
    } else {
      setSearchParams({});
    }
  };

  const createMutation = useMutation({
    mutationFn: (body: Parameters<typeof createMilestone>[1]) => createMilestone(projectId, body),
    onSuccess: async (milestone) => {
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "milestones"] });
      await queryClient.invalidateQueries({ queryKey: ["milestones"] });
      setFormError(null);
      await afterCreateSuccess(milestone, "MILESTONE");
    },
    onError: () => setFormError("Could not create milestone."),
  });

  const onCreateSubmit = (values: CreateFormValues) => {
    createMutation.mutate(buildMilestoneBody(values));
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateMilestone>[1] }) =>
      updateMilestone(id, body),
    onSuccess: async (milestone) => {
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "milestones"] });
      await queryClient.invalidateQueries({ queryKey: ["milestones"] });
      setSelected(milestone);
      setUpdateError(null);
    },
    onError: () => setUpdateError("Could not update milestone."),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (milestonesQuery.data ?? []).filter((milestone) => {
      if (!q) return true;
      return (
        milestone.name.toLowerCase().includes(q) ||
        (milestone.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [milestonesQuery.data, search]);

  const activeFilterCount = [search, projectId, statusFilter, dueFrom, dueTo].filter(Boolean).length;

  const isLoading = projectsQuery.isLoading || milestonesQuery.isLoading;
  const hasError = projectsQuery.error || milestonesQuery.error;

  return (
    <>
      {showForm && canManage && projectId ? (
        <ZohoFormKitCreateView
          title="Create Milestone"
          tableCode="milestone"
          entityLabel="Milestone"
          pending={createForm.formState.isSubmitting || createMutation.isPending}
          isDirty={createForm.formState.isDirty}
          formError={formError}
          onCancel={() => cancelCreate(createForm.formState.isDirty)}
          onSave={() => void createForm.handleSubmit(onCreateSubmit)()}
          onSaveAndNew={() => {
            setSaveAndNew(true);
            void createForm.handleSubmit(onCreateSubmit)();
          }}
          onSubmit={() => void createForm.handleSubmit(onCreateSubmit)()}
          photo={photo}
        >
          <FormSection title="Primary details" description="Milestone name and timing">
            <div className="col-md-5">
              <FormField
                label="Name"
                required
                error={createForm.formState.errors.name}
                {...createForm.register("name")}
              />
            </div>
            <div className="col-md-3">
              <FormField label="Due date" type="date" {...createForm.register("dueDate")} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Status</label>
              <ZohoFormSelect
                control={createForm.control}
                name="status"
                options={milestoneStatusOptions}
                searchPlaceholder="Search Statuses"
                allowEmpty={false}
              />
            </div>
          </FormSection>
          <FormMoreDetails open={showMore} onToggle={() => setShowMore((v) => !v)}>
            <FormSection title="Additional details">
              <div className="col-md-2">
                <FormField label="Sort order" type="number" {...createForm.register("sortOrder")} />
              </div>
              <div className="col-12">
                <FormField label="Description" {...createForm.register("description")} />
              </div>
            </FormSection>
          </FormMoreDetails>
        </ZohoFormKitCreateView>
      ) : (
    <ModuleListShell
      title="Milestones"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Milestones</span>}
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
        canManage && projectId ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setSelected(null);
              setShowForm(true);
            }}
          >
            Create Milestone
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Milestones by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or description"
            />
          </div>
          <div className="module-filter-section">
            <h3>Filter by fields</h3>
            <label className="form-label small mb-1">Project</label>
            <select
              className="form-select form-select-sm mb-2"
              value={projectId}
              onChange={(e) => selectProject(e.target.value)}
            >
              <option value="">All projects</option>
              {(projectsQuery.data ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.projectCode})
                </option>
              ))}
            </select>
            <label className="form-label small mb-1">Status</label>
            <select
              className="form-select form-select-sm mb-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              {MILESTONE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <label className="form-label small mb-1">Due from</label>
            <input
              className="form-control form-control-sm mb-2"
              type="date"
              value={dueFrom}
              onChange={(e) => setDueFrom(e.target.value)}
            />
            <label className="form-label small mb-1">Due to</label>
            <input
              className="form-control form-control-sm"
              type="date"
              value={dueTo}
              onChange={(e) => setDueTo(e.target.value)}
            />
          </div>
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {isLoading ? <LoadingState label="Loading milestones..." /> : null}
      {hasError ? <ErrorState title="Unable to load milestones" message="Try again." /> : null}

      {!isLoading && !hasError && !projectId ? (
        <p className="text-muted p-3 mb-0">
          Select a project in the filter panel to view and manage its milestones.
        </p>
      ) : null}

      {!isLoading && !hasError && projectId ? (
        <div
          className={selected ? "module-list-split" : undefined}
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
        >
          {viewMode === "list" ? (
            <div className="module-list-table-wrap">
              <table className="table module-list-table align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th>Order</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((milestone) => (
                    <tr
                      key={milestone.id}
                      className={selected?.id === milestone.id ? "is-selected" : undefined}
                      onClick={() => {
                        setSelected(milestone);
                        setUpdateError(null);
                        updateForm.reset({
                          name: milestone.name,
                          description: milestone.description ?? "",
                          dueDate: milestone.dueDate ?? "",
                          status: milestone.status,
                          sortOrder: String(milestone.sortOrder),
                        });
                      }}
                    >
                      <td className="lead-name">{milestone.name}</td>
                      <td>{milestone.dueDate ?? "—"}</td>
                      <td>
                        <StatusBadge status={milestone.status} />
                      </td>
                      <td>{milestone.sortOrder}</td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-5">
                        No milestones match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="module-tile-grid">
              {rows.map((milestone) => (
                <button
                  key={milestone.id}
                  type="button"
                  className={`module-tile text-start${selected?.id === milestone.id ? " is-selected" : ""}`}
                  onClick={() => {
                    setSelected(milestone);
                    setUpdateError(null);
                    updateForm.reset({
                      name: milestone.name,
                      description: milestone.description ?? "",
                      dueDate: milestone.dueDate ?? "",
                      status: milestone.status,
                      sortOrder: String(milestone.sortOrder),
                    });
                  }}
                >
                  <div className="tile-title">{milestone.name}</div>
                  <div className="small text-muted">
                    {milestone.status} · {milestone.dueDate ?? "No due date"}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selected && canManage ? (
            <aside className="module-detail-drawer">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div className="fw-semibold">Edit milestone</div>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
              {updateError ? <div className="alert alert-danger py-2">{updateError}</div> : null}
              <form
                onSubmit={updateForm.handleSubmit((values) =>
                  updateMutation.mutate({
                    id: selected.id,
                    body: {
                      name: values.name,
                      description: values.description || undefined,
                      dueDate: values.dueDate || undefined,
                      status: values.status,
                      sortOrder: values.sortOrder ? Number(values.sortOrder) : undefined,
                    },
                  }),
                )}
              >
                <FormField
                  label="Name"
                  required
                  error={updateForm.formState.errors.name}
                  {...updateForm.register("name")}
                />
                <FormField label="Description" {...updateForm.register("description")} />
                <FormField label="Due date" type="date" {...updateForm.register("dueDate")} />
                <label className="form-label">Status</label>
                <select className="form-select mb-2" {...updateForm.register("status")}>
                  {MILESTONE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <FormField
                  label="Sort order"
                  type="number"
                  {...updateForm.register("sortOrder")}
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={updateMutation.isPending}
                >
                  Save changes
                </button>
              </form>
            </aside>
          ) : null}
        </div>
      ) : null}
    </ModuleListShell>
      )}
    </>
  );
}
