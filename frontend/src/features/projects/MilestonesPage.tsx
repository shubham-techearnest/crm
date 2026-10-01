import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useSearchParams } from "react-router-dom";
import { RecordLink, RelatedRecordList } from "@/components/RecordLink";
import { readRecordNavState, useUrlSelection } from "@/hooks/useUrlRecord";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import {
  enumPickerOptions,
  TechEarnestCreateColumn,
  TechEarnestCreateField,
  TechEarnestCreateGrid,
  TechEarnestCreateSection,
  TechEarnestFormKitCreateView,
  TechEarnestFormSelect,
  useTechEarnestCreateFlow,
} from "@/components/TechEarnestCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleFilterDateRange, ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { TechEarnestFilterSelect } from "@/components/TechEarnestCreate/TechEarnestFilterSelect";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import {
  createMilestone,
  getMilestone,
  listMilestones,
  listProjects,
  listTasks,
  updateMilestone,
  type Milestone,
} from "./projectApi";
import { enumOptions } from "@/components/BulkActions/useBulkOptions";

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
  const [formError, setFormError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
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
  const [selected, setSelected] = useUrlSelection(milestonesQuery.data, { fetchById: getMilestone });
  const location = useLocation();
  const cameFrom = readRecordNavState(location.state)?.from;
  useEffect(() => {
    if (selected && !projectId) setProjectId(selected.projectId);
  }, [selected, projectId]);
  const milestoneTasksQuery = useQuery({
    queryKey: ["tasks", { projectId: selected?.projectId }],
    queryFn: () => listTasks({ projectId: selected!.projectId }),
    enabled: !!selected,
  });
  const milestoneTasks = useMemo(
    () => (milestoneTasksQuery.data ?? []).filter((task) => task.milestoneId === selected?.id),
    [milestoneTasksQuery.data, selected?.id],
  );

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: MILESTONE_DEFAULTS,
  });

  const createErrors = createForm.formState.errors;

  const {
    setSaveAndNew,
    cancelCreate,
    afterCreateSuccess,
  } = useTechEarnestCreateFlow<CreateFormValues, Milestone>({
    defaults: MILESTONE_DEFAULTS,
    reset: createForm.reset,
    setShowForm,
    setFormError,
    setSelected,
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

  useEffect(() => {
    if (!selected) return;
    updateForm.reset({
      name: selected.name,
      description: selected.description ?? "",
      dueDate: selected.dueDate ?? "",
      status: selected.status,
      sortOrder: String(selected.sortOrder),
    });
  }, [selected?.id]);

  const selectProject = (id: string) => {
    setProjectId(id);
    setShowForm(false);
    setSearchParams(id ? { projectId: id } : {});
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
        <TechEarnestFormKitCreateView
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
          showRecordImage={false}
        >
          <TechEarnestCreateSection title="Milestone Information">
            <TechEarnestCreateGrid>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Milestone Name" required error={createErrors.name?.message}>
                  <input
                    type="text"
                    className={`form-control form-control-sm${createErrors.name ? " is-invalid" : ""}`}
                    {...createForm.register("name")}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Sort Order" error={createErrors.sortOrder?.message}>
                  <input
                    type="number"
                    className={`form-control form-control-sm${createErrors.sortOrder ? " is-invalid" : ""}`}
                    {...createForm.register("sortOrder")}
                  />
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Due Date" error={createErrors.dueDate?.message}>
                  <input type="date" className="form-control form-control-sm" {...createForm.register("dueDate")} />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Status" error={createErrors.status?.message}>
                  <TechEarnestFormSelect
                    control={createForm.control}
                    name="status"
                    options={milestoneStatusOptions}
                    searchPlaceholder="Search Statuses"
                    allowEmpty={false}
                  />
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
            </TechEarnestCreateGrid>
          </TechEarnestCreateSection>
          <TechEarnestCreateSection title="Description Information">
            <TechEarnestCreateField label="Description" wide error={createErrors.description?.message}>
              <textarea rows={4} className="form-control form-control-sm" {...createForm.register("description")} />
            </TechEarnestCreateField>
          </TechEarnestCreateSection>
        </TechEarnestFormKitCreateView>
      ) : (
    <ModuleListShell
      title="Milestones"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Milestones</span>}
      filterToggle={{ onToggle: () => setFilterOpen((open) => !open) }}
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
            <TechEarnestFilterSelect label="Project" value={projectId} onChange={selectProject} options={(projectsQuery.data ?? []).map((project) => ({ value: project.id, label: project.name, subtitle: project.projectCode }))} placeholder="All projects" emptyLabel="All projects" searchPlaceholder="Search projects" />
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={MILESTONE_STATUSES.map((value) => ({ value, label: value }))} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search milestone statuses" />
            <ModuleFilterDateRange
              label="Due"
              from={dueFrom}
              to={dueTo}
              onFromChange={setDueFrom}
              onToChange={setDueTo}
            />
          </div>
        </>
      }
      activeFilterCount={activeFilterCount}
      onClearFilters={() => {
        setSearch("");
        selectProject("");
        setStatusFilter("");
        setDueFrom("");
        setDueTo("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
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
            <ModuleListTable
              tableCode="milestone"
              defaultColumns={[
                { field: "name", label: "Name" },
                { field: "dueDate", label: "Due" },
                { field: "status", label: "Status" },
                { field: "sortOrder", label: "Order" },
              ]}
              rows={rows}
              rowKey={(milestone) => milestone.id}
              bulk={{
                noun: "milestones",
                exportFileName: "milestones",
                onComplete: () => {
                  void queryClient.invalidateQueries({ queryKey: ["milestones"] });
                  void queryClient.invalidateQueries({ queryKey: ["projects"] });
                },
                actions: [
                  {
                    id: "change-status",
                    label: "Change status",
                    visible: canManage,
                    doneLabel: "updated",
                    input: { kind: "select", label: "New status", options: enumOptions(MILESTONE_STATUSES) },
                    run: (milestone, status) =>
                      updateMilestone(milestone.id, {
                        name: milestone.name,
                        description: milestone.description ?? undefined,
                        dueDate: milestone.dueDate,
                        sortOrder: milestone.sortOrder,
                        status,
                      }),
                  },
                ],
              }}
              selectedRowKey={selected?.id}
              onRowClick={(milestone) => {
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
              renderCell={(milestone, field) => {
                if (field === "status") return <StatusBadge status={milestone.status} />;
                const value = (milestone as unknown as Record<string, unknown>)[field];
                return value == null || value === "" ? "—" : String(value);
              }}
              emptyMessage="No milestones match the current filters."
            />
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

          {selected ? (
            <aside className="module-detail-drawer">
              {cameFrom ? (
                <button type="button" className="techearnest-record-return mb-2" onClick={() => setSelected(null)}>
                  <span aria-hidden="true">‹</span> Back to {cameFrom.label || "previous page"}
                </button>
              ) : null}
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <div className="fw-semibold">{selected.name}</div>
                  <div className="small text-muted">
                    <RecordLink module="project" id={selected.projectId}>
                      {projectsQuery.data?.find((project) => project.id === selected.projectId)?.name ?? "Open project"}
                    </RecordLink>
                    {" · "}
                    <StatusBadge status={selected.status} />
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
              <div className="border-top pt-2 mb-3">
                <div className="form-label mb-1">Tasks ({milestoneTasks.length})</div>
                {milestoneTasks.length || milestoneTasksQuery.isLoading ? (
                  <RelatedRecordList
                    module="task"
                    loading={milestoneTasksQuery.isLoading}
                    items={milestoneTasks.map((task) => ({
                      id: task.id,
                      label: task.name,
                      secondary: task.dueDate ? `due ${task.dueDate}` : undefined,
                      trailing: <StatusBadge status={task.status} />,
                    }))}
                  />
                ) : (
                  <div className="small text-muted">No tasks linked to this milestone</div>
                )}
              </div>
              {canManage ? (
              <>
              <div className="fw-semibold border-top pt-2 mb-2">Edit milestone</div>
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
              </>
              ) : null}
            </aside>
          ) : null}
        </div>
      ) : null}
    </ModuleListShell>
      )}
    </>
  );
}
