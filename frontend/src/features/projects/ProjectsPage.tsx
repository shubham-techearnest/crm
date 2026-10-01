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
  ModuleFilterCheckbox,
  ModuleFilterField,
  ModuleListShell,
  countActiveFilters,
} from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { TechEarnestFilterSelect } from "@/components/TechEarnestCreate/TechEarnestFilterSelect";
import { RecordShell, DEFAULT_RELATED_LINKS } from "@/components/RecordShell";
import {
  buildTimelineEntries,
  recordLifecycleInfo,
  TechEarnestRecordInfoSection,
  TechEarnestRecordRelatedCard,
  TechEarnestRecordSummaryStrip,
  TechEarnestRecordTimeline,
  useRecordNavigation,
} from "@/components/TechEarnestRecord";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listAuditLogs, listRegions, listUsers } from "@/features/admin/adminApi";
import { adminErrorMessage } from "@/features/admin/adminKit";
import { createAccount, getAccount, getDeal, listAccounts, listActivities } from "@/features/crm/crmApi";
import { listContracts } from "@/features/contracts/contractApi";
import { RecordLink, RelatedRecordList } from "@/components/RecordLink";
import { useUrlSelection } from "@/hooks/useUrlRecord";
import {
  createNote,
  deleteDocument,
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
import { ProjectTimeTrackingCard } from "@/features/timesheets/TimeTrackingCards";
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
  BILLING_TYPE_META,
  BILLING_TYPES_BY_PROJECT_TYPE,
  PROJECT_TYPE_META,
  PROJECT_TYPES,
  billingTypeLabel,
  projectTypeLabel,
  suggestProjectCode,
  type Project,
  type UpdateProjectBody,
} from "./projectApi";
import { ProjectBillingCard } from "./ProjectBillingCard";
import { enumOptions, useActiveUserOptions } from "@/components/BulkActions/useBulkOptions";

/** The update endpoint replaces every field, so bulk edits resend the row's current values. */
function projectUpdateBody(project: Project, patch: Partial<UpdateProjectBody>): UpdateProjectBody {
  const body: Record<string, unknown> = {
    regionId: project.regionId,
    accountId: project.accountId,
    projectManagerId: project.projectManagerId,
    name: project.name,
    description: project.description,
    status: project.status,
    priority: project.priority,
    startDate: project.startDate,
    endDate: project.endDate,
    budget: project.budget,
    estimatedHours: project.estimatedHours,
    billingType: project.billingType,
    projectType: project.projectType ?? undefined,
    contractReference: project.contractReference ?? null,
    contractSignedDate: project.contractSignedDate ?? null,
    ...patch,
  };
  return body as UpdateProjectBody;
}

const PROJECT_STATUSES = ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
const PROJECT_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

const projectStatusOptions = enumPickerOptions(PROJECT_STATUSES);
const projectPriorityOptions = enumPickerOptions(PROJECT_PRIORITIES);
const projectTypeOptions = optionsFromPairs(
  PROJECT_TYPES.map((type) => ({
    value: type,
    label: PROJECT_TYPE_META[type].label,
    subtitle: PROJECT_TYPE_META[type].description,
  })),
);

const positiveAmount = (value: string | undefined) => {
  const n = Number(value);
  return !!value?.trim() && Number.isFinite(n) && n > 0;
};

const projectSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    projectCode: z.string().max(64).optional(),
    projectType: z.string().min(1, "Project type is required"),
    accountId: z.string().optional(),
    regionId: z.string().min(1, "Region is required"),
    billingType: z.string().min(1, "Billing type is required"),
    contractReference: z.string().max(128).optional(),
    contractSignedDate: z.string().optional(),
    status: z.string().min(1),
    projectManagerId: z.string().optional(),
    description: z.string().optional(),
    priority: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    budget: z.string().optional(),
    estimatedHours: z.string().optional(),
    hourlyRate: z.string().optional(),
    monthlyFee: z.string().optional(),
    contractValue: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.projectType !== "IN_HOUSE" && !values.accountId) {
      ctx.addIssue({ code: "custom", path: ["accountId"], message: "Account is required" });
    }
    if (!(BILLING_TYPES_BY_PROJECT_TYPE[values.projectType] ?? []).includes(values.billingType)) {
      ctx.addIssue({ code: "custom", path: ["billingType"], message: "Choose a billing type for this project type" });
    }
    if (values.billingType === "TIME_AND_MATERIAL" && !positiveAmount(values.hourlyRate)) {
      ctx.addIssue({ code: "custom", path: ["hourlyRate"], message: "Hourly rate is required" });
    }
    if (values.billingType === "FIXED_MONTHLY" && !positiveAmount(values.monthlyFee)) {
      ctx.addIssue({ code: "custom", path: ["monthlyFee"], message: "Monthly fee is required" });
    }
    if (values.billingType === "FIXED_BID" && !positiveAmount(values.contractValue)) {
      ctx.addIssue({ code: "custom", path: ["contractValue"], message: "Contract value is required" });
    }
    if (values.startDate && values.endDate && values.endDate < values.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date cannot be before start date" });
    }
  });

type ProjectFormValues = z.infer<typeof projectSchema>;

const PROJECT_DEFAULTS: ProjectFormValues = {
  name: "",
  projectCode: "",
  projectType: "B2B",
  accountId: "",
  regionId: "",
  projectManagerId: "",
  billingType: "FIXED_BID",
  contractReference: "",
  contractSignedDate: "",
  status: "PLANNED",
  description: "",
  priority: "MEDIUM",
  startDate: "",
  endDate: "",
  budget: "",
  estimatedHours: "",
  hourlyRate: "",
  monthlyFee: "",
  contractValue: "",
};

function billingInvoiceHint(type: string): string {
  switch (type) {
    case "STAFF_AUGMENTATION":
      return "Invoices list every approved, billable hour at the rate of the resource who logged it.";
    case "TIME_AND_MATERIAL":
      return "Invoices list every approved, billable hour at the project hourly rate.";
    case "FIXED_MONTHLY":
      return "One invoice line per month for the monthly fee. A month can only be invoiced once.";
    case "NON_BILLABLE":
      return "Hours are tracked against the project for cost and utilization, but nothing is invoiced.";
    default:
      return "Invoice any part of the contract value (for example an advance or a milestone) until it is fully billed.";
  }
}

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
  const bulkManagerOptions = useActiveUserOptions(canUpdateProject);
  const canManageMilestone = useHasPermission("MILESTONE_MANAGE");
  const canCreateTask = useHasPermission("TASK_CREATE");
  const canViewUsers = useHasPermission("USER_VIEW");
  const canViewAllocations = useHasPermission("ALLOCATION_VIEW");
  const canViewTimesheets = useHasPermission("TIMESHEET_VIEW");
  const canViewResources = useHasPermission("RESOURCE_VIEW");
  const canViewInvoices = useHasPermission("INVOICE_VIEW");
  const canCreateInvoice = useHasPermission("INVOICE_CREATE");
  const canViewPurchaseOrders = useHasPermission("PO_VIEW");
  const canViewExpenses = useHasPermission("EXPENSE_VIEW");
  const canViewActivities = useHasPermission("ACTIVITY_VIEW");
  const canViewContracts = useHasPermission("CONTRACT_VIEW");
  const canViewDeals = useHasPermission("DEAL_VIEW");
  const canViewNotes = useHasPermission("NOTE_VIEW");
  const canCreateNotes = useHasPermission("NOTE_CREATE");
  const canDeleteNotes = useHasPermission("NOTE_DELETE");
  const canViewDocs = useHasPermission("DOCUMENT_VIEW");
  const canUploadDocs = useHasPermission("DOCUMENT_UPLOAD");
  const canDeleteDocs = useHasPermission("DOCUMENT_DELETE");
  const canViewAudit = useHasPermission("AUDIT_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [startFrom, setStartFrom] = useState("");
  const [endTo, setEndTo] = useState("");
  const [delayedOnly, setDelayedOnly] = useState(false);
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
  const [selected, setSelected] = useUrlSelection(projectsQuery.data, { fetchById: getProject });
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
    queryFn: () => getAccount(selected!.accountId!),
    enabled: !!selected?.accountId,
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
  const contractsQuery = useQuery({
    queryKey: ["contracts", "account", selected?.accountId],
    queryFn: () => listContracts({ accountId: selected!.accountId! }),
    enabled: !!selected?.accountId && canViewContracts,
  });
  const projectContracts = useMemo(
    () => (contractsQuery.data ?? []).filter((contract) => contract.projectId === selected?.id),
    [contractsQuery.data, selected?.id],
  );
  const dealQuery = useQuery({
    queryKey: ["crm", "deals", "record", selected?.dealId],
    queryFn: () => getDeal(selected!.dealId!),
    enabled: !!selected?.dealId && canViewDeals,
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
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: PROJECT_DEFAULTS,
  });
  const formBillingType = watch("billingType");
  const formProjectType = watch("projectType");
  const formName = watch("name");
  const formAccountId = watch("accountId");
  const [codeSeed, setCodeSeed] = useState({ name: "", accountId: "", projectType: "" });
  useEffect(() => {
    const handle = window.setTimeout(
      () => setCodeSeed({ name: formName?.trim() ?? "", accountId: formAccountId ?? "", projectType: formProjectType }),
      400,
    );
    return () => window.clearTimeout(handle);
  }, [formName, formAccountId, formProjectType]);
  const codeSuggestionQuery = useQuery({
    queryKey: ["projects", "code-suggestion", codeSeed],
    queryFn: () => suggestProjectCode(codeSeed),
    enabled: showForm && !editingProject && canCreate && !!codeSeed.name,
    staleTime: 30_000,
  });
  const [extraAccountOptions, setExtraAccountOptions] = useState<{ value: string; label: string }[]>([]);
  const billingTypeOptions = useMemo(
    () =>
      optionsFromPairs(
        (BILLING_TYPES_BY_PROJECT_TYPE[formProjectType] ?? []).map((type) => ({
          value: type,
          label: BILLING_TYPE_META[type]?.label ?? type,
          subtitle: BILLING_TYPE_META[type]?.description,
        })),
      ),
    [formProjectType],
  );

  function changeProjectType(next: string) {
    const allowed = BILLING_TYPES_BY_PROJECT_TYPE[next] ?? [];
    if (!allowed.includes(formBillingType)) {
      setValue("billingType", allowed[0] ?? "", { shouldDirty: true, shouldValidate: true });
    }
    if (next === "IN_HOUSE") {
      setValue("accountId", "", { shouldDirty: true });
    }
  }

  const {
    setSaveAndNew,
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
    () =>
      optionsFromPairs([
        ...(accountsQuery.data ?? []).map((account) => ({ value: account.id, label: account.name })),
        ...extraAccountOptions.filter((option) => !(accountsQuery.data ?? []).some((a) => a.id === option.value)),
      ]),
    [accountsQuery.data, extraAccountOptions],
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
    projectType: values.projectType,
    accountId: values.projectType === "IN_HOUSE" ? null : values.accountId || null,
    regionId: values.regionId,
    projectManagerId: values.projectManagerId || undefined,
    billingType: values.billingType,
    contractReference: values.projectType === "CONTRACT" ? values.contractReference?.trim() || null : null,
    contractSignedDate: values.projectType === "CONTRACT" ? values.contractSignedDate || null : null,
    status: values.status || "PLANNED",
    description: values.description || undefined,
    priority: values.priority || undefined,
    startDate: values.startDate || undefined,
    endDate: values.endDate || undefined,
    budget: parseOptionalNumber(values.budget) ?? null,
    estimatedHours: parseOptionalNumber(values.estimatedHours) ?? null,
    hourlyRate: parseOptionalNumber(values.hourlyRate) ?? null,
    monthlyFee: parseOptionalNumber(values.monthlyFee) ?? null,
    contractValue: parseOptionalNumber(values.contractValue) ?? null,
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
        hourlyRate: body.hourlyRate,
        monthlyFee: body.monthlyFee,
        contractValue: body.contractValue,
        projectType: body.projectType,
        contractReference: body.contractReference,
        contractSignedDate: body.contractSignedDate,
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
    onError: (error) =>
      setFormError(
        adminErrorMessage(
          error,
          editingProject
            ? "Could not update project. Check required fields and permissions."
            : "Could not create project. Check required fields.",
        ),
      ),
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
      projectType: project.projectType ?? "B2B",
      accountId: project.accountId ?? "",
      regionId: project.regionId,
      projectManagerId: project.projectManagerId ?? "",
      billingType: project.billingType,
      contractReference: project.contractReference ?? "",
      contractSignedDate: project.contractSignedDate ?? "",
      status: project.status,
      description: project.description ?? "",
      priority: project.priority ?? "MEDIUM",
      startDate: project.startDate ?? "",
      endDate: project.endDate ?? "",
      budget: project.budget == null ? "" : String(project.budget),
      estimatedHours: project.estimatedHours == null ? "" : String(project.estimatedHours),
      hourlyRate: project.hourlyRate == null ? "" : String(project.hourlyRate),
      monthlyFee: project.monthlyFee == null ? "" : String(project.monthlyFee),
      contractValue: project.contractValue == null ? "" : String(project.contractValue),
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

  const accountName = (id: string | null | undefined) =>
    !id ? "—" : accountsQuery.data?.find((a) => a.id === id)?.name ?? id.slice(0, 8);

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

  const regionName = (id: string) => regionsQuery.data?.find((region) => region.id === id)?.name ?? "—";

  const openActivities = useMemo(
    () => (activitiesQuery.data ?? []).filter((activity) => activity.status !== "COMPLETED"),
    [activitiesQuery.data],
  );
  const closedActivities = useMemo(
    () => (activitiesQuery.data ?? []).filter((activity) => activity.status === "COMPLETED"),
    [activitiesQuery.data],
  );

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument("PROJECT", selected!.id, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "documents", "PROJECT", selected?.id] });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "documents", "PROJECT", selected?.id] });
    },
  });

  const openDownload = async (id: string, fileName: string) => {
    const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const response = await fetch(documentDownloadUrl(id), {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) return;
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {showForm && (editingProject ? canUpdateProject : canCreate) ? (
        <TechEarnestFormKitCreateView
          title={editingProject ? "Edit Project" : "Create Project"}
          tableCode="project"
          recordId={editingProject?.id}
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
          showRecordImage={false}
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
                <TechEarnestCreateField
                  label="Project Code"
                  error={errors.projectCode?.message}
                  hint={editingProject ? undefined : "Generated automatically from the account and project name."}
                >
                  {editingProject ? (
                    <input
                      type="text"
                      readOnly
                      title="The project code cannot be changed"
                      className="form-control form-control-sm"
                      {...register("projectCode")}
                    />
                  ) : (
                    <input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      className="form-control form-control-sm"
                      value={
                        codeSeed.name
                          ? codeSuggestionQuery.data ?? (codeSuggestionQuery.isFetching ? "Generating…" : "")
                          : ""
                      }
                      placeholder="Auto-generated on save"
                    />
                  )}
                </TechEarnestCreateField>
                <TechEarnestCreateField
                  label="Project Type"
                  required
                  error={errors.projectType?.message}
                  hint={PROJECT_TYPE_META[formProjectType]?.description}
                >
                  <TechEarnestFormSelect
                    control={control}
                    name="projectType"
                    options={projectTypeOptions}
                    searchPlaceholder="Search Project Types"
                    allowEmpty={false}
                    onValueChange={changeProjectType}
                    invalid={!!errors.projectType}
                  />
                </TechEarnestCreateField>
                {formProjectType !== "IN_HOUSE" ? (
                  <TechEarnestCreateField label="Account Name" required error={errors.accountId?.message}>
                    <TechEarnestFormSelect
                      control={control}
                      name="accountId"
                      options={accountOptions}
                      searchPlaceholder="Search Accounts"
                      lookupIcon="building"
                      lookupMode="modal"
                      lookupTitle="Select Account"
                      addNewLabel="New Account"
                      allowEmpty={false}
                      placeholder="Select account"
                      invalid={!!errors.accountId}
                      quickCreate={{
                        title: "Create Account",
                        fields: [
                          { name: "name", label: "Account Name", required: true },
                          {
                            name: "regionId",
                            label: "Region",
                            type: "select",
                            required: true,
                            options: regionOptions,
                          },
                          {
                            name: "accountType",
                            label: "Account Type",
                            type: "select",
                            required: true,
                            options: ["CUSTOMER", "PROSPECT", "PARTNER", "VENDOR"].map((type) => ({
                              value: type,
                              label: type.charAt(0) + type.slice(1).toLowerCase(),
                            })),
                          },
                        ],
                        submitLabel: "Save and Associate",
                        onSubmit: async (values) => {
                          const account = await createAccount({
                            name: values.name.trim(),
                            regionId: values.regionId,
                            accountType: values.accountType,
                          });
                          const option = { value: account.id, label: account.name };
                          setExtraAccountOptions((current) => [...current, option]);
                          await queryClient.invalidateQueries({ queryKey: ["crm", "accounts"] });
                          return option;
                        },
                      }}
                    />
                  </TechEarnestCreateField>
                ) : null}
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
          <TechEarnestCreateSection title="Billing">
            <TechEarnestCreateGrid>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField
                  label="Billing Type"
                  required
                  error={errors.billingType?.message}
                  hint={BILLING_TYPE_META[formBillingType]?.description}
                >
                  <TechEarnestFormSelect
                    control={control}
                    name="billingType"
                    options={billingTypeOptions}
                    searchPlaceholder="Search Billing Types"
                    allowEmpty={false}
                    disabled={billingTypeOptions.length <= 1}
                    invalid={!!errors.billingType}
                  />
                </TechEarnestCreateField>
                {formBillingType === "TIME_AND_MATERIAL" || formBillingType === "STAFF_AUGMENTATION" ? (
                  <TechEarnestCreateField
                    label={formBillingType === "TIME_AND_MATERIAL" ? "Hourly Rate" : "Fallback Hourly Rate"}
                    required={formBillingType === "TIME_AND_MATERIAL"}
                    error={errors.hourlyRate?.message}
                    hint={
                      formBillingType === "STAFF_AUGMENTATION"
                        ? "Used only for resources without their own billing rate."
                        : "Charged for every approved billable hour."
                    }
                  >
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">Rs.</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={`form-control${errors.hourlyRate ? " is-invalid" : ""}`}
                        {...register("hourlyRate")}
                      />
                      <span className="input-group-text">/ hour</span>
                    </div>
                  </TechEarnestCreateField>
                ) : null}
                {formBillingType === "FIXED_MONTHLY" ? (
                  <TechEarnestCreateField
                    label="Monthly Fee"
                    required
                    error={errors.monthlyFee?.message}
                    hint="Invoiced once per calendar month."
                  >
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">Rs.</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={`form-control${errors.monthlyFee ? " is-invalid" : ""}`}
                        {...register("monthlyFee")}
                      />
                      <span className="input-group-text">/ month</span>
                    </div>
                  </TechEarnestCreateField>
                ) : null}
                {formBillingType === "FIXED_BID" ? (
                  <TechEarnestCreateField
                    label="Contract Value"
                    required
                    error={errors.contractValue?.message}
                    hint="Total agreed price; invoiced in instalments until fully billed."
                  >
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">Rs.</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={`form-control${errors.contractValue ? " is-invalid" : ""}`}
                        {...register("contractValue")}
                      />
                    </div>
                  </TechEarnestCreateField>
                ) : null}
              </TechEarnestCreateColumn>
              <TechEarnestCreateColumn>
                <p className="small text-muted mb-0 pt-1">{billingInvoiceHint(formBillingType)}</p>
              </TechEarnestCreateColumn>
            </TechEarnestCreateGrid>
          </TechEarnestCreateSection>
          {formProjectType === "CONTRACT" ? (
            <TechEarnestCreateSection title="Contract Details">
              <TechEarnestCreateGrid>
                <TechEarnestCreateColumn>
                  <TechEarnestCreateField
                    label="Contract Reference"
                    error={errors.contractReference?.message}
                    hint="Contract, SOW or PO number."
                  >
                    <input
                      type="text"
                      maxLength={128}
                      className={`form-control form-control-sm${errors.contractReference ? " is-invalid" : ""}`}
                      {...register("contractReference")}
                    />
                  </TechEarnestCreateField>
                </TechEarnestCreateColumn>
                <TechEarnestCreateColumn>
                  <TechEarnestCreateField label="Contract Signed On" error={errors.contractSignedDate?.message}>
                    <input type="date" className="form-control form-control-sm" {...register("contractSignedDate")} />
                  </TechEarnestCreateField>
                </TechEarnestCreateColumn>
              </TechEarnestCreateGrid>
            </TechEarnestCreateSection>
          ) : null}
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
                  {selected.accountId ? (
                    <>
                      <RecordLink module="account" id={selected.accountId}>
                        {accountName(selected.accountId)}
                      </RecordLink>{" "}
                      ·{" "}
                    </>
                  ) : null}
                  {projectTypeLabel(selected.projectType)} · {billingTypeLabel(selected.billingType)}
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
              customFieldsTable="project"
              layout="page"
              avatarLabel={selected.name}
              onBack={() => {
                setShowMilestoneForm(false);
                setShowTaskForm(false);
                setInlineError(null);
                recordNav.goBack();
              }}
              onPrev={recordNav.goPrev}
              onNext={recordNav.goNext}
              hasPrev={recordNav.hasPrev}
              hasNext={recordNav.hasNext}
              relatedLinks={[
                { id: "tasks", label: "Tasks" },
                { id: "milestones", label: "Milestones" },
                ...(canViewAllocations ? [{ id: "allocations", label: "Allocations" }] : []),
                ...(canViewInvoices ? [{ id: "invoices", label: "Invoices" }] : []),
                ...(canViewContracts ? [{ id: "contracts", label: "Contracts" }] : []),
                ...(canViewPurchaseOrders ? [{ id: "purchase-orders", label: "Purchase Orders" }] : []),
                ...(canViewExpenses ? [{ id: "expenses", label: "Expenses" }] : []),
                ...DEFAULT_RELATED_LINKS,
              ]}
              primaryAction={
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!canUpdateProject}
                  onClick={() => openProjectEdit(selected)}
                >
                  Edit
                </button>
              }
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
                      Delete
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
                {
                  id: "overview",
                  label: "Overview",
                  content: (
                    <>
                      <TechEarnestRecordSummaryStrip
                        fields={[
                          { label: "Project Manager", value: userLabel(selected.projectManagerId) },
                          { label: "Status", value: <StatusBadge status={selected.status} /> },
                          { label: "Health", value: <StatusBadge status={selected.health ?? "ON_TRACK"} /> },
                          {
                            label: "Progress",
                            value: selected.progressPercent != null ? `${selected.progressPercent}%` : "—",
                          },
                          { label: "End Date", value: selected.endDate ?? "—" },
                        ]}
                      />

                      <TechEarnestRecordInfoSection
                        title="Project Information"
                        fields={[
                          { label: "Project Name", value: selected.name },
                          { label: "Project Code", value: selected.projectCode },
                          { label: "Project Type", value: projectTypeLabel(selected.projectType) },
                          {
                            label: "Account Name",
                            value: selected.accountId ? (
                              <RecordLink module="account" id={selected.accountId}>
                                {accountQuery.data?.name ?? accountName(selected.accountId)}
                              </RecordLink>
                            ) : (
                              "Internal (no account)"
                            ),
                          },
                          ...(selected.projectType === "CONTRACT"
                            ? [
                                { label: "Contract Reference", value: selected.contractReference ?? "—" },
                                { label: "Contract Signed On", value: selected.contractSignedDate ?? "—" },
                              ]
                            : []),
                          ...(selected.dealId
                            ? [
                                {
                                  label: "Source Deal",
                                  value: (
                                    <RecordLink module="deal" id={selected.dealId}>
                                      {dealQuery.data?.name ?? "Open deal"}
                                    </RecordLink>
                                  ),
                                },
                              ]
                            : []),
                          { label: "Project Manager", value: userLabel(selected.projectManagerId) },
                          { label: "Region", value: regionName(selected.regionId) },
                          { label: "Billing Type", value: billingTypeLabel(selected.billingType) },
                          { label: "Status", value: selected.status },
                          { label: "Priority", value: selected.priority ?? "—" },
                          { label: "Start Date", value: selected.startDate ?? "—" },
                          { label: "End Date", value: selected.endDate ?? "—" },
                        ]}
                      />

                      <TechEarnestRecordInfoSection
                        title="Budget & Effort"
                        fields={[
                          { label: "Budget", value: formatMoney(selected.budget) },
                          { label: "Estimated Hours", value: formatHours(selected.estimatedHours) },
                          { label: "Actual Hours", value: formatHours(selected.actualHours) },
                          ...(canViewInvoices
                            ? [
                                {
                                  label: "Unbilled Hours",
                                  value: unbilledTimeQuery.isLoading
                                    ? "Loading…"
                                    : `${formatHours(unbilledHoursTotal)} (${(unbilledTimeQuery.data ?? []).length} entries)`,
                                },
                              ]
                            : []),
                        ]}
                      />

                      <TechEarnestRecordInfoSection
                        title="Billing"
                        fields={[
                          { label: "Billing Type", value: billingTypeLabel(selected.billingType) },
                          ...(selected.billingType === "TIME_AND_MATERIAL"
                            ? [{ label: "Hourly Rate", value: `${formatMoney(selected.hourlyRate)} / hour` }]
                            : []),
                          ...(selected.billingType === "STAFF_AUGMENTATION"
                            ? [
                                {
                                  label: "Rate",
                                  value: selected.hourlyRate
                                    ? `Resource billing rate (fallback ${formatMoney(selected.hourlyRate)} / hour)`
                                    : "Resource billing rate",
                                },
                              ]
                            : []),
                          ...(selected.billingType === "FIXED_MONTHLY"
                            ? [{ label: "Monthly Fee", value: `${formatMoney(selected.monthlyFee)} / month` }]
                            : []),
                          ...(selected.billingType === "FIXED_BID"
                            ? [{ label: "Contract Value", value: formatMoney(selected.contractValue) }]
                            : []),
                        ]}
                      />

                      {canCreateInvoice ? <ProjectBillingCard project={selected} /> : null}

                      {selected.description ? (
                        <TechEarnestRecordInfoSection
                          title="Description Information"
                          collapsible={false}
                          fields={[{ label: "Description", value: selected.description }]}
                        />
                      ) : null}

                      {inlineError && !confirmProjectDelete ? (
                        <div className="alert alert-danger py-2">{inlineError}</div>
                      ) : null}

                      <TechEarnestRecordRelatedCard
                        id="techearnest-record-section-tasks"
                        title={`Tasks (${tasksQuery.data?.length ?? 0})`}
                        isEmpty={!tasksQuery.isLoading && !(tasksQuery.data ?? []).length && !showTaskForm}
                        emptyLabel="No records found"
                        actions={
                          canCreateTask ? (
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => {
                                setShowTaskForm((value) => !value);
                                setShowMilestoneForm(false);
                              }}
                            >
                              {showTaskForm ? "Cancel" : "New Task"}
                            </button>
                          ) : null
                        }
                      >
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
                            <select className="form-select form-select-sm mb-2" {...taskForm.register("status")}>
                              <option value="TODO">TODO</option>
                              <option value="IN_PROGRESS">IN_PROGRESS</option>
                              <option value="BLOCKED">BLOCKED</option>
                              <option value="COMPLETED">COMPLETED</option>
                            </select>
                            <FormField label="Due date" type="date" {...taskForm.register("dueDate")} />
                            <button type="submit" className="btn btn-primary btn-sm" disabled={taskMutation.isPending}>
                              Create task
                            </button>
                          </form>
                        ) : null}
                        <RelatedRecordList
                          module="task"
                          loading={tasksQuery.isLoading}
                          loadingLabel="Loading tasks…"
                          items={(tasksQuery.data ?? []).map((task) => ({
                            id: task.id,
                            label: task.name,
                            secondary: task.dueDate ? `due ${task.dueDate}` : undefined,
                            trailing: <StatusBadge status={task.status} />,
                          }))}
                        />
                      </TechEarnestRecordRelatedCard>

                      <TechEarnestRecordRelatedCard
                        id="techearnest-record-section-milestones"
                        title={`Milestones (${milestonesQuery.data?.length ?? 0})`}
                        isEmpty={!milestonesQuery.isLoading && !(milestonesQuery.data ?? []).length && !showMilestoneForm}
                        emptyLabel="No records found"
                        actions={
                          canManageMilestone ? (
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => {
                                setShowMilestoneForm((value) => !value);
                                setShowTaskForm(false);
                              }}
                            >
                              {showMilestoneForm ? "Cancel" : "New Milestone"}
                            </button>
                          ) : null
                        }
                      >
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
                            <button type="submit" className="btn btn-primary btn-sm" disabled={milestoneMutation.isPending}>
                              Create milestone
                            </button>
                          </form>
                        ) : null}
                        <RelatedRecordList
                          module="milestone"
                          loading={milestonesQuery.isLoading}
                          loadingLabel="Loading milestones…"
                          items={(milestonesQuery.data ?? []).map((milestone) => ({
                            id: milestone.id,
                            label: milestone.name,
                            secondary: milestone.dueDate ?? undefined,
                            trailing: <StatusBadge status={milestone.status} />,
                          }))}
                        />
                      </TechEarnestRecordRelatedCard>

                      {canViewAllocations ? (
                        <TechEarnestRecordRelatedCard
                          id="techearnest-record-section-allocations"
                          title={`Allocations (${allocationsQuery.data?.length ?? 0})`}
                          isEmpty={!allocationsQuery.isLoading && !(allocationsQuery.data ?? []).length}
                          emptyLabel="No records found"
                          actions={
                            <Link className="btn btn-outline-secondary btn-sm" to="/allocations">
                              Open Allocations
                            </Link>
                          }
                        >
                          <ul className="related-record-list">
                            {(allocationsQuery.data ?? []).map((allocation) => (
                              <li key={allocation.id}>
                                <span className="related-record-primary">
                                  <RecordLink module="resource" id={allocation.resourceId}>
                                    {resourceLabel(allocation.resourceId)}
                                  </RecordLink>
                                  <span className="related-record-secondary">
                                    {allocation.role ? `${allocation.role} · ` : ""}
                                    <RecordLink module="allocation" id={allocation.id}>
                                      {allocation.startDate} – {allocation.endDate}
                                    </RecordLink>
                                  </span>
                                </span>
                                <span className="related-record-trailing">
                                  <StatusBadge status={allocation.status} />
                                </span>
                              </li>
                            ))}
                          </ul>
                        </TechEarnestRecordRelatedCard>
                      ) : null}

                      <ProjectTimeTrackingCard projectId={selected.id} canViewTimesheets={canViewTimesheets} />

                      {canViewInvoices ? (
                        <TechEarnestRecordRelatedCard
                          id="techearnest-record-section-unbilled-time"
                          title={`Unbilled Time (${formatHours(unbilledHoursTotal)} h)`}
                          isEmpty={!unbilledTimeQuery.isLoading && !(unbilledTimeQuery.data ?? []).length}
                          emptyLabel={unbilledTimeQuery.error ? "Unable to load unbilled time" : "No records found"}
                        >
                          <ul className="list-unstyled small mb-0">
                            {(unbilledTimeQuery.data ?? []).map((entry) => (
                              <li key={entry.id} className="mb-2 d-flex justify-content-between gap-2">
                                <span>
                                  {entry.workDate}
                                  {entry.description ? <span className="text-muted"> · {entry.description}</span> : null}
                                </span>
                                <span>
                                  {formatHours(entry.hours)}h
                                  {entry.billingRate != null ? ` @ ${formatMoney(entry.billingRate)}` : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </TechEarnestRecordRelatedCard>
                      ) : null}

                      {canViewInvoices ? (
                        <TechEarnestRecordRelatedCard
                          id="techearnest-record-section-invoices"
                          title={`Invoices (${invoicesQuery.data?.length ?? 0})`}
                          isEmpty={!invoicesQuery.isLoading && !(invoicesQuery.data ?? []).length}
                          emptyLabel="No records found"
                          actions={
                            <Link className="btn btn-outline-secondary btn-sm" to="/invoices">
                              Open Invoices
                            </Link>
                          }
                        >
                          <RelatedRecordList
                            module="invoice"
                            items={(invoicesQuery.data ?? []).map((invoice) => ({
                              id: invoice.id,
                              label: invoice.invoiceNumber ?? invoice.id.slice(0, 8),
                              secondary: formatMoney(invoice.total),
                              trailing: <StatusBadge status={invoice.status} />,
                            }))}
                          />
                        </TechEarnestRecordRelatedCard>
                      ) : null}

                      {canViewPurchaseOrders ? (
                        <TechEarnestRecordRelatedCard
                          id="techearnest-record-section-purchase-orders"
                          title={`Purchase Orders (${purchaseOrdersQuery.data?.length ?? 0})`}
                          isEmpty={!purchaseOrdersQuery.isLoading && !(purchaseOrdersQuery.data ?? []).length}
                          emptyLabel="No records found"
                          actions={
                            <Link className="btn btn-outline-secondary btn-sm" to="/purchase-orders">
                              Open Purchase Orders
                            </Link>
                          }
                        >
                          <RelatedRecordList
                            module="purchaseOrder"
                            items={(purchaseOrdersQuery.data ?? []).map((order) => ({
                              id: order.id,
                              label: order.poNumber ?? order.id.slice(0, 8),
                              secondary: formatMoney(order.total),
                              trailing: <StatusBadge status={order.status} />,
                            }))}
                          />
                        </TechEarnestRecordRelatedCard>
                      ) : null}

                      {canViewExpenses ? (
                        <TechEarnestRecordRelatedCard
                          id="techearnest-record-section-expenses"
                          title={`Expenses (${expensesQuery.data?.length ?? 0})`}
                          isEmpty={!expensesQuery.isLoading && !(expensesQuery.data ?? []).length}
                          emptyLabel="No records found"
                          actions={
                            <Link className="btn btn-outline-secondary btn-sm" to="/expenses">
                              Open Expenses
                            </Link>
                          }
                        >
                          <RelatedRecordList
                            module="expense"
                            items={(expensesQuery.data ?? []).map((expense) => ({
                              id: expense.id,
                              label: expense.category,
                              secondary: `${formatMoney(expense.amount)} ${expense.currencyCode}`,
                              trailing: <StatusBadge status={expense.status} />,
                            }))}
                          />
                        </TechEarnestRecordRelatedCard>
                      ) : null}

                      {canViewContracts ? (
                        <TechEarnestRecordRelatedCard
                          id="techearnest-record-section-contracts"
                          title={`Contracts (${projectContracts.length})`}
                          isEmpty={!contractsQuery.isLoading && !projectContracts.length}
                          emptyLabel="No records found"
                        >
                          <RelatedRecordList
                            module="contract"
                            loading={contractsQuery.isLoading}
                            items={projectContracts.map((contract) => ({
                              id: contract.id,
                              label: contract.contractNumber ? `${contract.contractNumber} · ${contract.name}` : contract.name,
                              secondary: contract.endDate ? `ends ${contract.endDate}` : undefined,
                              trailing: <StatusBadge status={contract.status} />,
                            }))}
                          />
                        </TechEarnestRecordRelatedCard>
                      ) : null}

                      {canViewNotes ? (
                        <TechEarnestRecordRelatedCard
                          id="techearnest-record-section-notes"
                          title="Notes"
                          isEmpty={!(notesQuery.data ?? []).length && !canCreateNotes}
                          emptyLabel="No notes yet"
                          actions={
                            canCreateNotes ? (
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                disabled={!noteBody.trim() || noteMutation.isPending}
                                onClick={() => noteMutation.mutate()}
                              >
                                Save
                              </button>
                            ) : null
                          }
                        >
                          {canCreateNotes ? (
                            <textarea
                              className="form-control form-control-sm mb-2"
                              rows={2}
                              value={noteBody}
                              onChange={(event) => setNoteBody(event.target.value)}
                              placeholder="Add a note"
                            />
                          ) : null}
                          <ul className="list-unstyled small mb-0">
                            {(notesQuery.data ?? []).map((note) => (
                              <li key={note.id} className="mb-2 border-bottom pb-2">
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
                          </ul>
                        </TechEarnestRecordRelatedCard>
                      ) : null}

                      {canViewDocs ? (
                        <TechEarnestRecordRelatedCard
                          id="techearnest-record-section-attachments"
                          title="Attachments"
                          isEmpty={!(docsQuery.data ?? []).length}
                          emptyLabel="No Attachment"
                          actions={
                            canUploadDocs ? (
                              <label className="btn btn-outline-secondary btn-sm mb-0">
                                Attach
                                <input
                                  type="file"
                                  className="d-none"
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) {
                                      uploadMutation.mutate(file);
                                      event.target.value = "";
                                    }
                                  }}
                                />
                              </label>
                            ) : null
                          }
                        >
                          <ul className="list-unstyled small mb-0">
                            {(docsQuery.data ?? []).map((doc) => (
                              <li key={doc.id} className="mb-2 d-flex justify-content-between gap-2">
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm p-0 text-start"
                                  onClick={() => void openDownload(doc.id, doc.fileName)}
                                >
                                  {doc.fileName}
                                </button>
                                {canDeleteDocs ? (
                                  <button
                                    type="button"
                                    className="btn btn-link btn-sm p-0 text-danger"
                                    onClick={() => deleteDocMutation.mutate(doc.id)}
                                  >
                                    Delete
                                  </button>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </TechEarnestRecordRelatedCard>
                      ) : null}

                      {canViewActivities ? (
                        <>
                          <TechEarnestRecordRelatedCard
                            id="techearnest-record-section-open-activities"
                            title="Open Activities"
                            isEmpty={!openActivities.length}
                            emptyLabel="No records found"
                          >
                            <RelatedRecordList
                              module="activity"
                              items={openActivities.map((activity) => ({
                                id: activity.id,
                                label: activity.subject,
                                trailing: <StatusBadge status={activity.status} />,
                              }))}
                            />
                          </TechEarnestRecordRelatedCard>
                          <TechEarnestRecordRelatedCard
                            id="techearnest-record-section-closed-activities"
                            title="Closed Activities"
                            isEmpty={!closedActivities.length}
                            emptyLabel="No records found"
                          >
                            <RelatedRecordList
                              module="activity"
                              items={closedActivities.map((activity) => ({
                                id: activity.id,
                                label: activity.subject,
                                trailing: <StatusBadge status={activity.status} />,
                              }))}
                            />
                          </TechEarnestRecordRelatedCard>
                        </>
                      ) : null}
                    </>
                  ),
                },
                {
                  id: "timeline",
                  label: "Timeline",
                  visible: true,
                  content: (
                    <TechEarnestRecordTimeline
                      entries={timelineEntries}
                      loading={auditQuery.isLoading || activitiesQuery.isLoading || notesQuery.isLoading}
                    />
                  ),
                },
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
            <ModuleFilterField label="Start from" htmlFor="projectStartFromFilter">
              <input
                id="projectStartFromFilter"
                className="form-control form-control-sm"
                type="date"
                value={startFrom}
                onChange={(e) => setStartFrom(e.target.value)}
              />
            </ModuleFilterField>
            <ModuleFilterField label="End to" htmlFor="projectEndToFilter">
              <input
                id="projectEndToFilter"
                className="form-control form-control-sm"
                type="date"
                value={endTo}
                onChange={(e) => setEndTo(e.target.value)}
              />
            </ModuleFilterField>
            <ModuleFilterCheckbox
              id="delayedOnly"
              label="Delayed only"
              checked={delayedOnly}
              onChange={setDelayedOnly}
            />
          </div>
        </>
      }
      onClearFilters={() => {
        setSearch("");
        setStatusFilter("");
        setAccountFilter("");
        setManagerFilter("");
        setStartFrom("");
        setEndTo("");
        setDelayedOnly(false);
      }}
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
                { field: "projectType", label: "Type" },
                { field: "accountId", label: "Account" },
                { field: "status", label: "Status" },
                { field: "health", label: "Health" },
                { field: "billingType", label: "Billing" },
                { field: "progressPercent", label: "Progress" },
              ]}
              rows={rows}
              rowKey={(project) => project.id}
              bulk={{
                noun: "projects",
                exportFileName: "projects",
                onComplete: () => void queryClient.invalidateQueries({ queryKey: ["projects"] }),
                actions: [
                  {
                    id: "change-status",
                    label: "Change status",
                    visible: canUpdateProject,
                    doneLabel: "updated",
                    input: { kind: "select", label: "New status", options: enumOptions(PROJECT_STATUSES) },
                    run: (project, status) => updateProject(project.id, projectUpdateBody(project, { status })),
                  },
                  {
                    id: "change-manager",
                    label: "Change manager",
                    visible: canUpdateProject,
                    doneLabel: "reassigned",
                    input: { kind: "select", label: "Project manager", options: bulkManagerOptions },
                    run: (project, projectManagerId) =>
                      updateProject(project.id, projectUpdateBody(project, { projectManagerId })),
                  },
                  {
                    id: "delete",
                    label: "Delete",
                    tone: "danger",
                    visible: canDeleteProject,
                    doneLabel: "deleted",
                    confirm: "Deleted projects disappear from lists, boards and reports.",
                    run: (project) => deleteProject(project.id),
                  },
                ],
              }}
              selectedRowKey={(selected as Project | null)?.id}
              onRowClick={(project) => {
                setSelected(project);
                setShowMilestoneForm(false);
                setShowTaskForm(false);
                setInlineError(null);
              }}
              renderCell={(project, field) => {
                if (field === "billingType") return billingTypeLabel(project.billingType);
                if (field === "projectType") return projectTypeLabel(project.projectType);
                if (field === "accountId")
                  return !project.accountId ? (
                    "—"
                  ) : (
                    <RecordLink module="account" id={project.accountId}>
                      {accountName(project.accountId)}
                    </RecordLink>
                  );
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
