import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { DealCreateView } from "./DealCreateView";
import { DealEditView } from "./DealEditView";
import { DealRecordOverview, DEAL_STAGES } from "./DealRecordOverview";
import { buildOwnerOptions, enumPickerOptions, optionsFromPairs, TechEarnestFilterSelect } from "@/components/TechEarnestCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import {
  ModuleFilterDateRange,
  ModuleFilterField,
  ModuleListShell,
} from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { RecordShell, DEAL_RELATED_LINKS } from "@/components/RecordShell";
import { buildDealTimelineEntries, recordLifecycleInfo, useRecordNavigation, TechEarnestRecordTimeline } from "@/components/TechEarnestRecord";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import type { ApiResponse } from "@/types/api";
import { listAuditLogs, listRegions, listUsers } from "@/features/admin/adminApi";
import { getPublishedFormPolicies } from "@/features/admin/studio/metadataApi";
import { createProjectFromDeal, listProjects } from "@/features/projects/projectApi";
import { RecordLink, useOpenRecord } from "@/components/RecordLink";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { useUrlSelection } from "@/hooks/useUrlRecord";
import { useBulkImport } from "@/features/import/useBulkImport";
import {
  changeDealStage,
  getDeal,
  getLead,
  getPipeline,
  listAccounts,
  listActivities,
  listContacts,
  listDealStageHistory,
  listDeals,
  type Deal,
} from "./crmApi";
import {
  createNote,
  deleteDocument,
  deleteNote,
  documentDownloadUrl,
  listDocuments,
  listNotes,
  uploadDocument,
} from "./foundationApi";
import { ACCESS_TOKEN_KEY } from "@/api/client";

function policyConditionMatches(policy: { when: { field: string; op: string; value?: string } }, values: Record<string, string>) {
  const actual = values[policy.when.field] ?? "";
  const expected = policy.when.value ?? "";
  switch (policy.when.op.toUpperCase()) {
    case "EQ": return actual !== "" && actual.toLowerCase() === expected.toLowerCase();
    case "NEQ": return actual === "" || actual.toLowerCase() !== expected.toLowerCase();
    case "EMPTY": return actual.trim() === "";
    case "NOT_EMPTY": return actual.trim() !== "";
    default: return false;
  }
}

function policyFieldLabel(field: string) {
  return field === "lostReason" ? "Lost reason" : field === "expectedCloseDate" ? "Closing date" : field;
}

const DEAL_STAGE_OPTIONS = enumPickerOptions(DEAL_STAGES);
const DEAL_LIST_COLUMNS = [
  { field: "name", label: "Deal Name" },
  { field: "accountId", label: "Account" },
  { field: "stage", label: "Stage" },
  { field: "value", label: "Amount" },
  { field: "source", label: "Lead Source" },
];

function formatDealMoney(value: number | null | undefined) {
  if (value == null) return "—";
  return value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const payload = err.response?.data as ApiResponse<unknown> | undefined;
    if (payload?.message) return payload.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function DealsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  const canCreate = useHasPermission("DEAL_CREATE");
  const canUpdate = useHasPermission("DEAL_UPDATE");
  const canStage = useHasPermission("DEAL_STAGE");
  const canCreateProject = useHasPermission("PROJECT_CREATE");
  const canViewNotes = useHasPermission("NOTE_VIEW");
  const canCreateNotes = useHasPermission("NOTE_CREATE");
  const canDeleteNotes = useHasPermission("NOTE_DELETE");
  const canViewDocs = useHasPermission("DOCUMENT_VIEW");
  const canUploadDocs = useHasPermission("DOCUMENT_UPLOAD");
  const canDeleteDocs = useHasPermission("DOCUMENT_DELETE");
  const canViewActivities = useHasPermission("ACTIVITY_VIEW");
  const canViewAudit = useHasPermission("AUDIT_VIEW");
  const canViewUsers = useHasPermission("USER_VIEW");
  const canViewProjects = useHasPermission("PROJECT_VIEW");
  const canViewLeads = useHasPermission("LEAD_VIEW");
  const [view, setView] = useState<"list" | "pipeline">("list");
  const [stageError, setStageError] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectSuccess, setProjectSuccess] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [wonCloseDate, setWonCloseDate] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [minValueFilter, setMinValueFilter] = useState("");
  const [closeFrom, setCloseFrom] = useState("");
  const [closeTo, setCloseTo] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const { filterOpen, setFilterOpen, search, setSearch, showForm, setShowForm } = useModuleWorkspace();
  useEffect(() => {
    if (searchParams.get("create") === "1" && canCreate) {
      setSelected(null);
      setShowForm(true);
    }
  }, [searchParams, canCreate]);

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      stage: stageFilter || undefined,
      accountId: accountFilter || undefined,
      ownerId: ownerFilter || undefined,
      minValue: minValueFilter.trim() ? Number(minValueFilter) : undefined,
      closeFrom: closeFrom || undefined,
      closeTo: closeTo || undefined,
    }),
    [search, stageFilter, accountFilter, ownerFilter, minValueFilter, closeFrom, closeTo],
  );

  const dealsQuery = useQuery({
    queryKey: ["crm", "deals", listParams],
    queryFn: () => listDeals(listParams),
  });
  const [selected, setSelected] = useUrlSelection(dealsQuery.data, { fetchById: getDeal });
  const openRecord = useOpenRecord();
  const stagePoliciesQuery = useQuery({
    queryKey: ["metadata", "runtime", "form-policies", "deal", "EDIT"],
    queryFn: () => getPublishedFormPolicies("deal", "EDIT"),
    enabled: canStage,
    staleTime: 60_000,
  });
  const dealRecordQuery = useQuery({
    queryKey: ["crm", "deals", "record", selected?.id],
    queryFn: () => getDeal(selected!.id),
    enabled: !!selected,
  });
  useEffect(() => {
    if (dealRecordQuery.data && selected?.id === dealRecordQuery.data.id) {
      setSelected((current) =>
        current?.id === dealRecordQuery.data!.id ? dealRecordQuery.data! : current,
      );
    }
  }, [dealRecordQuery.data, selected?.id]);
  const pipelineQuery = useQuery({
    queryKey: ["crm", "deals", "pipeline"],
    queryFn: getPipeline,
    enabled: view === "pipeline",
  });
  const accountsQuery = useQuery({ queryKey: ["crm", "accounts"], queryFn: () => listAccounts() });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: canViewUsers || (showForm && canCreate),
  });
  const regionsQuery = useQuery({
    queryKey: ["admin", "regions", "deal-account-quick-create"],
    queryFn: listRegions,
    enabled: showForm && canCreate,
  });
  const activeFilterCount = [
    search,
    stageFilter,
    accountFilter,
    ownerFilter,
    minValueFilter,
    closeFrom,
    closeTo,
  ].filter(Boolean).length;
  const bulkImport = useBulkImport("deals", async () => {
    await queryClient.invalidateQueries({ queryKey: ["crm", "deals"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboards"] });
  });
  const activitiesQuery = useQuery({
    queryKey: ["crm", "activities", "DEAL", (selected as Deal | null)?.id],
    queryFn: () => listActivities({ relatedEntityType: "DEAL", relatedEntityId: selected!.id }),
    enabled: !!selected && canViewActivities,
  });
  const notesQuery = useQuery({
    queryKey: ["crm", "notes", "DEAL", (selected as Deal | null)?.id],
    queryFn: () => listNotes("DEAL", selected!.id),
    enabled: !!selected && canViewNotes,
  });
  const docsQuery = useQuery({
    queryKey: ["crm", "documents", "DEAL", (selected as Deal | null)?.id],
    queryFn: () => listDocuments("DEAL", selected!.id),
    enabled: !!selected && canViewDocs,
  });
  const auditQuery = useQuery({
    queryKey: ["admin", "audit-logs", "DEAL", (selected as Deal | null)?.id],
    queryFn: () => listAuditLogs({ entityType: "DEAL", entityId: selected!.id, size: 50 }),
    enabled: !!selected && canViewAudit,
  });
  const stageHistoryQuery = useQuery({
    queryKey: ["crm", "deals", "stage-history", (selected as Deal | null)?.id],
    queryFn: () => listDealStageHistory(selected!.id),
    enabled: !!selected,
  });
  const contactsQuery = useQuery({
    queryKey: ["crm", "contacts", "deal-record", selected?.accountId],
    queryFn: () => listContacts({ accountId: selected!.accountId }),
    enabled: !!selected,
  });
  const dealProjectsQuery = useQuery({
    queryKey: ["projects", "list", { accountId: selected?.accountId }],
    queryFn: () => listProjects({ accountId: selected!.accountId }),
    enabled: !!selected && canViewProjects,
  });
  const dealProjects = useMemo(
    () => (dealProjectsQuery.data ?? []).filter((project) => project.dealId === selected?.id),
    [dealProjectsQuery.data, selected?.id],
  );
  const leadQuery = useQuery({
    queryKey: ["crm", "leads", "record", selected?.leadId],
    queryFn: () => getLead(selected!.leadId!),
    enabled: !!selected?.leadId && canViewLeads,
  });

  const accountName = useMemo(() => {
    const map = new Map((accountsQuery.data ?? []).map((a) => [a.id, a.name]));
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [accountsQuery.data]);

  const ownerName = useMemo(() => {
    const map = new Map(
      (usersQuery.data ?? []).map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]),
    );
    return (id: string | null | undefined) => (id ? (map.get(id) ?? id.slice(0, 8)) : "—");
  }, [usersQuery.data]);

  const dealContact = useMemo(
    () => (selected?.contactId ? (contactsQuery.data ?? []).find((item) => item.id === selected.contactId) : undefined),
    [contactsQuery.data, selected?.contactId],
  );
  const contactName = selected?.contactId
    ? dealContact
      ? `${dealContact.firstName} ${dealContact.lastName}`.trim()
      : selected.contactId.slice(0, 8)
    : undefined;

  const accountOptions = useMemo(
    () => optionsFromPairs((accountsQuery.data ?? []).map((account) => ({ value: account.id, label: account.name }))),
    [accountsQuery.data],
  );
  const ownerFilterOptions = useMemo(
    () =>
      optionsFromPairs(
        (usersQuery.data ?? []).map((user) => ({
          value: user.id,
          label: `${user.firstName} ${user.lastName}`.trim(),
          subtitle: user.email,
        })),
      ),
    [usersQuery.data],
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["crm", "deals"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboards"] });
  };

  async function handleDealCreated(deal: Deal, mode: "save" | "saveAndNew") {
    await refresh();
    if (mode === "save") {
      setShowForm(false);
      setSelected(deal);
    }
  }

  function openCreate() {
    setSelected(null);
    setShowForm(true);
  }

  const stageMutation = useMutation({
    mutationFn: ({
      id,
      toStage,
      lostReason: reason,
      expectedCloseDate,
    }: {
      id: string;
      toStage: string;
      lostReason?: string;
      expectedCloseDate?: string;
    }) => changeDealStage(id, { toStage, lostReason: reason, expectedCloseDate }),
    onSuccess: async (deal) => {
      await refresh();
      setSelected(deal);
      setStageError(null);
      setLostReason("");
      setWonCloseDate("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs", "DEAL", deal.id] });
      await queryClient.invalidateQueries({ queryKey: ["crm", "deals", "stage-history", deal.id] });
    },
    onError: (err) => setStageError(errorMessage(err, "Could not change stage.")),
  });

  const projectMutation = useMutation({
    mutationFn: (dealId: string) => createProjectFromDeal(dealId),
    onSuccess: async (project) => {
      setProjectError(null);
      setProjectSuccess(`Project "${project.name}" created successfully.`);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      openRecord("project", project.id, selected?.name);
    },
    onError: (err) => {
      setProjectSuccess(null);
      setProjectError(errorMessage(err, "Could not create project from deal."));
    },
  });

  const noteMutation = useMutation({
    mutationFn: () => createNote("DEAL", selected!.id, noteBody),
    onSuccess: async () => {
      setNoteBody("");
      await queryClient.invalidateQueries({ queryKey: ["crm", "notes", "DEAL", (selected as Deal | null)?.id] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "notes", "DEAL", selected?.id] });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "documents", "DEAL", selected?.id] });
    },
  });

  const loading = view === "list" ? dealsQuery.isLoading : pipelineQuery.isLoading;
  const error = view === "list" ? dealsQuery.error : pipelineQuery.error;
  const deals = dealsQuery.data ?? [];
  const recordNav = useRecordNavigation(deals, selected, setSelected);

  const ownerOptions = useMemo(
    () =>
      buildOwnerOptions(usersQuery.data, {
        userId: auth.userId,
        displayName: auth.displayName,
      }),
    [usersQuery.data, auth.displayName, auth.userId],
  );

  const timelineEntries = useMemo(
    () =>
      buildDealTimelineEntries(
        auditQuery.data,
        activitiesQuery.data,
        stageHistoryQuery.data,
        (userId) => (userId === auth.userId ? auth.displayName : ownerName(userId)),
        recordLifecycleInfo("Deal", selected),
        notesQuery.data,
      ),
    [
      auditQuery.data,
      activitiesQuery.data,
      stageHistoryQuery.data,
      notesQuery.data,
      auth.displayName,
      auth.userId,
      ownerName,
      selected,
    ],
  );

  function handleStageClick(stage: string) {
    if (!selected) return;
    if (stage === selected.stage) return;
    if (selected.stage === "WON" || selected.stage === "LOST") {
      setStageError("Stage cannot be changed after the deal is closed.");
      return;
    }
    if (stage === "LOST" && !lostReason.trim()) {
      setStageError("Lost reason is required when stage is LOST.");
      return;
    }
    const closeDate = stage === "WON" ? wonCloseDate || selected.expectedCloseDate || "" : undefined;
    if (stage === "WON" && !closeDate) {
      setStageError("Expected close date is required when stage is WON.");
      return;
    }
    const policyValues: Record<string, string> = {
      stage,
      lostReason: stage === "LOST" ? lostReason : "",
      expectedCloseDate: stage === "WON" ? closeDate ?? "" : selected.expectedCloseDate ?? "",
    };
    for (const policy of stagePoliciesQuery.data ?? []) {
      if (!policyConditionMatches(policy.policy, policyValues)) continue;
      const required = policy.policy.then.find((effect) => effect.mandatory && !String(policyValues[effect.field] ?? "").trim());
      if (required) {
        setStageError(`${policyFieldLabel(required.field)} is required by “${policy.name}”.`);
        return;
      }
    }
    stageMutation.mutate({
      id: selected.id,
      toStage: stage,
      lostReason: stage === "LOST" ? lostReason || undefined : undefined,
      expectedCloseDate: closeDate || undefined,
    });
  }

  async function openDownload(id: string, fileName: string) {
    const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const response = await fetch(documentDownloadUrl(id), {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {showForm && canCreate ? (
        <DealCreateView
          accounts={(accountsQuery.data ?? []).map((account) => ({ id: account.id, name: account.name }))}
          regions={(regionsQuery.data ?? []).map((region) => ({ id: region.id, name: region.name }))}
          users={ownerOptions}
          defaultOwnerId={auth.userId}
          onCancel={() => setShowForm(false)}
          onCreated={(deal, mode) => void handleDealCreated(deal, mode)}
        />
      ) : showEdit && selected && canUpdate ? (
        <DealEditView
          deal={selected}
          accountName={accountName(selected.accountId)}
          users={ownerOptions}
          onCancel={() => setShowEdit(false)}
          onUpdated={(deal) => {
            setSelected(deal);
            setShowEdit(false);
            void refresh();
          }}
        />
      ) : selected ? (
        <RecordShell
          layout="page"
          title={`${selected.name}${selected.value != null ? ` - ${formatDealMoney(selected.value)}` : ""}`}
          subtitle={accountName(selected.accountId)}
          avatarLabel={selected.name}
          meta={<span className="small text-muted">Last Update: {new Date(selected.updatedAt).toLocaleString()}</span>}
          status={<StatusBadge status={selected.stage} />}
          recordKey={selected.id}
          onBack={() => {
            setShowEdit(false);
            recordNav.goBack();
          }}
          onPrev={recordNav.goPrev}
          onNext={recordNav.goNext}
          hasPrev={recordNav.hasPrev}
          hasNext={recordNav.hasNext}
          relatedLinks={
            canViewProjects ? [...DEAL_RELATED_LINKS, { id: "projects", label: "Projects" }] : [...DEAL_RELATED_LINKS]
          }
          primaryAction={
            dealContact?.email ? (
              <a className="btn btn-primary btn-sm" href={`mailto:${dealContact.email}`}>
                Send Email
              </a>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" disabled title="The deal has no contact with an email">
                Send Email
              </button>
            )
          }
          secondaryActions={
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={!canUpdate}
              onClick={() => setShowEdit(true)}
            >
              Edit
            </button>
          }
          tabs={[
            {
              id: "overview",
              label: "Overview",
              content: (
                <DealRecordOverview
                  deal={selected}
                  ownerName={ownerName(selected.ownerId)}
                  accountName={accountName(selected.accountId)}
                  contactName={contactName}
                  contactEmail={dealContact?.email}
                  userName={(userId) => (userId === auth.userId ? auth.displayName : ownerName(userId))}
                  stageHistory={stageHistoryQuery.data ?? []}
                  activities={canViewActivities ? activitiesQuery.data ?? [] : null}
                  projects={canViewProjects ? dealProjects : null}
                  leadName={
                    leadQuery.data
                      ? [leadQuery.data.firstName, leadQuery.data.lastName].filter(Boolean).join(" ") ||
                        leadQuery.data.companyName
                      : null
                  }
                  canStage={canStage}
                  canCreateProject={canCreateProject}
                  canViewNotes={canViewNotes}
                  canCreateNotes={canCreateNotes}
                  canDeleteNotes={canDeleteNotes}
                  canViewDocs={canViewDocs}
                  canUploadDocs={canUploadDocs}
                  canDeleteDocs={canDeleteDocs}
                  stageError={stageError}
                  projectError={projectError}
                  projectSuccess={projectSuccess}
                  lostReason={lostReason}
                  wonCloseDate={wonCloseDate}
                  noteBody={noteBody}
                  notes={notesQuery.data ?? []}
                  documents={docsQuery.data ?? []}
                  stagePending={stageMutation.isPending}
                  projectPending={projectMutation.isPending}
                  onLostReasonChange={setLostReason}
                  onWonCloseDateChange={setWonCloseDate}
                  onNoteBodyChange={setNoteBody}
                  onStageClick={handleStageClick}
                  onCreateProject={() => projectMutation.mutate(selected.id)}
                  onSaveNote={() => noteMutation.mutate()}
                  onDeleteNote={(id) => deleteNoteMutation.mutate(id)}
                  onDeleteDocument={(id) => deleteDocMutation.mutate(id)}
                  onUploadDocument={async (file) => {
                    await uploadDocument("DEAL", selected.id, file);
                    await queryClient.invalidateQueries({ queryKey: ["crm", "documents", "DEAL", selected.id] });
                  }}
                  onDownloadDocument={(id, fileName) => void openDownload(id, fileName)}
                />
              ),
            },
            {
              id: "timeline",
              label: "Timeline",
              visible: true,
              content: (
                <TechEarnestRecordTimeline
                  entries={timelineEntries}
                  loading={auditQuery.isLoading || stageHistoryQuery.isLoading || activitiesQuery.isLoading || notesQuery.isLoading}
                />
              ),
            },
          ]}
        />
      ) : (
    <ModuleListShell
      title="Deals"
      filterOpen={filterOpen}
      viewSelector={<span className="module-view-select">All Deals</span>}
      toolbarActions={
        <>
          <button
            type="button"
            className={`btn btn-sm ${filterOpen ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setFilterOpen((o) => !o)}
          >
            Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </button>
          <div className="btn-group btn-group-sm" role="group">
            <button
              type="button"
              className={`btn ${view === "list" ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setView("list")}
            >
              List
            </button>
            <button
              type="button"
              className={`btn ${view === "pipeline" ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setView("pipeline")}
            >
              Pipeline
            </button>
          </div>
        </>
      }
      primaryAction={
        canCreate ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openCreate()}>
            Create Deal
          </button>
        ) : null
      }
      createMenuItems={bulkImport.menuItems}
      moreMenuItems={bulkImport.menuItems}
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Deals by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Deal name"
            />
          </div>
          <div className="module-filter-section">
            <h3>Filter by fields</h3>
            <TechEarnestFilterSelect
              label="Stage"
              value={stageFilter}
              onChange={setStageFilter}
              options={DEAL_STAGE_OPTIONS}
              searchPlaceholder="Search Stages"
            />
            <TechEarnestFilterSelect
              label="Account"
              value={accountFilter}
              onChange={setAccountFilter}
              options={accountOptions}
              searchPlaceholder="Search Accounts"
            />
            {canViewUsers ? (
              <TechEarnestFilterSelect
                label="Owner"
                value={ownerFilter}
                onChange={setOwnerFilter}
                options={ownerFilterOptions}
                searchPlaceholder="Search Owners"
              />
            ) : null}
            <ModuleFilterField label="Min value" htmlFor="dealMinValueFilter">
              <input
                id="dealMinValueFilter"
                className="form-control form-control-sm"
                type="number"
                value={minValueFilter}
                onChange={(e) => setMinValueFilter(e.target.value)}
                placeholder="0"
              />
            </ModuleFilterField>
            <ModuleFilterDateRange
              label="Close date"
              from={closeFrom}
              to={closeTo}
              onFromChange={setCloseFrom}
              onToChange={setCloseTo}
            />
          </div>
        </>
      }
      activeFilterCount={activeFilterCount}
      onClearFilters={() => {
        setSearch("");
        setStageFilter("");
        setAccountFilter("");
        setOwnerFilter("");
        setMinValueFilter("");
        setCloseFrom("");
        setCloseTo("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {view === "list" ? deals.length : "—"}</span>}
    >
      {loading ? <LoadingState label="Loading deals..." /> : null}
      {error ? <ErrorState title="Unable to load deals" message="Try again." /> : null}

      {!loading && !error && view === "list" && !deals.length && !activeFilterCount
        ? bulkImport.renderEmptyState({ canCreate, createLabel: "Create Deal", onCreate: () => openCreate() })
        : null}

      {!loading && !error && (view !== "list" || deals.length || activeFilterCount) ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {view === "list" ? (
            <ModuleListTable
                tableCode="deal"
                defaultColumns={DEAL_LIST_COLUMNS}
                rows={deals}
                rowKey={(deal) => deal.id}
                selectedRowKey={(selected as Deal | null)?.id}
                onRowClick={(deal) => {
                  setSelected(deal);
                  setProjectError(null);
                  setProjectSuccess(null);
                  setStageError(null);
                }}
                renderCell={(deal, field) => {
                  if (field === "accountId")
                    return (
                      <RecordLink module="account" id={deal.accountId}>
                        {accountName(deal.accountId)}
                      </RecordLink>
                    );
                  if (field === "stage") return <StatusBadge status={deal.stage} />;
                  if (field === "value") return deal.value ?? "—";
                  const value = (deal as unknown as Record<string, unknown>)[field];
                  return value == null || value === "" ? "—" : String(value);
                }}
                nameFields={["name"]}
                emptyMessage="No deals match the current filters."
            />
          ) : (
            <div className="d-flex gap-3 overflow-auto p-3" style={{ minHeight: 280 }}>
              {(pipelineQuery.data ?? []).map((column) => (
                <div key={column.stage} className="border rounded bg-white p-2 flex-shrink-0" style={{ width: 220 }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="fw-semibold small">{column.stage}</span>
                    <span className="text-muted small">{column.totalValue ?? 0}</span>
                  </div>
                  {(column.deals ?? []).map((deal) => (
                    <button
                      key={deal.id}
                      type="button"
                      className={`btn btn-sm w-100 text-start mb-2 ${
                        (selected as Deal | null)?.id === deal.id ? "btn-primary" : "btn-outline-secondary"
                      }`}
                      onClick={() => setSelected(deal)}
                    >
                      <div className="fw-semibold text-truncate">{deal.name}</div>
                      <div className="small opacity-75">{deal.value ?? "—"}</div>
                    </button>
                  ))}
                </div>
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
