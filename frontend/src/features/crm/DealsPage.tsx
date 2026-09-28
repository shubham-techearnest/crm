import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { DealCreateView } from "./DealCreateView";
import { DealEditView } from "./DealEditView";
import { DealRecordOverview, DEAL_STAGES } from "./DealRecordOverview";
import { buildOwnerOptions, enumPickerOptions, optionsFromPairs, ZohoFilterSelect } from "@/components/ZohoCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { RecordShell, DEAL_RELATED_LINKS } from "@/components/RecordShell";
import { buildTimelineEntries, buildDealTimelineEntries, recordLifecycleInfo, useRecordNavigation, ZohoRecordTimeline } from "@/components/ZohoRecord";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import type { ApiResponse } from "@/types/api";
import { listAuditLogs, listUsers } from "@/features/admin/adminApi";
import { createProjectFromDeal } from "@/features/projects/projectApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import {
  changeDealStage,
  getPipeline,
  listAccounts,
  listActivities,
  listContacts,
  listDealStageHistory,
  listDeals,
  type Deal,
} from "./crmApi";
import { createNote, listDocuments, listNotes, uploadDocument, documentDownloadUrl } from "./foundationApi";
import { ACCESS_TOKEN_KEY } from "@/api/client";

const DEAL_STAGE_OPTIONS = enumPickerOptions(DEAL_STAGES);

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
  const navigate = useNavigate();
  const auth = useAuth();
  const canCreate = useHasPermission("DEAL_CREATE");
  const canUpdate = useHasPermission("DEAL_UPDATE");
  const canStage = useHasPermission("DEAL_STAGE");
  const canCreateProject = useHasPermission("PROJECT_CREATE");
  const canViewNotes = useHasPermission("NOTE_VIEW");
  const canCreateNotes = useHasPermission("NOTE_CREATE");
  const canViewDocs = useHasPermission("DOCUMENT_VIEW");
  const canUploadDocs = useHasPermission("DOCUMENT_UPLOAD");
  const canViewActivities = useHasPermission("ACTIVITY_VIEW");
  const canViewAudit = useHasPermission("AUDIT_VIEW");
  const canViewUsers = useHasPermission("USER_VIEW");
  const [view, setView] = useState<"list" | "pipeline">("list");
  const [selected, setSelected] = useState<Deal | null>(null);
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
  const activeFilterCount = [
    search,
    stageFilter,
    accountFilter,
    ownerFilter,
    minValueFilter,
    closeFrom,
    closeTo,
  ].filter(Boolean).length;
  const activitiesQuery = useQuery({
    queryKey: ["crm", "activities", "DEAL", selected?.id],
    queryFn: () => listActivities({ relatedEntityType: "DEAL", relatedEntityId: selected!.id }),
    enabled: !!selected && canViewActivities,
  });
  const notesQuery = useQuery({
    queryKey: ["crm", "notes", "DEAL", selected?.id],
    queryFn: () => listNotes("DEAL", selected!.id),
    enabled: !!selected && canViewNotes,
  });
  const docsQuery = useQuery({
    queryKey: ["crm", "documents", "DEAL", selected?.id],
    queryFn: () => listDocuments("DEAL", selected!.id),
    enabled: !!selected && canViewDocs,
  });
  const auditQuery = useQuery({
    queryKey: ["admin", "audit-logs", "DEAL", selected?.id],
    queryFn: () => listAuditLogs({ entityType: "DEAL", entityId: selected!.id, size: 50 }),
    enabled: !!selected && canViewAudit,
  });
  const stageHistoryQuery = useQuery({
    queryKey: ["crm", "deals", "stage-history", selected?.id],
    queryFn: () => listDealStageHistory(selected!.id),
    enabled: !!selected,
  });
  const contactsQuery = useQuery({
    queryKey: ["crm", "contacts", "deal-record", selected?.accountId],
    queryFn: () => listContacts({ accountId: selected!.accountId }),
    enabled: !!selected,
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

  const contactName = useMemo(() => {
    if (!selected?.contactId) return undefined;
    const contact = (contactsQuery.data ?? []).find((item) => item.id === selected.contactId);
    return contact ? `${contact.firstName} ${contact.lastName}`.trim() : selected.contactId.slice(0, 8);
  }, [contactsQuery.data, selected?.contactId]);

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
      navigate("/projects");
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
      await queryClient.invalidateQueries({ queryKey: ["crm", "notes", "DEAL", selected?.id] });
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
    stageMutation.mutate({
      id: selected.id,
      toStage: stage,
      lostReason: stage === "LOST" ? lostReason || undefined : undefined,
      expectedCloseDate: closeDate || undefined,
    });
  }

  async function openDownload(id: string) {
    const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const response = await fetch(documentDownloadUrl(id), {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "document";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {showForm && canCreate ? (
        <DealCreateView
          accounts={(accountsQuery.data ?? []).map((account) => ({ id: account.id, name: account.name }))}
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
          relatedLinks={[...DEAL_RELATED_LINKS]}
          primaryAction={
            <button type="button" className="btn btn-primary btn-sm" disabled>
              Send Email
            </button>
          }
          secondaryActions={
            canUpdate ? (
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowEdit(true)}>
                Edit
              </button>
            ) : null
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
                  canStage={canStage}
                  canCreateProject={canCreateProject}
                  canViewNotes={canViewNotes}
                  canCreateNotes={canCreateNotes}
                  canViewDocs={canViewDocs}
                  canUploadDocs={canUploadDocs}
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
                  onUploadDocument={async (file) => {
                    await uploadDocument("DEAL", selected.id, file);
                    await queryClient.invalidateQueries({ queryKey: ["crm", "documents", "DEAL", selected.id] });
                  }}
                  onDownloadDocument={openDownload}
                />
              ),
            },
            {
              id: "timeline",
              label: "Timeline",
              visible: true,
              content: (
                <ZohoRecordTimeline
                  entries={timelineEntries}
                  loading={auditQuery.isLoading || stageHistoryQuery.isLoading || activitiesQuery.isLoading}
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
            <ZohoFilterSelect
              label="Stage"
              value={stageFilter}
              onChange={setStageFilter}
              options={DEAL_STAGE_OPTIONS}
              searchPlaceholder="Search Stages"
            />
            <ZohoFilterSelect
              label="Account"
              value={accountFilter}
              onChange={setAccountFilter}
              options={accountOptions}
              searchPlaceholder="Search Accounts"
            />
            {canViewUsers ? (
              <ZohoFilterSelect
                label="Owner"
                value={ownerFilter}
                onChange={setOwnerFilter}
                options={ownerFilterOptions}
                searchPlaceholder="Search Owners"
              />
            ) : null}
            <label className="form-label">Min value</label>
            <input
              className="form-control form-control-sm mb-2"
              type="number"
              value={minValueFilter}
              onChange={(e) => setMinValueFilter(e.target.value)}
              placeholder="0"
            />
            <label className="form-label">Close from</label>
            <input
              className="form-control form-control-sm mb-2"
              type="date"
              value={closeFrom}
              onChange={(e) => setCloseFrom(e.target.value)}
            />
            <label className="form-label">Close to</label>
            <input
              className="form-control form-control-sm"
              type="date"
              value={closeTo}
              onChange={(e) => setCloseTo(e.target.value)}
            />
          </div>
        </>
      }
      footerLeft={<span>Total Records: {view === "list" ? deals.length : "—"}</span>}
    >
      {loading ? <LoadingState label="Loading deals..." /> : null}
      {error ? <ErrorState title="Unable to load deals" message="Try again." /> : null}

      {!loading && !error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {view === "list" ? (
            <div className="module-list-table-wrap">
              <table className="table module-list-table align-middle">
                <thead>
                  <tr>
                    <th>Deal Name</th>
                    <th>Account</th>
                    <th>Stage</th>
                    <th>Amount</th>
                    <th>Lead Source</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((deal) => (
                    <tr
                      key={deal.id}
                      className={selected?.id === deal.id ? "is-selected" : undefined}
                      onClick={() => {
                        setSelected(deal);
                        setProjectError(null);
                        setProjectSuccess(null);
                        setStageError(null);
                      }}
                    >
                      <td className="lead-name">{deal.name}</td>
                      <td>{accountName(deal.accountId)}</td>
                      <td>
                        <StatusBadge status={deal.stage} />
                      </td>
                      <td>{deal.value ?? "—"}</td>
                      <td>{deal.source ?? "—"}</td>
                    </tr>
                  ))}
                  {!deals.length ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-5">
                        No deals match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
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
                        selected?.id === deal.id ? "btn-primary" : "btn-outline-secondary"
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
    </>
  );
}
