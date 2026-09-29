import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { ACCESS_TOKEN_KEY } from "@/api/client";
import { FormField } from "@/components/FormField/FormField";
import {
  TechEarnestCreateColumn,
  TechEarnestCreateField,
  TechEarnestCreateGrid,
  TechEarnestCreateSection,
  TechEarnestFormKitCreateView,
  TechEarnestFormUserSelect,
  useTechEarnestCreateFlow,
  TechEarnestFormSelect,
  enumPickerOptions,
  optionsFromPairs,
} from "@/components/TechEarnestCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import {
  ModuleListShell,
  countActiveFilters,
} from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { TechEarnestFilterSelect } from "@/components/TechEarnestCreate/TechEarnestFilterSelect";
import {
  RecordShell,
  DEFAULT_RELATED_LINKS,
  RecordOverviewField,
  RecordOverviewGrid,
  RecordSection,
  recordAuditTab,
  recordCustomTab,
  recordDocumentsTab,
  recordNotesTab,
  recordOverviewTab,
  recordRelatedTab,
  recordTimelineTab,
} from "@/components/RecordShell";
import { buildTimelineEntries, recordLifecycleInfo, useRecordNavigation, TechEarnestRecordTimeline } from "@/components/TechEarnestRecord";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listAuditLogs, listRegions, listUsers } from "@/features/admin/adminApi";
import { getAccount, listAccounts, listActivities } from "@/features/crm/crmApi";
import {
  createNote,
  deleteNote,
  documentDownloadUrl,
  listDocuments,
  listNotes,
  uploadDocument,
} from "@/features/crm/foundationApi";
import { listExpenses } from "@/features/expenses/expenseApi";
import { listInvoices, listUnbilledTime } from "@/features/finance/invoiceApi";
import { listPurchaseOrders } from "@/features/procurement/purchaseOrdersApi";
import { listAllocations, listResources } from "@/features/resources/resourceApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { useBulkImport } from "@/features/import/useBulkImport";
import {
  createMilestone,
  createProject,
  createTask,
  deleteProject,
  getProject,
  listMilestones,
  listProjects,
  listTasks,
  updateProject,
  type Project,
} from "./projectApi";

const BILLING_TYPES = ["FIXED_PRICE", "HOURLY", "MILESTONE", "RETAINER"] as const;
const PROJECT_STATUSES = ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
const PROJECT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const billingTypeOptions = enumPickerOptions(BILLING_TYPES);
const projectStatusOptions = enumPickerOptions(PROJECT_STATUSES);
const projectPriorityOptions = enumPickerOptions(PROJECT_PRIORITIES);

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

function formatMoney(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatHours(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  const canCreate = useHasPermission("PROJECT_CREATE");
  const canUpdateProject = useHasPermission("PROJECT_UPDATE");
  const canDeleteProject = useHasPermission("PROJECT_DELETE");
  const canManageMilestone = useHasPermission("MILESTONE_MANAGE");
  const canCreateTask = useHasPermission("TASK_CREATE");
  const canViewUsers = useHasPermission("USER_VIEW");
  const canViewAllocations = useHasPermission("ALLOCATION_VIEW");
  const canViewResources = useHasPermission("RESOURCE_VIEW");
  const canViewInvoices = useHasPermission("INVOICE_VIEW");
  const canViewPurchaseOrders = useHasPermission("PO_VIEW");
  const canViewExpenses = useHasPermission("EXPENSE_VIEW");
  const canViewActivities = useHasPermission("ACTIVITY_VIEW");
  const canViewNotes = useHasPermission("NOTE_VIEW");
  const canCreateNotes = useHasPermission("NOTE_CREATE");
  const canDeleteNotes = useHasPermission("NOTE_DELETE");
  const canViewDocs = useHasPermission("DOCUMENT_VIEW");
  const canUploadDocs = useHasPermission("DOCUMENT_UPLOAD");
  const canViewAudit = useHasPermission("AUDIT_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [startFrom, setStartFrom] = useState("");
  const [endTo, setEndTo] = useState("");
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [selected, setSelected] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [confirmProjectDelete, setConfirmProjectDelete] = useState(false);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");

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
  const projectRecordQuery = useQuery({
    queryKey: ["projects", "record", selected?.id],
    queryFn: () => getProject(selected!.id),
    enabled: !!selected,
  });
  useEffect(() => {
    if (projectRecordQuery.data && selected?.id === projectRecordQuery.data.id) {
      setSelected((current) =>
        current?.id === projectRecordQuery.data!.id ? projectRecordQuery.data! : current,
      );
    }
  }, [projectRecordQuery.data, selected?.id]);
  const accountsQuery = useQuery({ queryKey: ["crm", "accounts"], queryFn: () => listAccounts() });
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: canViewUsers,
  });
  const milestonesQuery = useQuery({
    queryKey: ["projects", (selected as Project | null)?.id, "milestones"],
    queryFn: () => listMilestones(selected!.id),
    enabled: !!selected,
  });
  const tasksQuery = useQuery({
    queryKey: ["projects", (selected as Project | null)?.id, "tasks"],
    queryFn: () => listTasks(selected!.id),
    enabled: !!selected,
  });
  const accountQuery = useQuery({
    queryKey: ["crm", "accounts", selected?.accountId],
    queryFn: () => getAccount(selected!.accountId),
    enabled: !!selected,
  });
  const allocationsQuery = useQuery({
    queryKey: ["allocations", "project", (selected as Project | null)?.id],
    queryFn: () => listAllocations({ projectId: selected!.id }),
    enabled: !!selected && canViewAllocations,
  });
  const resourcesQuery = useQuery({
    queryKey: ["resources"],
    queryFn: () => listResources(),
    enabled: !!selected && canViewResources,
  });
  const invoicesQuery = useQuery({
    queryKey: ["invoices", "project", (selected as Project | null)?.id],
    queryFn: () => listInvoices({ projectId: selected!.id }),
    enabled: !!selected && canViewInvoices,
  });
  const unbilledTimeQuery = useQuery({
    queryKey: ["invoices", "unbilled-time", (selected as Project | null)?.id],
    queryFn: () => listUnbilledTime(selected!.id),
    enabled: !!selected && canViewInvoices,
  });
  const purchaseOrdersQuery = useQuery({
    queryKey: ["purchase-orders", "project", (selected as Project | null)?.id],
    queryFn: () => listPurchaseOrders({ projectId: selected!.id }),
    enabled: !!selected && canViewPurchaseOrders,
  });
  const expensesQuery = useQuery({
    queryKey: ["expenses", "project", (selected as Project | null)?.id],
    queryFn: () => listExpenses({ projectId: selected!.id }),
    enabled: !!selected && canViewExpenses,
  });
  const activitiesQuery = useQuery({
    queryKey: ["crm", "activities", "PROJECT", (selected as Project | null)?.id],
    queryFn: () => listActivities({ relatedEntityType: "PROJECT", relatedEntityId: selected!.id }),
    enabled: !!selected && canViewActivities,
  });
  const notesQuery = useQuery({
    queryKey: ["crm", "notes", "PROJECT", (selected as Project | null)?.id],
    queryFn: () => listNotes("PROJECT", selected!.id),
    enabled: !!selected && canViewNotes,
  });
  const docsQuery = useQuery({
    queryKey: ["crm", "documents", "PROJECT", (selected as Project | null)?.id],
    queryFn: () => listDocuments("PROJECT", selected!.id),
    enabled: !!selected && canViewDocs,
  });
  const auditQuery = useQuery({
    queryKey: ["admin", "audit-logs", "PROJECT", (selected as Project | null)?.id],
    queryFn: () => listAuditLogs({ entityType: "PROJECT", entityId: selected!.id, size: 30 }),
    enabled: !!selected && canViewAudit,
  });

  const rows = projectsQuery.data ?? [];
  const recordNav = useRecordNavigation(rows, selected, setSelected);
  const activeFilterCount = countActiveFilters(
    search,
    statusFilter,
    accountFilter,
    managerFilter,
    startFrom,
    endTo,
    delayedOnly ? "1" : "",
  );
  const bulkImport = useBulkImport("projects", () => queryClient.invalidateQueries({ queryKey: ["projects"] }));

  function openCreateProject() {
    setEditingProject(null);
    reset(PROJECT_DEFAULTS);
    setShowForm(true);
  }

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: PROJECT_DEFAULTS,
  });

  const {
    setSaveAndNew,
    photo,
    cancelCreate,
    afterCreateSuccess,
  } = useTechEarnestCreateFlow({
    defaults: PROJECT_DEFAULTS,
    reset,
    setShowForm,
    setFormError,
    setSelected: (entity) => setSelected(entity as Project),
  });

  useEffect(() => {
    if (searchParams.get("create") === "1" && canCreate) {
      setSelected(null);
      setEditingProject(null);
      setFormError(null);
      reset(PROJECT_DEFAULTS);
      setShowForm(true);
    }
  }, [searchParams, canCreate, reset, setShowForm]);

  const accountOptions = useMemo(
    () => optionsFromPairs((accountsQuery.data ?? []).map((account) => ({ value: account.id, label: account.name }))),
    [accountsQuery.data],
  );
  const managerFilterOptions = useMemo(
    () => optionsFromPairs([
      ...(auth.userId ? [{ value: auth.userId, label: "Current user" }] : []),
      ...(usersQuery.data ?? []).map((user) => ({ value: user.id, label: `${user.firstName} ${user.lastName}`.trim(), subtitle: user.email ?? undefined })),
    ]),
    [auth.userId, usersQuery.data],
  );
  const regionOptions = useMemo(
    () => optionsFromPairs((regionsQuery.data ?? []).map((region) => ({ value: region.id, label: region.name }))),
    [regionsQuery.data],
  );

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
      queryClient.invalidateQueries({ queryKey: ["allocations", "project", selected.id] }),
      queryClient.invalidateQueries({ queryKey: ["invoices", "project", selected.id] }),
      queryClient.invalidateQueries({ queryKey: ["invoices", "unbilled-time", selected.id] }),
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", "project", selected.id] }),
      queryClient.invalidateQueries({ queryKey: ["expenses", "project", selected.id] }),
      queryClient.invalidateQueries({ queryKey: ["crm", "activities", "PROJECT", selected.id] }),
    ]);
  };

  const noteMutation = useMutation({
    mutationFn: () => createNote("PROJECT", selected!.id, noteBody),
    onSuccess: async () => {
      setNoteBody("");
      await queryClient.invalidateQueries({ queryKey: ["crm", "notes", "PROJECT", selected!.id] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "notes", "PROJECT", selected!.id] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: ProjectFormValues) => {
      const body = buildProjectBody(values);
      if (!editingProject) return createProject(body);
      return updateProject(editingProject.id, {
        regionId: body.regionId,
        accountId: body.accountId,
        projectManagerId: body.projectManagerId,
        name: body.name,
        description: body.description,
        status: body.status,
        priority: body.priority,
        startDate: body.startDate,
        endDate: body.endDate,
        budget: body.budget,
        estimatedHours: body.estimatedHours,
        billingType: body.billingType,
      });
    },
    onSuccess: async (project) => {
      await refreshProjects();
      setFormError(null);
      if (editingProject) {
        setSelected(project);
        setEditingProject(null);
        setShowForm(false);
        reset(PROJECT_DEFAULTS);
      } else {
        await afterCreateSuccess(project, "PROJECT");
      }
    },
    onError: () => setFormError(editingProject ? "Could not update project. Check required fields and permissions." : "Could not create project. Check required fields."),
  });

  const onCreateSubmit = (values: ProjectFormValues) => {
    createMutation.mutate(values);
  };

  const deleteProjectMutation = useMutation({
    mutationFn: () => deleteProject(selected!.id),
    onSuccess: async () => {
      await refreshProjects();
      setConfirmProjectDelete(false);
      setSelected(null);
      setInlineError(null);
    },
    onError: () => setInlineError("Could not delete project. Check linked records and your permission."),
  });

  function openProjectEdit(project: Project) {
    setEditingProject(project);
    setFormError(null);
    reset({
      name: project.name,
      projectCode: project.projectCode,
      accountId: project.accountId,
      regionId: project.regionId,
      projectManagerId: project.projectManagerId ?? "",
      billingType: project.billingType,
      status: project.status,
      description: project.description ?? "",
      priority: project.priority ?? "MEDIUM",
      startDate: project.startDate ?? "",
      endDate: project.endDate ?? "",
      budget: project.budget == null ? "" : String(project.budget),
      estimatedHours: project.estimatedHours == null ? "" : String(project.estimatedHours),
    });
    setShowForm(true);
  }

  function cancelProjectForm() {
    if (editingProject) {
      if (isDirty && !window.confirm("Discard unsaved changes?")) return;
      setEditingProject(null);
      setShowForm(false);
      setFormError(null);
      reset(PROJECT_DEFAULTS);
      return;
    }
    cancelCreate(isDirty);
  }

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

  const userLabel = useMemo(() => {
    const map = new Map(
      (usersQuery.data ?? []).map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]),
    );
    return (id: string | null) => (id ? (map.get(id) ?? id.slice(0, 8)) : "—");
  }, [usersQuery.data]);

  const timelineEntries = useMemo(
    () =>
      buildTimelineEntries(
        auditQuery.data,
        activitiesQuery.data,
        (userId) => (userId === auth.userId ? auth.displayName : userLabel(userId ?? null)),
        recordLifecycleInfo("Project", selected ? { ...selected, ownerId: selected.projectManagerId } : null),
        notesQuery.data,
      ),
    [
      auditQuery.data,
      activitiesQuery.data,
      notesQuery.data,
      auth.displayName,
      auth.userId,
      userLabel,
      selected,
    ],
  );

  const resourceLabel = useMemo(() => {
    const map = new Map(
      (resourcesQuery.data ?? []).map((resource) => [
        resource.id,
        resource.employeeName ?? resource.employeeCode ?? resource.designation ?? resource.id.slice(0, 8),
      ]),
    );
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [resourcesQuery.data]);

  const unbilledHoursTotal = useMemo(
    () => (unbilledTimeQuery.data ?? []).reduce((sum, entry) => sum + entry.hours, 0),
    [unbilledTimeQuery.data],
  );

  return (
    <>
      {showForm && (editingProject ? canUpdateProject : canCreate) ? (
        <TechEarnestFormKitCreateView
          title={editingProject ? "Edit Project" : "Create Project"}
          tableCode="project"
          entityLabel="Project"
          pending={isSubmitting || createMutation.isPending}
          isDirty={isDirty}
          formError={formError}
          onCancel={cancelProjectForm}
          onSave={() => void handleSubmit(onCreateSubmit)()}
          onSaveAndNew={!editingProject ? () => {
            setSaveAndNew(true);
            void handleSubmit(onCreateSubmit)();
          } : undefined}
          onSubmit={() => void handleSubmit(onCreateSubmit)()}
          photo={photo}
        >
          <TechEarnestCreateSection title="Project Information">
            <TechEarnestCreateGrid>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Project Name" required error={errors.name?.message}>
                  <input
                    type="text"
                    className={`form-control form-control-sm${errors.name ? " is-invalid" : ""}`}
                    {...register("name")}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Project Code" required error={errors.projectCode?.message}>
                  <input
                    type="text"
                    maxLength={64}
                    readOnly={!!editingProject}
                    title={editingProject ? "The project code cannot be changed" : undefined}
                    className={`form-control form-control-sm${errors.projectCode ? " is-invalid" : ""}`}
                    {...register("projectCode")}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Account Name" required error={errors.accountId?.message}>
                  <TechEarnestFormSelect
                    control={control}
                    name="accountId"
                    options={accountOptions}
                    searchPlaceholder="Search Accounts"
                    lookupIcon="building"
                    allowEmpty={false}
                    placeholder="Select account"
                    invalid={!!errors.accountId}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Project Manager" error={errors.projectManagerId?.message}>
                  <TechEarnestFormUserSelect
                    control={control}
                    name="projectManagerId"
                    users={usersQuery.data ?? []}
                    searchPlaceholder="Search Users"
                    placeholder={canViewUsers ? "Select project manager" : "Users are not available"}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Region" required error={errors.regionId?.message}>
                  <TechEarnestFormSelect
                    control={control}
                    name="regionId"
                    options={regionOptions}
                    searchPlaceholder="Search Regions"
                    lookupIcon="building"
                    allowEmpty={false}
                    placeholder="Select region"
                    invalid={!!errors.regionId}
                  />
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Billing Type" required error={errors.billingType?.message}>
                  <TechEarnestFormSelect
                    control={control}
                    name="billingType"
                    options={billingTypeOptions}
                    searchPlaceholder="Search Billing Types"
                    allowEmpty={false}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Status">
                  <TechEarnestFormSelect
                    control={control}
                    name="status"
                    options={projectStatusOptions}
                    searchPlaceholder="Search Statuses"
                    allowEmpty={false}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Priority">
                  <TechEarnestFormSelect
                    control={control}
                    name="priority"
                    options={projectPriorityOptions}
                    searchPlaceholder="Search Priorities"
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Start Date">
                  <input type="date" className="form-control form-control-sm" {...register("startDate")} />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="End Date">
                  <input type="date" className="form-control form-control-sm" {...register("endDate")} />
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
            </TechEarnestCreateGrid>
          </TechEarnestCreateSection>
          <TechEarnestCreateSection title="Budget & Effort">
            <TechEarnestCreateGrid>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Budget" error={errors.budget?.message}>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text">Rs.</span>
                    <input type="number" min={0} step="0.01" className="form-control" {...register("budget")} />
                  </div>
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Estimated Hours" error={errors.estimatedHours?.message}>
                  <input type="number" min={0} step="0.5" className="form-control form-control-sm" {...register("estimatedHours")} />
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
            </TechEarnestCreateGrid>
          </TechEarnestCreateSection>
          <TechEarnestCreateSection title="Description Information">
            <TechEarnestCreateField label="Description" wide error={errors.description?.message}>
              <textarea rows={4} className="form-control form-control-sm" {...register("description")} />
            </TechEarnestCreateField>
          </TechEarnestCreateSection>
        </TechEarnestFormKitCreateView>
      ) : selected ? (
        <RecordShell
              title={selected.name}
              subtitle={selected.projectCode}
              meta={
                <span className="text-muted small">
                  {accountName(selected.accountId)} · {selected.billingType}
                </span>
              }
              status={
                <>
                  <StatusBadge status={selected.status} />
                  {selected.health ? (
                    <span className="ms-1">
                      <StatusBadge status={selected.health} />
                    </span>
                  ) : null}
                </>
              }
              recordKey={selected.id}
              layout="page"
              avatarLabel={selected.name}
              onBack={() => {
                setSelected(null);
                setShowMilestoneForm(false);
                setShowTaskForm(false);
                setInlineError(null);
              }}
              onPrev={recordNav.goPrev}
              onNext={recordNav.goNext}
              hasPrev={recordNav.hasPrev}
              hasNext={recordNav.hasNext}
              relatedLinks={[...DEFAULT_RELATED_LINKS]}
              primaryAction={canUpdateProject ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => openProjectEdit(selected)}>
                  Edit project
                </button>
              ) : null}
              secondaryActions={
                <>
                  {canDeleteProject ? (
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => {
                        setInlineError(null);
                        setConfirmProjectDelete(true);
                      }}
                    >
                      Delete project
                    </button>
                  ) : null}
                  {canManageMilestone ? (
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => {
                        setShowMilestoneForm((value) => !value);
                        setShowTaskForm(false);
                      }}
                    >
                      {showMilestoneForm ? "Cancel milestone" : "Add milestone"}
                    </button>
                  ) : null}
                  {canCreateTask ? (
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => {
                        setShowTaskForm((value) => !value);
                        setShowMilestoneForm(false);
                      }}
                    >
                      {showTaskForm ? "Cancel task" : "Add task"}
                    </button>
                  ) : null}
                  {confirmProjectDelete ? (
                    <div className="module-modal-backdrop" role="presentation" onClick={() => deleteProjectMutation.isPending ? null : setConfirmProjectDelete(false)}>
                      <div className="module-modal" role="dialog" aria-modal="true" aria-labelledby="delete-project-title" onClick={(event) => event.stopPropagation()}>
                        <div className="module-modal-header">
                          <h2 id="delete-project-title" className="h5 mb-0">Delete project?</h2>
                          <button type="button" className="btn-close" aria-label="Close" disabled={deleteProjectMutation.isPending} onClick={() => setConfirmProjectDelete(false)} />
                        </div>
                        <div className="module-modal-body">
                          <p className="mb-0">Delete <strong>{selected.name}</strong>? The project will be moved to deleted records.</p>
                          {inlineError ? <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">{inlineError}</div> : null}
                        </div>
                        <div className="module-modal-footer">
                          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={deleteProjectMutation.isPending} onClick={() => setConfirmProjectDelete(false)}>Cancel</button>
                          <button type="button" className="btn btn-danger btn-sm" disabled={deleteProjectMutation.isPending} onClick={() => deleteProjectMutation.mutate()}>
                            {deleteProjectMutation.isPending ? "Deleting…" : "Delete project"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              }
              tabs={[
                recordOverviewTab(
                  <>
                    <RecordOverviewGrid>
                      <RecordOverviewField label="Status" value={<StatusBadge status={selected.status} />} />
                      <RecordOverviewField
                        label="Health"
                        value={<StatusBadge status={selected.health ?? "ON_TRACK"} />}
                      />
                      <RecordOverviewField
                        label="Progress"
                        value={
                          selected.progressPercent != null ? `${selected.progressPercent}%` : "—"
                        }
                      />
                      <RecordOverviewField label="Priority" value={selected.priority ?? "—"} />
                      <RecordOverviewField label="Billing type" value={selected.billingType} />
                      <RecordOverviewField label="Budget" value={formatMoney(selected.budget)} />
                      <RecordOverviewField
                        label="Estimated hours"
                        value={formatHours(selected.estimatedHours)}
                      />
                      <RecordOverviewField
                        label="Actual hours"
                        value={formatHours(selected.actualHours)}
                      />
                      <RecordOverviewField label="Start date" value={selected.startDate ?? "—"} />
                      <RecordOverviewField label="End date" value={selected.endDate ?? "—"} />
                      <RecordOverviewField
                        label="Project manager"
                        value={userLabel(selected.projectManagerId)}
                      />
                      <RecordOverviewField
                        label="Account"
                        value={
                          accountQuery.isLoading ? (
                            "Loading…"
                          ) : accountQuery.data ? (
                            <>
                              {accountQuery.data.name}{" "}
                              <Link className="small" to="/accounts">
                                Open
                              </Link>
                            </>
                          ) : (
                            accountName(selected.accountId)
                          )
                        }
                      />
                    </RecordOverviewGrid>
                    {selected.description ? (
                      <RecordSection title="Description">
                        <p className="small text-muted mb-0">{selected.description}</p>
                      </RecordSection>
                    ) : null}
                    {canViewInvoices ? (
                      <RecordSection title="Unbilled time summary">
                        {unbilledTimeQuery.isLoading ? (
                          <LoadingState label="Loading time…" workspace />
                        ) : (
                          <p className="small mb-0">
                            {(unbilledTimeQuery.data ?? []).length} entries ·{" "}
                            {formatHours(unbilledHoursTotal)} hours unbilled
                          </p>
                        )}
                      </RecordSection>
                    ) : null}
                  </>,
                ),
                recordRelatedTab(
                  <>
                    {inlineError ? <div className="alert alert-danger py-2">{inlineError}</div> : null}

                    {showMilestoneForm ? (
                      <form
                        className="border-bottom pb-3 mb-3"
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
                        className="border-bottom pb-3 mb-3"
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

                    <RecordSection title={`Tasks (${tasksQuery.data?.length ?? 0})`}>
                      {tasksQuery.isLoading ? <LoadingState label="Loading tasks…" workspace /> : null}
                      <ul className="list-unstyled small mb-0">
                        {(tasksQuery.data ?? []).map((task) => (
                          <li key={task.id} className="mb-1">
                            {task.name} — <StatusBadge status={task.status} />
                            {task.dueDate ? ` · due ${task.dueDate}` : ""}
                          </li>
                        ))}
                        {!tasksQuery.data?.length ? <li className="text-muted">No tasks</li> : null}
                      </ul>
                    </RecordSection>

                    <RecordSection title={`Milestones (${milestonesQuery.data?.length ?? 0})`}>
                      {milestonesQuery.isLoading ? (
                        <LoadingState label="Loading milestones…" workspace />
                      ) : null}
                      <ul className="list-unstyled small mb-0">
                        {(milestonesQuery.data ?? []).map((milestone) => (
                          <li key={milestone.id} className="mb-1">
                            {milestone.name} — <StatusBadge status={milestone.status} />
                            {milestone.dueDate ? ` · ${milestone.dueDate}` : ""}
                          </li>
                        ))}
                        {!milestonesQuery.data?.length ? (
                          <li className="text-muted">No milestones</li>
                        ) : null}
                      </ul>
                    </RecordSection>

                    {canViewAllocations ? (
                      <RecordSection title={`Allocations (${allocationsQuery.data?.length ?? 0})`}>
                        {allocationsQuery.isLoading ? (
                          <LoadingState label="Loading allocations…" workspace />
                        ) : null}
                        <ul className="list-unstyled small mb-0">
                          {(allocationsQuery.data ?? []).map((allocation) => (
                            <li key={allocation.id} className="mb-1">
                              {resourceLabel(allocation.resourceId)}
                              {allocation.role ? ` · ${allocation.role}` : ""} —{" "}
                              <StatusBadge status={allocation.status} />
                              <span className="text-muted">
                                {" "}
                                · {allocation.startDate} – {allocation.endDate}
                              </span>
                            </li>
                          ))}
                          {!allocationsQuery.data?.length ? (
                            <li className="text-muted">No allocations</li>
                          ) : null}
                        </ul>
                        <Link className="small" to="/allocations">
                          Open Allocations
                        </Link>
                      </RecordSection>
                    ) : null}
                  </>,
                ),
                recordCustomTab(
                  "time",
                  "Time",
                  <>
                    {unbilledTimeQuery.isLoading ? (
                      <LoadingState label="Loading unbilled time…" workspace />
                    ) : null}
                    {unbilledTimeQuery.error ? (
                      <p className="small text-muted mb-0">Unable to load unbilled time.</p>
                    ) : (
                      <>
                        <p className="small mb-2">
                          Total unbilled: {formatHours(unbilledHoursTotal)} hours across{" "}
                          {(unbilledTimeQuery.data ?? []).length} entries
                        </p>
                        <ul className="list-unstyled small mb-0">
                          {(unbilledTimeQuery.data ?? []).map((entry) => (
                            <li key={entry.id} className="mb-1">
                              {entry.workDate} · {formatHours(entry.hours)}h
                              {entry.billingRate != null ? ` @ ${formatMoney(entry.billingRate)}` : ""}
                              {entry.description ? ` — ${entry.description}` : ""}
                            </li>
                          ))}
                          {!unbilledTimeQuery.data?.length ? (
                            <li className="text-muted">No unbilled time entries</li>
                          ) : null}
                        </ul>
                      </>
                    )}
                  </>,
                  { visible: canViewInvoices },
                ),
                recordCustomTab(
                  "finance",
                  "Finance",
                  <>
                    {canViewInvoices ? (
                      <RecordSection title={`Invoices (${invoicesQuery.data?.length ?? 0})`}>
                        {invoicesQuery.isLoading ? (
                          <LoadingState label="Loading invoices…" workspace />
                        ) : null}
                        <ul className="list-unstyled small mb-0">
                          {(invoicesQuery.data ?? []).map((invoice) => (
                            <li key={invoice.id} className="mb-1">
                              {invoice.invoiceNumber ?? invoice.id.slice(0, 8)} —{" "}
                              <StatusBadge status={invoice.status} /> · {formatMoney(invoice.total)}
                            </li>
                          ))}
                          {!invoicesQuery.data?.length ? (
                            <li className="text-muted">No invoices</li>
                          ) : null}
                        </ul>
                        <Link className="small" to="/invoices">
                          Open Invoices
                        </Link>
                      </RecordSection>
                    ) : null}
                    {canViewPurchaseOrders ? (
                      <RecordSection title={`Purchase orders (${purchaseOrdersQuery.data?.length ?? 0})`}>
                        {purchaseOrdersQuery.isLoading ? (
                          <LoadingState label="Loading purchase orders…" workspace />
                        ) : null}
                        <ul className="list-unstyled small mb-0">
                          {(purchaseOrdersQuery.data ?? []).map((order) => (
                            <li key={order.id} className="mb-1">
                              {order.poNumber ?? order.id.slice(0, 8)} —{" "}
                              <StatusBadge status={order.status} /> · {formatMoney(order.total)}
                            </li>
                          ))}
                          {!purchaseOrdersQuery.data?.length ? (
                            <li className="text-muted">No purchase orders</li>
                          ) : null}
                        </ul>
                        <Link className="small" to="/purchase-orders">
                          Open Purchase Orders
                        </Link>
                      </RecordSection>
                    ) : null}
                    {canViewExpenses ? (
                      <RecordSection title={`Expenses (${expensesQuery.data?.length ?? 0})`}>
                        {expensesQuery.isLoading ? (
                          <LoadingState label="Loading expenses…" workspace />
                        ) : null}
                        <ul className="list-unstyled small mb-0">
                          {(expensesQuery.data ?? []).map((expense) => (
                            <li key={expense.id} className="mb-1">
                              {expense.category} — <StatusBadge status={expense.status} /> ·{" "}
                              {formatMoney(expense.amount)} {expense.currencyCode}
                            </li>
                          ))}
                          {!expensesQuery.data?.length ? (
                            <li className="text-muted">No expenses</li>
                          ) : null}
                        </ul>
                        <Link className="small" to="/expenses">
                          Open Expenses
                        </Link>
                      </RecordSection>
                    ) : null}
                  </>,
                  {
                    visible: canViewInvoices || canViewPurchaseOrders || canViewExpenses,
                  },
                ),
                recordTimelineTab(<TechEarnestRecordTimeline entries={timelineEntries} />, {
                  visible: canViewActivities || canViewAudit,
                  id: "timeline",
                }),
                recordNotesTab(
                  <>
                    {canCreateNotes ? (
                      <div className="mb-3">
                        <textarea
                          className="form-control form-control-sm mb-2"
                          rows={2}
                          value={noteBody}
                          onChange={(event) => setNoteBody(event.target.value)}
                          placeholder="Add a note…"
                        />
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          disabled={!noteBody.trim() || noteMutation.isPending}
                          onClick={() => noteMutation.mutate()}
                        >
                          Add note
                        </button>
                      </div>
                    ) : null}
                    <ul className="small mb-0">
                      {(notesQuery.data ?? []).map((note) => (
                        <li key={note.id} className="mb-2">
                          <div>{note.body}</div>
                          <div className="text-muted d-flex justify-content-between">
                            <span>{new Date(note.createdAt).toLocaleString()}</span>
                            {canDeleteNotes ? (
                              <button
                                type="button"
                                className="btn btn-link btn-sm p-0"
                                onClick={() => deleteNoteMutation.mutate(note.id)}
                              >
                                Delete
                              </button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                      {!notesQuery.data?.length ? <li className="text-muted">No notes</li> : null}
                    </ul>
                  </>,
                  { visible: canViewNotes },
                ),
                recordDocumentsTab(
                  <>
                    {canUploadDocs ? (
                      <input
                        className="form-control form-control-sm mb-2"
                        type="file"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file || !selected) return;
                          try {
                            await uploadDocument("PROJECT", selected.id, file);
                            await queryClient.invalidateQueries({
                              queryKey: ["crm", "documents", "PROJECT", selected.id],
                            });
                          } catch {
                            /* ignore */
                          }
                          event.target.value = "";
                        }}
                      />
                    ) : null}
                    <ul className="small mb-0">
                      {(docsQuery.data ?? []).map((doc) => (
                        <li key={doc.id}>
                          <button
                            type="button"
                            className="btn btn-link btn-sm px-0"
                            onClick={async () => {
                              const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
                              const response = await fetch(documentDownloadUrl(doc.id), {
                                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                              });
                              if (!response.ok) return;
                              const blob = await response.blob();
                              const url = URL.createObjectURL(blob);
                              const anchor = document.createElement("a");
                              anchor.href = url;
                              anchor.download = doc.fileName;
                              anchor.click();
                              URL.revokeObjectURL(url);
                            }}
                          >
                            {doc.fileName}
                          </button>
                        </li>
                      ))}
                      {!docsQuery.data?.length ? <li className="text-muted">No documents</li> : null}
                    </ul>
                  </>,
                  { visible: canViewDocs },
                ),
                recordAuditTab(
                  <ul className="small mb-0">
                    {(auditQuery.data ?? []).map((log) => (
                      <li key={log.id}>
                        {log.action} · {new Date(log.createdAt).toLocaleString()}
                      </li>
                    ))}
                    {!auditQuery.data?.length ? (
                      <li className="text-muted">No audit events</li>
                    ) : null}
                  </ul>,
                  { visible: canViewAudit },
                ),
              ]}
            />

      ) : (
    <ModuleListShell
      title="Projects"
      filterOpen={filterOpen}
      activeFilterCount={activeFilterCount}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Projects</span>}
      filterToggle={{ onToggle: () => setFilterOpen((open) => !open) }}
      primaryAction={
        canCreate ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreateProject}>
            Create Project
          </button>
        ) : null
      }
      createMenuItems={bulkImport.menuItems}
      moreMenuItems={bulkImport.menuItems}
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
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={projectStatusOptions} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search project statuses" />
            <TechEarnestFilterSelect label="Account" value={accountFilter} onChange={setAccountFilter} options={accountOptions} placeholder="All accounts" emptyLabel="All accounts" searchPlaceholder="Search accounts" />
            {canViewUsers ? (
              <TechEarnestFilterSelect label="Manager" value={managerFilter} onChange={setManagerFilter} options={managerFilterOptions} placeholder="All managers" emptyLabel="All managers" searchPlaceholder="Search managers" />
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
      recordCount={rows.length}
    >
      {projectsQuery.isLoading ? <LoadingState label="Loading projects..." /> : null}
      {projectsQuery.error ? <ErrorState title="Unable to load projects" message="Try again." /> : null}

      {!projectsQuery.isLoading && !projectsQuery.error && !rows.length && !activeFilterCount
        ? bulkImport.renderEmptyState({ canCreate, createLabel: "Create Project", onCreate: openCreateProject })
        : null}

      {!projectsQuery.isLoading && !projectsQuery.error && (rows.length || activeFilterCount) ? (
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
        >
          {viewMode === "list" ? (
            <ModuleListTable
              tableCode="project"
              defaultColumns={[
                { field: "name", label: "Name" },
                { field: "projectCode", label: "Code" },
                { field: "accountId", label: "Account" },
                { field: "status", label: "Status" },
                { field: "health", label: "Health" },
                { field: "billingType", label: "Billing" },
                { field: "progressPercent", label: "Progress" },
              ]}
              rows={rows}
              rowKey={(project) => project.id}
              selectedRowKey={(selected as Project | null)?.id}
              onRowClick={(project) => {
                setSelected(project);
                setShowMilestoneForm(false);
                setShowTaskForm(false);
                setInlineError(null);
              }}
              renderCell={(project, field) => {
                if (field === "accountId") return accountName(project.accountId);
                if (field === "status") return <StatusBadge status={project.status} />;
                if (field === "health") return <StatusBadge status={project.health ?? "ON_TRACK"} />;
                if (field === "progressPercent") return project.progressPercent != null ? `${project.progressPercent}%` : "—";
                const value = (project as unknown as Record<string, unknown>)[field];
                return value == null || value === "" ? "—" : String(value);
              }}
              nameFields={["name"]}
              emptyMessage="No projects match the current filters."
            />
          ) : (
            <div className="module-tile-grid">
              {rows.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={`module-tile text-start${(selected as Project | null)?.id === project.id ? " is-selected" : ""}`}
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

        </div>
      ) : null}
    </ModuleListShell>
      )}
      {bulkImport.dialog}
    </>
  );
}
