import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormMoreDetails, FormSection } from "@/components/FormKit";
import {
  enumPickerOptions,
  optionsFromPairs,
  TechEarnestFormKitCreateView,
  TechEarnestFormSelect,
  TechEarnestFilterSelect,
  useTechEarnestCreateFlow,
} from "@/components/TechEarnestCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listResources } from "@/features/resources/resourceApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import {
  addComment,
  addDependency,
  assignTask,
  createTask,
  deleteTask,
  getTask,
  listComments,
  listProjects,
  listTasks,
  updateTask,
  type ProjectTask,
} from "./projectApi";

const TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"] as const;
const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const taskStatusOptions = enumPickerOptions(TASK_STATUSES);
const taskPriorityOptions = enumPickerOptions(["LOW", "MEDIUM", "HIGH"] as const);
const taskFilterPriorityOptions = enumPickerOptions(TASK_PRIORITIES);

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  dueDate: z.string().optional(),
  startDate: z.string().optional(),
  estimatedHours: z.string().optional(),
  assignedResourceId: z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

const TASK_DEFAULTS: CreateFormValues = {
  name: "",
  description: "",
  status: "TODO",
  priority: "MEDIUM",
  dueDate: "",
  startDate: "",
  estimatedHours: "",
  assignedResourceId: "",
};

function parseOptionalNumber(value?: string): number | undefined {
  if (!value?.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

const assignSchema = z.object({
  assignedResourceId: z.string().uuid("Enter a valid resource UUID"),
});

type AssignFormValues = z.infer<typeof assignSchema>;

const commentSchema = z.object({
  body: z.string().min(1, "Comment is required"),
});

type CommentFormValues = z.infer<typeof commentSchema>;

const dependencySchema = z.object({ predecessorTaskId: z.string().uuid("Choose a task") });
type DependencyFormValues = z.infer<typeof dependencySchema>;

function resourceLabel(resource: { id: string; employeeCode: string | null; designation: string | null; userId: string | null }) {
  return resource.employeeCode || resource.designation || resource.userId?.slice(0, 8) || resource.id.slice(0, 8);
}

export function TasksPage() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission("TASK_CREATE");
  const canUpdate = useHasPermission("TASK_UPDATE");
  const canAssign = useHasPermission("TASK_ASSIGN");
  const canDelete = useHasPermission("TASK_DELETE");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [projectId, setProjectId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [selected, setSelected] = useState<ProjectTask | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelNotice, setPanelNotice] = useState<string | null>(null);
  const [confirmTaskDelete, setConfirmTaskDelete] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const listParams = useMemo(
    () => ({
      projectId: projectId || undefined,
      status: statusFilter || undefined,
      assignedResourceId: assigneeFilter || undefined,
      priority: priorityFilter || undefined,
      dueFrom: dueFrom || undefined,
      dueTo: dueTo || undefined,
    }),
    [projectId, statusFilter, assigneeFilter, priorityFilter, dueFrom, dueTo],
  );

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });
  const resourcesQuery = useQuery({
    queryKey: ["resources"],
    queryFn: () => listResources(),
  });
  const resourceOptions = useMemo(
    () => optionsFromPairs((resourcesQuery.data ?? []).map((resource) => ({ value: resource.id, label: resourceLabel(resource) }))),
    [resourcesQuery.data],
  );
  const projectOptions = useMemo(
    () => optionsFromPairs((projectsQuery.data ?? []).map((project) => ({ value: project.id, label: `${project.name} (${project.projectCode})` }))),
    [projectsQuery.data],
  );

  const tasksQuery = useQuery({
    queryKey: ["tasks", listParams],
    queryFn: () => listTasks(listParams),
  });
  const taskDetailQuery = useQuery({
    queryKey: ["tasks", selected?.id, "detail"],
    queryFn: () => getTask(selected!.id),
    enabled: !!selected,
  });

  const commentsQuery = useQuery({
    queryKey: ["tasks", selected?.id, "comments"],
    queryFn: () => listComments(selected!.id),
    enabled: !!selected,
  });

  const dependencyCandidatesQuery = useQuery({
    queryKey: ["tasks", "dependency-candidates", selected?.projectId],
    queryFn: () => listTasks({ projectId: selected!.projectId }),
    enabled: !!selected,
  });

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: TASK_DEFAULTS,
  });

  const {
    setSaveAndNew,
    photo,
    cancelCreate,
    afterCreateSuccess,
  } = useTechEarnestCreateFlow<CreateFormValues, ProjectTask>({
    defaults: TASK_DEFAULTS,
    reset: createForm.reset,
    setShowForm,
    setFormError,
    setSelected,
    onResetExtras: () => setShowMore(false),
  });

  const buildTaskBody = (values: CreateFormValues) => ({
    name: values.name,
    description: values.description || undefined,
    status: values.status || "TODO",
    priority: values.priority || undefined,
    dueDate: values.dueDate || undefined,
    startDate: values.startDate || undefined,
    estimatedHours: parseOptionalNumber(values.estimatedHours) ?? null,
    assignedResourceId: values.assignedResourceId || undefined,
  });

  const assignForm = useForm<AssignFormValues>({
    resolver: zodResolver(assignSchema),
    defaultValues: { assignedResourceId: "" },
  });

  const commentForm = useForm<CommentFormValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: { body: "" },
  });

  const dependencyForm = useForm<DependencyFormValues>({
    resolver: zodResolver(dependencySchema),
    defaultValues: { predecessorTaskId: "" },
  });

  const dependencyOptions = useMemo(
    () => optionsFromPairs(
      (dependencyCandidatesQuery.data ?? [])
        .filter((task) => task.id !== selected?.id)
        .map((task) => ({ value: task.id, label: task.name })),
    ),
    [dependencyCandidatesQuery.data, selected?.id],
  );

  const refreshTasks = async () => {
    await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: Parameters<typeof createTask>[1]) => createTask(projectId, body),
    onSuccess: async (task) => {
      await refreshTasks();
      setFormError(null);
      await afterCreateSuccess(task, "TASK");
    },
    onError: () => setFormError("Could not create task."),
  });

  const onCreateSubmit = (values: CreateFormValues) => {
    createMutation.mutate(buildTaskBody(values));
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateTask(id, { status }),
    onSuccess: async (task) => {
      await refreshTasks();
      queryClient.setQueryData(["tasks", task.id, "detail"], task);
      setSelected(task);
      setPanelError(null);
    },
    onError: () => setPanelError("Could not update task status."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: async () => {
      await refreshTasks();
      setConfirmTaskDelete(false);
      setSelected(null);
      setPanelError(null);
    },
    onError: () => setPanelError("Could not delete this task. Check your access and linked records."),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, assignedResourceId }: { id: string; assignedResourceId: string }) =>
      assignTask(id, { assignedResourceId }),
    onSuccess: async (task) => {
      await refreshTasks();
      queryClient.setQueryData(["tasks", task.id, "detail"], task);
      setSelected(task);
      assignForm.reset({ assignedResourceId: "" });
      setPanelError(null);
    },
    onError: () => setPanelError("Could not assign task. Check the resource UUID."),
  });

  const commentMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => addComment(id, { body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks", selected?.id, "comments"] });
      commentForm.reset({ body: "" });
      setPanelError(null);
    },
    onError: () => setPanelError("Could not add comment."),
  });

  const dependencyMutation = useMutation({
    mutationFn: ({ taskId, predecessorTaskId }: { taskId: string; predecessorTaskId: string }) =>
      addDependency(taskId, { predecessorTaskId }),
    onSuccess: () => {
      dependencyForm.reset({ predecessorTaskId: "" });
      setPanelError(null);
      setPanelNotice("Dependency added.");
    },
    onError: () => {
      setPanelNotice(null);
      setPanelError("Could not add dependency. It may already exist or violate project rules.");
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tasksQuery.data ?? []).filter((task) => {
      if (!q) return true;
      return (
        task.name.toLowerCase().includes(q) ||
        (task.priority ?? "").toLowerCase().includes(q) ||
        (task.assignedResourceId ?? "").toLowerCase().includes(q)
      );
    });
  }, [tasksQuery.data, search]);
  const selectedTask = taskDetailQuery.data ?? selected;

  const activeFilterCount = [
    search,
    projectId,
    statusFilter,
    assigneeFilter,
    priorityFilter,
    dueFrom,
    dueTo,
  ].filter(Boolean).length;

  const isLoading = projectsQuery.isLoading || tasksQuery.isLoading;
  const hasError = projectsQuery.error || tasksQuery.error;

  return (
    <>
      {showForm && canCreate && projectId ? (
        <TechEarnestFormKitCreateView
          title="Create Task"
          tableCode="task"
          entityLabel="Task"
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
          <FormSection title="Primary details" description="Task identity and status">
            <div className="col-md-5">
              <FormField
                label="Name"
                required
                error={createForm.formState.errors.name}
                {...createForm.register("name")}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Status</label>
              <TechEarnestFormSelect
                control={createForm.control}
                name="status"
                options={taskStatusOptions}
                searchPlaceholder="Search Statuses"
                allowEmpty={false}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Priority</label>
              <TechEarnestFormSelect
                control={createForm.control}
                name="priority"
                options={taskPriorityOptions}
                searchPlaceholder="Search Priorities"
                allowEmpty={false}
              />
            </div>
            <div className="col-md-3">
              <FormField label="Due date" type="date" {...createForm.register("dueDate")} />
            </div>
          </FormSection>
          <FormMoreDetails open={showMore} onToggle={() => setShowMore((v) => !v)}>
            <FormSection title="Assignment & effort">
              <div className="col-md-3">
                <FormField label="Start date" type="date" {...createForm.register("startDate")} />
              </div>
              <div className="col-md-3">
                <FormField
                  label="Estimated hours"
                  type="number"
                  {...createForm.register("estimatedHours")}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Assigned resource</label>
                <TechEarnestFormSelect
                  control={createForm.control}
                  name="assignedResourceId"
                  options={resourceOptions}
                  searchPlaceholder="Search resources"
                  placeholder="Select a resource"
                  allowEmpty
                />
              </div>
              <div className="col-12">
                <FormField label="Description" {...createForm.register("description")} />
              </div>
            </FormSection>
          </FormMoreDetails>
        </TechEarnestFormKitCreateView>
      ) : (
    <ModuleListShell
      title="Tasks"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Tasks</span>}
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
        canCreate && projectId ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setSelected(null);
              setShowForm(true);
            }}
          >
            Create Task
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Tasks by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or assignee"
            />
          </div>
          <div className="module-filter-section">
            <h3>Filter by fields</h3>
            <div className="mb-2">
              <TechEarnestFilterSelect
                label="Project"
                value={projectId}
                onChange={(value) => {
                setProjectId(value);
                setSelected(null);
                setShowForm(false);
                setPanelError(null);
              }}
                options={projectOptions}
                placeholder="All projects"
                emptyLabel="All projects"
                searchPlaceholder="Search projects"
              />
            </div>
            <div className="mb-2">
              <TechEarnestFilterSelect
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={taskStatusOptions}
                placeholder="All statuses"
                emptyLabel="All statuses"
                searchPlaceholder="Search statuses"
              />
            </div>
            <div className="mb-2">
              <TechEarnestFilterSelect
                label="Priority"
                value={priorityFilter}
                onChange={setPriorityFilter}
                options={taskFilterPriorityOptions}
                placeholder="All priorities"
                emptyLabel="All priorities"
                searchPlaceholder="Search priorities"
              />
            </div>
            <div className="mb-2">
              <TechEarnestFilterSelect
                label="Assignee"
                value={assigneeFilter}
                onChange={setAssigneeFilter}
                options={resourceOptions}
                placeholder="All assignees"
                emptyLabel="All assignees"
                searchPlaceholder="Search resources"
              />
            </div>
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
      {isLoading ? <LoadingState label="Loading tasks..." /> : null}
      {hasError ? <ErrorState title="Unable to load tasks" message="Try again." /> : null}

      {!isLoading && !hasError && !projectId ? (
        <p className="text-muted p-3 mb-0">Select a project in the filter panel to view and manage its tasks.</p>
      ) : null}

      {!isLoading && !hasError && projectId ? (
        <div
          className={selected ? "module-list-split" : undefined}
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
        >
          {viewMode === "list" ? (
            <ModuleListTable
              tableCode="task"
              defaultColumns={[
                { field: "name", label: "Name" },
                { field: "status", label: "Status" },
                { field: "priority", label: "Priority" },
                { field: "dueDate", label: "Due" },
                { field: "assignedResourceId", label: "Assignee" },
              ]}
              rows={rows}
              rowKey={(task) => task.id}
              selectedRowKey={selected?.id}
              onRowClick={(task) => {
                setSelected(task);
                setPanelError(null);
                setPanelNotice(null);
                dependencyForm.reset({ predecessorTaskId: "" });
                assignForm.reset({ assignedResourceId: task.assignedResourceId ?? "" });
              }}
              renderCell={(task, field) => {
                if (field === "status") return <StatusBadge status={task.status} />;
                if (field === "assignedResourceId") {
                  if (!task.assignedResourceId) return "—";
                  const resource = resourcesQuery.data?.find((item) => item.id === task.assignedResourceId);
                  return resource ? resourceLabel(resource) : task.assignedResourceId.slice(0, 8);
                }
                const value = (task as unknown as Record<string, unknown>)[field];
                return value == null || value === "" ? "—" : String(value);
              }}
              nameFields={["name"]}
              emptyMessage="No tasks match the current filters."
            />
          ) : (
            <div className="module-tile-grid">
              {rows.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className={`module-tile text-start${selected?.id === task.id ? " is-selected" : ""}`}
                  onClick={() => {
                    setSelected(task);
                    setPanelError(null);
                    setPanelNotice(null);
                    dependencyForm.reset({ predecessorTaskId: "" });
                    assignForm.reset({
                      assignedResourceId: task.assignedResourceId ?? "",
                    });
                  }}
                >
                  <div className="tile-title">{task.name}</div>
                  <div className="small text-muted">
                    {task.status} · {task.priority ?? "—"}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selected ? (
            <aside className="module-detail-drawer">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <div className="fw-semibold">{selectedTask?.name ?? selected.name}</div>
                  <div className="text-muted small">
                    <StatusBadge status={selectedTask?.status ?? selected.status} />
                  </div>
                </div>
                <div className="d-flex gap-2">
                  {canDelete ? (
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => setConfirmTaskDelete(true)}
                    >
                      Delete
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setSelected(null)}
                  >
                    Close
                  </button>
                </div>
              </div>

              {panelError ? <div className="alert alert-danger py-2">{panelError}</div> : null}
              {panelNotice ? <div className="alert alert-success py-2">{panelNotice}</div> : null}
              {taskDetailQuery.error ? (
                <div className="alert alert-warning py-2" role="status">Could not refresh task details. Showing the list record.</div>
              ) : null}
              {selectedTask ? (
                <dl className="row small mb-3 border-top border-bottom py-3">
                  <dt className="col-5 text-muted">Description</dt>
                  <dd className="col-7">{selectedTask.description || "—"}</dd>
                  <dt className="col-5 text-muted">Start date</dt>
                  <dd className="col-7">{selectedTask.startDate || "—"}</dd>
                  <dt className="col-5 text-muted">Due date</dt>
                  <dd className="col-7">{selectedTask.dueDate || "—"}</dd>
                  <dt className="col-5 text-muted">Hours</dt>
                  <dd className="col-7">{selectedTask.actualHours ?? 0} actual / {selectedTask.estimatedHours ?? "—"} estimated</dd>
                  <dt className="col-5 text-muted">Completion</dt>
                  <dd className="col-7">{selectedTask.completionPercentage ?? 0}%</dd>
                </dl>
              ) : null}

              {canUpdate ? (
                <div className="mb-3">
                  <div className="form-label">Update status</div>
                  <div className="d-flex flex-wrap gap-1">
                    {TASK_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        disabled={status === selected.status || statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({ id: selected.id, status })
                        }
                      >
                        {status === "COMPLETED" ? "Complete" : status}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {canAssign ? (
                <form
                  className="mb-3 border-top pt-3"
                  onSubmit={assignForm.handleSubmit((values) =>
                    assignMutation.mutate({
                      id: selected.id,
                      assignedResourceId: values.assignedResourceId,
                    }),
                  )}
                >
                  <label className="form-label required">Assign resource</label>
                  <TechEarnestFormSelect
                    control={assignForm.control}
                    name="assignedResourceId"
                    options={resourceOptions}
                    searchPlaceholder="Search resources"
                    placeholder="Select a resource"
                    allowEmpty={false}
                    invalid={!!assignForm.formState.errors.assignedResourceId}
                  />
                  {assignForm.formState.errors.assignedResourceId ? (
                    <div className="invalid-feedback d-block">{assignForm.formState.errors.assignedResourceId.message}</div>
                  ) : null}
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={assignMutation.isPending}
                  >
                    Assign
                  </button>
                </form>
              ) : null}

              {canUpdate ? (
                <form
                  className="mb-3 border-top pt-3"
                  onSubmit={dependencyForm.handleSubmit((values) =>
                    dependencyMutation.mutate({
                      taskId: selected.id,
                      predecessorTaskId: values.predecessorTaskId,
                    }),
                  )}
                >
                  <label className="form-label required">Depends on</label>
                  <TechEarnestFormSelect
                    control={dependencyForm.control}
                    name="predecessorTaskId"
                    options={dependencyOptions}
                    searchPlaceholder="Search project tasks"
                    placeholder={dependencyCandidatesQuery.isLoading ? "Loading tasks…" : "Select a predecessor task"}
                    allowEmpty={false}
                    invalid={!!dependencyForm.formState.errors.predecessorTaskId}
                    disabled={dependencyCandidatesQuery.isLoading || dependencyOptions.length === 0}
                  />
                  {dependencyForm.formState.errors.predecessorTaskId ? (
                    <div className="invalid-feedback d-block">{dependencyForm.formState.errors.predecessorTaskId.message}</div>
                  ) : null}
                  {!dependencyCandidatesQuery.isLoading && dependencyOptions.length === 0 ? (
                    <div className="form-text">There are no other tasks in this project yet.</div>
                  ) : null}
                  <button
                    type="submit"
                    className="btn btn-outline-primary btn-sm mt-2"
                    disabled={dependencyMutation.isPending || dependencyOptions.length === 0}
                  >
                    {dependencyMutation.isPending ? "Adding…" : "Add dependency"}
                  </button>
                </form>
              ) : null}

              <div className="border-top pt-3">
                <h2 className="h6">Comments</h2>
                <ul className="list-unstyled small mb-3">
                  {(commentsQuery.data ?? []).map((comment) => (
                    <li key={comment.id} className="mb-2">
                      <div>{comment.body}</div>
                      <div className="text-muted">
                        {comment.authorId.slice(0, 8)} ·{" "}
                        {new Date(comment.createdAt).toLocaleString()}
                      </div>
                    </li>
                  ))}
                  {!commentsQuery.data?.length ? (
                    <li className="text-muted">No comments yet</li>
                  ) : null}
                </ul>
                {canUpdate ? (
                  <form
                    onSubmit={commentForm.handleSubmit((values) =>
                      commentMutation.mutate({ id: selected.id, body: values.body }),
                    )}
                  >
                    <FormField
                      label="Add comment"
                      required
                      error={commentForm.formState.errors.body}
                      {...commentForm.register("body")}
                    />
                    <button
                      type="submit"
                      className="btn btn-outline-primary btn-sm"
                      disabled={commentMutation.isPending}
                    >
                      Post comment
                    </button>
                  </form>
                ) : null}
              </div>
            </aside>
          ) : null}
        </div>
      ) : null}
    </ModuleListShell>
      )}
      {confirmTaskDelete && selected && canDelete ? (
        <div className="module-modal-backdrop" role="presentation" onClick={() => deleteMutation.isPending ? null : setConfirmTaskDelete(false)}>
          <section className="module-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-task-title" onClick={(event) => event.stopPropagation()}>
            <header className="d-flex align-items-center justify-content-between gap-3 mb-3">
              <h2 id="delete-task-title" className="h5 mb-0">Delete task?</h2>
              <button type="button" className="btn-close" aria-label="Close" disabled={deleteMutation.isPending} onClick={() => setConfirmTaskDelete(false)} />
            </header>
            <p>Delete <strong>{selected.name}</strong>? The task will be soft-deleted and removed from active lists.</p>
            {panelError ? <div className="alert alert-danger py-2" role="alert">{panelError}</div> : null}
            <footer className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={deleteMutation.isPending} onClick={() => setConfirmTaskDelete(false)}>Cancel</button>
              <button type="button" className="btn btn-danger btn-sm" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(selected.id)}>
                {deleteMutation.isPending ? "Deleting…" : "Delete task"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
