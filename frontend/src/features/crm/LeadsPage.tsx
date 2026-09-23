import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { DynamicForm, FormActions, UnsavedGuard } from "@/components/FormKit";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { RecordShell } from "@/components/RecordShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { ACCESS_TOKEN_KEY } from "@/api/client";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listAuditLogs, listRegions, listUsers } from "@/features/admin/adminApi";
import { getPublishedFormBundle, getPublishedListLayout, getUserListPref, saveUserListPref, type ListLayoutColumn } from "@/features/admin/studio/metadataApi";
import {
  assignLead,
  bulkAssignLeads,
  bulkStatusLeads,
  checkLeadDuplicates,
  convertLead,
  createLead,
  exportLeads,
  listAccounts,
  listActivities,
  listLeads,
  queryLeads,
  updateLead,
  type DuplicateCheckResult,
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

const leadSchema = z.object({
  regionId: z.string().min(1, "Region is required"),
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  companyName: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  status: z.string().min(1),
  phone: z.string().optional(),
  source: z.string().optional(),
  priority: z.string().optional(),
  estimatedValue: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  designation: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  description: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadSchema>;

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

export function LeadsPage() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const canCreate = useHasPermission("LEAD_CREATE");
  const canConvert = useHasPermission("LEAD_CONVERT");
  const canAssign = useHasPermission("LEAD_ASSIGN");
  const canUpdate = useHasPermission("LEAD_UPDATE");
  const canExport = useHasPermission("LEAD_EXPORT");
  const canViewUsers = useHasPermission("USER_VIEW");
  const canViewDocs = useHasPermission("DOCUMENT_VIEW");
  const canUploadDocs = useHasPermission("DOCUMENT_UPLOAD");
  const canDeleteDocs = useHasPermission("DOCUMENT_DELETE");
  const canViewNotes = useHasPermission("NOTE_VIEW");
  const canCreateNotes = useHasPermission("NOTE_CREATE");
  const canDeleteNotes = useHasPermission("NOTE_DELETE");
  const canManageViews = useHasPermission("SAVED_VIEW_MANAGE");
  const canViewAudit = useHasPermission("AUDIT_VIEW");
  const canViewActivities = useHasPermission("ACTIVITY_VIEW");
  const [showForm, setShowForm] = useState(false);
  const [showMoreLeadFields, setShowMoreLeadFields] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [showConvert, setShowConvert] = useState(false);
  const [assignOwnerId, setAssignOwnerId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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
  const [activeViewId, setActiveViewId] = useState("");
  const [filterOpen, setFilterOpen] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "tile">("list");
  const [columnChooserOpen, setColumnChooserOpen] = useState(false);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [bulkOwnerId, setBulkOwnerId] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [dupWarning, setDupWarning] = useState<DuplicateCheckResult | null>(null);
  const [pendingCreate, setPendingCreate] = useState<Parameters<typeof createLead>[0] | null>(null);

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
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const leadFormBundleQuery = useQuery({
    queryKey: ["metadata", "runtime", "lead", "form-bundle", "CREATE"],
    queryFn: () => getPublishedFormBundle("lead", "CREATE"),
    enabled: showForm,
    staleTime: 60_000,
  });
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
    enabled: canAssign || canViewUsers,
  });
  const accountsQuery = useQuery({
    queryKey: ["crm", "accounts"],
    queryFn: () => listAccounts(),
    enabled: showConvert,
  });
  const viewsQuery = useQuery({
    queryKey: ["crm", "saved-views", "LEAD"],
    queryFn: () => listSavedViews("LEAD"),
    enabled: canManageViews,
  });
  const notesQuery = useQuery({
    queryKey: ["crm", "notes", "LEAD", selected?.id],
    queryFn: () => listNotes("LEAD", selected!.id),
    enabled: !!selected && canViewNotes,
  });
  const docsQuery = useQuery({
    queryKey: ["crm", "documents", "LEAD", selected?.id],
    queryFn: () => listDocuments("LEAD", selected!.id),
    enabled: !!selected && canViewDocs,
  });
  const activitiesQuery = useQuery({
    queryKey: ["crm", "activities", "LEAD", selected?.id],
    queryFn: () => listActivities({ relatedEntityType: "LEAD", relatedEntityId: selected!.id }),
    enabled: !!selected && canViewActivities,
  });
  const auditQuery = useQuery({
    queryKey: ["admin", "audit-logs", "LEAD", selected?.id],
    queryFn: () => listAuditLogs({ entityType: "LEAD", entityId: selected!.id, size: 50 }),
    enabled: !!selected && canViewAudit,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      regionId: "",
      firstName: "",
      lastName: "",
      companyName: "",
      email: "",
      phone: "",
      source: "",
      status: "NEW",
      priority: "MEDIUM",
      estimatedValue: "",
      website: "",
      industry: "",
      designation: "",
      expectedCloseDate: "",
      description: "",
    },
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

  const createMutation = useMutation({
    mutationFn: createLead,
    onSuccess: async () => {
      await refresh();
      reset();
      setShowForm(false);
      setFormError(null);
      setDupWarning(null);
      setPendingCreate(null);
    },
    onError: () => setFormError("Could not create lead. Check required fields and region."),
  });

  const bulkAssignMutation = useMutation({
    mutationFn: () => bulkAssignLeads(checkedIds, bulkOwnerId),
    onSuccess: async (result) => {
      await refresh();
      setBulkMessage(`Assigned ${result.succeeded}; failed ${result.failed}.`);
      setCheckedIds([]);
    },
    onError: () => setBulkMessage("Bulk assign failed."),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: () => bulkStatusLeads(checkedIds, bulkStatus),
    onSuccess: async (result) => {
      await refresh();
      setBulkMessage(`Updated status for ${result.succeeded}; failed ${result.failed}.`);
      setCheckedIds([]);
    },
    onError: () => setBulkMessage("Bulk status update failed."),
  });

  async function submitLeadCreate(values: z.infer<typeof leadSchema>, force = false) {
    const body = {
      regionId: values.regionId,
      firstName: values.firstName,
      lastName: values.lastName,
      companyName: values.companyName,
      email: values.email || undefined,
      phone: values.phone || undefined,
      source: values.source || undefined,
      status: values.status || "NEW",
      priority: values.priority || undefined,
      estimatedValue: values.estimatedValue ? Number(values.estimatedValue) : undefined,
      website: values.website || undefined,
      industry: values.industry || undefined,
      designation: values.designation || undefined,
      expectedCloseDate: values.expectedCloseDate || undefined,
      description: values.description || undefined,
    };
    if (!force) {
      try {
        const dup = await checkLeadDuplicates({
          email: body.email,
          companyName: body.companyName,
        });
        if (dup.hasDuplicates) {
          setDupWarning(dup);
          setPendingCreate(body);
          return;
        }
      } catch {
        // soft warn path — allow create if check fails
      }
    }
    createMutation.mutate(body);
  }

  const convertMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof convertLead>[1] }) =>
      convertLead(id, body),
    onSuccess: async () => {
      await refresh();
      setShowConvert(false);
      setSelected(null);
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

  const exportMutation = useMutation({
    mutationFn: (cols: string[]) => exportLeads(cols),
    onError: () => setExportError("Export failed."),
    onSuccess: () => setExportError(null),
  });

  const saveColumnsMutation = useMutation({
    mutationFn: (columns: ListLayoutColumn[]) => saveUserListPref("lead", columns),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["metadata", "list-prefs", "lead"] });
      setColumnChooserOpen(false);
    },
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
        visibility: "PRIVATE",
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
      await queryClient.invalidateQueries({ queryKey: ["crm", "notes", "LEAD", selected?.id] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "notes", "LEAD", selected?.id] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument("LEAD", selected!.id, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "documents", "LEAD", selected?.id] });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "documents", "LEAD", selected?.id] });
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

  return (
    <>
      {exportError ? <div className="alert alert-danger py-2">{exportError}</div> : null}

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
        toolbarActions={
          <>
            <button
              type="button"
              className={`btn btn-sm ${filterOpen ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setFilterOpen((open) => !open)}
            >
              Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </button>
            <select
              className="form-select form-select-sm"
              style={{ width: "auto" }}
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split(":");
                setSortBy(field);
                setSortDir(dir);
              }}
              aria-label="Sort leads"
            >
              <option value="createdAt:DESC">Sort: Newest</option>
              <option value="createdAt:ASC">Sort: Oldest</option>
              <option value="companyName:ASC">Sort: Company</option>
              <option value="estimatedValue:DESC">Sort: Value</option>
              <option value="status:ASC">Sort: Status</option>
            </select>
            {canExport ? (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={exportMutation.isPending}
                onClick={() => exportMutation.mutate(visibleColumns.map((c) => c.field))}
              >
                Export
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setColumnChooserOpen((v) => !v)}
            >
              Columns
            </button>
            {checkedIds.length > 0 ? (
              <span className="small text-muted align-self-center">{checkedIds.length} selected</span>
            ) : null}
            {canAssign && checkedIds.length > 0 ? (
              <>
                <select
                  className="form-select form-select-sm"
                  style={{ width: "auto" }}
                  value={bulkOwnerId}
                  onChange={(e) => setBulkOwnerId(e.target.value)}
                >
                  <option value="">Bulk owner…</option>
                  {(usersQuery.data ?? []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  disabled={!bulkOwnerId || bulkAssignMutation.isPending}
                  onClick={() => bulkAssignMutation.mutate()}
                >
                  Bulk assign
                </button>
              </>
            ) : null}
            {canUpdate && checkedIds.length > 0 ? (
              <>
                <select
                  className="form-select form-select-sm"
                  style={{ width: "auto" }}
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                >
                  <option value="">Bulk status…</option>
                  {LEAD_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  disabled={!bulkStatus || bulkStatusMutation.isPending}
                  onClick={() => bulkStatusMutation.mutate()}
                >
                  Bulk status
                </button>
              </>
            ) : null}
          </>
        }
        primaryAction={
          canCreate ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "Create Lead"}
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
              <label className="form-label small mb-1">Status</label>
              <select
                className="form-select form-select-sm mb-2"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                {LEAD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
                <option value="CONVERTED">CONVERTED</option>
              </select>
              <label className="form-label small mb-1">Lead source</label>
              <input
                className="form-control form-control-sm mb-2"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                placeholder="e.g. Cold Call"
              />
              <label className="form-label small mb-1">Priority</label>
              <select
                className="form-select form-select-sm mb-2"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
              <label className="form-label small mb-1">Region</label>
              <select
                className="form-select form-select-sm mb-2"
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
              >
                <option value="">All</option>
                {(regionsQuery.data ?? []).map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
              <label className="form-label small mb-1">Owner</label>
              <select
                className="form-select form-select-sm mb-2"
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
              >
                <option value="">All</option>
                {auth.userId ? <option value={auth.userId}>Current user</option> : null}
                {(usersQuery.data ?? []).map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
              </select>
              <label className="form-label small mb-1">Min est. value</label>
              <input
                type="number"
                className="form-control form-control-sm mb-2"
                value={minValueFilter}
                onChange={(e) => setMinValueFilter(e.target.value)}
                placeholder="e.g. 10000"
              />
              <label className="form-label small mb-1">Created from</label>
              <input
                type="date"
                className="form-control form-control-sm mb-2"
                value={createdFrom}
                onChange={(e) => setCreatedFrom(e.target.value)}
              />
              <label className="form-label small mb-1">Created to</label>
              <input
                type="date"
                className="form-control form-control-sm mb-2"
                value={createdTo}
                onChange={(e) => setCreatedTo(e.target.value)}
              />
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="unconvertedOnly"
                  checked={unconvertedOnly}
                  onChange={(e) => setUnconvertedOnly(e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="unconvertedOnly">
                  Unconverted only
                </label>
              </div>
            </div>
            {canManageViews ? (
              <div className="module-filter-section">
                <h3>Save view</h3>
                <input
                  className="form-control form-control-sm mb-2"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder={`Name for “${activeViewName}” filters`}
                />
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
            <button
              type="button"
              className="btn btn-link btn-sm px-0"
              onClick={() => {
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
              }}
            >
              Clear filters
            </button>
          </>
        }
        footerLeft={<span>Total Records: {leads.length}</span>}
        footerRight={<span>View: {activeViewName}</span>}
      >
        {showForm ? (
          <form
            className="border-bottom p-3 bg-white"
            onSubmit={handleSubmit((values) => void submitLeadCreate(values))}
          >
            {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
            {bulkMessage ? <div className="alert alert-info py-2">{bulkMessage}</div> : null}
            {dupWarning?.hasDuplicates ? (
              <div className="alert alert-warning py-2">
                <div className="fw-semibold mb-1">Possible duplicates found</div>
                <ul className="mb-2 small">
                  {dupWarning.matches.slice(0, 5).map((m) => (
                    <li key={m.id}>
                      {m.firstName} {m.lastName} · {m.companyName ?? "—"} · {m.email ?? "—"} ({m.status})
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn btn-sm btn-warning me-2"
                  onClick={() => {
                    if (pendingCreate) createMutation.mutate(pendingCreate);
                  }}
                >
                  Create anyway
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    setDupWarning(null);
                    setPendingCreate(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : null}
            <UnsavedGuard when={isDirty && showForm} />
            {leadFormBundleQuery.isLoading ? <LoadingState label="Loading form layout..." /> : null}
            {leadFormBundleQuery.error ? (
              <ErrorState title="Form layout unavailable" message="Published Lead CREATE layout is required." />
            ) : null}
            {leadFormBundleQuery.data ? (
              <DynamicForm
                layout={leadFormBundleQuery.data.layout.layout}
                fields={leadFormBundleQuery.data.fields}
                register={register}
                errors={errors}
                moreOpen={showMoreLeadFields}
                onMoreToggle={() => setShowMoreLeadFields((v) => !v)}
                fieldConfig={{
                  regionId: {
                    options: (regionsQuery.data ?? []).map((region) => ({
                      value: region.id,
                      label: region.name,
                    })),
                    colClass: "col-md-3",
                  },
                  status: {
                    options: LEAD_STATUSES.map((status) => ({ value: status, label: status })),
                    colClass: "col-md-4",
                  },
                  priority: {
                    options: [
                      { value: "LOW", label: "LOW" },
                      { value: "MEDIUM", label: "MEDIUM" },
                      { value: "HIGH", label: "HIGH" },
                    ],
                  },
                  email: { typeOverride: "email", colClass: "col-md-4" },
                  firstName: { colClass: "col-md-3" },
                  lastName: { colClass: "col-md-3" },
                  companyName: { colClass: "col-md-3" },
                }}
              />
            ) : null}

            <FormActions
              submitting={isSubmitting || createMutation.isPending}
              onCancel={() => {
                if (isDirty && !window.confirm("Discard unsaved changes?")) return;
                setShowForm(false);
                setShowMoreLeadFields(false);
              }}
            />
          </form>
        ) : null}

        {leadsQuery.isLoading ? <LoadingState label="Loading leads..." /> : null}
        {!leadsQuery.isLoading && leadsQuery.error ? (
          <ErrorState title="Unable to load leads" message="Check your connection and try again." />
        ) : null}

        {!leadsQuery.isLoading && !leadsQuery.error ? (
          <div className={selected ? "module-list-split" : undefined} style={selected ? undefined : { flex: 1, display: "flex", flexDirection: "column" }}>
            {viewMode === "tile" ? (
              <div className="module-tile-grid">
                {leads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    className={`module-tile text-start${selected?.id === lead.id ? " is-selected" : ""}`}
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
            <div className="module-list-table-wrap">
              {columnChooserOpen ? (
                <div className="border rounded p-2 mb-2 bg-light">
                  <div className="small text-muted mb-2">Personal columns (overrides admin default)</div>
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    {publishedColumns.map((col) => {
                      const checked = visibleColumns.some((c) => c.field === col.field);
                      return (
                        <label key={col.field} className="form-check form-check-inline small mb-0">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? visibleColumns.filter((c) => c.field !== col.field)
                                : [...visibleColumns, col];
                              saveColumnsMutation.mutate(next.length ? next : publishedColumns);
                            }}
                          />
                          {col.label}
                        </label>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="btn btn-link btn-sm px-0"
                    onClick={() => saveColumnsMutation.mutate(publishedColumns)}
                  >
                    Reset to admin default
                  </button>
                </div>
              ) : null}
              <table className="table module-list-table align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        aria-label="Select all leads"
                        checked={leads.length > 0 && checkedIds.length === leads.length}
                        onChange={(e) => {
                          setCheckedIds(e.target.checked ? leads.map((l) => l.id) : []);
                        }}
                      />
                    </th>
                    {visibleColumns.map((col) => (
                      <th key={col.field}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className={selected?.id === lead.id ? "is-selected" : undefined}
                      onClick={() => {
                        setSelected(lead);
                        setShowConvert(false);
                        setConvertError(null);
                        setActionError(null);
                        setAssignOwnerId(lead.ownerId ?? "");
                      }}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={checkedIds.includes(lead.id)}
                          onChange={(e) => {
                            setCheckedIds((prev) =>
                              e.target.checked ? [...prev, lead.id] : prev.filter((id) => id !== lead.id),
                            );
                          }}
                        />
                      </td>
                      {visibleColumns.map((col) => (
                        <td key={col.field} className={col.field === "firstName" || col.field === "lastName" ? "lead-name" : undefined}>
                          {leadCellValue(lead, col.field)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!leads.length ? (
                    <tr>
                      <td colSpan={Math.max(visibleColumns.length + 1, 2)} className="text-muted text-center py-5">
                        No leads match the current view/filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            )}

            {selected ? (
              <RecordShell
                title={`${selected.firstName} ${selected.lastName}`}
                subtitle={selected.companyName ?? undefined}
                badges={<StatusBadge status={selected.status} />}
                onClose={() => {
                  setSelected(null);
                  setShowConvert(false);
                }}
                tabs={[
                  {
                    id: "overview",
                    label: "Overview",
                    content: (
                      <>
<p className="small mb-1">Email: {selected.email ?? "—"}</p>
                <p className="small mb-1">Phone: {selected.phone ?? "—"}</p>
                <p className="small mb-3">
                  Est. value: {selected.estimatedValue != null ? selected.estimatedValue : "—"}
                </p>

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

                {canConvert && selected.status !== "CONVERTED" ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm mb-2"
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

                    {showConvert ? (
                      <form
                        className="border-top pt-3 mt-2"
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
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="createAccount"
                            {...convertForm.register("createAccount")}
                          />
                          <label className="form-check-label" htmlFor="createAccount">
                            Create account
                          </label>
                        </div>
                        {!createAccountChecked ? (
                          <div className="mb-2">
                            <label className="form-label small">Existing account</label>
                            <select className="form-select form-select-sm" {...convertForm.register("accountId")}>
                              <option value="">Select account</option>
                              {(accountsQuery.data ?? []).map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="createContact"
                            {...convertForm.register("createContact")}
                          />
                          <label className="form-check-label" htmlFor="createContact">
                            Create contact
                          </label>
                        </div>
                        <div className="form-check mb-3">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="createDeal"
                            {...convertForm.register("createDeal")}
                          />
                          <label className="form-check-label" htmlFor="createDeal">
                            Create deal
                          </label>
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
                  </>
                ) : null}

                {selected.status === "CONVERTED" ? (
                  <p className="small text-muted mb-0">
                    Converted — account {selected.convertedAccountId?.slice(0, 8) ?? "—"}, deal{" "}
                    {selected.convertedDealId?.slice(0, 8) ?? "—"}
                  </p>
                ) : null}

                {canViewNotes ? (
                  <div className="border-top pt-3 mt-3">
                    <div className="fw-semibold small mb-2">Notes</div>
                    {canCreateNotes ? (
                      <div className="mb-2">
                        <textarea
                          className="form-control form-control-sm mb-2"
                          rows={2}
                          value={noteBody}
                          onChange={(e) => setNoteBody(e.target.value)}
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
                      {!notesQuery.data?.length ? <li className="text-muted">No notes yet.</li> : null}
                    </ul>
                  </div>
                ) : null}

                {canViewDocs ? (
                  <div className="border-top pt-3 mt-3">
                    <div className="fw-semibold small mb-2">Documents</div>
                    {canUploadDocs ? (
                      <input
                        type="file"
                        className="form-control form-control-sm mb-2"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            uploadMutation.mutate(file);
                            e.target.value = "";
                          }
                        }}
                      />
                    ) : null}
                    <ul className="list-unstyled small mb-0">
                      {(docsQuery.data ?? []).map((doc) => (
                        <li key={doc.id} className="mb-2 d-flex justify-content-between gap-2">
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 text-start"
                            onClick={() => openDownload(doc.id)}
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
                      {!docsQuery.data?.length ? <li className="text-muted">No documents yet.</li> : null}
                    </ul>
                  </div>
                ) : null}
                      </>
                    ),
                  },
                  {
                    id: "related",
                    label: "Related",
                    content: (
                      <p className="small text-muted mb-0">
                        {selected.status === "CONVERTED"
                          ? `Linked account ${selected.convertedAccountId?.slice(0, 8) ?? "—"} · deal ${selected.convertedDealId?.slice(0, 8) ?? "—"}`
                          : "Convert this lead to link account, contact, and deal."}
                      </p>
                    ),
                  },
                  {
                    id: "activities",
                    label: "Activities",
                    visible: canViewActivities,
                    content: (
                      <ul className="list-unstyled small mb-0">
                        {(activitiesQuery.data ?? []).map((a) => (
                          <li key={a.id} className="mb-2">
                            {a.subject} — <StatusBadge status={a.status} />
                          </li>
                        ))}
                        {!activitiesQuery.data?.length ? <li className="text-muted">No related activities.</li> : null}
                      </ul>
                    ),
                  },
                  {
                    id: "notes",
                    label: "Notes",
                    visible: canViewNotes,
                    content: <p className="small text-muted mb-0">Use Overview tab for notes on this lead.</p>,
                  },
                  {
                    id: "documents",
                    label: "Documents",
                    visible: canViewDocs,
                    content: <p className="small text-muted mb-0">Use Overview tab for documents on this lead.</p>,
                  },
                  {
                    id: "audit",
                    label: "Audit",
                    visible: canViewAudit,
                    content: (
                      <ul className="list-unstyled small mb-0">
                        {(auditQuery.data ?? []).map((log) => (
                          <li key={log.id} className="mb-2">
                            {log.action} · {new Date(log.createdAt).toLocaleString()}
                          </li>
                        ))}
                        {!auditQuery.data?.length ? <li className="text-muted">No audit events for this lead.</li> : null}
                      </ul>
                    ),
                  },
                ]}
              />
            ) : null}
          </div>
        ) : null}
      </ModuleListShell>
    </>
  );
}
