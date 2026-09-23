import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import axios from "axios";
import { FormField } from "@/components/FormField/FormField";
import { DynamicForm, FormActions, UnsavedGuard } from "@/components/FormKit";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { RecordShell } from "@/components/RecordShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import type { ApiResponse } from "@/types/api";
import { listAuditLogs, listUsers } from "@/features/admin/adminApi";
import { getPublishedFormBundle } from "@/features/admin/studio/metadataApi";
import { createProjectFromDeal } from "@/features/projects/projectApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import {
  changeDealStage,
  createDeal,
  getPipeline,
  listAccounts,
  listActivities,
  listDeals,
  type Deal,
} from "./crmApi";
import { listDocuments, listNotes, uploadDocument, documentDownloadUrl } from "./foundationApi";
import { ACCESS_TOKEN_KEY } from "@/api/client";

const DEAL_STAGES = [
  "NEW",
  "QUALIFICATION",
  "REQUIREMENT",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

const schema = z.object({
  accountId: z.string().min(1, "Account is required"),
  name: z.string().min(1, "Name is required"),
  stage: z.string().optional(),
  value: z.string().optional(),
  source: z.string().optional(),
  probability: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  description: z.string().optional(),
  competitor: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

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
  const canStage = useHasPermission("DEAL_STAGE");
  const canCreateProject = useHasPermission("PROJECT_CREATE");
  const canViewNotes = useHasPermission("NOTE_VIEW");
  const canViewDocs = useHasPermission("DOCUMENT_VIEW");
  const canUploadDocs = useHasPermission("DOCUMENT_UPLOAD");
  const canViewActivities = useHasPermission("ACTIVITY_VIEW");
  const canViewAudit = useHasPermission("AUDIT_VIEW");
  const canViewUsers = useHasPermission("USER_VIEW");
  const [view, setView] = useState<"list" | "pipeline">("list");
  const [selected, setSelected] = useState<Deal | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
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
  const [showMore, setShowMore] = useState(false);
  const [saveAndNew, setSaveAndNew] = useState(false);
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
    enabled: canViewUsers,
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
    queryFn: () => listAuditLogs({ entityType: "DEAL", entityId: selected!.id, size: 30 }),
    enabled: !!selected && canViewAudit,
  });
  const dealFormBundleQuery = useQuery({
    queryKey: ["metadata", "runtime", "deal", "form-bundle", "CREATE"],
    queryFn: () => getPublishedFormBundle("deal", "CREATE"),
    enabled: showForm,
    staleTime: 60_000,
  });

  const accountName = useMemo(() => {
    const map = new Map((accountsQuery.data ?? []).map((a) => [a.id, a.name]));
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [accountsQuery.data]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountId: "",
      name: "",
      stage: "NEW",
      value: "",
      source: "",
      probability: "",
      expectedCloseDate: "",
      description: "",
      competitor: "",
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["crm", "deals"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboards"] });
  };

  function buildDealBody(values: FormValues) {
    return {
      accountId: values.accountId,
      name: values.name,
      stage: values.stage || "NEW",
      value: values.value ? Number(values.value) : undefined,
      source: values.source || undefined,
      probability: values.probability ? Number(values.probability) : undefined,
      expectedCloseDate: values.expectedCloseDate || undefined,
      description: values.description || undefined,
      competitor: values.competitor || undefined,
    };
  }

  const createMutation = useMutation({
    mutationFn: createDeal,
    onSuccess: async () => {
      await refresh();
      setFormError(null);
      if (saveAndNew) {
        reset();
        setSaveAndNew(false);
        setShowMore(false);
      } else {
        reset();
        setShowForm(false);
        setShowMore(false);
      }
    },
    onError: () => setFormError("Could not create deal."),
  });

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

  const loading = view === "list" ? dealsQuery.isLoading : pipelineQuery.isLoading;
  const error = view === "list" ? dealsQuery.error : pipelineQuery.error;
  const deals = dealsQuery.data ?? [];

  return (
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
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Create Deal"}
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
            <label className="form-label small mb-1">Stage</label>
            <select className="form-select form-select-sm mb-2" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
              <option value="">All</option>
              {DEAL_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
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
              </>
            ) : null}
            <label className="form-label small mb-1">Min value</label>
            <input
              className="form-control form-control-sm mb-2"
              type="number"
              value={minValueFilter}
              onChange={(e) => setMinValueFilter(e.target.value)}
              placeholder="0"
            />
            <label className="form-label small mb-1">Close from</label>
            <input
              className="form-control form-control-sm mb-2"
              type="date"
              value={closeFrom}
              onChange={(e) => setCloseFrom(e.target.value)}
            />
            <label className="form-label small mb-1">Close to</label>
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
      {showForm ? (
        <form
          className="border-bottom p-3 bg-white"
          onSubmit={handleSubmit((values) => createMutation.mutate(buildDealBody(values)))}
        >
          <UnsavedGuard when={isDirty && showForm} />
          {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
          {dealFormBundleQuery.isLoading ? <LoadingState label="Loading form layout..." /> : null}
          {dealFormBundleQuery.error ? (
            <ErrorState title="Form layout unavailable" message="Published Deal CREATE layout is required." />
          ) : null}
          {dealFormBundleQuery.data ? (
            <DynamicForm
              layout={dealFormBundleQuery.data.layout.layout}
              fields={dealFormBundleQuery.data.fields}
              register={register}
              errors={errors}
              moreOpen={showMore}
              onMoreToggle={() => setShowMore((v) => !v)}
              fieldConfig={{
                accountId: {
                  options: (accountsQuery.data ?? []).map((account) => ({
                    value: account.id,
                    label: account.name,
                  })),
                  colClass: "col-md-4",
                },
                stage: {
                  options: DEAL_STAGES.map((stage) => ({ value: stage, label: stage })),
                  colClass: "col-md-2",
                },
                name: { colClass: "col-md-4" },
                value: { typeOverride: "number", colClass: "col-md-2" },
                probability: { typeOverride: "number" },
                expectedCloseDate: { typeOverride: "date" },
              }}
            />
          ) : null}
          <FormActions
            submitting={isSubmitting || createMutation.isPending}
            showSaveAndNew
            onSaveAndNew={() => {
              setSaveAndNew(true);
              void handleSubmit((values) => createMutation.mutate(buildDealBody(values)))();
            }}
            onCancel={() => {
              if (isDirty && !window.confirm("Discard unsaved changes?")) return;
              setShowForm(false);
              setShowMore(false);
              reset();
            }}
          />
        </form>
      ) : null}

      {loading ? <LoadingState label="Loading deals..." /> : null}
      {error ? <ErrorState title="Unable to load deals" message="Try again." /> : null}

      {!loading && !error ? (
        <div className={selected ? "module-list-split" : undefined} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
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

          {selected ? (
            <RecordShell
              title={selected.name}
              subtitle={accountName(selected.accountId)}
              badges={<StatusBadge status={selected.stage} />}
              onClose={() => setSelected(null)}
              tabs={[
                {
                  id: "overview",
                  label: "Overview",
                  content: (
                    <>
                      <p className="small mb-3">Value: {selected.value ?? "—"}</p>
                      {stageError ? <div className="alert alert-danger py-2">{stageError}</div> : null}
                      {projectError ? <div className="alert alert-danger py-2">{projectError}</div> : null}
                      {projectSuccess ? <div className="alert alert-success py-2">{projectSuccess}</div> : null}
                      {canStage ? (
                        <div className="mb-3">
                          <div className="form-label">Change stage</div>
                          <div className="d-flex flex-wrap gap-1 mb-2">
                            {DEAL_STAGES.map((stage) => (
                              <button
                                key={stage}
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                disabled={stage === selected.stage || stageMutation.isPending}
                                onClick={() => {
                                  if (stage === "LOST" && !lostReason.trim()) {
                                    setStageError("Lost reason is required when stage is LOST.");
                                    return;
                                  }
                                  const closeDate =
                                    stage === "WON"
                                      ? wonCloseDate || selected.expectedCloseDate || ""
                                      : undefined;
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
                                }}
                              >
                                {stage}
                              </button>
                            ))}
                          </div>
                          <FormField
                            label="Lost reason (if LOST)"
                            value={lostReason}
                            onChange={(e) => setLostReason(e.target.value)}
                          />
                          <FormField
                            label="Close date (if WON)"
                            type="date"
                            value={wonCloseDate || selected.expectedCloseDate?.slice(0, 10) || ""}
                            onChange={(e) => setWonCloseDate(e.target.value)}
                          />
                        </div>
                      ) : null}
                      {canCreateProject && selected.stage === "WON" ? (
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          disabled={projectMutation.isPending}
                          onClick={() => projectMutation.mutate(selected.id)}
                        >
                          Create project
                        </button>
                      ) : null}
                    </>
                  ),
                },
                {
                  id: "related",
                  label: "Related",
                  content: (
                    <p className="small text-muted mb-0">Account: {accountName(selected.accountId)}</p>
                  ),
                },
                {
                  id: "activities",
                  label: "Activities",
                  visible: canViewActivities,
                  content: (
                    <ul className="small mb-0">
                      {(activitiesQuery.data ?? []).map((a) => (
                        <li key={a.id}>
                          {a.subject} — <StatusBadge status={a.status} />
                        </li>
                      ))}
                      {!activitiesQuery.data?.length ? <li className="text-muted">No activities</li> : null}
                    </ul>
                  ),
                },
                {
                  id: "notes",
                  label: "Notes",
                  visible: canViewNotes,
                  content: (
                    <ul className="small mb-0">
                      {(notesQuery.data ?? []).map((n) => (
                        <li key={n.id}>{n.body}</li>
                      ))}
                      {!notesQuery.data?.length ? <li className="text-muted">No notes</li> : null}
                    </ul>
                  ),
                },
                {
                  id: "documents",
                  label: "Documents",
                  visible: canViewDocs,
                  content: (
                    <>
                      {canUploadDocs ? (
                        <input
                          className="form-control form-control-sm mb-2"
                          type="file"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !selected) return;
                            try {
                              await uploadDocument("DEAL", selected.id, file);
                              await queryClient.invalidateQueries({
                                queryKey: ["crm", "documents", "DEAL", selected.id],
                              });
                            } catch {
                              /* ignore */
                            }
                            e.target.value = "";
                          }}
                        />
                      ) : null}
                      <ul className="small mb-0">
                        {(docsQuery.data ?? []).map((d) => (
                          <li key={d.id}>
                            <button
                              type="button"
                              className="btn btn-link btn-sm px-0"
                              onClick={async () => {
                                const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
                                const response = await fetch(documentDownloadUrl(d.id), {
                                  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                                });
                                if (!response.ok) return;
                                const blob = await response.blob();
                                const url = URL.createObjectURL(blob);
                                const anchor = document.createElement("a");
                                anchor.href = url;
                                anchor.download = d.fileName;
                                anchor.click();
                                URL.revokeObjectURL(url);
                              }}
                            >
                              {d.fileName}
                            </button>
                          </li>
                        ))}
                        {!docsQuery.data?.length ? <li className="text-muted">No documents</li> : null}
                      </ul>
                    </>
                  ),
                },
                {
                  id: "audit",
                  label: "Audit",
                  visible: canViewAudit,
                  content: (
                    <ul className="small mb-0">
                      {(auditQuery.data ?? []).map((log) => (
                        <li key={log.id}>
                          {log.action} · {new Date(log.createdAt).toLocaleString()}
                        </li>
                      ))}
                      {!auditQuery.data?.length ? <li className="text-muted">No audit events</li> : null}
                    </ul>
                  ),
                },
              ]}
            />
          ) : null}
        </div>
      ) : null}
    </ModuleListShell>
  );
}
