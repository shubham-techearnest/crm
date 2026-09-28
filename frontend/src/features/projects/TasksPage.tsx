import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { listResources } from "@/features/resources/resourceApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import {
  addComment,
  assignTask,
  createTask,
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

export function TasksPage() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission("TASK_CREATE");
  const canUpdate = useHasPermission("TASK_UPDATE");
  const canAssign = useHasPermission("TASK_ASSIGN");
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

  const tasksQuery = useQuery({
    queryKey: ["tasks", listParams],
    queryFn: () => listTasks(listParams),
  });

  const commentsQuery = useQuery({
    queryKey: ["tasks", selected?.id, "comments"],
    queryFn: () => listComments(selected!.id),
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
  } = useZohoCreateFlow<CreateFormValues, ProjectTask>({
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
      setSelected(task);
      setPanelError(null);
    },
    onError: () => setPanelError("Could not update task status."),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, assignedResourceId }: { id: string; assignedResourceId: string }) =>
      assignTask(id, { assignedResourceId }),
    onSuccess: async (task) => {
      await refreshTasks();
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
        <ZohoFormKitCreateView
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
              <ZohoFormSelect
                control={createForm.control}
                name="status"
                options={taskStatusOptions}
                searchPlaceholder="Search Statuses"
                allowEmpty={false}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Priority</label>
              <ZohoFormSelect
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
                <FormField
                  label="Assigned resource ID"
                  {...createForm.register("assignedResourceId")}
                />
              </div>
              <div className="col-12">
                <FormField label="Description" {...createForm.register("description")} />
              </div>
            </FormSection>
          </FormMoreDetails>
        </ZohoFormKitCreateView>
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
            <label className="form-label small mb-1">Project</label>
            <select
              className="form-select form-select-sm mb-2"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setSelected(null);
                setShowForm(false);
                setPanelError(null);
              }}
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
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <label className="form-label small mb-1">Priority</label>
            <select
              className="form-select form-select-sm mb-2"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="">All</option>
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
            <label className="form-label small mb-1">Assignee</label>
            <select
              className="form-select form-select-sm mb-2"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
            >
              <option value="">All</option>
              {(resourcesQuery.data ?? []).map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.employeeCode ?? resource.designation ?? resource.id.slice(0, 8)}
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
            <div className="module-list-table-wrap">
              <table className="table module-list-table align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Due</th>
                    <th>Assignee</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((task) => (
                    <tr
                      key={task.id}
                      className={selected?.id === task.id ? "is-selected" : undefined}
                      onClick={() => {
                        setSelected(task);
                        setPanelError(null);
                        assignForm.reset({
                          assignedResourceId: task.assignedResourceId ?? "",
                        });
                      }}
                    >
                      <td className="lead-name">{task.name}</td>
                      <td>
                        <StatusBadge status={task.status} />
                      </td>
                      <td>{task.priority ?? "—"}</td>
                      <td>{task.dueDate ?? "—"}</td>
                      <td>
                        {task.assignedResourceId
                          ? task.assignedResourceId.slice(0, 8)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-5">
                        No tasks match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
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
                  <div className="fw-semibold">{selected.name}</div>
                  <div className="text-muted small">
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

              {panelError ? <div className="alert alert-danger py-2">{panelError}</div> : null}

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
                  <FormField
                    label="Assign resource UUID"
                    required
                    error={assignForm.formState.errors.assignedResourceId}
                    {...assignForm.register("assignedResourceId")}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={assignMutation.isPending}
                  >
                    Assign
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
    </>
  );
}
