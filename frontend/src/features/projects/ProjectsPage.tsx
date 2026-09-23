import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormActions, FormMoreDetails, FormSection, UnsavedGuard } from "@/components/FormKit";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listRegions, listUsers } from "@/features/admin/adminApi";
import { listAccounts } from "@/features/crm/crmApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import {
  createMilestone,
  createProject,
  createTask,
  listMilestones,
  listProjects,
  listTasks,
  type Project,
} from "./projectApi";

const BILLING_TYPES = ["FIXED_PRICE", "HOURLY", "MILESTONE", "RETAINER"] as const;
const PROJECT_STATUSES = ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
const PROJECT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const projectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  projectCode: z.string().min(1, "Code is required").max(64),
  accountId: z.string().min(1, "Account is required"),
  regionId: z.string().min(1, "Region is required"),
  billingType: z.string().min(1, "Billing type is required"),
  status: z.string().min(1),
  projectManagerId: z.string().optional(),
  description: z.string().optional(),
  priority: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.string().optional(),
  estimatedHours: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

const PROJECT_DEFAULTS: ProjectFormValues = {
  name: "",
  projectCode: "",
  accountId: "",
  regionId: "",
  projectManagerId: "",
  billingType: "FIXED_PRICE",
  status: "PLANNED",
  description: "",
  priority: "MEDIUM",
  startDate: "",
  endDate: "",
  budget: "",
  estimatedHours: "",
};

function parseOptionalNumber(value?: string): number | undefined {
  if (!value?.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

const milestoneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  dueDate: z.string().optional(),
  status: z.string().optional(),
});

type MilestoneFormValues = z.infer<typeof milestoneSchema>;

const taskSchema = z.object({
  name: z.string().min(1, "Name is required"),
  status: z.string().optional(),
  priority: z.string().optional(),
  dueDate: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const canCreate = useHasPermission("PROJECT_CREATE");
  const canManageMilestone = useHasPermission("MILESTONE_MANAGE");
  const canCreateTask = useHasPermission("TASK_CREATE");
  const canViewUsers = useHasPermission("USER_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [startFrom, setStartFrom] = useState("");
  const [endTo, setEndTo] = useState("");
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [selected, setSelected] = useState<Project | null>(null);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [saveAndNew, setSaveAndNew] = useState(false);

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter || undefined,
      accountId: accountFilter || undefined,
      projectManagerId: managerFilter || undefined,
      startFrom: startFrom || undefined,
      endTo: endTo || undefined,
      delayedOnly: delayedOnly || undefined,
    }),
    [search, statusFilter, accountFilter, managerFilter, startFrom, endTo, delayedOnly],
  );

  const projectsQuery = useQuery({
    queryKey: ["projects", listParams],
    queryFn: () => listProjects(listParams),
  });
  const accountsQuery = useQuery({ queryKey: ["crm", "accounts"], queryFn: () => listAccounts() });
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: canViewUsers,
  });
  const milestonesQuery = useQuery({
    queryKey: ["projects", selected?.id, "milestones"],
    queryFn: () => listMilestones(selected!.id),
    enabled: !!selected,
  });
  const tasksQuery = useQuery({
    queryKey: ["projects", selected?.id, "tasks"],
    queryFn: () => listTasks(selected!.id),
    enabled: !!selected,
  });

  const rows = projectsQuery.data ?? [];
  const activeFilterCount = [
    search,
    statusFilter,
    accountFilter,
    managerFilter,
    startFrom,
    endTo,
    delayedOnly ? "1" : "",
  ].filter(Boolean).length;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: PROJECT_DEFAULTS,
  });

  const buildProjectBody = (values: ProjectFormValues) => ({
    name: values.name,
    projectCode: values.projectCode,
    accountId: values.accountId,
    regionId: values.regionId,
    projectManagerId: values.projectManagerId || undefined,
    billingType: values.billingType,
    status: values.status || "PLANNED",
    description: values.description || undefined,
    priority: values.priority || undefined,
    startDate: values.startDate || undefined,
    endDate: values.endDate || undefined,
    budget: parseOptionalNumber(values.budget) ?? null,
    estimatedHours: parseOptionalNumber(values.estimatedHours) ?? null,
  });

  const milestoneForm = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneSchema),
    defaultValues: { name: "", dueDate: "", status: "PLANNED" },
  });

  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { name: "", status: "TODO", priority: "MEDIUM", dueDate: "" },
  });

  const refreshProjects = async () => {
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const refreshSelected = async () => {
    if (!selected) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["projects", selected.id, "milestones"] }),
      queryClient.invalidateQueries({ queryKey: ["projects", selected.id, "tasks"] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: async () => {
      await refreshProjects();
      setFormError(null);
      if (saveAndNew) {
        reset(PROJECT_DEFAULTS);
        setSaveAndNew(false);
        setShowMore(false);
      } else {
        reset(PROJECT_DEFAULTS);
        setShowForm(false);
        setShowMore(false);
      }
    },
    onError: () => setFormError("Could not create project. Check required fields."),
  });

  const milestoneMutation = useMutation({
    mutationFn: (body: Parameters<typeof createMilestone>[1]) =>
      createMilestone(selected!.id, body),
    onSuccess: async () => {
      await refreshSelected();
      milestoneForm.reset({ name: "", dueDate: "", status: "PLANNED" });
      setShowMilestoneForm(false);
      setInlineError(null);
    },
    onError: () => setInlineError("Could not create milestone."),
  });

  const taskMutation = useMutation({
    mutationFn: (body: Parameters<typeof createTask>[1]) => createTask(selected!.id, body),
    onSuccess: async () => {
      await refreshSelected();
      taskForm.reset({ name: "", status: "TODO", priority: "MEDIUM", dueDate: "" });
      setShowTaskForm(false);
      setInlineError(null);
    },
    onError: () => setInlineError("Could not create task."),
  });

  const accountName = (id: string) =>
    accountsQuery.data?.find((a) => a.id === id)?.name ?? id.slice(0, 8);

  return (
    <ModuleListShell
      title="Projects"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Projects</span>}
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
        canCreate ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Create Project"}
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Projects by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or code"
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
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <label className="form-label small mb-1">Account</label>
            <select
              className="form-select form-select-sm mb-2"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
            >
              <option value="">All</option>
              {(accountsQuery.data ?? []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            {canViewUsers ? (
              <>
                <label className="form-label small mb-1">Manager</label>
                <select
                  className="form-select form-select-sm mb-2"
                  value={managerFilter}
                  onChange={(e) => setManagerFilter(e.target.value)}
                >
                  <option value="">All</option>
                  {auth.userId ? <option value={auth.userId}>Current user</option> : null}
                  {(usersQuery.data ?? []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <label className="form-label small mb-1">Start from</label>
            <input
              className="form-control form-control-sm mb-2"
              type="date"
              value={startFrom}
              onChange={(e) => setStartFrom(e.target.value)}
            />
            <label className="form-label small mb-1">End to</label>
            <input
              className="form-control form-control-sm mb-2"
              type="date"
              value={endTo}
              onChange={(e) => setEndTo(e.target.value)}
            />
            <div className="form-check">
              <input
                id="delayedOnly"
                className="form-check-input"
                type="checkbox"
                checked={delayedOnly}
                onChange={(e) => setDelayedOnly(e.target.checked)}
              />
              <label className="form-check-label small" htmlFor="delayedOnly">
                Delayed only
              </label>
            </div>
          </div>
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {showForm ? (
        <form
          className="border-bottom p-3 bg-white"
          onSubmit={handleSubmit((values) => createMutation.mutate(buildProjectBody(values)))}
        >
          <UnsavedGuard when={isDirty && showForm} />
          {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
          <FormSection title="Primary details" description="Identity, account, and billing">
            <div className="col-md-4">
              <FormField label="Name" required error={errors.name} {...register("name")} />
            </div>
            <div className="col-md-2">
              <FormField
                label="Project code"
                required
                error={errors.projectCode}
                {...register("projectCode")}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label required">Account</label>
              <select className="form-select" {...register("accountId")}>
                <option value="">Select account</option>
                {(accountsQuery.data ?? []).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              {errors.accountId ? (
                <div className="invalid-feedback d-block">{errors.accountId.message}</div>
              ) : null}
            </div>
            <div className="col-md-3">
              <label className="form-label required">Region</label>
              <select className="form-select" {...register("regionId")}>
                <option value="">Select region</option>
                {(regionsQuery.data ?? []).map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
              {errors.regionId ? (
                <div className="invalid-feedback d-block">{errors.regionId.message}</div>
              ) : null}
            </div>
            <div className="col-md-3">
              <label className="form-label required">Billing type</label>
              <select className="form-select" {...register("billingType")}>
                {BILLING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Status</label>
              <select className="form-select" {...register("status")}>
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </FormSection>
          <FormMoreDetails open={showMore} onToggle={() => setShowMore((v) => !v)}>
            <FormSection title="Schedule & planning">
              <div className="col-md-3">
                <FormField
                  label="Project manager ID"
                  error={errors.projectManagerId}
                  {...register("projectManagerId")}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">Priority</label>
                <select className="form-select" {...register("priority")}>
                  {PROJECT_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <FormField label="Start date" type="date" {...register("startDate")} />
              </div>
              <div className="col-md-2">
                <FormField label="End date" type="date" {...register("endDate")} />
              </div>
              <div className="col-md-2">
                <FormField label="Budget" type="number" error={errors.budget} {...register("budget")} />
              </div>
              <div className="col-md-2">
                <FormField
                  label="Estimated hours"
                  type="number"
                  error={errors.estimatedHours}
                  {...register("estimatedHours")}
                />
              </div>
              <div className="col-12">
                <FormField label="Description" error={errors.description} {...register("description")} />
              </div>
            </FormSection>
          </FormMoreDetails>
          <FormActions
            submitLabel="Save"
            showSaveAndNew
            submitting={isSubmitting || createMutation.isPending}
            onSaveAndNew={() => {
              setSaveAndNew(true);
              void handleSubmit((values) => createMutation.mutate(buildProjectBody(values)))();
            }}
            onCancel={() => {
              if (isDirty && !window.confirm("Discard unsaved changes?")) return;
              setShowForm(false);
              setShowMore(false);
              reset(PROJECT_DEFAULTS);
            }}
          />
        </form>
      ) : null}

      {projectsQuery.isLoading ? <LoadingState label="Loading projects..." /> : null}
      {projectsQuery.error ? <ErrorState title="Unable to load projects" message="Try again." /> : null}

      {!projectsQuery.isLoading && !projectsQuery.error ? (
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
                    <th>Code</th>
                    <th>Account</th>
                    <th>Status</th>
                    <th>Health</th>
                    <th>Billing</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((project) => (
                    <tr
                      key={project.id}
                      className={selected?.id === project.id ? "is-selected" : undefined}
                      onClick={() => {
                        setSelected(project);
                        setShowMilestoneForm(false);
                        setShowTaskForm(false);
                        setInlineError(null);
                      }}
                    >
                      <td className="lead-name">{project.name}</td>
                      <td>{project.projectCode}</td>
                      <td>{accountName(project.accountId)}</td>
                      <td>
                        <StatusBadge status={project.status} />
                      </td>
                      <td>
                        <StatusBadge status={project.health ?? "ON_TRACK"} />
                      </td>
                      <td>{project.billingType}</td>
                      <td>
                        {project.progressPercent != null ? `${project.progressPercent}%` : "—"}
                      </td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-5">
                        No projects match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="module-tile-grid">
              {rows.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={`module-tile text-start${selected?.id === project.id ? " is-selected" : ""}`}
                  onClick={() => {
                    setSelected(project);
                    setShowMilestoneForm(false);
                    setShowTaskForm(false);
                    setInlineError(null);
                  }}
                >
                  <div className="tile-title">{project.name}</div>
                  <div className="small text-muted">
                    {project.projectCode} · {project.status}
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
                  <div className="text-muted small">{selected.projectCode}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
              <p className="small mb-1">
                Status: <StatusBadge status={selected.status} />
              </p>
              <p className="small mb-3">
                Progress:{" "}
                {selected.progressPercent != null ? `${selected.progressPercent}%` : "—"}
              </p>

              {inlineError ? <div className="alert alert-danger py-2">{inlineError}</div> : null}

              <div className="d-flex gap-2 mb-3">
                {canManageMilestone ? (
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => {
                      setShowMilestoneForm((v) => !v);
                      setShowTaskForm(false);
                    }}
                  >
                    {showMilestoneForm ? "Cancel" : "Add milestone"}
                  </button>
                ) : null}
                {canCreateTask ? (
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => {
                      setShowTaskForm((v) => !v);
                      setShowMilestoneForm(false);
                    }}
                  >
                    {showTaskForm ? "Cancel" : "Add task"}
                  </button>
                ) : null}
              </div>

              {showMilestoneForm ? (
                <form
                  className="border-top pt-3 mb-3"
                  onSubmit={milestoneForm.handleSubmit((values) =>
                    milestoneMutation.mutate({
                      name: values.name,
                      dueDate: values.dueDate || undefined,
                      status: values.status || "PLANNED",
                    }),
                  )}
                >
                  <FormField
                    label="Milestone name"
                    required
                    error={milestoneForm.formState.errors.name}
                    {...milestoneForm.register("name")}
                  />
                  <FormField label="Due date" type="date" {...milestoneForm.register("dueDate")} />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={milestoneMutation.isPending}
                  >
                    Create milestone
                  </button>
                </form>
              ) : null}

              {showTaskForm ? (
                <form
                  className="border-top pt-3 mb-3"
                  onSubmit={taskForm.handleSubmit((values) =>
                    taskMutation.mutate({
                      name: values.name,
                      status: values.status || "TODO",
                      priority: values.priority || undefined,
                      dueDate: values.dueDate || undefined,
                    }),
                  )}
                >
                  <FormField
                    label="Task name"
                    required
                    error={taskForm.formState.errors.name}
                    {...taskForm.register("name")}
                  />
                  <label className="form-label">Status</label>
                  <select className="form-select mb-2" {...taskForm.register("status")}>
                    <option value="TODO">TODO</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="BLOCKED">BLOCKED</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={taskMutation.isPending}
                  >
                    Create task
                  </button>
                </form>
              ) : null}

              <h2 className="h6">Milestones ({milestonesQuery.data?.length ?? 0})</h2>
              <ul className="list-unstyled small mb-3">
                {(milestonesQuery.data ?? []).map((m) => (
                  <li key={m.id} className="mb-1">
                    {m.name} — <StatusBadge status={m.status} />
                    {m.dueDate ? ` · ${m.dueDate}` : ""}
                  </li>
                ))}
                {!milestonesQuery.data?.length ? (
                  <li className="text-muted">No milestones</li>
                ) : null}
              </ul>

              <h2 className="h6">Tasks ({tasksQuery.data?.length ?? 0})</h2>
              <ul className="list-unstyled small mb-0">
                {(tasksQuery.data ?? []).map((t) => (
                  <li key={t.id} className="mb-1">
                    {t.name} — <StatusBadge status={t.status} />
                  </li>
                ))}
                {!tasksQuery.data?.length ? <li className="text-muted">No tasks</li> : null}
              </ul>
            </aside>
          ) : null}
        </div>
      ) : null}
    </ModuleListShell>
  );
}
