import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { z } from "zod";
import {
  enumPickerOptions,
  optionsFromPairs,
  TechEarnestCreateColumn,
  TechEarnestCreateField,
  TechEarnestCreateGrid,
  TechEarnestCreateSection,
  TechEarnestFormKitCreateView,
  TechEarnestFormSelect,
  TechEarnestFormUserSelect,
  useTechEarnestCreateFlow,
  type TechEarnestPickerUser,
} from "@/components/TechEarnestCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import {
  ModuleListShell,
  countActiveFilters,
} from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { deleteRecord } from "@/components/BulkActions/bulkActions";
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
import { useHasPermission } from "@/features/auth/AuthContext";
import { listDepartments, listRegions, listUsers } from "@/features/admin/adminApi";
import { getMyFieldAcls } from "@/features/admin/studio/metadataApi";
import { listActivities } from "@/features/crm/crmApi";
import { listProjects, listTasks } from "@/features/projects/projectApi";
import { listExpenses } from "@/features/expenses/expenseApi";
import { RecordLink, RelatedRecordList } from "@/components/RecordLink";
import { useUrlSelection } from "@/hooks/useUrlRecord";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { useBulkImport } from "@/features/import/useBulkImport";
import {
  onboardResource,
  getResource,
  updateResource,
  getUtilization,
  listAllocations,
  listResourceSkills,
  listResources,
  listSkills,
  putResourceSkills,
  isExternalType,
  RATE_UNITS,
  RESOURCE_TYPE_META,
  RESOURCE_TYPES,
  resourceTypeLabel,
  deactivateResource,
  reactivateResource,
  type Resource,
  type ResourceSkillItem,
} from "./resourceApi";
import { errorMessage, LoginStatusBadge, ResourcePortalPanel } from "./ResourcePortalPanel";
import { isEndedResource, ResourceLeaveCard, ResourceLifecycleActions } from "./ResourceLifecyclePanel";
import { ResourceTimesheetsCard } from "@/features/timesheets/TimeTrackingCards";

const PROFICIENCIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;
const RESOURCE_STATUSES = ["AVAILABLE", "ON_LEAVE", "INACTIVE"] as const;

const resourceStatusOptions = enumPickerOptions(RESOURCE_STATUSES);

const resourceSchema = z
  .object({
  userId: z.string().optional(),
  departmentId: z.string().optional(),
  managerId: z.string().optional(),
  regionId: z.string().min(1, "Region is required"),
  resourceType: z.string().min(1, "Type is required"),
  designation: z.string().optional(),
  employeeCode: z.string().optional(),
  capacityHoursPerWeek: z.string().optional(),
  costRate: z.string().optional(),
  billingRate: z.string().optional(),
  status: z.string().optional(),
  joiningDate: z.string().optional(),
  fullName: z.string().max(200).optional(),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
  phone: z.string().max(50).optional(),
  engagementEndDate: z.string().optional(),
  engagementStartDate: z.string().optional(),
  contractReference: z.string().max(128).optional(),
  workingHoursPerDay: z.string().optional(),
  workingDaysPerWeek: z.string().optional(),
  experienceYears: z.string().optional(),
  location: z.string().max(128).optional(),
  availableFrom: z.string().optional(),
  billable: z.boolean().optional(),
  rateUnit: z.string().optional(),
  projectId: z.string().optional(),
  allocationStartDate: z.string().optional(),
  allocationEndDate: z.string().optional(),
  allocationPercentage: z.string().optional(),
  allocationRole: z.string().max(128).optional(),
  grantPortalAccess: z.boolean().optional(),
  })
  .superRefine((values, ctx) => {
    const external = isExternalType(values.resourceType);
    if (!external) {
      if (!values.userId) {
        ctx.addIssue({ code: "custom", path: ["userId"], message: "Pick the employee's user account" });
      }
    } else if (!values.userId && !values.fullName?.trim()) {
      ctx.addIssue({ code: "custom", path: ["fullName"], message: "Full name is required for external resources" });
    }
    if (external && values.grantPortalAccess && !values.userId && !values.email?.trim()) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Email is required to send the portal login" });
    }
    const pct = Number(values.allocationPercentage);
    if (values.allocationPercentage?.trim() && (!Number.isFinite(pct) || pct <= 0 || pct > 100)) {
      ctx.addIssue({ code: "custom", path: ["allocationPercentage"], message: "Enter 1–100" });
    }
    if (values.allocationStartDate && values.allocationEndDate && values.allocationEndDate < values.allocationStartDate) {
      ctx.addIssue({ code: "custom", path: ["allocationEndDate"], message: "End date cannot be before start date" });
    }
    if (values.engagementStartDate && values.engagementEndDate && values.engagementEndDate < values.engagementStartDate) {
      ctx.addIssue({ code: "custom", path: ["engagementEndDate"], message: "End date cannot be before start date" });
    }
    const rangeCheck = (field: "workingHoursPerDay" | "workingDaysPerWeek" | "experienceYears", min: number, max: number) => {
      const raw = values[field]?.trim();
      if (!raw) return;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < min || value > max) {
        ctx.addIssue({ code: "custom", path: [field], message: `Enter ${min}–${max}` });
      }
    };
    rangeCheck("workingHoursPerDay", 0.5, 24);
    rangeCheck("workingDaysPerWeek", 0.5, 7);
    rangeCheck("experienceYears", 0, 60);
  });

type ResourceFormValues = z.infer<typeof resourceSchema>;

const RESOURCE_DEFAULTS: ResourceFormValues = {
  userId: "",
  departmentId: "",
  managerId: "",
  regionId: "",
  resourceType: "EMPLOYEE",
  designation: "",
  employeeCode: "",
  capacityHoursPerWeek: "40",
  costRate: "",
  billingRate: "",
  status: "AVAILABLE",
  joiningDate: "",
  fullName: "",
  email: "",
  phone: "",
  engagementEndDate: "",
  engagementStartDate: "",
  contractReference: "",
  workingHoursPerDay: "8",
  workingDaysPerWeek: "5",
  experienceYears: "",
  location: "",
  availableFrom: "",
  billable: true,
  rateUnit: "HOURLY",
  projectId: "",
  allocationStartDate: "",
  allocationEndDate: "",
  allocationPercentage: "100",
  allocationRole: "",
  grantPortalAccess: true,
};

function currentMonthRange(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const periodStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const periodEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { periodStart, periodEnd };
}

function parseOptionalNumber(value?: string): number | undefined {
  if (!value?.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function formatRate(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function ResourceTypeBadge({ type }: { type: string }) {
  const external = isExternalType(type);
  return (
    <span className={`badge ${external ? "bg-warning-subtle text-warning-emphasis" : "bg-primary-subtle text-primary-emphasis"}`}>
      {resourceTypeLabel(type)}
    </span>
  );
}

function resourceTitle(resource: Resource): string {
  return resource.employeeName ?? resource.fullName ?? resource.designation ?? resource.employeeCode ?? "Resource";
}

const RESOURCE_OPTIONAL_COLUMNS = [
  { field: "fullName", label: "Full name" },
  { field: "email", label: "Email" },
  { field: "phone", label: "Phone" },
  { field: "engagementEndDate", label: "Engagement end" },
  { field: "accessExpiresAt", label: "Portal access until" },
  { field: "departmentName", label: "Department" },
  { field: "managerName", label: "Manager" },
  { field: "joiningDate", label: "Joining date" },
  { field: "createdAt", label: "Created time" },
  { field: "updatedAt", label: "Modified time" },
];

export function ResourcesPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("RESOURCE_MANAGE");
  const canViewAllocations = useHasPermission("ALLOCATION_VIEW");
  const canViewProjects = useHasPermission("PROJECT_VIEW");
  const canViewTimesheets = useHasPermission("TIMESHEET_VIEW");
  const canViewTasks = useHasPermission("TASK_VIEW");
  const canViewActivities = useHasPermission("ACTIVITY_VIEW");
  const canViewExpenses = useHasPermission("EXPENSE_VIEW");
  const hasRateViewPermission = useHasPermission("RATE_VIEW");
  const canInvitePortal = useHasPermission("RESOURCE_PORTAL_INVITE");
  const canAllocate = useHasPermission("RESOURCE_ALLOCATE") && canViewProjects;
  const canSendTimesheetLink = useHasPermission("TIMESHEET_LINK_SEND");
  const rateAclQuery = useQuery({
    queryKey: ["metadata", "field-acls", "me", "resource"],
    queryFn: () => getMyFieldAcls("resource"),
    staleTime: 60_000,
    retry: false,
  });
  const canViewCostRate = rateAclQuery.data?.costRate != null
    ? ["READ", "WRITE"].includes(rateAclQuery.data.costRate)
    : hasRateViewPermission;
  const canViewBillingRate = rateAclQuery.data?.billingRate != null
    ? ["READ", "WRITE"].includes(rateAclQuery.data.billingRate)
    : hasRateViewPermission;
  const canWriteCostRate = rateAclQuery.data?.costRate === "WRITE";
  const canWriteBillingRate = rateAclQuery.data?.billingRate === "WRITE";
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [draftSkills, setDraftSkills] = useState<ResourceSkillItem[]>([]);
  const [newSkillId, setNewSkillId] = useState("");
  const [newProficiency, setNewProficiency] = useState<string>("INTERMEDIATE");
  const monthRange = useMemo(() => currentMonthRange(), []);

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter || undefined,
      regionId: regionFilter || undefined,
      skillId: skillFilter || undefined,
    }),
    [search, statusFilter, regionFilter, skillFilter],
  );

  const resourcesQuery = useQuery({
    queryKey: ["resources", listParams],
    queryFn: () => listResources(listParams),
  });
  const [selected, setSelected] = useUrlSelection(resourcesQuery.data, { fetchById: getResource });
  const resourceExpensesQuery = useQuery({
    queryKey: ["expenses", "resource", selected?.id],
    queryFn: () => listExpenses({ resourceId: selected!.id }),
    enabled: !!selected && canViewExpenses,
  });
  const resourceDetailQuery = useQuery({
    queryKey: ["resources", selected?.id, "detail"],
    queryFn: () => getResource(selected!.id),
    enabled: !!selected,
  });
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: showForm && canManage,
    retry: false,
  });
  const departmentsQuery = useQuery({
    queryKey: ["admin", "departments"],
    queryFn: listDepartments,
    enabled: showForm && canManage,
    retry: false,
  });
  const skillsCatalogQuery = useQuery({
    queryKey: ["skills"],
    queryFn: () => listSkills(),
  });
  const resourceSkillsQuery = useQuery({
    queryKey: ["resources", (selected as Resource | null)?.id, "skills"],
    queryFn: () => listResourceSkills(selected!.id),
    enabled: !!selected,
  });
  const utilizationQuery = useQuery({
    queryKey: ["resources", (selected as Resource | null)?.id, "utilization", monthRange.periodStart, monthRange.periodEnd],
    queryFn: () =>
      getUtilization(selected!.id, monthRange.periodStart, monthRange.periodEnd),
    enabled: !!selected,
  });
  const allocationsQuery = useQuery({
    queryKey: ["allocations", "resource", (selected as Resource | null)?.id],
    queryFn: () => listAllocations({ resourceId: selected!.id }),
    enabled: !!selected && (canViewAllocations || canViewProjects),
  });
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
    enabled: (!!selected || (showForm && canAllocate)) && canViewProjects,
  });
  const formProjectsQuery = projectsQuery;
  const [createNotice, setCreateNotice] = useState<{ notes: string[]; warnings: string[] } | null>(null);
  const assignedTasksQuery = useQuery({
    queryKey: ["tasks", "resource", (selected as Resource | null)?.id],
    queryFn: () => listTasks({ assignedResourceId: selected!.id }),
    enabled: !!selected && canViewTasks,
  });
  const activitiesQuery = useQuery({
    queryKey: ["crm", "activities", "RESOURCE", (selected as Resource | null)?.id],
    queryFn: () => listActivities({ relatedEntityType: "RESOURCE", relatedEntityId: selected!.id }),
    enabled: !!selected && canViewActivities,
  });

  const timelineEntries = useMemo(
    () =>
      buildTimelineEntries(
        undefined,
        activitiesQuery.data,
        undefined,
        recordLifecycleInfo("Resource", resourceDetailQuery.data ? { ...resourceDetailQuery.data, ownerId: resourceDetailQuery.data.userId } : selected ? { ...selected, ownerId: selected.userId } : null),
      ),
    [activitiesQuery.data, selected, resourceDetailQuery.data],
  );

  useEffect(() => {
    if (resourceSkillsQuery.data) {
      setDraftSkills(
        resourceSkillsQuery.data.map((s) => ({
          skillId: s.skillId,
          proficiency: s.proficiency,
          yearsOfExperience: s.yearsOfExperience,
        })),
      );
    }
  }, [resourceSkillsQuery.data]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceSchema),
    defaultValues: RESOURCE_DEFAULTS,
  });
  const formResourceType = watch("resourceType");
  const formProjectId = watch("projectId");
  const formGrantPortal = watch("grantPortalAccess");
  const formProject = (formProjectsQuery.data ?? []).find((project) => project.id === formProjectId);
  const formIsExternal = isExternalType(formResourceType);
  const formCode = watch("employeeCode");

  const {
    setSaveAndNew,
    photo,
    cancelCreate,
    afterCreateSuccess,
  } = useTechEarnestCreateFlow({
    defaults: RESOURCE_DEFAULTS,
    reset,
    setShowForm,
    setFormError,
    setSelected: (entity) => setSelected(entity as Resource),
  });

  const buildResourceBody = (values: ResourceFormValues) => ({
    fullName: values.fullName?.trim() || undefined,
    email: values.email?.trim() || undefined,
    phone: values.phone?.trim() || undefined,
    engagementEndDate: values.engagementEndDate || null,
    userId: values.userId || null,
    departmentId: values.departmentId || null,
    managerId: values.managerId || null,
    regionId: values.regionId,
    resourceType: values.resourceType,
    designation: values.designation || undefined,
    capacityHoursPerWeek: parseOptionalNumber(values.capacityHoursPerWeek) ?? null,
    costRate: canWriteCostRate ? parseOptionalNumber(values.costRate) ?? null : undefined,
    billingRate: canWriteBillingRate ? parseOptionalNumber(values.billingRate) ?? null : undefined,
    status: values.status || "AVAILABLE",
    joiningDate: values.joiningDate || undefined,
    profile: {
      engagementStartDate: values.engagementStartDate || null,
      contractReference: values.contractReference?.trim() || null,
      workingHoursPerDay: parseOptionalNumber(values.workingHoursPerDay) ?? null,
      workingDaysPerWeek: parseOptionalNumber(values.workingDaysPerWeek) ?? null,
      experienceYears: parseOptionalNumber(values.experienceYears) ?? null,
      location: values.location?.trim() || null,
      availableFrom: values.availableFrom || null,
      billable: values.billable ?? true,
      rateUnit: values.rateUnit || "HOURLY",
    },
  });

  const createMutation = useMutation({
    mutationFn: onboardResource,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["resources"] }),
        queryClient.invalidateQueries({ queryKey: ["allocations"] }),
      ]);
      setFormError(null);
      const notes: string[] = [];
      if (result.allocation) notes.push(`Allocated to ${projectName(result.allocation.projectId)}.`);
      if (result.portalAccess) {
        notes.push(
          result.portalAccess.emailed
            ? `Portal login sent to ${result.portalAccess.email}.`
            : `Portal login created for ${result.portalAccess.email}; share the invite link from the Portal & timesheets tab.`,
        );
      }
      setCreateNotice({ notes, warnings: result.warnings });
      await afterCreateSuccess(result.resource, "RESOURCE");
    },
    onError: (e) => setFormError(errorMessage(e, "Could not create resource. Check required fields.")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateResource>[1] }) => updateResource(id, body),
    onSuccess: async (resource) => {
      await queryClient.invalidateQueries({ queryKey: ["resources"] });
      setSelected(resource);
      setEditingResourceId(null);
      setFormError(null);
      setShowForm(false);
      reset(RESOURCE_DEFAULTS);
    },
    onError: (e) => setFormError(errorMessage(e, "Could not update resource. Check required fields.")),
  });

  const onCreateSubmit = (values: ResourceFormValues) => {
    if (canAllocate && isExternalType(values.resourceType) && !values.projectId) {
      setError("projectId", { type: "custom", message: "Select the project this resource will work on" });
      return;
    }
    const pct = parseOptionalNumber(values.allocationPercentage);
    createMutation.mutate({
      resource: buildResourceBody(values),
      projectId: canAllocate ? values.projectId || null : null,
      allocationStartDate: values.allocationStartDate || null,
      allocationEndDate: values.allocationEndDate || null,
      allocationPercentage: pct ?? null,
      allocationRole: values.allocationRole?.trim() || null,
      grantPortalAccess: canInvitePortal && isExternalType(values.resourceType) ? !!values.grantPortalAccess : false,
    });
  };

  const onUpdateSubmit = (values: ResourceFormValues) => {
    if (!editingResourceId) return;
    const base = buildResourceBody(values);
    updateMutation.mutate({
      id: editingResourceId,
      body: {
        ...base,
        profile: {
          ...base.profile,
          clearAvailableFrom: !values.availableFrom,
          clearEngagementStartDate: !values.engagementStartDate,
        },
        // Blank strings clear contact fields on update; omitted (undefined) would keep the old value.
        fullName: values.fullName?.trim() ?? "",
        email: values.email?.trim() ?? "",
        phone: values.phone?.trim() ?? "",
        clearEngagementEndDate: !values.engagementEndDate,
      },
    });
  };

  function openResourceEdit(resource: Resource) {
    setEditingResourceId(resource.id);
    setFormError(null);
    reset({
      userId: resource.userId ?? "",
      departmentId: resource.departmentId ?? "",
      managerId: resource.managerId ?? "",
      regionId: resource.regionId,
      resourceType: resource.resourceType,
      designation: resource.designation ?? "",
      employeeCode: resource.employeeCode ?? "",
      capacityHoursPerWeek: resource.capacityHoursPerWeek != null ? String(resource.capacityHoursPerWeek) : "",
      costRate: resource.costRate != null ? String(resource.costRate) : "",
      billingRate: resource.billingRate != null ? String(resource.billingRate) : "",
      status: resource.status,
      joiningDate: resource.joiningDate ?? "",
      fullName: resource.fullName ?? "",
      email: resource.email ?? "",
      phone: resource.phone ?? "",
      engagementEndDate: resource.engagementEndDate ?? "",
      engagementStartDate: resource.engagementStartDate ?? "",
      contractReference: resource.contractReference ?? "",
      workingHoursPerDay: resource.workingHoursPerDay != null ? String(resource.workingHoursPerDay) : "",
      workingDaysPerWeek: resource.workingDaysPerWeek != null ? String(resource.workingDaysPerWeek) : "",
      experienceYears: resource.experienceYears != null ? String(resource.experienceYears) : "",
      location: resource.location ?? "",
      availableFrom: resource.availableFrom ?? "",
      billable: resource.billable ?? true,
      rateUnit: resource.rateUnit ?? "HOURLY",
    });
    setShowForm(true);
  }

  const skillsMutation = useMutation({
    mutationFn: () => putResourceSkills(selected!.id, { skills: draftSkills }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resources", selected!.id, "skills"] });
      setSkillsError(null);
    },
    onError: () => setSkillsError("Could not update skills."),
  });

  const skillName = (id: string) =>
    skillsCatalogQuery.data?.find((s) => s.id === id)?.name ?? id.slice(0, 8);

  const regionName = (id: string) =>
    regionsQuery.data?.find((r) => r.id === id)?.name ?? id.slice(0, 8);

  const rows = resourcesQuery.data ?? [];
  const selectedResource = resourceDetailQuery.data ?? selected;
  const recordNav = useRecordNavigation(rows, selected, setSelected);
  const activeFilterCount = countActiveFilters(search, statusFilter, regionFilter, skillFilter);
  const bulkImport = useBulkImport("resources", () => queryClient.invalidateQueries({ queryKey: ["resources"] }));

  function openCreateResource() {
    setEditingResourceId(null);
    setFormError(null);
    setCreateNotice(null);
    reset(RESOURCE_DEFAULTS);
    setShowForm(true);
  }

  const projectName = useMemo(() => {
    const map = new Map((projectsQuery.data ?? []).map((project) => [project.id, project.name]));
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [projectsQuery.data]);
  const formProjectOptions = useMemo(
    () =>
      optionsFromPairs(
        (projectsQuery.data ?? [])
          .filter((project) => project.status !== "COMPLETED" && project.status !== "CANCELLED")
          .map((project) => ({ value: project.id, label: project.name, subtitle: project.projectCode })),
      ),
    [projectsQuery.data],
  );

  const openActivities = useMemo(
    () => (activitiesQuery.data ?? []).filter((activity) => activity.status !== "COMPLETED"),
    [activitiesQuery.data],
  );
  const closedActivities = useMemo(
    () => (activitiesQuery.data ?? []).filter((activity) => activity.status === "COMPLETED"),
    [activitiesQuery.data],
  );

  const relatedProjects = useMemo(() => {
    const projectIds = new Set((allocationsQuery.data ?? []).map((allocation) => allocation.projectId));
    return (projectsQuery.data ?? []).filter((project) => projectIds.has(project.id));
  }, [allocationsQuery.data, projectsQuery.data]);

  const regionOptions = useMemo(
    () =>
      optionsFromPairs(
        (regionsQuery.data ?? []).map((region) => ({ value: region.id, label: region.name })),
      ),
    [regionsQuery.data],
  );
  const editingResource = editingResourceId ? rows.find((row) => row.id === editingResourceId) ?? selectedResource : null;
  const pickerUsers = useMemo(() => {
    const users: TechEarnestPickerUser[] = (usersQuery.data ?? []).map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    }));
    const known = new Set(users.map((user) => user.id));
    const addFallback = (id: string | null | undefined, name: string | null | undefined) => {
      if (id && name && !known.has(id)) {
        known.add(id);
        users.push({ id, firstName: name, lastName: "", email: null });
      }
    };
    addFallback(editingResource?.userId, editingResource?.employeeName);
    addFallback(editingResource?.managerId, editingResource?.managerName);
    return users;
  }, [usersQuery.data, editingResource]);
  const departmentOptions = useMemo(() => {
    const options = (departmentsQuery.data ?? []).map((department) => ({ value: department.id, label: department.name }));
    if (
      editingResource?.departmentId
      && editingResource.departmentName
      && !options.some((option) => option.value === editingResource.departmentId)
    ) {
      options.push({ value: editingResource.departmentId, label: editingResource.departmentName });
    }
    return optionsFromPairs(options);
  }, [departmentsQuery.data, editingResource]);
  const skillFilterOptions = useMemo(
    () => optionsFromPairs((skillsCatalogQuery.data ?? []).map((skill) => ({ value: skill.id, label: skill.name }))),
    [skillsCatalogQuery.data],
  );

  return (
    <>
      {showForm && canManage ? (
        <TechEarnestFormKitCreateView
          title={editingResourceId ? "Edit Resource" : "Create Resource"}
          tableCode="resource"
          recordId={editingResourceId}
          entityLabel="Resource"
          pending={isSubmitting || createMutation.isPending || updateMutation.isPending}
          isDirty={isDirty}
          formError={formError}
          onCancel={() => {
            if (editingResourceId) {
              setEditingResourceId(null);
              setShowForm(false);
              reset(RESOURCE_DEFAULTS);
            } else cancelCreate(isDirty);
          }}
          onSave={() => void handleSubmit(editingResourceId ? onUpdateSubmit : onCreateSubmit)()}
          onSaveAndNew={!editingResourceId ? () => {
            setSaveAndNew(true);
            void handleSubmit(onCreateSubmit)();
          } : undefined}
          onSubmit={() => void handleSubmit(editingResourceId ? onUpdateSubmit : onCreateSubmit)()}
          photo={photo}
        >
          <TechEarnestCreateSection title="Resource Type">
            <div className="resource-type-picker" role="radiogroup" aria-label="Resource type">
              {RESOURCE_TYPES.map((type) => {
                const meta = RESOURCE_TYPE_META[type];
                const active = formResourceType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`resource-type-option${active ? " is-active" : ""}`}
                    onClick={() => setValue("resourceType", type, { shouldDirty: true, shouldValidate: true })}
                  >
                    <span className="resource-type-option__title">
                      {meta.label}
                      <span className="resource-type-option__prefix">{meta.prefix}-###</span>
                    </span>
                    <span className="resource-type-option__hint">{meta.hint}</span>
                  </button>
                );
              })}
            </div>
          </TechEarnestCreateSection>
          <TechEarnestCreateSection title="Resource Information">
            <TechEarnestCreateGrid>
              <TechEarnestCreateColumn>
                {formIsExternal ? (
                  <TechEarnestCreateField label="Full Name" required error={errors.fullName?.message}>
                    <input
                      type="text"
                      maxLength={200}
                      className="form-control form-control-sm"
                      placeholder="Contractor or freelancer name"
                      {...register("fullName")}
                    />
                  </TechEarnestCreateField>
                ) : (
                  <TechEarnestCreateField label="User Account" required error={errors.userId?.message}>
                    <TechEarnestFormUserSelect
                      control={control}
                      name="userId"
                      users={pickerUsers}
                      searchPlaceholder="Search Users"
                      placeholder={usersQuery.isError ? "Users are not available" : "Select the employee's user"}
                    />
                  </TechEarnestCreateField>
                )}
                <TechEarnestCreateField label="Code">
                  <input
                    type="text"
                    readOnly
                    className="form-control form-control-sm"
                    value={
                      formCode
                      || `Auto-generated on save (${RESOURCE_TYPE_META[formResourceType as keyof typeof RESOURCE_TYPE_META]?.prefix ?? "EMP"}-###)`
                    }
                    aria-readonly="true"
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Designation" error={errors.designation?.message}>
                  <input type="text" maxLength={128} className="form-control form-control-sm" {...register("designation")} />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Department">
                  <TechEarnestFormSelect
                    control={control}
                    name="departmentId"
                    options={departmentOptions}
                    searchPlaceholder="Search Departments"
                    lookupIcon="building"
                    placeholder={departmentsQuery.isError ? "Departments are not available" : "Select department"}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Reporting Manager">
                  <TechEarnestFormUserSelect
                    control={control}
                    name="managerId"
                    users={pickerUsers}
                    searchPlaceholder="Search Users"
                    placeholder={usersQuery.isError ? "Users are not available" : "Select manager"}
                  />
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
              <TechEarnestCreateColumn>
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
                <TechEarnestCreateField label="Status">
                  <TechEarnestFormSelect
                    control={control}
                    name="status"
                    options={resourceStatusOptions}
                    searchPlaceholder="Search Statuses"
                    allowEmpty={false}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Joining Date">
                  <input type="date" className="form-control form-control-sm" {...register("joiningDate")} />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Experience (years)" error={errors.experienceYears?.message}>
                  <input type="number" min={0} max={60} step="0.5" className="form-control form-control-sm" {...register("experienceYears")} />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Location" error={errors.location?.message}>
                  <input type="text" maxLength={128} className="form-control form-control-sm" placeholder="City or Remote" {...register("location")} />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Available From" hint="Leave empty to derive it from allocations.">
                  <input type="date" className="form-control form-control-sm" {...register("availableFrom")} />
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
            </TechEarnestCreateGrid>
          </TechEarnestCreateSection>
          {formIsExternal ? (
            <TechEarnestCreateSection title="Contact & Engagement">
              <p className="small text-muted mb-2">
                External resources sign in through a portal login to fill in timesheets for the projects they are
                allocated to. Their access ends on the engagement end date.
              </p>
              <TechEarnestCreateGrid>
                <TechEarnestCreateColumn>
                  <TechEarnestCreateField label="Email" error={errors.email?.message}>
                    <input
                      type="email"
                      maxLength={255}
                      className="form-control form-control-sm"
                      placeholder="Needed for the portal login"
                      {...register("email")}
                    />
                  </TechEarnestCreateField>
                  <TechEarnestCreateField label="Phone" error={errors.phone?.message}>
                    <input type="tel" maxLength={50} className="form-control form-control-sm" {...register("phone")} />
                  </TechEarnestCreateField>
                </TechEarnestCreateColumn>
                <TechEarnestCreateColumn>
                  <TechEarnestCreateField label="Engagement Start Date">
                    <input type="date" className="form-control form-control-sm" {...register("engagementStartDate")} />
                  </TechEarnestCreateField>
                  <TechEarnestCreateField label="Engagement End Date" error={errors.engagementEndDate?.message}>
                    <input type="date" className="form-control form-control-sm" {...register("engagementEndDate")} />
                  </TechEarnestCreateField>
                  <TechEarnestCreateField label="Contract Reference" error={errors.contractReference?.message}>
                    <input type="text" maxLength={128} className="form-control form-control-sm" placeholder="SOW / PO number" {...register("contractReference")} />
                  </TechEarnestCreateField>
                </TechEarnestCreateColumn>
              </TechEarnestCreateGrid>
            </TechEarnestCreateSection>
          ) : null}
          {!editingResourceId && canAllocate ? (
            <TechEarnestCreateSection title="Project & Access">
              <TechEarnestCreateGrid>
                <TechEarnestCreateColumn>
                  <TechEarnestCreateField
                    label="Project"
                    required={formIsExternal}
                    error={errors.projectId?.message}
                    hint={formIsExternal ? undefined : "Optional for employees; leave empty to keep them on the bench."}
                  >
                    <TechEarnestFormSelect
                      control={control}
                      name="projectId"
                      options={formProjectOptions}
                      searchPlaceholder="Search Projects"
                      placeholder="Select project"
                      invalid={!!errors.projectId}
                    />
                  </TechEarnestCreateField>
                  {formProjectId ? (
                    <>
                      <TechEarnestCreateField label="Role on Project" error={errors.allocationRole?.message}>
                        <input
                          type="text"
                          maxLength={128}
                          className="form-control form-control-sm"
                          placeholder="e.g. Backend developer"
                          {...register("allocationRole")}
                        />
                      </TechEarnestCreateField>
                      <TechEarnestCreateField label="Allocation %" error={errors.allocationPercentage?.message}>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          step="5"
                          className="form-control form-control-sm"
                          {...register("allocationPercentage")}
                        />
                      </TechEarnestCreateField>
                    </>
                  ) : null}
                </TechEarnestCreateColumn>
                <TechEarnestCreateColumn>
                  {formProjectId ? (
                    <>
                      <TechEarnestCreateField label="Allocation Start" hint="Defaults to today.">
                        <input type="date" className="form-control form-control-sm" {...register("allocationStartDate")} />
                      </TechEarnestCreateField>
                      <TechEarnestCreateField
                        label="Allocation End"
                        error={errors.allocationEndDate?.message}
                        hint={
                          formProject?.endDate
                            ? `Defaults to the project end date (${formProject.endDate}).`
                            : "Defaults to the engagement end date, or 3 months."
                        }
                      >
                        <input type="date" className="form-control form-control-sm" {...register("allocationEndDate")} />
                      </TechEarnestCreateField>
                    </>
                  ) : null}
                  {formIsExternal && canInvitePortal ? (
                    <TechEarnestCreateField label="Default Access">
                      <div className="form-check mb-0">
                        <input
                          id="resource-grant-portal"
                          type="checkbox"
                          className="form-check-input"
                          {...register("grantPortalAccess")}
                        />
                        <label className="form-check-label small" htmlFor="resource-grant-portal">
                          Send portal login to fill timesheets
                        </label>
                      </div>
                      {formGrantPortal ? (
                        <div className="form-text small">
                          An invite with a set-password link is emailed. They see only their allocated projects and own
                          timesheets.
                        </div>
                      ) : null}
                    </TechEarnestCreateField>
                  ) : null}
                  {!formIsExternal ? (
                    <p className="small text-muted mb-0 pt-1">
                      Employees sign in with their existing user account and can log time on the selected project
                      straight away.
                    </p>
                  ) : null}
                </TechEarnestCreateColumn>
              </TechEarnestCreateGrid>
            </TechEarnestCreateSection>
          ) : null}
          <TechEarnestCreateSection title="Capacity & Rates">
            <TechEarnestCreateGrid>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Capacity (hrs/week)" error={errors.capacityHoursPerWeek?.message}>
                  <input type="number" min={0} step="0.5" className="form-control form-control-sm" {...register("capacityHoursPerWeek")} />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Working Hours / Day" error={errors.workingHoursPerDay?.message}>
                  <input type="number" min={0.5} max={24} step="0.5" className="form-control form-control-sm" {...register("workingHoursPerDay")} />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Working Days / Week" error={errors.workingDaysPerWeek?.message}>
                  <input type="number" min={0.5} max={7} step="0.5" className="form-control form-control-sm" {...register("workingDaysPerWeek")} />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Billable">
                  <div className="form-check mt-1">
                    <input id="resource-billable" type="checkbox" className="form-check-input" {...register("billable")} />
                    <label className="form-check-label small" htmlFor="resource-billable">
                      Time on client projects is billable by default
                    </label>
                  </div>
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
              <TechEarnestCreateColumn>
                {canWriteCostRate || canWriteBillingRate ? (
                  <TechEarnestCreateField label="Rate Unit" hint="Daily and monthly rates are converted to hourly using working hours.">
                    <select className="form-select form-select-sm" {...register("rateUnit")}>
                      {RATE_UNITS.map((unit) => (
                        <option key={unit} value={unit}>{unit.charAt(0) + unit.slice(1).toLowerCase()}</option>
                      ))}
                    </select>
                  </TechEarnestCreateField>
                ) : null}
                {canWriteCostRate ? (
                  <TechEarnestCreateField label="Cost Rate" error={errors.costRate?.message}>
                    <input type="number" min={0} step="0.01" className="form-control form-control-sm" {...register("costRate")} />
                  </TechEarnestCreateField>
                ) : null}
                {canWriteBillingRate ? (
                  <TechEarnestCreateField label="Billing Rate" error={errors.billingRate?.message}>
                    <input type="number" min={0} step="0.01" className="form-control form-control-sm" {...register("billingRate")} />
                  </TechEarnestCreateField>
                ) : null}
              </TechEarnestCreateColumn>
            </TechEarnestCreateGrid>
          </TechEarnestCreateSection>
        </TechEarnestFormKitCreateView>
      ) : selectedResource ? (
        <RecordShell
              title={resourceTitle(selectedResource)}
              subtitle={[selectedResource.designation, selectedResource.employeeCode].filter(Boolean).join(" · ") || selectedResource.id.slice(0, 8)}
              meta={
                <span className="text-muted small">
                  {regionName(selectedResource.regionId)} · {resourceTypeLabel(selectedResource.resourceType)}
                </span>
              }
              status={<StatusBadge status={selectedResource.status} />}
              recordKey={selectedResource.id}
              customFieldsTable="resource"
              layout="page"
              avatarLabel={resourceTitle(selectedResource)}
              onBack={recordNav.goBack}
              onPrev={recordNav.goPrev}
              onNext={recordNav.goNext}
              hasPrev={recordNav.hasPrev}
              hasNext={recordNav.hasNext}
              relatedLinks={[
                ...(canViewAllocations ? [{ id: "allocations", label: "Allocations" }] : []),
                ...(canViewTimesheets ? [{ id: "timesheets", label: "Timesheets" }] : []),
                ...(canViewExpenses ? [{ id: "expenses", label: "Expenses" }] : []),
                ...(canViewProjects ? [{ id: "projects", label: "Projects" }] : []),
                ...(canViewTasks ? [{ id: "tasks", label: "Assigned Tasks" }] : []),
                ...DEFAULT_RELATED_LINKS,
              ]}
              primaryAction={
                selectedResource.email ? (
                  <a className="btn btn-primary btn-sm" href={`mailto:${selectedResource.email}`}>
                    Send Email
                  </a>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm" disabled>
                    Send Email
                  </button>
                )
              }
              secondaryActions={
                <>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={!canManage}
                    onClick={() => openResourceEdit(selectedResource)}
                  >
                    Edit
                  </button>
                  {canManage ? (
                    <ResourceLifecycleActions
                      resource={selectedResource}
                      onChanged={(result) => {
                        setSelected(result.resource);
                        const notes: string[] = [];
                        if (isEndedResource(result.resource)) {
                          notes.push(`Resource deactivated (${result.resource.status.replace(/_/g, " ").toLowerCase()}).`);
                          if (result.allocationsEnded) notes.push(`${result.allocationsEnded} current allocation(s) ended.`);
                          if (result.allocationsCancelled) notes.push(`${result.allocationsCancelled} future allocation(s) cancelled.`);
                          if (result.portalAccessRevoked) notes.push("Portal login revoked.");
                        } else {
                          notes.push("Resource reactivated.");
                        }
                        setCreateNotice({ notes, warnings: [] });
                      }}
                    />
                  ) : null}
                </>
              }
              tabs={[
                {
                  id: "overview",
                  label: "Overview",
                  content: (
                <>
                  {createNotice ? (
                    <div
                      className={`alert ${createNotice.warnings.length ? "alert-warning" : "alert-success"} py-2 small d-flex justify-content-between align-items-start`}
                      role="status"
                    >
                      <div>
                        {createNotice.notes.map((note) => (
                          <div key={note}>{note}</div>
                        ))}
                        {createNotice.warnings.map((warning) => (
                          <div key={warning} className="fw-semibold">
                            {warning}
                          </div>
                        ))}
                      </div>
                      <button type="button" className="btn-close btn-sm" aria-label="Dismiss" onClick={() => setCreateNotice(null)} />
                    </div>
                  ) : null}
                  <TechEarnestRecordSummaryStrip
                    fields={[
                      { label: "Reporting Manager", value: selectedResource.managerName ?? "—" },
                      { label: "Email", value: selectedResource.email ?? "—" },
                      { label: "Resource Type", value: resourceTypeLabel(selectedResource.resourceType) },
                      {
                        label: "Utilization",
                        value: utilizationQuery.isLoading
                          ? "Loading…"
                          : utilizationQuery.data?.utilizationPercent != null
                            ? `${utilizationQuery.data.utilizationPercent}%`
                            : "—",
                      },
                      { label: "Status", value: <StatusBadge status={selectedResource.status} /> },
                    ]}
                  />

                  <TechEarnestRecordInfoSection
                    title="Resource Information"
                    fields={[
                      { label: isExternalType(selectedResource.resourceType) ? "Name" : "Employee", value: selectedResource.employeeName ?? "—" },
                      { label: "Code", value: selectedResource.employeeCode ?? "—" },
                      { label: "Designation", value: selectedResource.designation ?? "—" },
                      { label: "Department", value: selectedResource.departmentName ?? "—" },
                      { label: "Reporting Manager", value: selectedResource.managerName ?? "—" },
                      { label: "Region", value: regionName(selectedResource.regionId) },
                      { label: "Resource Type", value: <ResourceTypeBadge type={selectedResource.resourceType} /> },
                      { label: "Status", value: selectedResource.status },
                      { label: "Joining Date", value: selectedResource.joiningDate ?? "—" },
                      { label: "Experience", value: selectedResource.experienceYears != null ? `${selectedResource.experienceYears} yrs` : "—" },
                      { label: "Location", value: selectedResource.location ?? "—" },
                      { label: "Available From", value: selectedResource.availableFrom ?? "—" },
                      { label: "Billable", value: selectedResource.billable === false ? "No" : "Yes" },
                      { label: "Login", value: <LoginStatusBadge status={selectedResource.loginStatus} /> },
                      ...(selectedResource.deactivatedAt
                        ? [
                            { label: "Deactivated", value: new Date(selectedResource.deactivatedAt).toLocaleDateString() },
                            { label: "Deactivation Reason", value: selectedResource.deactivationReason ?? "—" },
                          ]
                        : []),
                    ]}
                  />

                  <TechEarnestRecordInfoSection
                    title="Contact & Engagement"
                    fields={[
                      { label: "Full Name", value: selectedResource.fullName ?? "—" },
                      { label: "Email", value: selectedResource.email ?? "—" },
                      { label: "Phone", value: selectedResource.phone ?? "—" },
                      { label: "Engagement Start", value: selectedResource.engagementStartDate ?? "—" },
                      { label: "Engagement End", value: selectedResource.engagementEndDate ?? "—" },
                      { label: "Contract Reference", value: selectedResource.contractReference ?? "—" },
                      ...(selectedResource.accessExpiresAt
                        ? [{ label: "Portal Access Until", value: new Date(selectedResource.accessExpiresAt).toLocaleDateString() }]
                        : []),
                    ]}
                  />

                  <TechEarnestRecordInfoSection
                    title="Capacity & Rates"
                    fields={[
                      {
                        label: "Capacity",
                        value:
                          selectedResource.capacityHoursPerWeek != null
                            ? `${selectedResource.capacityHoursPerWeek} hrs/week`
                            : "—",
                      },
                      {
                        label: "Working Pattern",
                        value: `${selectedResource.workingHoursPerDay ?? 8} h/day · ${selectedResource.workingDaysPerWeek ?? 5} days/week`,
                      },
                      ...(canViewCostRate ? [{ label: "Cost Rate", value: `${formatRate(selectedResource.costRate)}${selectedResource.costRate != null && selectedResource.rateUnit ? ` / ${selectedResource.rateUnit.toLowerCase()}` : ""}` }] : []),
                      ...(canViewBillingRate ? [{ label: "Billing Rate", value: `${formatRate(selectedResource.billingRate)}${selectedResource.billingRate != null && selectedResource.rateUnit ? ` / ${selectedResource.rateUnit.toLowerCase()}` : ""}` }] : []),
                      {
                        label: `Allocated (${monthRange.periodStart} → ${monthRange.periodEnd})`,
                        value: utilizationQuery.data?.allocatedHours != null ? `${utilizationQuery.data.allocatedHours}h` : "—",
                      },
                      {
                        label: "Available This Month",
                        value: utilizationQuery.data?.availableHours != null ? `${utilizationQuery.data.availableHours}h` : "—",
                      },
                      {
                        label: "Utilization",
                        value: (
                          <>
                            {utilizationQuery.data?.utilizationPercent != null
                              ? `${utilizationQuery.data.utilizationPercent}%`
                              : "—"}
                            {utilizationQuery.data?.overAllocated ? (
                              <span className="badge bg-danger ms-1">OVER ALLOCATED</span>
                            ) : null}
                          </>
                        ),
                      },
                      ...(utilizationQuery.data?.warning ? [{ label: "Warning", value: utilizationQuery.data.warning }] : []),
                    ]}
                  />

                  <ResourceLeaveCard resourceId={selectedResource.id} canManage={canManage} />

                  <TechEarnestRecordRelatedCard
                    id="techearnest-record-section-skills"
                    title={`Skills (${draftSkills.length})`}
                    isEmpty={!resourceSkillsQuery.isLoading && !draftSkills.length && !canManage}
                    emptyLabel="No records found"
                    actions={
                      canManage ? (
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          disabled={skillsMutation.isPending}
                          onClick={() => skillsMutation.mutate()}
                        >
                          Save
                        </button>
                      ) : null
                    }
                  >
                    {skillsError ? <div className="alert alert-danger py-2">{skillsError}</div> : null}
                    {resourceSkillsQuery.isLoading ? (
                      <LoadingState label="Loading skills…" workspace />
                    ) : null}
                    <ul className="list-unstyled small mb-2">
                      {draftSkills.map((item) => (
                        <li
                          key={item.skillId}
                          className="d-flex justify-content-between align-items-center mb-1"
                        >
                          <span>
                            {skillName(item.skillId)} — {item.proficiency}
                            {item.yearsOfExperience != null
                              ? ` · ${item.yearsOfExperience} yrs`
                              : ""}
                          </span>
                          {canManage ? (
                            <button
                              type="button"
                              className="btn btn-link btn-sm text-danger p-0"
                              onClick={() =>
                                setDraftSkills((prev) =>
                                  prev.filter((skill) => skill.skillId !== item.skillId),
                                )
                              }
                            >
                              Remove
                            </button>
                          ) : null}
                        </li>
                      ))}
                      {!draftSkills.length ? <li className="text-muted">No skills assigned</li> : null}
                    </ul>

                    {canManage ? (
                      <>
                        <div className="row g-2 mb-2">
                          <div className="col-7">
                            <select
                              className="form-select form-select-sm"
                              value={newSkillId}
                              onChange={(event) => setNewSkillId(event.target.value)}
                            >
                              <option value="">Add skill…</option>
                              {(skillsCatalogQuery.data ?? [])
                                .filter((skill) => !draftSkills.some((draft) => draft.skillId === skill.id))
                                .map((skill) => (
                                  <option key={skill.id} value={skill.id}>
                                    {skill.name}
                                    {skill.category ? ` (${skill.category})` : ""}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div className="col-5">
                            <select
                              className="form-select form-select-sm"
                              value={newProficiency}
                              onChange={(event) => setNewProficiency(event.target.value)}
                            >
                              {PROFICIENCIES.map((proficiency) => (
                                <option key={proficiency} value={proficiency}>
                                  {proficiency}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="d-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            disabled={!newSkillId}
                            onClick={() => {
                              if (!newSkillId) return;
                              setDraftSkills((prev) => [
                                ...prev,
                                { skillId: newSkillId, proficiency: newProficiency },
                              ]);
                              setNewSkillId("");
                            }}
                          >
                            Add to list
                          </button>
                        </div>
                      </>
                    ) : null}
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
                      <ul className="list-unstyled small mb-0">
                        {(allocationsQuery.data ?? []).map((allocation) => (
                          <li key={allocation.id} className="mb-2 border-bottom pb-2">
                            <div className="d-flex justify-content-between gap-2">
                              <span className="fw-semibold">
                                <RecordLink module="project" id={allocation.projectId}>
                                  {projectName(allocation.projectId)}
                                </RecordLink>
                              </span>
                              <StatusBadge status={allocation.status} />
                            </div>
                            <div className="text-muted">
                              {allocation.role ? `${allocation.role} · ` : ""}
                              <RecordLink module="allocation" id={allocation.id}>
                                {allocation.startDate} – {allocation.endDate}
                              </RecordLink>
                              {allocation.allocationPercentage != null ? ` · ${allocation.allocationPercentage}%` : ""}
                              {allocation.allocatedHours != null ? ` · ${allocation.allocatedHours}h` : ""}
                            </div>
                            {allocation.warning ? <div className="text-warning">{allocation.warning}</div> : null}
                          </li>
                        ))}
                      </ul>
                    </TechEarnestRecordRelatedCard>
                  ) : null}

                  <ResourceTimesheetsCard
                    resourceId={selectedResource.id}
                    periodStart={monthRange.periodStart}
                    periodEnd={monthRange.periodEnd}
                    projectName={projectName}
                    canViewTimesheets={canViewTimesheets}
                  />

                  {canViewExpenses ? (
                    <TechEarnestRecordRelatedCard
                      id="techearnest-record-section-expenses"
                      title={`Expenses (${resourceExpensesQuery.data?.length ?? 0})`}
                      isEmpty={!resourceExpensesQuery.isLoading && !(resourceExpensesQuery.data ?? []).length}
                      emptyLabel="No records found"
                    >
                      <RelatedRecordList
                        module="expense"
                        loading={resourceExpensesQuery.isLoading}
                        items={(resourceExpensesQuery.data ?? []).map((expense) => ({
                          id: expense.id,
                          label: expense.category,
                          secondary: [
                            `${expense.amount.toLocaleString()} ${expense.currencyCode}`,
                            expense.projectId ? projectName(expense.projectId) : null,
                          ]
                            .filter(Boolean)
                            .join(" · "),
                          trailing: <StatusBadge status={expense.status} />,
                        }))}
                      />
                    </TechEarnestRecordRelatedCard>
                  ) : null}

                  {canViewProjects ? (
                    <TechEarnestRecordRelatedCard
                      id="techearnest-record-section-projects"
                      title={`Projects (${relatedProjects.length})`}
                      isEmpty={!projectsQuery.isLoading && !allocationsQuery.isLoading && !relatedProjects.length}
                      emptyLabel="No records found"
                      actions={
                        <Link className="btn btn-outline-secondary btn-sm" to="/projects">
                          Open Projects
                        </Link>
                      }
                    >
                      <RelatedRecordList
                        module="project"
                        items={relatedProjects.map((project) => ({
                          id: project.id,
                          label: project.name,
                          secondary: `${project.projectCode}${
                            project.progressPercent != null ? ` · ${project.progressPercent}% complete` : ""
                          }`,
                          trailing: (
                            <span className="d-flex gap-1">
                              <StatusBadge status={project.status} />
                              {project.health ? <StatusBadge status={project.health} /> : null}
                            </span>
                          ),
                        }))}
                      />
                    </TechEarnestRecordRelatedCard>
                  ) : null}

                  {canViewTasks ? (
                    <TechEarnestRecordRelatedCard
                      id="techearnest-record-section-tasks"
                      title={`Assigned Tasks (${assignedTasksQuery.data?.length ?? 0})`}
                      isEmpty={!assignedTasksQuery.isLoading && !(assignedTasksQuery.data ?? []).length}
                      emptyLabel="No records found"
                      actions={
                        <Link className="btn btn-outline-secondary btn-sm" to="/tasks">
                          Open Tasks
                        </Link>
                      }
                    >
                      <RelatedRecordList
                        module="task"
                        items={(assignedTasksQuery.data ?? []).map((task) => ({
                          id: task.id,
                          label: task.name,
                          secondary: [projectName(task.projectId), task.dueDate ? `due ${task.dueDate}` : null]
                            .filter(Boolean)
                            .join(" · "),
                          trailing: <StatusBadge status={task.status} />,
                        }))}
                      />
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
                  id: "portal",
                  label: "Portal & timesheets",
                  visible: canInvitePortal || canSendTimesheetLink,
                  content: <ResourcePortalPanel key={selectedResource.id} resource={selectedResource} />,
                },
                {
                  id: "timeline",
                  label: "Timeline",
                  visible: true,
                  content: (
                    <TechEarnestRecordTimeline entries={timelineEntries} loading={activitiesQuery.isLoading} />
                  ),
                },
              ]}
            />

      ) : (
    <ModuleListShell
      title="Resources"
      filterOpen={filterOpen}
      activeFilterCount={activeFilterCount}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Resources</span>}
      filterToggle={{ onToggle: () => setFilterOpen((open) => !open) }}
      primaryAction={
        canManage ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreateResource}>
            Create Resource
          </button>
        ) : null
      }
      createMenuItems={bulkImport.menuItems}
      moreMenuItems={bulkImport.menuItems}
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Resources by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, code or designation"
            />
          </div>
          <div className="module-filter-section">
            <h3>Filter by fields</h3>
            <TechEarnestFilterSelect label="Availability" value={statusFilter} onChange={setStatusFilter} options={resourceStatusOptions} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search resource statuses" />
            <TechEarnestFilterSelect label="Region" value={regionFilter} onChange={setRegionFilter} options={regionOptions} placeholder="All regions" emptyLabel="All regions" searchPlaceholder="Search regions" />
            <TechEarnestFilterSelect label="Skill" value={skillFilter} onChange={setSkillFilter} options={skillFilterOptions} placeholder="All skills" emptyLabel="All skills" searchPlaceholder="Search skills" />
          </div>
        </>
      }
      onClearFilters={() => {
        setSearch("");
        setStatusFilter("");
        setRegionFilter("");
        setSkillFilter("");
      }}
      recordCount={rows.length}
    >
      {resourcesQuery.isLoading ? <LoadingState label="Loading resources..." /> : null}
      {resourcesQuery.error ? <ErrorState title="Unable to load resources" message="Try again." /> : null}

      {!resourcesQuery.isLoading && !resourcesQuery.error && !rows.length && !activeFilterCount
        ? bulkImport.renderEmptyState({
            canCreate: canManage,
            createLabel: "Create Resource",
            onCreate: openCreateResource,
          })
        : null}

      {!resourcesQuery.isLoading && !resourcesQuery.error && (rows.length || activeFilterCount) ? (
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
        >
          {viewMode === "list" ? (
            <ModuleListTable
              tableCode="resource"
              defaultColumns={[
                { field: "employeeName", label: "Employee" },
                { field: "employeeCode", label: "Code" },
                { field: "designation", label: "Designation" },
                { field: "resourceType", label: "Type" },
                { field: "regionId", label: "Region" },
                { field: "capacityHoursPerWeek", label: "Capacity" },
                { field: "status", label: "Status" },
                { field: "loginStatus", label: "Login" },
                ...(canViewCostRate ? [{ field: "costRate", label: "Cost rate" }] : []),
                ...(canViewBillingRate ? [{ field: "billingRate", label: "Billing rate" }] : []),
              ]}
              optionalColumns={RESOURCE_OPTIONAL_COLUMNS}
              rows={rows}
              rowKey={(resource) => resource.id}
              bulk={{
                noun: "resources",
                exportFileName: "resources",
                onComplete: () => {
                  void queryClient.invalidateQueries({ queryKey: ["resources"] });
                  void queryClient.invalidateQueries({ queryKey: ["allocations"] });
                  void queryClient.invalidateQueries({ queryKey: ["resource-board"] });
                },
                actions: [
                  {
                    id: "deactivate",
                    label: "Deactivate",
                    tone: "warning",
                    visible: canManage,
                    doneLabel: "deactivated",
                    applies: (resource) => !isEndedResource(resource),
                    confirm: "Current allocations end today, future ones are cancelled, and portal access is revoked.",
                    input: { kind: "text", label: "Reason", optional: true, placeholder: "e.g. Contract finished" },
                    run: (resource, reason) =>
                      deactivateResource(resource.id, {
                        status: "INACTIVE",
                        reason: reason || undefined,
                        endOpenAllocations: true,
                        revokePortalAccess: true,
                      }),
                  },
                  {
                    id: "reactivate",
                    label: "Reactivate",
                    tone: "success",
                    visible: canManage,
                    doneLabel: "reactivated",
                    applies: (resource) => isEndedResource(resource),
                    run: (resource) => reactivateResource(resource.id, {}),
                  },
                  {
                    id: "delete",
                    label: "Delete",
                    tone: "danger",
                    visible: canManage,
                    doneLabel: "deleted",
                    confirm: "Deleted resources disappear from lists and the resource board.",
                    run: (resource) => deleteRecord(`/resources/${resource.id}`),
                  },
                ],
              }}
              selectedRowKey={(selected as Resource | null)?.id}
              onRowClick={(resource) => {
                setSelected(resource);
                setSkillsError(null);
              }}
              renderCell={(resource, field) => {
                if (field === "regionId") return regionName(resource.regionId);
                if (field === "status") return <StatusBadge status={resource.status} />;
                if (field === "capacityHoursPerWeek") return resource.capacityHoursPerWeek != null ? `${resource.capacityHoursPerWeek}h` : "—";
                if (field === "costRate" || field === "billingRate") return formatRate((resource as unknown as Record<string, number | null>)[field]);
                if (field === "createdAt" || field === "updatedAt") return formatDateTime(resource[field]);
                if (field === "loginStatus") return <LoginStatusBadge status={resource.loginStatus} />;
                if (field === "accessExpiresAt") return resource.accessExpiresAt ? new Date(resource.accessExpiresAt).toLocaleDateString() : "—";
                if (field === "userId") return resource.employeeName ?? "—";
                if (field === "managerId") return resource.managerName ?? "—";
                if (field === "departmentId") return resource.departmentName ?? "—";
                if (field === "resourceType") return <ResourceTypeBadge type={resource.resourceType} />;
                const value = (resource as unknown as Record<string, unknown>)[field];
                return value == null || value === "" ? "—" : String(value);
              }}
              nameFields={["employeeName", "fullName", "employeeCode", "designation"]}
              excludedFields={[...(!canViewCostRate ? ["costRate"] : []), ...(!canViewBillingRate ? ["billingRate"] : [])]}
              emptyMessage="No resources match the current filters."
            />
          ) : (
            <div className="module-tile-grid">
              {rows.map((resource) => (
                <button
                  key={resource.id}
                  type="button"
                  className={`module-tile text-start${(selected as Resource | null)?.id === resource.id ? " is-selected" : ""}`}
                  onClick={() => {
                    setSelected(resource);
                    setSkillsError(null);
                  }}
                >
                  <div className="tile-title">{resourceTitle(resource)}</div>
                  <div className="small text-muted">
                    {resourceTypeLabel(resource.resourceType)} · {resource.status}
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
