import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  TechEarnestCreateColumn,
  TechEarnestCreateField,
  TechEarnestCreateGrid,
  TechEarnestCreateSection,
  TechEarnestFormKitCreateView,
  TechEarnestFormSelect,
  useTechEarnestCreateFlow,
} from "@/components/TechEarnestCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleFilterCheckbox, ModuleFilterField, ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
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
import { listAuditLogs, listUsers } from "@/features/admin/adminApi";
import { listProjects } from "@/features/projects/projectApi";
import { listResources, type Resource } from "@/features/resources/resourceApi";
import { useBulkImport } from "@/features/import/useBulkImport";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { useUrlRecordId } from "@/hooks/useUrlRecord";
import { RecordLink } from "@/components/RecordLink";
import {
  approveTimesheet,
  bulkApproveTimesheets,
  bulkRejectTimesheets,
  copyPreviousWeek,
  createTimesheet,
  deleteTimeEntry,
  exportTimesheetsCsv,
  getTimesheet,
  listEntryProjects,
  listEntryProjectsForResource,
  listTimesheets,
  mondayOf,
  rejectTimesheet,
  saveTimesheetEntries,
  submitTimesheet,
  updateTimesheetNotes,
  closedProjectLabel,
  type BulkActionResult,
  type GridEntryBody,
  type Timesheet,
} from "./timesheetApi";
import { WeeklyTimesheetGrid } from "./WeeklyTimesheetGrid";

const createSchema = z
  .object({
    resourceId: z.string().optional(),
    weekStartDate: z.string().min(1, "Week start is required"),
    startWith: z.enum(["BLANK", "COPY_PREVIOUS", "QUICK_FILL"]),
    projectId: z.string().optional(),
    taskId: z.string().optional(),
    hoursPerDay: z.string().optional(),
    days: z.array(z.number()),
    billable: z.boolean(),
    entryDescription: z.string().max(500, "Keep it under 500 characters").optional(),
    notes: z.string().max(2000, "Keep notes under 2000 characters").optional(),
    submitAfterCreate: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.startWith === "QUICK_FILL") {
      if (!values.projectId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["projectId"], message: "Project is required" });
      }
      const hours = Number(values.hoursPerDay);
      if (!values.hoursPerDay || !Number.isFinite(hours) || hours < 0.25 || hours > 24) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["hoursPerDay"], message: "Enter between 0.25 and 24 hours" });
      }
      if (!values.days.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["days"], message: "Pick at least one day" });
      }
    }
    if (values.submitAfterCreate && values.startWith === "BLANK") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["submitAfterCreate"],
        message: "A blank week has no hours to submit. Copy last week or use quick fill.",
      });
    }
  });

type CreateFormValues = z.infer<typeof createSchema>;

const TIMESHEET_DEFAULTS: CreateFormValues = {
  resourceId: "",
  weekStartDate: mondayOf(),
  startWith: "BLANK",
  projectId: "",
  taskId: "",
  hoursPerDay: "8",
  days: [1, 2, 3, 4, 5],
  billable: true,
  entryDescription: "",
  notes: "",
  submitAfterCreate: false,
};

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

const START_OPTIONS: { value: CreateFormValues["startWith"]; label: string; description: string }[] = [
  { value: "BLANK", label: "Blank week", description: "Start empty and log time in the weekly grid." },
  { value: "COPY_PREVIOUS", label: "Copy last week", description: "Reuse last week's projects, tasks and hours." },
  { value: "QUICK_FILL", label: "Quick fill", description: "Log the same hours on one project for the days you pick." },
];

function shiftWeek(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return mondayOf(d);
}

const SOURCE_LABELS: Record<string, string> = {
  SELF: "Self",
  PROXY: "Entered by manager",
  LINK: "Via email link",
  IMPORT: "Imported",
};

function resourceLabel(resource: Resource): string {
  return resource.employeeName ?? resource.fullName ?? resource.employeeCode ?? resource.designation ?? resource.id.slice(0, 8);
}

type ListView = "all" | "mine" | "awaiting";

function summarizeBulk(results: BulkActionResult[], verb: string): string {
  const ok = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success);
  if (!failed.length) return `${ok} timesheet${ok === 1 ? "" : "s"} ${verb}.`;
  const reasons = [...new Set(failed.map((r) => r.message ?? "Failed"))].join("; ");
  return `${ok} ${verb}, ${failed.length} skipped: ${reasons}`;
}

function isEditable(status: string) {
  return status === "DRAFT" || status === "REJECTED";
}

function weekEndOf(weekStart: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStart ?? "");
  if (!match) return "—";
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 6)).toISOString().slice(0, 10);
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export function TimesheetsPage() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const canCreate = useHasPermission("TIMESHEET_CREATE");
  const canSubmit = useHasPermission("TIMESHEET_SUBMIT");
  const canApprove = useHasPermission("TIMESHEET_APPROVE");
  const canExport = useHasPermission("TIMESHEET_EXPORT");
  const canViewRates = useHasPermission("RATE_VIEW");
  const canProxy = useHasPermission("TIMESHEET_PROXY");
  const canViewProjects = useHasPermission("PROJECT_VIEW");
  const canViewResources = useHasPermission("RESOURCE_VIEW");
  const canViewAudit = useHasPermission("AUDIT_VIEW");
  const canViewUsers = useHasPermission("USER_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [selectedId, setSelectedId] = useUrlRecordId();
  const [statusFilter, setStatusFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [weekStartFilter, setWeekStartFilter] = useState("");
  const [billableOnly, setBillableOnly] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [listView, setListView] = useState<ListView>("all");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [bulkMessage, setBulkMessage] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);

  const listParams = useMemo(
    () => ({
      status: statusFilter || undefined,
      resourceId: listView === "mine" ? auth.resourceId ?? undefined : resourceFilter || undefined,
      weekStart: weekStartFilter || undefined,
      billableOnly: billableOnly || undefined,
      awaitingMyApproval: listView === "awaiting" || undefined,
    }),
    [statusFilter, resourceFilter, weekStartFilter, billableOnly, listView, auth.resourceId],
  );

  useEffect(() => {
    setCheckedIds([]);
  }, [listParams]);

  const listQuery = useQuery({
    queryKey: ["timesheets", listParams],
    queryFn: () => listTimesheets(listParams),
  });
  const resourcesQuery = useQuery({
    queryKey: ["resources"],
    queryFn: () => listResources(),
    enabled: canViewResources,
  });
  const detailQuery = useQuery({
    queryKey: ["timesheets", selectedId],
    queryFn: () => getTimesheet(selectedId!),
    enabled: !!selectedId,
  });
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
    enabled: !!selectedId && canViewProjects,
  });
  const entryProjectsQuery = useQuery({
    queryKey: ["timesheets", selectedId, "entry-projects"],
    queryFn: () => listEntryProjects(selectedId!),
    enabled: !!selectedId && canCreate,
    retry: false,
  });
  const auditQuery = useQuery({
    queryKey: ["admin", "audit-logs", "TIMESHEET", selectedId],
    queryFn: () => listAuditLogs({ entityType: "TIMESHEET", entityId: selectedId!, size: 30 }),
    enabled: !!selectedId && canViewAudit,
  });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: !!selectedId && canViewUsers,
    retry: false,
  });

  const selected: Timesheet | undefined = detailQuery.data;
  const selectedNotes = selected?.notes ?? "";
  useEffect(() => {
    setNotesDraft(selectedNotes);
  }, [selectedNotes, selectedId]);
  const bulkImport = useBulkImport("timesheets", () => queryClient.invalidateQueries({ queryKey: ["timesheets"] }));

  const projectName = useMemo(() => {
    const names = new Map<string, string>();
    (projectsQuery.data ?? []).forEach((project) => names.set(project.id, project.name));
    (entryProjectsQuery.data ?? []).forEach((project) => names.set(project.projectId, project.name));
    const tasks = new Map<string, string>();
    (entryProjectsQuery.data ?? []).forEach((project) => project.tasks.forEach((task) => tasks.set(task.taskId, task.name)));
    return {
      project: (id: string) => names.get(id) ?? `${id.slice(0, 8)}…`,
      task: (id: string | null) => (id ? tasks.get(id) ?? null : null),
    };
  }, [projectsQuery.data, entryProjectsQuery.data]);
  const closedEntryProjects = useMemo(
    () => new Set((entryProjectsQuery.data ?? []).filter((project) => project.closed).map((project) => project.projectId)),
    [entryProjectsQuery.data],
  );

  useEffect(() => {
    setActionError(null);
    setRejectReason("");
  }, [selectedId]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: TIMESHEET_DEFAULTS,
  });
  const watchedWeekStart = watch("weekStartDate");
  const watchedStartWith = watch("startWith");
  const watchedDays = watch("days");
  const watchedHoursPerDay = watch("hoursPerDay");
  const watchedQuickProjectId = watch("projectId");
  const watchedCreateResourceId = watch("resourceId");
  const createResourceId = (canProxy && watchedCreateResourceId) || auth.resourceId || "";
  const createEntryProjectsQuery = useQuery({
    queryKey: ["timesheets", "entry-projects", createResourceId],
    queryFn: () => listEntryProjectsForResource(createResourceId),
    enabled: showForm && canCreate && !!createResourceId && watchedStartWith === "QUICK_FILL",
    retry: false,
  });
  const quickFillProjectOptions = (createEntryProjectsQuery.data ?? [])
    .filter((project) => !project.closed)
    .map((project) => ({
      value: project.projectId,
      label: project.name,
      subtitle: project.projectCode ?? undefined,
    }));
  const endedQuickFillProjects = (createEntryProjectsQuery.data ?? []).filter((project) => project.closed);
  const quickFillTaskOptions = (
    createEntryProjectsQuery.data?.find((project) => project.projectId === watchedQuickProjectId)?.tasks ?? []
  ).map((task) => ({ value: task.taskId, label: task.name, subtitle: task.status ?? undefined }));
  const quickFillTotal = (Number(watchedHoursPerDay) || 0) * (watchedDays?.length ?? 0);
  useEffect(() => {
    setValue("taskId", "");
  }, [watchedQuickProjectId, setValue]);
  useEffect(() => {
    if (watchedStartWith === "BLANK") setValue("submitAfterCreate", false);
  }, [watchedStartWith, setValue]);

  function toggleDay(day: number) {
    const current = watchedDays ?? [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => a - b);
    setValue("days", next, { shouldDirty: true, shouldValidate: true });
  }
  const weekEndLabel = useMemo(() => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(watchedWeekStart ?? "");
    if (!match) return "—";
    const end = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 6));
    return end.toISOString().slice(0, 10);
  }, [watchedWeekStart]);
  const ownResourceLabel = useMemo(() => {
    if (!auth.resourceId) return "Not linked — ask an admin to link your user to a resource";
    const resource = resourcesQuery.data?.find((item) => item.id === auth.resourceId);
    if (!resource) return auth.displayName;
    return resourceLabel(resource);
  }, [auth.resourceId, auth.displayName, resourcesQuery.data]);
  const resourceOptions = useMemo(
    () =>
      (resourcesQuery.data ?? []).map((resource) => ({
        value: resource.id,
        label: resource.id === auth.resourceId ? `${resourceLabel(resource)} (me)` : resourceLabel(resource),
        subtitle: [resource.employeeCode, resource.designation].filter(Boolean).join(" · ") || undefined,
      })),
    [resourcesQuery.data, auth.resourceId],
  );

  const { setSaveAndNew, cancelCreate, afterCreateSuccess } = useTechEarnestCreateFlow({
    defaults: TIMESHEET_DEFAULTS,
    reset,
    setShowForm,
    setFormError,
    setSelected: (entity) => setSelectedId(entity.id),
  });

  const createMutation = useMutation({
    mutationFn: createTimesheet,
    onSuccess: async (sheet) => {
      await queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      setFormError(null);
      await afterCreateSuccess(sheet, "TIMESHEET");
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const saveGridMutation = useMutation({
    mutationFn: (gridEntries: GridEntryBody[]) => saveTimesheetEntries(selectedId!, gridEntries),
    onSuccess: (sheet) => {
      queryClient.setQueryData(["timesheets", selectedId], sheet);
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      setActionError(null);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const notesMutation = useMutation({
    mutationFn: (notes: string) => updateTimesheetNotes(selectedId!, notes),
    onSuccess: (sheet) => {
      queryClient.setQueryData(["timesheets", selectedId], sheet);
      setActionError(null);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const copyWeekMutation = useMutation({
    mutationFn: () => copyPreviousWeek(selectedId!),
    onSuccess: (sheet) => {
      queryClient.setQueryData(["timesheets", selectedId], sheet);
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      setActionError(null);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  function invalidateTimeSummaries() {
    queryClient.invalidateQueries({ predicate: (query) => query.queryKey.includes("time-summary") });
  }

  function onBulkSettled(results: BulkActionResult[], verb: string) {
    invalidateTimeSummaries();
    queryClient.invalidateQueries({ queryKey: ["timesheets"] });
    const failed = results.some((r) => !r.success);
    const succeeded = results.some((r) => r.success);
    setBulkMessage({ tone: failed ? (succeeded ? "warning" : "danger") : "success", text: summarizeBulk(results, verb) });
    setCheckedIds(results.filter((r) => !r.success).map((r) => r.id));
  }

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) => bulkApproveTimesheets(ids),
    onSuccess: (results) => onBulkSettled(results, "approved"),
    onError: (err: Error) => setBulkMessage({ tone: "danger", text: err.message }),
  });

  const bulkRejectMutation = useMutation({
    mutationFn: ({ ids, reason }: { ids: string[]; reason: string }) => bulkRejectTimesheets(ids, reason),
    onSuccess: (results) => {
      onBulkSettled(results, "rejected");
      setBulkRejectReason("");
    },
    onError: (err: Error) => setBulkMessage({ tone: "danger", text: err.message }),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitTimesheet(selectedId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["timesheets", selectedId] });
      setActionError(null);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveTimesheet(selectedId!),
    onSuccess: () => {
      invalidateTimeSummaries();
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["timesheets", selectedId] });
      setActionError(null);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectTimesheet(selectedId!, rejectReason.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["timesheets", selectedId] });
      setRejectReason("");
      setActionError(null);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: string) => deleteTimeEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const onCreate = handleSubmit((values) => {
    const resourceId = (canProxy && values.resourceId) || auth.resourceId;
    if (!resourceId) {
      setFormError(
        canProxy
          ? "Choose the resource this timesheet is for."
          : "Your user is not linked to a resource. Ask an admin to link one.",
      );
      return;
    }
    createMutation.mutate({
      resourceId,
      weekStartDate: mondayOf(new Date(`${values.weekStartDate}T00:00:00`)),
      notes: values.notes?.trim() || null,
      startWith: values.startWith,
      quickFill:
        values.startWith === "QUICK_FILL"
          ? {
              projectId: values.projectId!,
              taskId: values.taskId || null,
              hoursPerDay: Number(values.hoursPerDay),
              days: values.days,
              billable: values.billable,
              description: values.entryDescription?.trim() || null,
            }
          : null,
      submitAfterCreate: canSubmit && values.submitAfterCreate,
    });
  });

  function openCreateTimesheet() {
    reset({ ...TIMESHEET_DEFAULTS, resourceId: auth.resourceId ?? "" });
    setFormError(null);
    setShowForm(true);
  }

  async function onExport() {
    try {
      const blob = await exportTimesheetsCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "timesheets.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Export failed");
    }
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (listQuery.data ?? []).filter((sheet) => {
      if (!q) return true;
      return (
        sheet.weekStartDate.toLowerCase().includes(q) ||
        sheet.status.toLowerCase().includes(q) ||
        (sheet.resourceName ?? "").toLowerCase().includes(q)
      );
    });
  }, [listQuery.data, search]);

  const activeFilterCount = [
    search,
    statusFilter,
    resourceFilter,
    weekStartFilter,
    billableOnly ? "1" : "",
  ].filter(Boolean).length;

  const selectedRow = rows.find((row) => row.id === selectedId) ?? null;
  const recordNav = useRecordNavigation(rows, selectedRow, (item) => setSelectedId(item?.id ?? null));
  const selectedResource = selected ? resourcesQuery.data?.find((r) => r.id === selected.resourceId) : undefined;
  const userLabel = useMemo(() => {
    const map = new Map(
      (usersQuery.data ?? []).map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]),
    );
    return (id: string | null | undefined) =>
      id ? (id === auth.userId ? auth.displayName : (map.get(id) ?? id.slice(0, 8))) : "—";
  }, [usersQuery.data, auth.userId, auth.displayName]);
  const timelineEntries = useMemo(
    () =>
      buildTimelineEntries(
        auditQuery.data,
        undefined,
        userLabel,
        recordLifecycleInfo("Timesheet", selected ? { ...selected, ownerId: selected.enteredBy } : null),
      ),
    [auditQuery.data, userLabel, selected],
  );
  const entries = useMemo(() => selected?.entries ?? [], [selected]);
  const billableHours = entries.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.hours, 0);
  const hoursByProject = useMemo(() => {
    const totals = new Map<string, number>();
    entries.forEach((entry) => totals.set(entry.projectId, (totals.get(entry.projectId) ?? 0) + entry.hours));
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);
  const hoursByDay = useMemo(() => {
    const totals = new Map<string, number>();
    entries.forEach((entry) => totals.set(entry.workDate, (totals.get(entry.workDate) ?? 0) + entry.hours));
    return [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries]);
  const ownSheet = !!selected && !!auth.resourceId && selected.resourceId === auth.resourceId;
  const canEditSheet = !!selected && (ownSheet || canProxy);
  const canEditEntries = !!selected && canCreate && canEditSheet && isEditable(selected.status);
  const fallbackProjects = useMemo(
    () => (projectsQuery.data ?? []).map((project) => ({ id: project.id, name: project.name })),
    [projectsQuery.data],
  );
  const selectedRows = rows.filter((row) => checkedIds.includes(row.id));
  const approvableIds = selectedRows.filter((row) => row.status === "SUBMITTED").map((row) => row.id);

  return (
    <>
      {showForm && canCreate ? (
        <TechEarnestFormKitCreateView
          title="Create Timesheet"
          tableCode="timesheet"
          entityLabel="Timesheet"
          pending={isSubmitting || createMutation.isPending}
          isDirty={isDirty}
          formError={formError}
          onCancel={() => cancelCreate(isDirty)}
          onSave={() => void onCreate()}
          onSaveAndNew={() => {
            setSaveAndNew(true);
            void onCreate();
          }}
          onSubmit={() => void onCreate()}
          showRecordImage={false}
        >
          <TechEarnestCreateSection title="Timesheet Information">
            <TechEarnestCreateGrid>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Resource" required={canProxy}>
                  {canProxy ? (
                    <TechEarnestFormSelect
                      control={control}
                      name="resourceId"
                      options={resourceOptions}
                      searchPlaceholder="Search resources"
                      placeholder="Select resource"
                      lookupIcon="users"
                      allowEmpty={false}
                    />
                  ) : (
                    <input
                      type="text"
                      readOnly
                      className="form-control form-control-sm"
                      value={ownResourceLabel}
                      title="Timesheets are created for the resource linked to your user"
                    />
                  )}
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Status">
                  <input type="text" readOnly className="form-control form-control-sm" value="Draft" />
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Week Start (Monday)" required error={errors.weekStartDate?.message}>
                  <input
                    type="date"
                    className={`form-control form-control-sm${errors.weekStartDate ? " is-invalid" : ""}`}
                    {...register("weekStartDate")}
                  />
                  <div className="d-flex flex-wrap gap-1 mt-1">
                    {[
                      { label: "Last week", weeks: -1 },
                      { label: "This week", weeks: 0 },
                      { label: "Next week", weeks: 1 },
                    ].map((option) => {
                      const value = shiftWeek(option.weeks);
                      return (
                        <button
                          key={option.label}
                          type="button"
                          className={`btn btn-sm py-0 ${watchedWeekStart === value ? "btn-primary" : "btn-outline-secondary"}`}
                          onClick={() => setValue("weekStartDate", value, { shouldDirty: true, shouldValidate: true })}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Week End">
                  <input type="text" readOnly className="form-control form-control-sm" value={weekEndLabel} />
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
            </TechEarnestCreateGrid>
            {canProxy ? (
              <p className="small text-muted mb-0 mt-3">
                You can fill in timesheets for resources you manage (for example people without a login); they are
                recorded as entered by you.
              </p>
            ) : null}
          </TechEarnestCreateSection>

          <TechEarnestCreateSection title="Start the Week">
            <div className="row g-2 mb-3" role="radiogroup" aria-label="How to start the week">
              {START_OPTIONS.map((option) => (
                <div key={option.value} className="col-md-4">
                  <label
                    className={`d-block border rounded p-2 h-100${watchedStartWith === option.value ? " border-primary bg-light" : ""}`}
                    style={{ cursor: "pointer" }}
                  >
                    <input type="radio" className="form-check-input me-2" value={option.value} {...register("startWith")} />
                    <span className="fw-semibold small">{option.label}</span>
                    <div className="small text-muted mt-1">{option.description}</div>
                  </label>
                </div>
              ))}
            </div>

            {watchedStartWith === "QUICK_FILL" ? (
              <TechEarnestCreateGrid>
                <TechEarnestCreateColumn>
                  <TechEarnestCreateField label="Project" required error={errors.projectId?.message}>
                    <TechEarnestFormSelect
                      control={control}
                      name="projectId"
                      options={quickFillProjectOptions}
                      searchPlaceholder="Search projects"
                      placeholder={
                        !createResourceId
                          ? "Choose a resource first"
                          : createEntryProjectsQuery.isLoading
                            ? "Loading projects…"
                            : quickFillProjectOptions.length
                              ? "Select project"
                              : "No open allocated projects"
                      }
                      lookupIcon="apps"
                      invalid={!!errors.projectId}
                    />
                    {endedQuickFillProjects.length ? (
                      <div className="form-text">
                        Ended projects are unavailable:{" "}
                        {endedQuickFillProjects
                          .map((project) => `${project.name} (${closedProjectLabel(project.status).toLowerCase()})`)
                          .join(", ")}
                      </div>
                    ) : null}
                  </TechEarnestCreateField>
                  {quickFillTaskOptions.length ? (
                    <TechEarnestCreateField label="Task">
                      <TechEarnestFormSelect
                        control={control}
                        name="taskId"
                        options={quickFillTaskOptions}
                        searchPlaceholder="Search tasks"
                        placeholder="No specific task"
                      />
                    </TechEarnestCreateField>
                  ) : null}
                  <TechEarnestCreateField label="Entry Description" error={errors.entryDescription?.message}>
                    <input
                      type="text"
                      maxLength={500}
                      className="form-control form-control-sm"
                      placeholder="What will you be working on?"
                      {...register("entryDescription")}
                    />
                  </TechEarnestCreateField>
                </TechEarnestCreateColumn>
                <TechEarnestCreateColumn>
                  <TechEarnestCreateField label="Hours per Day" required error={errors.hoursPerDay?.message}>
                    <input
                      type="number"
                      min={0.25}
                      max={24}
                      step={0.25}
                      className={`form-control form-control-sm${errors.hoursPerDay ? " is-invalid" : ""}`}
                      {...register("hoursPerDay")}
                    />
                  </TechEarnestCreateField>
                  <TechEarnestCreateField label="Days" required error={errors.days?.message}>
                    <div className="d-flex flex-wrap gap-1">
                      {WEEKDAYS.map((day) => {
                        const active = (watchedDays ?? []).includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            aria-pressed={active}
                            className={`btn btn-sm ${active ? "btn-primary" : "btn-outline-secondary"}`}
                            onClick={() => toggleDay(day.value)}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </TechEarnestCreateField>
                  <TechEarnestCreateField label="Billable">
                    <div className="form-check mt-1">
                      <input id="quickFillBillable" type="checkbox" className="form-check-input" {...register("billable")} />
                      <label className="form-check-label small" htmlFor="quickFillBillable">
                        Bill this time to the client
                      </label>
                    </div>
                  </TechEarnestCreateField>
                  <TechEarnestCreateField label="Week Total">
                    <input
                      type="text"
                      readOnly
                      className="form-control form-control-sm"
                      value={`${watchedDays?.length ?? 0} day(s) × ${Number(watchedHoursPerDay) || 0} h = ${quickFillTotal} h`}
                    />
                  </TechEarnestCreateField>
                </TechEarnestCreateColumn>
              </TechEarnestCreateGrid>
            ) : watchedStartWith === "COPY_PREVIOUS" ? (
              <p className="small text-muted mb-0">
                Entries from the week before are copied with their dates moved forward a week. Projects that can no
                longer be logged against are skipped. You can adjust everything in the weekly grid after saving.
              </p>
            ) : (
              <p className="small text-muted mb-0">
                After saving, log hours per project and day in the weekly grid on the timesheet record.
              </p>
            )}
          </TechEarnestCreateSection>

          {canSubmit ? (
            <TechEarnestCreateSection title="Submission">
              <div className="form-check">
                <input
                  id="submitAfterCreate"
                  type="checkbox"
                  className={`form-check-input${errors.submitAfterCreate ? " is-invalid" : ""}`}
                  {...register("submitAfterCreate")}
                />
                <label className="form-check-label small" htmlFor="submitAfterCreate">
                  Submit for approval right after saving
                </label>
              </div>
              {errors.submitAfterCreate ? (
                <div className="invalid-feedback d-block">{errors.submitAfterCreate.message}</div>
              ) : (
                <p className="small text-muted mb-0 mt-1">
                  {watchedStartWith === "BLANK"
                    ? "Available when the week starts with hours (copy last week or quick fill)."
                    : "Your approver sees it straight away. Leave unticked to review the grid first."}
                </p>
              )}
            </TechEarnestCreateSection>
          ) : null}

          <TechEarnestCreateSection title="Description Information">
            <TechEarnestCreateField label="Notes" error={errors.notes?.message}>
              <textarea
                rows={3}
                maxLength={2000}
                className={`form-control form-control-sm${errors.notes ? " is-invalid" : ""}`}
                placeholder="Context for your approver, e.g. sprint, leave, or overtime reason"
                {...register("notes")}
              />
            </TechEarnestCreateField>
          </TechEarnestCreateSection>
        </TechEarnestFormKitCreateView>
      ) : selectedId ? (
        detailQuery.isLoading ? (
          <LoadingState label="Loading timesheet…" />
        ) : detailQuery.error || !selected ? (
          <ErrorState title="Unable to load timesheet" message="Go back to the list and try again." />
        ) : (
          <RecordShell
            title={`Week of ${selected.weekStartDate}`}
            subtitle={`${selected.resourceName ?? "Resource"}${ownSheet ? " (me)" : ""}`}
            meta={`${selected.totalHours ?? 0} h`}
            status={<StatusBadge status={selected.status} />}
            recordKey={selected.id}
            layout="page"
            avatarLabel={selected.resourceName ?? "Timesheet"}
            onBack={recordNav.goBack}
            onPrev={recordNav.goPrev}
            onNext={recordNav.goNext}
            hasPrev={recordNav.hasPrev}
            hasNext={recordNav.hasNext}
            relatedLinks={[...DEFAULT_RELATED_LINKS]}
            primaryAction={
              selectedResource?.email ? (
                <a
                  className="btn btn-primary btn-sm"
                  href={`mailto:${selectedResource.email}?subject=${encodeURIComponent(
                    `Timesheet for week of ${selected.weekStartDate}`,
                  )}`}
                >
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
                {isEditable(selected.status) ? (
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={!canSubmit || !canEditSheet || submitMutation.isPending}
                    onClick={() => submitMutation.mutate()}
                  >
                    Submit Week
                  </button>
                ) : null}
                {selected.status === "SUBMITTED" ? (
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm"
                    disabled={!canApprove || approveMutation.isPending}
                    onClick={() => approveMutation.mutate()}
                  >
                    Approve
                  </button>
                ) : null}
              </>
            }
            tabs={[
              {
                id: "overview",
                label: "Overview",
                content: (
                  <>
                    {actionError ? <div className="alert alert-danger py-2 small">{actionError}</div> : null}
                    {selected.rejectionReason && isEditable(selected.status) ? (
                      <div className="alert alert-warning py-2 small">Rejected: {selected.rejectionReason}</div>
                    ) : null}
                    {canApprove && selected.status === "SUBMITTED" ? (
                      <div className="alert alert-warning py-2 small d-flex flex-wrap align-items-center gap-2">
                        <span className="fw-semibold">Awaiting approval.</span>
                        <input
                          className="form-control form-control-sm flex-grow-1"
                          style={{ maxWidth: "24rem" }}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Rejection reason (required to reject)"
                        />
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          disabled={rejectMutation.isPending || !rejectReason.trim()}
                          onClick={() => rejectMutation.mutate()}
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}

                    <TechEarnestRecordSummaryStrip
                      fields={[
                        {
                          label: "Resource",
                          value: (
                            <RecordLink module="resource" id={selected.resourceId}>
                              {selected.resourceName ?? "Resource"}
                            </RecordLink>
                          ),
                        },
                        { label: "Week", value: `${selected.weekStartDate} → ${weekEndOf(selected.weekStartDate)}` },
                        { label: "Total Hours", value: `${selected.totalHours ?? 0} h` },
                        { label: "Billable Hours", value: `${billableHours} h` },
                        { label: "Status", value: <StatusBadge status={selected.status} /> },
                      ]}
                    />

                    <TechEarnestRecordInfoSection
                      title="Timesheet Information"
                      fields={[
                        {
                          label: "Resource",
                          value: (
                            <>
                              <RecordLink module="resource" id={selected.resourceId}>
                                {selected.resourceName ?? "Resource"}
                              </RecordLink>
                              {ownSheet ? " (me)" : ""}
                            </>
                          ),
                        },
                        { label: "Employee Code", value: selectedResource?.employeeCode ?? "—" },
                        { label: "Week Start", value: selected.weekStartDate },
                        { label: "Week End", value: weekEndOf(selected.weekStartDate) },
                        { label: "Status", value: selected.status },
                        { label: "Entered Via", value: SOURCE_LABELS[selected.entrySource] ?? selected.entrySource ?? "—" },
                        { label: "Entered By", value: userLabel(selected.enteredBy) },
                        ...(selected.warning ? [{ label: "Warning", value: selected.warning }] : []),
                      ]}
                    />

                    <TechEarnestRecordInfoSection
                      title="Approval"
                      fields={[
                        { label: "Submitted At", value: formatDateTime(selected.submittedAt) },
                        { label: "Approved At", value: formatDateTime(selected.approvedAt) },
                        { label: "Approved By", value: userLabel(selected.approvedBy) },
                        { label: "Rejection Reason", value: selected.rejectionReason ?? "—" },
                      ]}
                    />

                    {canEditEntries ? (
                      <TechEarnestRecordRelatedCard id="techearnest-record-section-notes" title="Notes" isEmpty={false}>
                        <textarea
                          rows={2}
                          maxLength={2000}
                          className="form-control form-control-sm mb-2"
                          placeholder="Context for your approver, e.g. sprint, leave, or overtime reason"
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                        />
                        <div className="d-flex justify-content-end">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            disabled={notesMutation.isPending || notesDraft.trim() === (selected.notes ?? "")}
                            onClick={() => notesMutation.mutate(notesDraft.trim())}
                          >
                            {notesMutation.isPending ? "Saving…" : "Save Notes"}
                          </button>
                        </div>
                      </TechEarnestRecordRelatedCard>
                    ) : (
                      <TechEarnestRecordInfoSection
                        title="Description Information"
                        fields={[{ label: "Notes", value: selected.notes ?? "—" }]}
                      />
                    )}

                    <TechEarnestRecordRelatedCard
                      id="techearnest-record-section-weekly-time"
                      title="Weekly Time"
                      isEmpty={false}
                    >
                      <WeeklyTimesheetGrid
                        weekStart={selected.weekStartDate}
                        entries={entries}
                        projectChoices={entryProjectsQuery.data ?? []}
                        fallbackProjects={fallbackProjects}
                        projectLabel={projectName.project}
                        taskLabel={projectName.task}
                        editable={canEditEntries}
                        saving={saveGridMutation.isPending}
                        copying={copyWeekMutation.isPending}
                        onSave={(gridEntries) => saveGridMutation.mutate(gridEntries)}
                        onCopyLastWeek={() => copyWeekMutation.mutate()}
                      />
                    </TechEarnestRecordRelatedCard>

                    <TechEarnestRecordRelatedCard
                      id="techearnest-record-section-time-entries"
                      title={`Time Entries (${entries.length})`}
                      isEmpty={!entries.length}
                      emptyLabel="No entries yet"
                    >
                      <div className="table-responsive">
                        <table className="table table-sm small mb-0">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Project</th>
                              <th className="text-end">Hours</th>
                              <th>Billable</th>
                              {canViewRates ? <th className="text-end">Rate</th> : null}
                              <th>Notes</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {entries.map((entry) => (
                              <tr key={entry.id}>
                                <td>{entry.workDate}</td>
                                <td>
                                  <RecordLink module="project" id={entry.projectId}>
                                    {projectName.project(entry.projectId)}
                                  </RecordLink>
                                  {projectName.task(entry.taskId) ? (
                                    <div className="text-muted">
                                      <RecordLink module="task" id={entry.taskId}>
                                        {projectName.task(entry.taskId)}
                                      </RecordLink>
                                    </div>
                                  ) : null}
                                </td>
                                <td className="text-end">{entry.hours}</td>
                                <td>{entry.billable ? "Yes" : "No"}</td>
                                {canViewRates ? (
                                  <td className="text-end">{entry.billingRate != null ? entry.billingRate : "—"}</td>
                                ) : null}
                                <td>{entry.description ?? "—"}</td>
                                <td className="text-end">
                                  {canEditEntries && !closedEntryProjects.has(entry.projectId) ? (
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm text-danger p-0"
                                      disabled={deleteEntryMutation.isPending}
                                      onClick={() => deleteEntryMutation.mutate(entry.id)}
                                    >
                                      Remove
                                    </button>
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </TechEarnestRecordRelatedCard>

                    <TechEarnestRecordRelatedCard
                      id="techearnest-record-section-hours-by-project"
                      title={`Hours by Project (${hoursByProject.length})`}
                      isEmpty={!hoursByProject.length}
                      emptyLabel="No records found"
                    >
                      <ul className="list-unstyled small mb-0">
                        {hoursByProject.map(([projectId, hours]) => (
                          <li key={projectId} className="mb-2 d-flex justify-content-between gap-2">
                            <RecordLink module="project" id={projectId}>
                              {projectName.project(projectId)}
                            </RecordLink>
                            <span className="fw-semibold">{hours} h</span>
                          </li>
                        ))}
                      </ul>
                    </TechEarnestRecordRelatedCard>

                    <TechEarnestRecordRelatedCard
                      id="techearnest-record-section-hours-by-day"
                      title="Hours by Day"
                      isEmpty={!hoursByDay.length}
                      emptyLabel="No records found"
                    >
                      <ul className="list-unstyled small mb-0">
                        {hoursByDay.map(([day, hours]) => (
                          <li key={day} className="mb-2 d-flex justify-content-between gap-2">
                            <span>
                              {new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" })}{" "}
                              <span className="text-muted">· {day}</span>
                            </span>
                            <span className="fw-semibold">{hours} h</span>
                          </li>
                        ))}
                      </ul>
                    </TechEarnestRecordRelatedCard>
                  </>
                ),
              },
              {
                id: "timeline",
                label: "Timeline",
                visible: true,
                content: <TechEarnestRecordTimeline entries={timelineEntries} loading={auditQuery.isLoading} />,
              },
            ]}
          />
        )
      ) : (
    <ModuleListShell
      title="Timesheets"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={
        <select
          className="form-select form-select-sm module-view-select"
          value={listView}
          aria-label="Timesheet view"
          onChange={(e) => {
            setListView(e.target.value as ListView);
            setBulkMessage(null);
          }}
        >
          <option value="all">All Timesheets</option>
          {auth.resourceId ? <option value="mine">My Timesheets</option> : null}
          {canApprove ? <option value="awaiting">Awaiting My Approval</option> : null}
        </select>
      }
      toolbarActions={
        <>
          <button
            type="button"
            className={`btn btn-sm ${filterOpen ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setFilterOpen((o) => !o)}
          >
            Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </button>
          {canExport ? (
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void onExport()}>
              Export CSV
            </button>
          ) : null}
        </>
      }
      primaryAction={
        canCreate ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreateTimesheet}>
            Create Timesheet
          </button>
        ) : null
      }
      createMenuItems={bulkImport.menuItems}
      moreMenuItems={bulkImport.menuItems}
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Timesheets by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Week start, status or resource"
            />
          </div>
          <div className="module-filter-section">
            <h3>Filter by fields</h3>
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"].map((value) => ({ value, label: value }))} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search timesheet statuses" />
            <ModuleFilterField label="Week start" htmlFor="timesheetWeekStartFilter">
              <input
                id="timesheetWeekStartFilter"
                className="form-control form-control-sm"
                type="date"
                value={weekStartFilter}
                onChange={(e) => setWeekStartFilter(e.target.value)}
              />
            </ModuleFilterField>
            <TechEarnestFilterSelect label="Resource" value={resourceFilter} onChange={setResourceFilter} options={resourceOptions} placeholder="All resources" emptyLabel="All resources" searchPlaceholder="Search resources" />
            <ModuleFilterCheckbox
              id="billableOnly"
              label="Has billable entries"
              checked={billableOnly}
              onChange={setBillableOnly}
            />
          </div>
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
      activeFilterCount={activeFilterCount}
      onClearFilters={() => {
        setSearch("");
        setStatusFilter("");
        setResourceFilter("");
        setWeekStartFilter("");
        setBillableOnly(false);
      }}
      onCloseFilters={() => setFilterOpen(false)}
    >
      {listQuery.isLoading ? <LoadingState label="Loading timesheets..." /> : null}
      {listQuery.error ? <ErrorState title="Unable to load timesheets" message="Try again." /> : null}

      {bulkMessage ? (
        <div className={`alert alert-${bulkMessage.tone} py-2 small d-flex align-items-center gap-2`}>
          <span className="flex-grow-1">{bulkMessage.text}</span>
          <button type="button" className="btn-close btn-sm" aria-label="Dismiss" onClick={() => setBulkMessage(null)} />
        </div>
      ) : null}
      {canApprove && checkedIds.length > 0 ? (
        <div className="d-flex flex-wrap align-items-center gap-2 border rounded px-2 py-2 mb-2 small bg-light">
          <span className="fw-semibold">
            {checkedIds.length} selected
            {approvableIds.length !== checkedIds.length ? ` · ${approvableIds.length} awaiting approval` : ""}
          </span>
          <button
            type="button"
            className="btn btn-success btn-sm"
            disabled={!approvableIds.length || bulkApproveMutation.isPending}
            onClick={() => bulkApproveMutation.mutate(approvableIds)}
          >
            {bulkApproveMutation.isPending ? "Approving…" : `Approve (${approvableIds.length})`}
          </button>
          <input
            className="form-control form-control-sm"
            style={{ maxWidth: "20rem" }}
            value={bulkRejectReason}
            onChange={(e) => setBulkRejectReason(e.target.value)}
            placeholder="Rejection reason (required to reject)"
          />
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            disabled={!approvableIds.length || !bulkRejectReason.trim() || bulkRejectMutation.isPending}
            onClick={() => bulkRejectMutation.mutate({ ids: approvableIds, reason: bulkRejectReason.trim() })}
          >
            Reject ({approvableIds.length})
          </button>
          <button type="button" className="btn btn-link btn-sm ms-auto" onClick={() => setCheckedIds([])}>
            Clear selection
          </button>
        </div>
      ) : null}

      {!listQuery.isLoading && !listQuery.error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <ModuleListTable
              tableCode="timesheet"
              defaultColumns={[
                { field: "weekStartDate", label: "Week" },
                { field: "resourceName", label: "Resource" },
                { field: "status", label: "Status" },
                { field: "totalHours", label: "Hours" },
                { field: "entrySource", label: "Entered" },
              ]}
              rows={rows}
              rowKey={(sheet) => sheet.id}
              selectedRowKey={selectedId}
              onRowClick={(sheet) => setSelectedId(sheet.id)}
              selectable={canApprove}
              selectedIds={checkedIds}
              onSelectedIdsChange={setCheckedIds}
              renderCell={(sheet, field) => {
                if (field === "status") return <StatusBadge status={sheet.status} />;
                if (field === "entrySource") return SOURCE_LABELS[sheet.entrySource] ?? sheet.entrySource ?? "—";
                if (field === "resourceName")
                  return (
                    <RecordLink module="resource" id={sheet.resourceId}>
                      {sheet.resourceName ?? "Resource"}
                    </RecordLink>
                  );
                const value = (sheet as unknown as Record<string, unknown>)[field];
                return value == null || value === "" ? "—" : String(value);
              }}
              nameFields={["weekStartDate"]}
              emptyMessage="No timesheets match the current filters."
            />
          ) : (
            <div className="module-tile-grid">
              {rows.map((sheet) => (
                <button
                  key={sheet.id}
                  type="button"
                  className={`module-tile text-start${selectedId === sheet.id ? " is-selected" : ""}`}
                  onClick={() => setSelectedId(sheet.id)}
                >
                  <div className="tile-title">Week of {sheet.weekStartDate}</div>
                  <div className="small text-muted">
                    {sheet.resourceName ? `${sheet.resourceName} · ` : ""}
                    {sheet.status} · {sheet.totalHours ?? 0} h
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
