import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { RecordLink, RelatedRecordList } from "@/components/RecordLink";
import { useUrlSelection } from "@/hooks/useUrlRecord";
import {
  ModuleFilterCheckbox,
  ModuleFilterDateRange,
  ModuleFilterField,
  ModuleListShell,
  ModuleMenuDropdown,
} from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { postServerBulk } from "@/components/BulkActions/bulkActions";
import { enumOptions, useActiveUserOptions } from "@/components/BulkActions/useBulkOptions";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";
import type { ModuleMenuItem } from "@/components/ModuleListShell/ModuleListShell";
import { buildOwnerOptions, buildFilterOwnerOptions, enumPickerOptions, optionsFromPairs, TechEarnestFilterSelect, TechEarnestFormSelect } from "@/components/TechEarnestCreate";
import { useBulkImport } from "@/features/import/useBulkImport";
import { LeadCreateView } from "./LeadCreateView";
import { LeadEditView } from "./LeadEditView";
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
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { ACCESS_TOKEN_KEY } from "@/api/client";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listAuditLogs, listRegions, listUsers } from "@/features/admin/adminApi";
import { getPublishedListLayout, getUserListPref, type ListLayoutColumn } from "@/features/admin/studio/metadataApi";
import {
  assignLead,
  convertLead,
  deleteLead,
  exportLeads,
  getContact,
  getDeal,
  getLead,
  listAccounts,
  listActivities,
  listLeads,
  queryLeads,
  updateLead,
  type Lead,
} from "./crmApi";
import {
  createNote,
  createSavedView,
  deleteDocument,
  deleteNote,
  deleteSavedView,
  documentDownloadUrl,
  listDocuments,
  listNotes,
  listSavedViews,
  uploadDocument,
} from "./foundationApi";
import { buildLeadFilterConditions, needsLeadQuery } from "./leadFilterCatalog";

const convertSchema = z.object({
  createAccount: z.boolean(),
  createContact: z.boolean(),
  createDeal: z.boolean(),
  accountId: z.string().optional(),
  dealName: z.string().optional(),
  dealValue: z.string().optional(),
  dealStage: z.string().optional(),
});

type ConvertFormValues = z.infer<typeof convertSchema>;

const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION"] as const;
const LEAD_STATUS_FILTER_OPTIONS = enumPickerOptions([...LEAD_STATUSES, "CONVERTED"]);
const PRIORITY_FILTER_OPTIONS = enumPickerOptions(["LOW", "MEDIUM", "HIGH"]);
/** Fields the leads API can sort by (LeadController whitelist); leads are newest first otherwise. */
const LEAD_SORT_FIELDS = [
  { field: "companyName", label: "Company" },
  { field: "createdAt", label: "Created Time" },
  { field: "estimatedValue", label: "Estimated Value" },
  { field: "expectedCloseDate", label: "Expected Close Date" },
  { field: "priority", label: "Priority" },
  { field: "source", label: "Source" },
  { field: "status", label: "Status" },
];
const DEFAULT_LEAD_SORT = { field: "createdAt", dir: "DESC" };

export function LeadsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  const canCreate = useHasPermission("LEAD_CREATE");
  const canConvert = useHasPermission("LEAD_CONVERT");
  const canAssign = useHasPermission("LEAD_ASSIGN");
  const canUpdate = useHasPermission("LEAD_UPDATE");
  const canDelete = useHasPermission("LEAD_DELETE");
  const bulkOwnerOptions = useActiveUserOptions(canAssign);
  const canExport = useHasPermission("LEAD_EXPORT");
  const canImport = useHasPermission("LEAD_IMPORT");
  const canViewUsers = useHasPermission("USER_VIEW");
  const canViewDocs = useHasPermission("DOCUMENT_VIEW");
  const canUploadDocs = useHasPermission("DOCUMENT_UPLOAD");
  const canDeleteDocs = useHasPermission("DOCUMENT_DELETE");
  const canViewNotes = useHasPermission("NOTE_VIEW");
  const canCreateNotes = useHasPermission("NOTE_CREATE");
  const canDeleteNotes = useHasPermission("NOTE_DELETE");
  const canManageViews = useHasPermission("SAVED_VIEW_MANAGE");
  const canPublishViews = useHasPermission("ORG_UPDATE");
  const canViewAudit = useHasPermission("AUDIT_VIEW");
  const canViewActivities = useHasPermission("ACTIVITY_VIEW");
  const canViewContacts = useHasPermission("CONTACT_VIEW");
  const canViewDeals = useHasPermission("DEAL_VIEW");
  const [showForm, setShowForm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [assignOwnerId, setAssignOwnerId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [minValueFilter, setMinValueFilter] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [unconvertedOnly, setUnconvertedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("DESC");
  const [noteBody, setNoteBody] = useState("");
  const [viewName, setViewName] = useState("");
  const [viewVisibility, setViewVisibility] = useState<"PRIVATE" | "SHARED" | "PUBLIC">("PRIVATE");

  const useAdvancedQuery = needsLeadQuery({
    ownerId: ownerFilter,
    minValue: minValueFilter,
    createdFrom,
    createdTo,
    unconvertedOnly,
  });

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter || undefined,
      source: sourceFilter || undefined,
      priority: priorityFilter || undefined,
      regionId: regionFilter || undefined,
      sortBy,
      sortDir,
    }),
    [search, statusFilter, sourceFilter, priorityFilter, regionFilter, sortBy, sortDir],
  );

  const queryBody = useMemo(() => {
    const conditions = buildLeadFilterConditions({
      status: statusFilter,
      source: sourceFilter,
      priority: priorityFilter,
      regionId: regionFilter,
      ownerId: ownerFilter,
      minValue: minValueFilter,
      createdFrom,
      createdTo,
      unconvertedOnly,
    });
    return {
      search: search || undefined,
      filter: conditions.length ? { op: "AND", conditions } : undefined,
      sort: [{ field: sortBy, direction: sortDir }],
      size: 100,
    };
  }, [
    search,
    statusFilter,
    sourceFilter,
    priorityFilter,
    regionFilter,
    ownerFilter,
    minValueFilter,
    createdFrom,
    createdTo,
    unconvertedOnly,
    sortBy,
    sortDir,
  ]);

  const leadsQuery = useQuery({
    queryKey: ["crm", "leads", useAdvancedQuery ? "query" : "list", useAdvancedQuery ? queryBody : listParams],
    queryFn: () => (useAdvancedQuery ? queryLeads(queryBody) : listLeads(listParams)),
  });
  const [selected, setSelected] = useUrlSelection(leadsQuery.data, { fetchById: getLead });

  useEffect(() => {
    if (searchParams.get("create") === "1" && canCreate) {
      setSelected(null);
      setShowEdit(false);
      setShowForm(true);
    }
  }, [searchParams, canCreate]);
  const [activeViewId, setActiveViewId] = useState("");
  const [filterOpen, setFilterOpen] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "tile">("list");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const leadRecordQuery = useQuery({
    queryKey: ["crm", "leads", "record", selected?.id],
    queryFn: () => getLead(selected!.id),
    enabled: !!selected,
  });
  useEffect(() => {
    if (leadRecordQuery.data && selected?.id === leadRecordQuery.data.id) {
      setSelected((current) => current?.id === leadRecordQuery.data!.id ? leadRecordQuery.data! : current);
    }
  }, [leadRecordQuery.data, selected?.id]);
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const listLayoutQuery = useQuery({
    queryKey: ["metadata", "runtime", "lead", "list-layout"],
    queryFn: () => getPublishedListLayout("lead"),
    staleTime: 60_000,
  });
  const listPrefQuery = useQuery({
    queryKey: ["metadata", "list-prefs", "lead"],
    queryFn: () => getUserListPref("lead"),
    staleTime: 30_000,
  });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: canCreate || canAssign || canViewUsers,
  });
  const accountsQuery = useQuery({
    queryKey: ["crm", "accounts"],
    queryFn: () => listAccounts(),
    enabled: showConvert || !!selected?.convertedAccountId,
  });
  const convertedContactQuery = useQuery({
    queryKey: ["crm", "contacts", "record", selected?.convertedContactId],
    queryFn: () => getContact(selected!.convertedContactId!),
    enabled: !!selected?.convertedContactId && canViewContacts,
  });
  const convertedDealQuery = useQuery({
    queryKey: ["crm", "deals", "record", selected?.convertedDealId],
    queryFn: () => getDeal(selected!.convertedDealId!),
    enabled: !!selected?.convertedDealId && canViewDeals,
  });
  const viewsQuery = useQuery({
    queryKey: ["crm", "saved-views", "LEAD"],
    queryFn: () => listSavedViews("LEAD"),
    enabled: canManageViews,
  });
  const notesQuery = useQuery({
    queryKey: ["crm", "notes", "LEAD", (selected as Lead | null)?.id],
    queryFn: () => listNotes("LEAD", selected!.id),
    enabled: !!selected && canViewNotes,
  });
  const docsQuery = useQuery({
    queryKey: ["crm", "documents", "LEAD", (selected as Lead | null)?.id],
    queryFn: () => listDocuments("LEAD", selected!.id),
    enabled: !!selected && canViewDocs,
  });
  const activitiesQuery = useQuery({
    queryKey: ["crm", "activities", "LEAD", (selected as Lead | null)?.id],
    queryFn: () => listActivities({ relatedEntityType: "LEAD", relatedEntityId: selected!.id }),
    enabled: !!selected && canViewActivities,
  });
  const openActivities = useMemo(
    () => (activitiesQuery.data ?? []).filter((activity) => activity.status !== "COMPLETED"),
    [activitiesQuery.data],
  );
  const closedActivities = useMemo(
    () => (activitiesQuery.data ?? []).filter((activity) => activity.status === "COMPLETED"),
    [activitiesQuery.data],
  );
  const auditQuery = useQuery({
    queryKey: ["admin", "audit-logs", "LEAD", (selected as Lead | null)?.id],
    queryFn: () => listAuditLogs({ entityType: "LEAD", entityId: selected!.id, size: 50 }),
    enabled: !!selected && canViewAudit,
  });

  const convertForm = useForm<ConvertFormValues>({
    resolver: zodResolver(convertSchema),
    defaultValues: {
      createAccount: true,
      createContact: true,
      createDeal: true,
      accountId: "",
      dealName: "",
      dealValue: "",
      dealStage: "NEW",
    },
  });
  const createAccountChecked = useWatch({ control: convertForm.control, name: "createAccount" });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["crm", "leads"] }),
      queryClient.invalidateQueries({ queryKey: ["crm", "accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] }),
      queryClient.invalidateQueries({ queryKey: ["crm", "deals"] }),
    ]);
  };

  async function handleLeadCreated(lead: Lead, mode: "save" | "saveAndNew") {
    await refresh();
    if (mode === "save") {
      setShowForm(false);
      setSelected(lead);
    }
  }

  const convertMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof convertLead>[1] }) =>
      convertLead(id, body),
    onSuccess: async () => {
      await refresh();
      setShowConvert(false);
      setConvertError(null);
      convertForm.reset({
        createAccount: true,
        createContact: true,
        createDeal: true,
        accountId: "",
        dealName: "",
        dealValue: "",
        dealStage: "NEW",
      });
    },
    onError: () => setConvertError("Could not convert lead. Check permissions and inputs."),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, ownerId }: { id: string; ownerId: string }) => assignLead(id, ownerId),
    onSuccess: async (lead) => {
      await refresh();
      setSelected(lead);
      setActionError(null);
    },
    onError: () => setActionError("Could not assign owner. Check permissions."),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateLead(id, { status }),
    onSuccess: async (lead) => {
      await refresh();
      setSelected(lead);
      setActionError(null);
    },
    onError: () => setActionError("Could not update status."),
  });

  const deleteMutation = useMutation({
    mutationFn: (leadId: string) => deleteLead(leadId),
    onSuccess: async (_result, leadId) => {
      await refresh();
      if (selected?.id === leadId) setSelected(null);
      setLeadToDelete(null);
      setDeleteError(null);
    },
    onError: () => setDeleteError("Could not delete this lead. Check your permission and try again."),
  });

  const exportMutation = useMutation({
    mutationFn: (cols: string[]) => exportLeads(cols),
    onError: () => setExportError("Export failed."),
    onSuccess: () => setExportError(null),
  });

  const defaultLeadColumns: ListLayoutColumn[] = useMemo(
    () => [
      { field: "firstName", label: "First name" },
      { field: "lastName", label: "Last name" },
      { field: "companyName", label: "Company" },
      { field: "email", label: "Email" },
      { field: "phone", label: "Phone" },
      { field: "source", label: "Source" },
      { field: "status", label: "Status" },
    ],
    [],
  );

  const publishedColumns = listLayoutQuery.data?.layout?.columns?.length
    ? listLayoutQuery.data.layout.columns
    : defaultLeadColumns;

  const visibleColumns: ListLayoutColumn[] = useMemo(() => {
    const pref = listPrefQuery.data?.columns;
    if (pref && Array.isArray(pref) && pref.length > 0) {
      return pref;
    }
    return publishedColumns;
  }, [listPrefQuery.data, publishedColumns]);

  const leadCellValue = (lead: Lead, field: string): ReactNode => {
    switch (field) {
      case "firstName":
        return lead.firstName ?? "—";
      case "lastName":
        return lead.lastName ?? "—";
      case "companyName":
        return lead.companyName ?? "—";
      case "email":
        return lead.email ?? "—";
      case "phone":
        return lead.phone ?? "—";
      case "source":
        return lead.source ?? "—";
      case "status":
        return <StatusBadge status={lead.status} />;
      case "priority":
        return lead.priority ?? "—";
      case "estimatedValue":
        return lead.estimatedValue != null ? lead.estimatedValue : "—";
      case "createdAt":
        return lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—";
      default: {
        const value = (lead as unknown as Record<string, unknown>)[field];
        return value == null || value === "" ? "—" : String(value);
      }
    }
  };

  const saveViewMutation = useMutation({
    mutationFn: () =>
      createSavedView({
        module: "LEAD",
        name: viewName.trim(),
        visibility: viewVisibility,
        filter: {
          op: "AND",
          conditions: buildLeadFilterConditions({
            status: statusFilter,
            source: sourceFilter,
            priority: priorityFilter,
            regionId: regionFilter,
            ownerId: ownerFilter,
            minValue: minValueFilter,
            createdFrom,
            createdTo,
            unconvertedOnly,
          }),
        },
        sort: [{ field: sortBy, direction: sortDir }],
      }),
    onSuccess: async () => {
      setViewName("");
      await queryClient.invalidateQueries({ queryKey: ["crm", "saved-views", "LEAD"] });
    },
  });

  const deleteViewMutation = useMutation({
    mutationFn: deleteSavedView,
    onSuccess: async () => {
      setActiveViewId("");
      await queryClient.invalidateQueries({ queryKey: ["crm", "saved-views", "LEAD"] });
    },
  });

  const noteMutation = useMutation({
    mutationFn: () => createNote("LEAD", selected!.id, noteBody),
    onSuccess: async () => {
      setNoteBody("");
      await queryClient.invalidateQueries({ queryKey: ["crm", "notes", "LEAD", (selected as Lead | null)?.id] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "notes", "LEAD", (selected as Lead | null)?.id] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument("LEAD", selected!.id, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "documents", "LEAD", (selected as Lead | null)?.id] });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "documents", "LEAD", (selected as Lead | null)?.id] });
    },
  });

  const applySavedView = (viewId: string) => {
    setActiveViewId(viewId);
    const view = (viewsQuery.data ?? []).find((item) => item.id === viewId);
    if (!view?.filter || typeof view.filter !== "object") {
      return;
    }
    const conditions = Array.isArray((view.filter as { conditions?: unknown }).conditions)
      ? ((view.filter as {
          conditions: Array<{ field?: string; value?: unknown; operator?: string }>;
        }).conditions)
      : [];
    setStatusFilter(
      String(conditions.find((c) => c.field === "status" && c.operator !== "NE")?.value ?? ""),
    );
    setSourceFilter(String(conditions.find((c) => c.field === "source")?.value ?? ""));
    setPriorityFilter(String(conditions.find((c) => c.field === "priority")?.value ?? ""));
    setRegionFilter(String(conditions.find((c) => c.field === "regionId")?.value ?? ""));
    setOwnerFilter(String(conditions.find((c) => c.field === "ownerId")?.value ?? ""));
    const valueCond = conditions.find((c) => c.field === "estimatedValue");
    setMinValueFilter(valueCond?.value != null ? String(valueCond.value) : "");
    setUnconvertedOnly(conditions.some((c) => c.field === "status" && c.operator === "NE"));
    setCreatedFrom("");
    setCreatedTo("");
    const sort = Array.isArray(view.sort) ? (view.sort as Array<{ field?: string; direction?: string }>) : [];
    if (sort[0]?.field) {
      setSortBy(sort[0].field);
      setSortDir(sort[0].direction ?? "DESC");
    }
  };

  const openDownload = async (id: string) => {
    const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const response = await fetch(documentDownloadUrl(id), {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) {
      setActionError("Download failed.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "document";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const leads = leadsQuery.data ?? [];
  const recordNav = useRecordNavigation(leads, selected, setSelected);

  const ownerName = useMemo(() => {
    const map = new Map(
      (usersQuery.data ?? []).map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]),
    );
    return (id: string | null | undefined) => (id ? (map.get(id) ?? id.slice(0, 8)) : "—");
  }, [usersQuery.data]);

  const leadDisplayName = (lead: Lead) => {
    const sal = lead.salutation ? `${lead.salutation} ` : "";
    return `${sal}${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || "Lead";
  };

  const formatLeadMoney = (value: number | null | undefined) =>
    value != null
      ? value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
      : "—";

  const activeViewName =
    activeViewId === ""
      ? "All Leads"
      : (viewsQuery.data ?? []).find((view) => view.id === activeViewId)?.name ?? "All Leads";
  const activeFilterCount = [
    statusFilter,
    sourceFilter,
    priorityFilter,
    regionFilter,
    ownerFilter,
    minValueFilter,
    createdFrom,
    createdTo,
    unconvertedOnly ? "1" : "",
    search,
  ].filter(Boolean).length;

  const ownerOptions = useMemo(
    () =>
      buildOwnerOptions(usersQuery.data, {
        userId: auth.userId,
        displayName: auth.displayName,
      }),
    [usersQuery.data, auth.displayName, auth.userId],
  );

  const regionFilterOptions = useMemo(
    () => optionsFromPairs((regionsQuery.data ?? []).map((region) => ({ value: region.id, label: region.name }))),
    [regionsQuery.data],
  );
  const ownerFilterOptions = useMemo(
    () => buildFilterOwnerOptions(usersQuery.data, auth.userId),
    [usersQuery.data, auth.userId],
  );

  const timelineEntries = useMemo(
    () =>
      buildTimelineEntries(
        auditQuery.data,
        activitiesQuery.data,
        (userId) => (userId === auth.userId ? auth.displayName : ownerName(userId)),
        recordLifecycleInfo("Lead", selected),
        notesQuery.data,
      ),
    [auditQuery.data, activitiesQuery.data, notesQuery.data, auth.displayName, auth.userId, ownerName, selected],
  );

  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter("");
    setSourceFilter("");
    setPriorityFilter("");
    setRegionFilter("");
    setOwnerFilter("");
    setMinValueFilter("");
    setCreatedFrom("");
    setCreatedTo("");
    setUnconvertedOnly(false);
    setActiveViewId("");
  };

  const openCreateLead = () => {
    setSelected(null);
    setShowForm(true);
  };

  const bulkImport = useBulkImport("leads", async (result) => {
    const extras = [
      result.skipped ? `${result.skipped} skipped` : "",
      result.failed ? `${result.failed} not imported` : "",
    ].filter(Boolean);
    setBulkMessage(`Imported ${result.imported} leads${extras.length ? ` (${extras.join(", ")})` : ""}.`);
    if (result.imported) await refresh();
  });
  const createMenuItems: ModuleMenuItem[] = bulkImport.menuItems;

  const moreMenuItems: ModuleMenuItem[] = [
    ...bulkImport.menuItems,
    {
      id: "export",
      label: "Export leads",
      icon: "export",
      visible: canExport,
      onClick: () => exportMutation.mutate(visibleColumns.map((column) => column.field)),
      disabled: exportMutation.isPending,
    },
  ];

  return (
    <>
      {exportError ? <div className="alert alert-danger py-2">{exportError}</div> : null}

      {showForm && canCreate ? (
        <LeadCreateView
          regions={(regionsQuery.data ?? []).map((region) => ({ id: region.id, name: region.name }))}
          users={ownerOptions}
          defaultOwnerId={auth.userId}
          defaultRegionId={auth.regionIds[0]}
          onCancel={() => setShowForm(false)}
          onCreated={(lead, mode) => void handleLeadCreated(lead, mode)}
        />
      ) : showEdit && selected && canUpdate ? (
        <LeadEditView
          lead={selected}
          users={ownerOptions}
          onCancel={() => setShowEdit(false)}
          onUpdated={(lead) => {
            setSelected(lead);
            setShowEdit(false);
            void refresh();
          }}
        />
      ) : selected ? (
        <RecordShell
          layout="page"
          title={leadDisplayName(selected)}
          subtitle={selected.companyName ?? undefined}
          avatarLabel={leadDisplayName(selected)}
          status={<StatusBadge status={selected.status} />}
          recordKey={selected.id}
          customFieldsTable="lead"
          onBack={() => {
            setShowEdit(false);
            setShowConvert(false);
            recordNav.goBack();
          }}
          onPrev={recordNav.goPrev}
          onNext={recordNav.goNext}
          hasPrev={recordNav.hasPrev}
          hasNext={recordNav.hasNext}
          relatedLinks={
            selected.convertedAccountId || selected.convertedContactId || selected.convertedDealId
              ? [{ id: "converted", label: "Converted Records" }, ...DEFAULT_RELATED_LINKS]
              : [...DEFAULT_RELATED_LINKS]
          }
          primaryAction={
            selected.email ? (
              <a className="btn btn-primary btn-sm" href={`mailto:${selected.email}`}>
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
              {canConvert && selected.status !== "CONVERTED" ? (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => {
                    setShowConvert((v) => !v);
                    convertForm.reset({
                      createAccount: true,
                      createContact: true,
                      createDeal: true,
                      accountId: "",
                      dealName: selected.companyName ? `${selected.companyName} deal` : "",
                      dealValue: selected.estimatedValue != null ? String(selected.estimatedValue) : "",
                      dealStage: "NEW",
                    });
                  }}
                >
                  {showConvert ? "Cancel convert" : "Convert"}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={!canUpdate || selected.status === "CONVERTED"}
                title={selected.status === "CONVERTED" ? "Converted leads cannot be edited" : undefined}
                onClick={() => setShowEdit(true)}
              >
                Edit
              </button>
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
                      { label: "Lead Owner", value: ownerName(selected.ownerId) },
                      { label: "Email", value: selected.email ?? "—" },
                      { label: "Phone", value: selected.phone ?? "—" },
                      { label: "Mobile", value: selected.mobile ?? "—" },
                      { label: "Lead Status", value: <StatusBadge status={selected.status} /> },
                    ]}
                  />

                  <TechEarnestRecordInfoSection
                    title="Lead Information"
                    fields={[
                      { label: "Lead Owner", value: ownerName(selected.ownerId) },
                      { label: "Company", value: selected.companyName ?? "—" },
                      { label: "Title", value: selected.designation ?? "—" },
                      {
                        label: "Lead Name",
                        value: `${selected.firstName ?? ""} ${selected.lastName ?? ""}`.trim() || "—",
                      },
                      { label: "Phone", value: selected.phone ?? "—" },
                      { label: "Email", value: selected.email ?? "—" },
                      { label: "Mobile", value: selected.mobile ?? "—" },
                      { label: "Fax", value: selected.fax ?? "—" },
                      { label: "Lead Source", value: selected.source ?? "—" },
                      { label: "Website", value: selected.website ?? "—" },
                      { label: "Industry", value: selected.industry ?? "—" },
                      { label: "Lead Status", value: selected.status },
                      { label: "Annual Revenue", value: formatLeadMoney(selected.estimatedValue) },
                      { label: "No. of Employees", value: selected.noOfEmployees ?? "—" },
                    ]}
                  />

                  {(selected.addressStreet ||
                    selected.addressCity ||
                    selected.addressState ||
                    selected.addressCountry) ? (
                    <TechEarnestRecordInfoSection
                      title="Address Information"
                      collapsible={false}
                      fields={[
                        {
                          label: "Address",
                          value: [
                            selected.addressFlat,
                            selected.addressStreet,
                            selected.addressCity,
                            selected.addressState,
                            selected.addressCountry,
                          ]
                            .filter(Boolean)
                            .join(", ") || "—",
                        },
                        { label: "Zip Code", value: selected.addressZip ?? "—" },
                      ]}
                    />
                  ) : null}

                  {selected.description ? (
                    <TechEarnestRecordInfoSection
                      title="Description Information"
                      collapsible={false}
                      fields={[{ label: "Description", value: selected.description }]}
                    />
                  ) : null}

                  {actionError ? <div className="alert alert-danger py-2">{actionError}</div> : null}

                  {canUpdate && selected.status !== "CONVERTED" ? (
                    <div className="mb-3">
                      <label className="form-label small mb-1">Update status</label>
                      <select
                        className="form-select form-select-sm"
                        value={selected.status}
                        onChange={(e) => statusMutation.mutate({ id: selected.id, status: e.target.value })}
                        disabled={statusMutation.isPending}
                      >
                        {LEAD_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {canAssign && selected.status !== "CONVERTED" ? (
                    <div className="mb-3">
                      <label className="form-label small mb-1">Assign owner</label>
                      <div className="d-flex gap-2">
                        <select
                          className="form-select form-select-sm"
                          value={assignOwnerId}
                          onChange={(e) => setAssignOwnerId(e.target.value)}
                        >
                          <option value="">Select owner</option>
                          {(usersQuery.data ?? []).map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm text-nowrap"
                          disabled={!assignOwnerId || assignMutation.isPending}
                          onClick={() => assignMutation.mutate({ id: selected.id, ownerId: assignOwnerId })}
                        >
                          Assign
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {showConvert && canConvert && selected.status !== "CONVERTED" ? (
                    <form
                      className="border rounded p-3 mb-3 bg-light"
                      onSubmit={convertForm.handleSubmit((values) => {
                        if (!values.createAccount && !values.accountId) {
                          setConvertError("Select an existing account or enable Create account.");
                          return;
                        }
                        convertMutation.mutate({
                          id: selected.id,
                          body: {
                            createAccount: values.createAccount,
                            createContact: values.createContact,
                            createDeal: values.createDeal,
                            accountId: values.createAccount ? undefined : values.accountId || undefined,
                            dealName: values.dealName || undefined,
                            dealValue: values.dealValue ? Number(values.dealValue) : undefined,
                            dealStage: values.dealStage || undefined,
                          },
                        });
                      })}
                    >
                      {convertError ? <div className="alert alert-danger py-2">{convertError}</div> : null}
                      <div className="form-check mb-2">
                        <input className="form-check-input" type="checkbox" id="createAccount" {...convertForm.register("createAccount")} />
                        <label className="form-check-label" htmlFor="createAccount">Create account</label>
                      </div>
                      {!createAccountChecked ? (
                        <div className="mb-2">
                          <label className="form-label small">Existing account</label>
                          <TechEarnestFormSelect
                            control={convertForm.control}
                            name="accountId"
                            options={(accountsQuery.data ?? []).map((account) => ({ value: account.id, label: account.name, subtitle: account.email ?? undefined }))}
                            searchPlaceholder="Search accounts"
                            placeholder="Select existing account"
                            lookupMode="modal"
                            lookupTitle="Select Account"
                            lookupIcon="building"
                          />
                        </div>
                      ) : null}
                      <div className="form-check mb-2">
                        <input className="form-check-input" type="checkbox" id="createContact" {...convertForm.register("createContact")} />
                        <label className="form-check-label" htmlFor="createContact">Create contact</label>
                      </div>
                      <div className="form-check mb-3">
                        <input className="form-check-input" type="checkbox" id="createDeal" {...convertForm.register("createDeal")} />
                        <label className="form-check-label" htmlFor="createDeal">Create deal</label>
                      </div>
                      <FormField label="Deal name" {...convertForm.register("dealName")} />
                      <FormField label="Deal value" type="number" {...convertForm.register("dealValue")} />
                      <label className="form-label">Deal stage</label>
                      <select className="form-select mb-3" {...convertForm.register("dealStage")}>
                        <option value="NEW">NEW</option>
                        <option value="QUALIFICATION">QUALIFICATION</option>
                        <option value="PROPOSAL">PROPOSAL</option>
                      </select>
                      <button type="submit" className="btn btn-success btn-sm" disabled={convertMutation.isPending}>
                        Confirm convert
                      </button>
                    </form>
                  ) : null}

                  {selected.convertedAccountId || selected.convertedContactId || selected.convertedDealId ? (
                    <TechEarnestRecordRelatedCard id="techearnest-record-section-converted" title="Converted Records">
                      <ul className="related-record-list">
                        {selected.convertedAccountId ? (
                          <li>
                            <span className="related-record-secondary">Account</span>
                            <RecordLink module="account" id={selected.convertedAccountId}>
                              {accountsQuery.data?.find((a) => a.id === selected.convertedAccountId)?.name ?? "Open account"}
                            </RecordLink>
                          </li>
                        ) : null}
                        {selected.convertedContactId ? (
                          <li>
                            <span className="related-record-secondary">Contact</span>
                            <RecordLink module="contact" id={selected.convertedContactId}>
                              {convertedContactQuery.data
                                ? `${convertedContactQuery.data.firstName} ${convertedContactQuery.data.lastName}`.trim()
                                : "Open contact"}
                            </RecordLink>
                          </li>
                        ) : null}
                        {selected.convertedDealId ? (
                          <li>
                            <span className="related-record-secondary">Deal</span>
                            <RecordLink module="deal" id={selected.convertedDealId}>
                              {convertedDealQuery.data?.name ?? "Open deal"}
                            </RecordLink>
                          </li>
                        ) : null}
                      </ul>
                      {selected.convertedAt ? (
                        <div className="small text-muted mt-2">
                          Converted {new Date(selected.convertedAt).toLocaleString()}
                        </div>
                      ) : null}
                    </TechEarnestRecordRelatedCard>
                  ) : null}

                  <TechEarnestRecordRelatedCard
                    id="techearnest-record-section-notes"
                    title="Notes"
                    isEmpty={!(notesQuery.data ?? []).length && !canCreateNotes}
                    emptyLabel="No notes yet"
                    actions={
                      canCreateNotes ? (
                        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={!noteBody.trim() || noteMutation.isPending} onClick={() => noteMutation.mutate()}>
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
                        onChange={(e) => setNoteBody(e.target.value)}
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
                              <button type="button" className="btn btn-link btn-sm p-0" onClick={() => deleteNoteMutation.mutate(note.id)}>
                                Delete
                              </button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </TechEarnestRecordRelatedCard>

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
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  uploadMutation.mutate(file);
                                  e.target.value = "";
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
                            <button type="button" className="btn btn-link btn-sm p-0 text-start" onClick={() => openDownload(doc.id)}>
                              {doc.fileName}
                            </button>
                            {canDeleteDocs ? (
                              <button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={() => deleteDocMutation.mutate(doc.id)}>
                                Delete
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </TechEarnestRecordRelatedCard>
                  ) : null}

                  <TechEarnestRecordRelatedCard id="techearnest-record-section-emails" title="Emails" isEmpty emptyLabel="No records found" />
                  <TechEarnestRecordRelatedCard
                    id="techearnest-record-section-open-activities"
                    title="Open Activities"
                    isEmpty={!openActivities.length && !activitiesQuery.isLoading}
                    emptyLabel="No records found"
                  >
                    <RelatedRecordList
                      module="activity"
                      loading={activitiesQuery.isLoading}
                      items={openActivities.map((activity) => ({
                        id: activity.id,
                        label: activity.subject,
                        secondary: activity.dueDate ? new Date(activity.dueDate).toLocaleDateString() : undefined,
                        trailing: <StatusBadge status={activity.status} />,
                      }))}
                    />
                  </TechEarnestRecordRelatedCard>
                  <TechEarnestRecordRelatedCard
                    id="techearnest-record-section-closed-activities"
                    title="Closed Activities"
                    isEmpty={!closedActivities.length && !activitiesQuery.isLoading}
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
                  <TechEarnestRecordRelatedCard id="techearnest-record-section-meetings" title="Invited Meetings" isEmpty emptyLabel="No records found" />
                  <TechEarnestRecordRelatedCard id="techearnest-record-section-campaigns" title="Campaigns" isEmpty emptyLabel="No records found" />
                  <TechEarnestRecordRelatedCard id="techearnest-record-section-social" title="Social" isEmpty emptyLabel="No records found" />
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
        title="Leads"
        filterOpen={filterOpen}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        viewSelector={
          <select
            className="form-select form-select-sm module-view-select"
            value={activeViewId}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) {
                setActiveViewId("");
                setStatusFilter("");
                setSourceFilter("");
                setPriorityFilter("");
                setRegionFilter("");
                return;
              }
              applySavedView(id);
            }}
            aria-label="Lead views"
          >
            <option value="">All Leads</option>
            {(viewsQuery.data ?? []).map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
        }
        sort={{
          fields: LEAD_SORT_FIELDS,
          value: sortBy === DEFAULT_LEAD_SORT.field && sortDir === DEFAULT_LEAD_SORT.dir
            ? null
            : { field: sortBy, direction: sortDir === "ASC" ? "asc" : "desc" },
          onChange: (value) => {
            setSortBy(value?.field ?? DEFAULT_LEAD_SORT.field);
            setSortDir(value ? (value.direction === "asc" ? "ASC" : "DESC") : DEFAULT_LEAD_SORT.dir);
          },
        }}
        filterToggle={{ onToggle: () => setFilterOpen((open) => !open) }}
        activeFilterCount={activeFilterCount}
        createMenuItems={createMenuItems}
        moreMenuItems={moreMenuItems}
        primaryAction={
          canCreate ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreateLead}>
              Create Lead
            </button>
          ) : null
        }
        filterPanel={
          <>
            <p className="module-filter-heading">Filter Leads by</p>
            <div className="module-filter-section">
              <h3>Search</h3>
              <input
                className="form-control form-control-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, company, email"
              />
            </div>
            <div className="module-filter-section">
              <h3>Filter by fields</h3>
              <TechEarnestFilterSelect
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={LEAD_STATUS_FILTER_OPTIONS}
                searchPlaceholder="Search Status"
              />
              <ModuleFilterField label="Lead source" htmlFor="leadSourceFilter">
                <input
                  id="leadSourceFilter"
                  className="form-control form-control-sm"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  placeholder="e.g. Cold Call"
                />
              </ModuleFilterField>
              <TechEarnestFilterSelect
                label="Priority"
                value={priorityFilter}
                onChange={setPriorityFilter}
                options={PRIORITY_FILTER_OPTIONS}
                searchPlaceholder="Search Priority"
              />
              <TechEarnestFilterSelect
                label="Region"
                value={regionFilter}
                onChange={setRegionFilter}
                options={regionFilterOptions}
                searchPlaceholder="Search Regions"
              />
              <TechEarnestFilterSelect
                label="Owner"
                value={ownerFilter}
                onChange={setOwnerFilter}
                options={ownerFilterOptions}
                searchPlaceholder="Search Owners"
              />
              <ModuleFilterField label="Min est. value" htmlFor="leadMinValueFilter">
                <input
                  id="leadMinValueFilter"
                  type="number"
                  className="form-control form-control-sm"
                  value={minValueFilter}
                  onChange={(e) => setMinValueFilter(e.target.value)}
                  placeholder="e.g. 10000"
                />
              </ModuleFilterField>
              <ModuleFilterDateRange
                label="Created"
                from={createdFrom}
                to={createdTo}
                onFromChange={setCreatedFrom}
                onToChange={setCreatedTo}
              />
              <ModuleFilterCheckbox
                id="unconvertedOnly"
                label="Unconverted only"
                checked={unconvertedOnly}
                onChange={setUnconvertedOnly}
              />
            </div>
            {canManageViews ? (
              <div className="module-filter-section is-collapsed">
                <h3>Save view</h3>
                <input
                  className="form-control form-control-sm mb-2"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder={`Name for “${activeViewName}” filters`}
                />
                {canPublishViews ? (
                  <>
                    <label className="form-label small mb-1">Visibility</label>
                    <select
                      className="form-select form-select-sm mb-2"
                      value={viewVisibility}
                      onChange={(e) => setViewVisibility(e.target.value as "PRIVATE" | "SHARED" | "PUBLIC")}
                    >
                      <option value="PRIVATE">Private (only me)</option>
                      <option value="SHARED">Shared (org users)</option>
                      <option value="PUBLIC">Public (org default)</option>
                    </select>
                  </>
                ) : null}
                <div className="d-flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    disabled={!viewName.trim() || saveViewMutation.isPending}
                    onClick={() => saveViewMutation.mutate()}
                  >
                    Save
                  </button>
                  {activeViewId ? (
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      disabled={deleteViewMutation.isPending}
                      onClick={() => deleteViewMutation.mutate(activeViewId)}
                    >
                      Delete view
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        }
        onClearFilters={clearAllFilters}
        footerLeft={<span>Total Records: {leads.length}</span>}
        footerRight={<span>View: {activeViewName}</span>}
      >
        {bulkMessage ? <div className="alert alert-info py-2 mx-3 mt-3 mb-0">{bulkMessage}</div> : null}

        {leadsQuery.isLoading ? <LoadingState label="Loading leads..." /> : null}
        {!leadsQuery.isLoading && leadsQuery.error ? (
          <ErrorState title="Unable to load leads" message="Check your connection and try again." />
        ) : null}

        {!leadsQuery.isLoading && !leadsQuery.error && !leads.length ? (
          <div className="module-list-empty">
            {activeFilterCount || activeViewId ? (
              <EmptyState
                workspace
                title="No leads match this view"
                description="Try changing or clearing the filters to see more leads."
                action={
                  <button type="button" className="btn btn-outline-primary btn-sm" onClick={clearAllFilters}>
                    Clear filters
                  </button>
                }
              />
            ) : (
              <EmptyState
                workspace
                title="No leads yet"
                description={
                  canImport
                    ? "Create your first lead, or bulk upload many at once from an Excel or CSV file."
                    : "Leads you create or are assigned will appear here."
                }
                action={
                  canCreate || canImport ? (
                    <div className="module-list-empty-actions">
                      {canCreate ? (
                        <button type="button" className="btn btn-primary btn-sm" onClick={openCreateLead}>
                          <ToolbarIcon name="plus" className="module-toolbar-icon" />
                          Create Lead
                        </button>
                      ) : null}
                      {canImport ? (
                        <button type="button" className="btn btn-outline-primary btn-sm" onClick={bulkImport.openDialog}>
                          <ToolbarIcon name="upload" className="module-toolbar-icon" />
                          Bulk upload
                        </button>
                      ) : null}
                    </div>
                  ) : null
                }
              />
            )}
          </div>
        ) : null}

        {!leadsQuery.isLoading && !leadsQuery.error && leads.length ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {viewMode === "tile" ? (
              <div className="module-tile-grid">
                {leads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    className={`module-tile text-start${(selected as Lead | null)?.id === lead.id ? " is-selected" : ""}`}
                    onClick={() => {
                      setSelected(lead);
                      setShowConvert(false);
                      setAssignOwnerId(lead.ownerId ?? "");
                    }}
                  >
                    <div className="tile-title">
                      {lead.firstName} {lead.lastName}
                    </div>
                    <div className="small text-muted">
                      {lead.companyName ?? "—"} · {lead.source ?? "No source"}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
            <ModuleListTable
                tableCode="lead"
                defaultColumns={defaultLeadColumns}
                rows={leads}
                rowKey={(lead) => lead.id}
                renderCell={leadCellValue}
                onRowClick={(lead) => {
                  setSelected(lead);
                  setShowConvert(false);
                  setConvertError(null);
                  setActionError(null);
                  setAssignOwnerId(lead.ownerId ?? "");
                }}
                selectedRowKey={(selected as Lead | null)?.id}
                selectedIds={checkedIds}
                onSelectedIdsChange={setCheckedIds}
                bulk={{
                  noun: "leads",
                  exportFileName: "leads",
                  rowLabel: leadDisplayName,
                  onComplete: () => void refresh(),
                  actions: [
                    {
                      id: "assign-owner",
                      label: "Assign owner",
                      visible: canAssign,
                      doneLabel: "reassigned",
                      input: { kind: "select", label: "New owner", options: bulkOwnerOptions },
                      runBatch: (leadIds, ownerId) => postServerBulk("/leads/bulk-assign", { leadIds, ownerId }),
                    },
                    {
                      id: "change-status",
                      label: "Change status",
                      visible: canUpdate,
                      doneLabel: "updated",
                      applies: (lead) => lead.status !== "CONVERTED",
                      input: { kind: "select", label: "New status", options: enumOptions(LEAD_STATUSES) },
                      runBatch: (leadIds, status) => postServerBulk("/leads/bulk-status", { leadIds, status }),
                    },
                    {
                      id: "delete",
                      label: "Delete",
                      tone: "danger",
                      visible: canDelete,
                      doneLabel: "deleted",
                      confirm: "Deleted leads disappear from lists and reports.",
                      run: (lead) => deleteLead(lead.id),
                    },
                  ],
                }}
                nameFields={["firstName", "lastName"]}
                emptyMessage="No leads match the current view/filters."
                trailingColumn={canDelete ? {
                  header: <span className="visually-hidden">Actions</span>,
                  stopPropagation: true,
                  render: (lead) => (
                    <ModuleMenuDropdown
                      items={[{ id: "delete", label: "Delete lead", icon: "trash", danger: true, onClick: () => { setDeleteError(null); setLeadToDelete(lead); } }]}
                      align="end"
                      ariaLabel={`Actions for ${leadDisplayName(lead)}`}
                      triggerClassName="module-more-btn"
                      trigger={<ToolbarIcon name="more" className="module-toolbar-icon" />}
                    />
                  ),
                } : undefined}
            />
            )}
          </div>
        ) : null}
      </ModuleListShell>
      )}

      {bulkImport.dialog}

      {leadToDelete ? (
        <div className="module-modal-backdrop" role="presentation" onClick={() => deleteMutation.isPending ? null : setLeadToDelete(null)}>
          <div className="module-modal" role="dialog" aria-modal="true" aria-labelledby="delete-lead-title" onClick={(event) => event.stopPropagation()}>
            <div className="module-modal-header">
              <h2 id="delete-lead-title" className="h5 mb-0">Delete lead?</h2>
              <button type="button" className="btn-close" aria-label="Close" disabled={deleteMutation.isPending} onClick={() => setLeadToDelete(null)} />
            </div>
            <div className="module-modal-body">
              <p className="mb-0">This will move <strong>{leadDisplayName(leadToDelete)}</strong> to deleted records.</p>
              {deleteError ? <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">{deleteError}</div> : null}
            </div>
            <div className="module-modal-footer">
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={deleteMutation.isPending} onClick={() => setLeadToDelete(null)}>Cancel</button>
              <button type="button" className="btn btn-danger btn-sm" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(leadToDelete.id)}>
                {deleteMutation.isPending ? "Deleting…" : "Delete lead"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </>
  );
}
