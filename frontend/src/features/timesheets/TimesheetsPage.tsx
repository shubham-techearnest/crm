import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  TechEarnestCreateSection,
  TechEarnestFormKitCreateView,
  TechEarnestFormSelect,
  useTechEarnestCreateFlow,
} from "@/components/TechEarnestCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleFilterCheckbox, ModuleFilterField, ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import type { BulkBatchResult } from "@/components/BulkActions/bulkActions";
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
import {
  getPublishedListLayout,
  getUserListPref,
  saveUserListPref,
  type ListLayoutColumn,
} from "@/features/admin/studio/metadataApi";
import { createSavedView, deleteSavedView, listSavedViews, type SavedView } from "@/features/crm/foundationApi";
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
  todayIso,
  updateTimesheetNotes,
  type BulkActionResult,
  type GridEntryBody,
  type TimeEntry,
  type Timesheet,
} from "./timesheetApi";
import { WeeklyTimesheetGrid } from "./WeeklyTimesheetGrid";

const createSchema = z.object({
  resourceId: z.string().optional(),
  weekStartDate: z.string().min(1, "Week start is required"),
  notes: z.string().max(2000, "Keep notes under 2000 characters").optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

const TIMESHEET_DEFAULTS: CreateFormValues = {
  resourceId: "",
  weekStartDate: mondayOf(),
  notes: "",
};

const NO_ENTRIES: TimeEntry[] = [];

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Places entries on the same weekday of the week starting {@code monday}. */
function seedEntriesForWeek(entries: GridEntryBody[], monday: string): TimeEntry[] {
  return entries.map((entry, index) => ({
    id: `draft-${index}-${entry.workDate}`,
    timesheetId: "",
    projectId: entry.projectId,
    taskId: entry.taskId ?? null,
    workDate: addDays(monday, ((daysBetween(monday, entry.workDate) % 7) + 7) % 7),
    hours: entry.hours,
    description: entry.description ?? null,
    billable: entry.billable,
    billingRate: null,
    createdAt: "",
    updatedAt: "",
  }));
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
type ViewVisibility = "PRIVATE" | "SHARED" | "PUBLIC";

const TIMESHEET_TABLE = "timesheet";
const TIMESHEET_DEFAULT_COLUMNS: ListLayoutColumn[] = [
  { field: "weekStartDate", label: "Week" },
  { field: "resourceId", label: "Resource" },
  { field: "status", label: "Status" },
  { field: "totalHours", label: "Hours" },
  { field: "entrySource", label: "Entered" },
];
const BUILT_IN_VIEW_LABELS: Record<ListView, string> = {
  all: "All Timesheets",
  mine: "My Timesheets",
  awaiting: "Awaiting My Approval",
};

/** What a saved timesheet view stores in its filter: the built-in scope, the search text and field conditions. */
interface TimesheetViewFilter {
  op: "AND";
  scope: ListView;
  search?: string;
  conditions: { field: string; value: string | boolean }[];
}

function toBatchResult(results: BulkActionResult[]): BulkBatchResult {
  return {
    succeeded: results.filter((r) => r.success).length,
    failures: results.filter((r) => !r.success).map((r) => ({ id: r.id, reason: r.message ?? "Failed" })),
  };
}

function isEditable(status: string) {
  return status === "DRAFT" || status === "REJECTED";
}

function addDays(isoDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate ?? "");
  if (!match) return "";
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days)).toISOString().slice(0, 10);
}

function weekEndOf(weekStart: string): string {
  return addDays(weekStart, 6) || "—";
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
  const [gridDirty, setGridDirty] = useState(false);
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
  const watchedCreateResourceId = watch("resourceId");
  const createResourceId = (canProxy && watchedCreateResourceId) || auth.resourceId || "";
  const createEntryProjectsQuery = useQuery({
    queryKey: ["timesheets", "entry-projects", createResourceId],
    queryFn: () => listEntryProjectsForResource(createResourceId),
    enabled: showForm && canCreate && !!createResourceId,
    retry: false,
  });
  const createProjectNames = useMemo(() => {
    const names = new Map<string, string>();
    const tasks = new Map<string, string>();
    (createEntryProjectsQuery.data ?? []).forEach((project) => {
      names.set(project.projectId, project.name);
      project.tasks.forEach((task) => tasks.set(task.taskId, task.name));
    });
    return {
      project: (id: string) => names.get(id) ?? `${id.slice(0, 8)}…`,
      task: (id: string | null) => (id ? tasks.get(id) ?? null : null),
    };
  }, [createEntryProjectsQuery.data]);
  const createWeekDates = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(watchedWeekStart ?? "")) return [];
    const monday = mondayOf(new Date(`${watchedWeekStart}T00:00:00`));
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [watchedWeekStart]);
  const createMonday = createWeekDates[0] ?? "";
  const weekEndLabel = createWeekDates[6] ?? "—";
  const today = todayIso();

  const [createSeed, setCreateSeed] = useState<TimeEntry[]>(NO_ENTRIES);
  const [createEntries, setCreateEntries] = useState<GridEntryBody[]>([]);
  const [createGridValid, setCreateGridValid] = useState(true);
  const [copyingCreateWeek, setCopyingCreateWeek] = useState(false);
  const createEntriesRef = useRef<GridEntryBody[]>([]);
  const onCreateEntriesChange = useCallback((gridEntries: GridEntryBody[], valid: boolean) => {
    createEntriesRef.current = gridEntries;
    setCreateEntries(gridEntries);
    setCreateGridValid(valid);
  }, []);
  const previousCreateMonday = useRef(createMonday);
  useEffect(() => {
    const previous = previousCreateMonday.current;
    previousCreateMonday.current = createMonday;
    if (!previous || !createMonday || previous === createMonday) return;
    // Keep what was typed when the week changes: each entry moves to the same weekday.
    setCreateSeed(seedEntriesForWeek(createEntriesRef.current, createMonday));
  }, [createMonday]);
  function resetCreateGrid() {
    createEntriesRef.current = [];
    setCreateSeed(NO_ENTRIES);
    setCreateEntries([]);
    setCreateGridValid(true);
  }

  async function copyLastWeekIntoCreate() {
    if (!createResourceId || !createMonday) {
      setFormError(canProxy ? "Choose the resource first." : "Your user is not linked to a resource.");
      return;
    }
    setCopyingCreateWeek(true);
    try {
      const previousMonday = addDays(createMonday, -7);
      const sheets = await listTimesheets({ resourceId: createResourceId, weekStart: previousMonday });
      const previous = sheets.find((sheet) => sheet.resourceId === createResourceId && sheet.weekStartDate === previousMonday);
      if (!previous) {
        setFormError("There is no timesheet for the previous week to copy.");
        return;
      }
      const full = await getTimesheet(previous.id);
      const openProjects = new Set(
        (createEntryProjectsQuery.data ?? []).filter((project) => !project.closed).map((project) => project.projectId),
      );
      const copies = full.entries.filter((entry) => !createEntryProjectsQuery.data || openProjects.has(entry.projectId));
      if (!copies.length) {
        setFormError(
          full.entries.length
            ? "None of last week's projects can be logged against any more."
            : "The previous week has no entries to copy.",
        );
        return;
      }
      setFormError(null);
      setCreateSeed(seedEntriesForWeek(copies, createMonday));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to copy last week");
    } finally {
      setCopyingCreateWeek(false);
    }
  }

  const createFutureDate = createEntries.map((entry) => entry.workDate).filter((date) => date > today).sort()[0] ?? null;
  const createSubmitBlockedReason = !createEntries.length
    ? "Enter some hours first"
    : !createGridValid
      ? "Fix the highlighted hours first"
      : createFutureDate
        ? `Hours on a future date (${createFutureDate}) can only be saved as a draft`
        : null;
  const createWeekLabel = createMonday
    ? `${new Date(`${createMonday}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${new Date(
        `${weekEndLabel}T00:00:00`,
      ).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
    : "—";
  function moveCreateWeek(weeks: number) {
    const base = createMonday || mondayOf();
    setValue("weekStartDate", addDays(base, weeks * 7), { shouldDirty: true, shouldValidate: true });
  }
  const resourceOptions = useMemo(
    () =>
      (resourcesQuery.data ?? []).map((resource) => ({
        value: resource.id,
        label: resource.id === auth.resourceId ? `${resourceLabel(resource)} (me)` : resourceLabel(resource),
        subtitle: [resource.employeeCode, resource.designation].filter(Boolean).join(" · ") || undefined,
      })),
    [resourcesQuery.data, auth.resourceId],
  );

  const { cancelCreate, afterCreateSuccess } = useTechEarnestCreateFlow({
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
      resetCreateGrid();
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

  const createTimesheetWith = (submit: boolean) =>
    handleSubmit((values) => {
    const resourceId = (canProxy && values.resourceId) || auth.resourceId;
    if (!resourceId) {
      setFormError(
        canProxy
          ? "Choose the resource this timesheet is for."
          : "Your user is not linked to a resource. Ask an admin to link one.",
      );
      return;
    }
    if (!createGridValid) {
      setFormError("Fix the highlighted hours: each cell must be 0–24 and a day can't exceed 24 hours.");
      return;
    }
    createMutation.mutate({
      resourceId,
      weekStartDate: mondayOf(new Date(`${values.weekStartDate}T00:00:00`)),
      notes: values.notes?.trim() || null,
      startWith: createEntries.length ? "CUSTOM" : "BLANK",
      entries: createEntries.length ? createEntries : undefined,
      submitAfterCreate: submit && canSubmit && !createSubmitBlockedReason,
    });
  })();

  function openCreateTimesheet() {
    reset({ ...TIMESHEET_DEFAULTS, resourceId: auth.resourceId ?? "" });
    resetCreateGrid();
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

  const canManageViews = useHasPermission("SAVED_VIEW_MANAGE");
  const canPublishViews = useHasPermission("ORG_UPDATE");
  const [activeViewId, setActiveViewId] = useState("");
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [viewVisibility, setViewVisibility] = useState<ViewVisibility>("PRIVATE");
  const [viewKeepsColumns, setViewKeepsColumns] = useState(true);
  const [viewError, setViewError] = useState<string | null>(null);
  const viewsQuery = useQuery({
    queryKey: ["saved-views", "TIMESHEET"],
    queryFn: () => listSavedViews("TIMESHEET"),
    enabled: canManageViews,
  });
  const listPrefQuery = useQuery({
    queryKey: ["metadata", "list-prefs", TIMESHEET_TABLE],
    queryFn: () => getUserListPref(TIMESHEET_TABLE),
    retry: false,
  });
  const listLayoutQuery = useQuery({
    queryKey: ["metadata", "list-layout", TIMESHEET_TABLE],
    queryFn: () => getPublishedListLayout(TIMESHEET_TABLE),
    retry: false,
  });
  const currentColumns: ListLayoutColumn[] = listPrefQuery.data?.columns?.length
    ? listPrefQuery.data.columns
    : listLayoutQuery.data?.layout?.columns?.length
      ? listLayoutQuery.data.layout.columns
      : TIMESHEET_DEFAULT_COLUMNS;
  const savedViews = viewsQuery.data ?? [];
  const activeView = savedViews.find((view) => view.id === activeViewId) ?? null;

  function clearListFilters() {
    setSearch("");
    setStatusFilter("");
    setResourceFilter("");
    setWeekStartFilter("");
    setBillableOnly(false);
  }

  function currentViewFilter(): TimesheetViewFilter {
    const conditions: TimesheetViewFilter["conditions"] = [];
    if (statusFilter) conditions.push({ field: "status", value: statusFilter });
    if (resourceFilter) conditions.push({ field: "resourceId", value: resourceFilter });
    if (weekStartFilter) conditions.push({ field: "weekStartDate", value: weekStartFilter });
    if (billableOnly) conditions.push({ field: "billable", value: true });
    return { op: "AND", scope: listView, search: search.trim() || undefined, conditions };
  }

  async function applySavedView(view: SavedView) {
    const filter = (view.filter ?? {}) as Partial<TimesheetViewFilter>;
    const value = (field: string) => filter.conditions?.find((c) => c.field === field)?.value;
    setStatusFilter(String(value("status") ?? ""));
    setResourceFilter(String(value("resourceId") ?? ""));
    setWeekStartFilter(String(value("weekStartDate") ?? ""));
    setBillableOnly(value("billable") === true);
    setSearch(filter.search ?? "");
    setListView(
      filter.scope === "mine" && auth.resourceId ? "mine" : filter.scope === "awaiting" && canApprove ? "awaiting" : "all",
    );
    setActiveViewId(view.id);
    const columns = Array.isArray(view.columns) ? (view.columns as ListLayoutColumn[]) : [];
    if (columns.length) {
      try {
        await saveUserListPref(TIMESHEET_TABLE, columns);
        await queryClient.invalidateQueries({ queryKey: ["metadata", "list-prefs", TIMESHEET_TABLE] });
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Could not apply the view's columns");
      }
    }
  }

  function selectView(value: string) {
    if (value.startsWith("saved:")) {
      const view = savedViews.find((v) => v.id === value.slice("saved:".length));
      if (view) void applySavedView(view);
      return;
    }
    setActiveViewId("");
    clearListFilters();
    setListView(value as ListView);
  }

  const saveViewMutation = useMutation({
    mutationFn: () =>
      createSavedView({
        module: "TIMESHEET",
        name: viewName.trim(),
        visibility: canPublishViews ? viewVisibility : "PRIVATE",
        filter: currentViewFilter() as unknown as Record<string, unknown>,
        columns: viewKeepsColumns ? currentColumns : null,
      }),
    onSuccess: async (view) => {
      await queryClient.invalidateQueries({ queryKey: ["saved-views", "TIMESHEET"] });
      setActiveViewId(view.id);
      setSaveViewOpen(false);
      setViewName("");
      setViewError(null);
    },
    onError: (err: Error) => setViewError(err.message),
  });

  const deleteViewMutation = useMutation({
    mutationFn: (id: string) => deleteSavedView(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["saved-views", "TIMESHEET"] });
      setActiveViewId("");
    },
    onError: (err: Error) => setActionError(err.message),
  });

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
  const firstFutureEntryDate = useMemo(
    () => entries.map((entry) => entry.workDate).filter((date) => date > today).sort()[0] ?? null,
    [entries, today],
  );
  const submitBlockedReason = !entries.length
    ? "Log and save some hours before submitting."
    : gridDirty
      ? "Save the week before submitting."
      : firstFutureEntryDate
        ? `Hours are logged for a future date (${firstFutureEntryDate}). Keep it as a draft and submit once those days have passed.`
        : null;
  const projectScoped = selected?.visibility === "MY_PROJECTS";
  const myHoursPending = entries.some((entry) => !entry.approvedAt);
  const approvedHours = entries.filter((entry) => entry.approvedAt).reduce((sum, entry) => sum + Number(entry.hours), 0);
  const fallbackProjects = useMemo(
    () => (projectsQuery.data ?? []).map((project) => ({ id: project.id, name: project.name })),
    [projectsQuery.data],
  );
  return (
    <>
      {showForm && canCreate ? (
        <TechEarnestFormKitCreateView
          title="Create Timesheet"
          tableCode="timesheet"
          entityLabel="Timesheet"
          pending={isSubmitting || createMutation.isPending}
          isDirty={isDirty || createEntries.length > 0}
          formError={formError}
          onCancel={() => cancelCreate(isDirty || createEntries.length > 0)}
          onSave={() => void createTimesheetWith(false)}
          onSubmit={() => void createTimesheetWith(false)}
          saveLabel="Save as Draft"
          extraAction={
            canSubmit
              ? {
                  label: "Submit for Approval",
                  disabled: !!createSubmitBlockedReason,
                  title: createSubmitBlockedReason ?? "Save and send to your approver",
                  onClick: () => void createTimesheetWith(true),
                }
              : undefined
          }
          showRecordImage={false}
        >
          <TechEarnestCreateSection title="Log your hours">
            <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
              {canProxy ? (
                <div style={{ minWidth: "16rem" }}>
                  <TechEarnestFormSelect
                    control={control}
                    name="resourceId"
                    options={resourceOptions}
                    searchPlaceholder="Search resources"
                    placeholder="Select resource"
                    lookupIcon="users"
                    allowEmpty={false}
                  />
                </div>
              ) : null}
              <div className="btn-group btn-group-sm" role="group" aria-label="Week">
                <button type="button" className="btn btn-outline-secondary" aria-label="Previous week" onClick={() => moveCreateWeek(-1)}>
                  ‹
                </button>
                <span className="btn btn-outline-secondary disabled text-body fw-semibold" style={{ minWidth: "13rem" }}>
                  {createWeekLabel}
                </span>
                <button type="button" className="btn btn-outline-secondary" aria-label="Next week" onClick={() => moveCreateWeek(1)}>
                  ›
                </button>
              </div>
              {createMonday !== mondayOf() ? (
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0"
                  onClick={() => setValue("weekStartDate", mondayOf(), { shouldDirty: true, shouldValidate: true })}
                >
                  This week
                </button>
              ) : null}
            </div>
            {!createResourceId ? (
              <p className="small text-muted mb-0">
                {canProxy ? "Choose the resource first to log time." : "Your user is not linked to a resource. Ask an admin to link one."}
              </p>
            ) : (
              <>
                <WeeklyTimesheetGrid
                  weekStart={createMonday}
                  entries={createSeed}
                  projectChoices={createEntryProjectsQuery.data ?? []}
                  fallbackProjects={[]}
                  projectLabel={createProjectNames.project}
                  taskLabel={createProjectNames.task}
                  editable
                  saving={false}
                  copying={copyingCreateWeek}
                  onSave={() => undefined}
                  onCopyLastWeek={() => void copyLastWeekIntoCreate()}
                  onEntriesChange={onCreateEntriesChange}
                  showSaveControls={false}
                />
                <input
                  type="text"
                  maxLength={2000}
                  aria-label="Note for approver"
                  className={`form-control form-control-sm${errors.notes ? " is-invalid" : ""}`}
                  placeholder="Note for approver (optional)"
                  {...register("notes")}
                />
                {errors.notes ? <div className="invalid-feedback d-block">{errors.notes.message}</div> : null}
              </>
            )}
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
            customFieldsTable="timesheet"
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
                    disabled={!canSubmit || !canEditSheet || submitMutation.isPending || !!submitBlockedReason}
                    title={submitBlockedReason ?? "Send this week to your approver"}
                    onClick={() => submitMutation.mutate()}
                  >
                    {submitMutation.isPending ? "Submitting…" : "Submit for Approval"}
                  </button>
                ) : null}
                {selected.status === "SUBMITTED" ? (
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm"
                    disabled={!canApprove || approveMutation.isPending || (projectScoped && !myHoursPending)}
                    onClick={() => approveMutation.mutate()}
                  >
                    {!projectScoped ? "Approve" : myHoursPending ? "Approve My Projects" : "My Projects Approved"}
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
                    {projectScoped ? (
                      <div className="alert alert-info py-2 small">
                        You only see the hours logged on projects you manage. Hours on other projects are reviewed by
                        their own project managers.
                        {selected.status === "SUBMITTED" && !myHoursPending
                          ? " You have approved your projects; the week is waiting for the other project managers."
                          : ""}
                      </div>
                    ) : selected.status === "SUBMITTED" && approvedHours > 0 ? (
                      <div className="alert alert-info py-2 small">
                        {approvedHours} of {selected.totalHours ?? 0} h already approved by their project managers.
                      </div>
                    ) : null}
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
                        onDirtyChange={setGridDirty}
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
          value={activeViewId ? `saved:${activeViewId}` : listView}
          aria-label="Timesheet view"
          onChange={(e) => selectView(e.target.value)}
        >
          <option value="all">{BUILT_IN_VIEW_LABELS.all}</option>
          {auth.resourceId ? <option value="mine">{BUILT_IN_VIEW_LABELS.mine}</option> : null}
          {canApprove ? <option value="awaiting">{BUILT_IN_VIEW_LABELS.awaiting}</option> : null}
          {savedViews.length ? (
            <optgroup label="Saved views">
              {savedViews.map((view) => (
                <option key={view.id} value={`saved:${view.id}`}>
                  {view.name}
                </option>
              ))}
            </optgroup>
          ) : null}
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
          {canManageViews ? (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              title="Save the current filters and columns as a view"
              onClick={() => {
                setViewName(activeView ? `${activeView.name} (copy)` : "");
                setViewError(null);
                setSaveViewOpen(true);
              }}
            >
              Save View
            </button>
          ) : null}
          {activeView && canManageViews ? (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              disabled={deleteViewMutation.isPending}
              onClick={() => {
                if (window.confirm(`Delete the view "${activeView.name}"?`)) deleteViewMutation.mutate(activeView.id);
              }}
            >
              Delete View
            </button>
          ) : null}
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
      footerRight={<span>View: {activeView?.name ?? BUILT_IN_VIEW_LABELS[listView]}</span>}
      activeFilterCount={activeFilterCount}
      onClearFilters={clearListFilters}
      onCloseFilters={() => setFilterOpen(false)}
    >
      {listQuery.isLoading ? <LoadingState label="Loading timesheets..." /> : null}
      {listQuery.error ? <ErrorState title="Unable to load timesheets" message="Try again." /> : null}

      {!listQuery.isLoading && !listQuery.error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <ModuleListTable
              tableCode={TIMESHEET_TABLE}
              defaultColumns={TIMESHEET_DEFAULT_COLUMNS}
              rows={rows}
              rowKey={(sheet) => sheet.id}
              selectedRowKey={selectedId}
              onRowClick={(sheet) => setSelectedId(sheet.id)}
              bulk={{
                noun: "timesheets",
                exportFileName: "timesheets",
                rowLabel: (sheet) => `${sheet.resourceName ?? "Resource"} · ${sheet.weekStartDate}`,
                onComplete: () => {
                  invalidateTimeSummaries();
                  void queryClient.invalidateQueries({ queryKey: ["timesheets"] });
                },
                actions: [
                  {
                    id: "approve",
                    label: "Approve",
                    tone: "success",
                    visible: canApprove,
                    doneLabel: "approved",
                    applies: (sheet) => sheet.status === "SUBMITTED",
                    runBatch: async (ids) => toBatchResult(await bulkApproveTimesheets(ids)),
                  },
                  {
                    id: "reject",
                    label: "Reject",
                    tone: "danger",
                    visible: canApprove,
                    doneLabel: "rejected",
                    applies: (sheet) => sheet.status === "SUBMITTED",
                    input: { kind: "text", label: "Rejection reason", multiline: true },
                    runBatch: async (ids, reason) => toBatchResult(await bulkRejectTimesheets(ids, reason)),
                  },
                  {
                    id: "submit",
                    label: "Submit",
                    visible: canSubmit,
                    doneLabel: "submitted",
                    applies: (sheet) => isEditable(sheet.status),
                    run: (sheet) => submitTimesheet(sheet.id),
                  },
                ],
              }}
              renderCell={(sheet, field) => {
                if (field === "status") return <StatusBadge status={sheet.status} />;
                if (field === "entrySource") return SOURCE_LABELS[sheet.entrySource] ?? sheet.entrySource ?? "—";
                if (field === "resourceName" || field === "resourceId")
                  return (
                    <RecordLink module="resource" id={sheet.resourceId}>
                      {sheet.resourceName ?? "Resource"}
                    </RecordLink>
                  );
                if (field === "totalHours") return `${sheet.totalHours ?? 0} h`;
                if (field === "submittedAt" || field === "approvedAt" || field === "createdAt")
                  return formatDateTime(sheet[field]);
                if (field === "approvedBy") return userLabel(sheet.approvedBy);
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
      {saveViewOpen ? (
        <>
          <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="timesheetSaveViewTitle">
            <div className="modal-dialog modal-dialog-centered">
              <form
                className="modal-content"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (viewName.trim()) saveViewMutation.mutate();
                }}
              >
                <div className="modal-header">
                  <h2 className="modal-title h5" id="timesheetSaveViewTitle">
                    Save Timesheet View
                  </h2>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setSaveViewOpen(false)} />
                </div>
                <div className="modal-body d-grid gap-3">
                  {viewError ? <div className="alert alert-danger py-2 mb-0">{viewError}</div> : null}
                  <div>
                    <label className="form-label" htmlFor="timesheetViewName">
                      View name
                    </label>
                    <input
                      id="timesheetViewName"
                      className="form-control"
                      value={viewName}
                      maxLength={120}
                      autoFocus
                      onChange={(e) => setViewName(e.target.value)}
                      placeholder="e.g. Submitted this month"
                    />
                  </div>
                  {canPublishViews ? (
                    <div>
                      <label className="form-label" htmlFor="timesheetViewVisibility">
                        Who can see it
                      </label>
                      <select
                        id="timesheetViewVisibility"
                        className="form-select"
                        value={viewVisibility}
                        onChange={(e) => setViewVisibility(e.target.value as ViewVisibility)}
                      >
                        <option value="PRIVATE">Only me</option>
                        <option value="SHARED">Shared with my organization</option>
                        <option value="PUBLIC">Everyone</option>
                      </select>
                    </div>
                  ) : null}
                  <div className="small text-muted">
                    <div>
                      <strong>Based on:</strong> {BUILT_IN_VIEW_LABELS[listView]}
                    </div>
                    <div>
                      <strong>Filters:</strong>{" "}
                      {activeFilterCount ? `${activeFilterCount} active` : "none (the view shows every timesheet in its base list)"}
                    </div>
                  </div>
                  <div className="form-check">
                    <input
                      id="timesheetViewColumns"
                      className="form-check-input"
                      type="checkbox"
                      checked={viewKeepsColumns}
                      onChange={(e) => setViewKeepsColumns(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="timesheetViewColumns">
                      Remember current columns ({currentColumns.map((c) => c.label || c.field).join(", ")})
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setSaveViewOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={!viewName.trim() || saveViewMutation.isPending}>
                    {saveViewMutation.isPending ? "Saving..." : "Save View"}
                  </button>
                </div>
              </form>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      ) : null}
    </>
  );
}
