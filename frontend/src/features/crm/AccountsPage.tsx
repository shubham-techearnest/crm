import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AccountCreateView } from "./AccountCreateView";
import { buildOwnerOptions, enumPickerOptions, optionsFromPairs, TechEarnestFilterSelect } from "@/components/TechEarnestCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { RecordShell, DEFAULT_RELATED_LINKS } from "@/components/RecordShell";
import { buildTimelineEntries, recordLifecycleInfo, useRecordNavigation, TechEarnestRecordTimeline } from "@/components/TechEarnestRecord";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listAuditLogs, listRegions, listUsers } from "@/features/admin/adminApi";
import { getPublishedRelatedLists } from "@/features/admin/studio/metadataApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import {
  listAccountContacts,
  listAccountDeals,
  listAccountProjects,
  listAccounts,
  listActivities,
  type Account,
} from "./crmApi";
import { listDocuments, listNotes } from "./foundationApi";

export function AccountsPage() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const [params] = useSearchParams();
  const canCreate = useHasPermission("ACCOUNT_CREATE");
  const canUpdate = useHasPermission("ACCOUNT_UPDATE");
  const canViewNotes = useHasPermission("NOTE_VIEW");
  const canViewDocs = useHasPermission("DOCUMENT_VIEW");
  const canViewActivities = useHasPermission("ACTIVITY_VIEW");
  const canViewProjects = useHasPermission("PROJECT_VIEW");
  const canViewAudit = useHasPermission("AUDIT_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [selected, setSelected] = useState<Account | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    if (params.get("create") === "1") setShowForm(true);
  }, [params, setShowForm]);

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter || undefined,
      accountType: typeFilter || undefined,
      industry: industryFilter || undefined,
      regionId: regionFilter || undefined,
    }),
    [search, statusFilter, typeFilter, industryFilter, regionFilter],
  );

  const accountsQuery = useQuery({
    queryKey: ["crm", "accounts", listParams],
    queryFn: () => listAccounts(listParams),
  });
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: (showForm && canCreate) || (showEdit && canUpdate),
  });
  const relatedListsQuery = useQuery({
    queryKey: ["metadata", "runtime", "account", "related-lists"],
    queryFn: () => getPublishedRelatedLists("account"),
    enabled: !!selected,
    staleTime: 60_000,
  });
  const contactsQuery = useQuery({
    queryKey: ["crm", "accounts", (selected as Account | null)?.id, "contacts"],
    queryFn: () => listAccountContacts(selected!.id),
    enabled: !!selected,
  });
  const dealsQuery = useQuery({
    queryKey: ["crm", "accounts", (selected as Account | null)?.id, "deals"],
    queryFn: () => listAccountDeals(selected!.id),
    enabled: !!selected,
  });
  const activitiesQuery = useQuery({
    queryKey: ["crm", "activities", "ACCOUNT", (selected as Account | null)?.id],
    queryFn: () => listActivities({ relatedEntityType: "ACCOUNT", relatedEntityId: selected!.id }),
    enabled: !!selected && canViewActivities,
  });
  const notesQuery = useQuery({
    queryKey: ["crm", "notes", "ACCOUNT", (selected as Account | null)?.id],
    queryFn: () => listNotes("ACCOUNT", selected!.id),
    enabled: !!selected && canViewNotes,
  });
  const docsQuery = useQuery({
    queryKey: ["crm", "documents", "ACCOUNT", (selected as Account | null)?.id],
    queryFn: () => listDocuments("ACCOUNT", selected!.id),
    enabled: !!selected && canViewDocs,
  });
  const projectsQuery = useQuery({
    queryKey: ["projects", "account", (selected as Account | null)?.id],
    queryFn: () => listAccountProjects(selected!.id),
    enabled: !!selected && canViewProjects,
  });
  const auditQuery = useQuery({
    queryKey: ["admin", "audit-logs", "ACCOUNT", (selected as Account | null)?.id],
    queryFn: () => listAuditLogs({ entityType: "ACCOUNT", entityId: selected!.id, size: 30 }),
    enabled: !!selected && canViewAudit,
  });

  const userLabel = useMemo(() => {
    const map = new Map(
      (usersQuery.data ?? []).map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]),
    );
    return (id: string | null | undefined) => (id ? (map.get(id) ?? id.slice(0, 8)) : "—");
  }, [usersQuery.data]);

  const rows = accountsQuery.data ?? [];
  const recordNav = useRecordNavigation(rows, selected, setSelected);
  const timelineEntries = useMemo(
    () =>
      buildTimelineEntries(
        auditQuery.data,
        activitiesQuery.data,
        (userId) => (userId === auth.userId ? auth.displayName : userLabel(userId)),
        recordLifecycleInfo("Account", selected),
        notesQuery.data,
      ),
    [auditQuery.data, activitiesQuery.data, notesQuery.data, auth.displayName, auth.userId, userLabel, selected],
  );
  const statusFilterOptions = enumPickerOptions(["ACTIVE", "INACTIVE"]);
  const typeFilterOptions = enumPickerOptions(["PROSPECT", "CUSTOMER", "PARTNER", "VENDOR"]);
  const regionFilterOptions = useMemo(
    () => optionsFromPairs((regionsQuery.data ?? []).map((region) => ({ value: region.id, label: region.name }))),
    [regionsQuery.data],
  );
  const activeFilterCount = [search, statusFilter, typeFilter, industryFilter, regionFilter].filter(Boolean)
    .length;

  async function handleAccountCreated(account: Account, mode: "save" | "saveAndNew") {
    await queryClient.invalidateQueries({ queryKey: ["crm", "accounts"] });
    if (mode === "save") {
      setShowForm(false);
      setShowEdit(false);
      setSelected(account);
    }
  }

  function openCreate() {
    setSelected(null);
    setShowForm(true);
  }

  const ownerOptions = useMemo(
    () =>
      buildOwnerOptions(usersQuery.data, {
        userId: auth.userId,
        displayName: auth.displayName,
      }),
    [usersQuery.data, auth.displayName, auth.userId],
  );

  return (
    <>
      {(showForm && canCreate) || (showEdit && selected && canUpdate) ? (
        <AccountCreateView
          regions={(regionsQuery.data ?? []).map((region) => ({ id: region.id, name: region.name }))}
          users={ownerOptions}
          accounts={(accountsQuery.data ?? []).map((account) => ({ id: account.id, name: account.name }))}
          defaultOwnerId={auth.userId}
          defaultRegionId={auth.regionIds[0]}
          account={showEdit ? selected ?? undefined : undefined}
          onCancel={() => {
            setShowForm(false);
            setShowEdit(false);
          }}
          onCreated={(account, mode) => void handleAccountCreated(account, mode)}
        />
      ) : selected ? (
        <RecordShell
          layout="page"
          title={selected.name}
          subtitle={selected.accountType}
          avatarLabel={selected.name}
          avatarVariant="building"
          status={<StatusBadge status={selected.status} />}
          recordKey={selected.id}
          onBack={recordNav.goBack}
          onPrev={recordNav.goPrev}
          onNext={recordNav.goNext}
          hasPrev={recordNav.hasPrev}
          hasNext={recordNav.hasNext}
          relatedLinks={[...DEFAULT_RELATED_LINKS]}
          primaryAction={canUpdate ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowEdit(true)}>
              Edit account
            </button>
          ) : null}
          tabs={[
            {
              id: "overview",
              label: "Overview",
              content: (
                <>
                  <p className="small mb-3">Email: {selected.email ?? "—"}</p>
                  <p className="small mb-0">Phone: {selected.phone ?? "—"}</p>
                </>
              ),
            },
            {
              id: "related",
              label: "Related",
              content: (
                <>
                  {(relatedListsQuery.data ?? []).map((rl) => {
                    if (rl.childTableCode === "contact") {
                      return (
                        <div key={rl.id} className="mb-3">
                          <h2 className="h6">{rl.label}</h2>
                          <ul className="small mb-0">
                            {(contactsQuery.data ?? []).map((c) => (
                              <li key={c.id}>
                                {rl.columns?.length
                                  ? rl.columns
                                      .map((col) => String((c as unknown as Record<string, unknown>)[col.field] ?? ""))
                                      .filter(Boolean)
                                      .join(" · ")
                                  : `${c.firstName} ${c.lastName}`}
                              </li>
                            ))}
                            {!contactsQuery.data?.length ? (
                              <li className="text-muted">No linked contacts</li>
                            ) : null}
                          </ul>
                        </div>
                      );
                    }
                    if (rl.childTableCode === "deal") {
                      return (
                        <div key={rl.id} className="mb-3">
                          <h2 className="h6">{rl.label}</h2>
                          <ul className="small mb-0">
                            {(dealsQuery.data ?? []).map((d) => (
                              <li key={d.id}>
                                {d.name} — <StatusBadge status={d.stage} />
                              </li>
                            ))}
                            {!dealsQuery.data?.length ? (
                              <li className="text-muted">No linked deals</li>
                            ) : null}
                          </ul>
                        </div>
                      );
                    }
                    if (rl.childTableCode === "activity" && canViewActivities) {
                      return (
                        <div key={rl.id} className="mb-3">
                          <h2 className="h6">{rl.label}</h2>
                          <ul className="small mb-0">
                            {(activitiesQuery.data ?? []).map((a) => (
                              <li key={a.id}>
                                {a.subject} — <StatusBadge status={a.status} />
                              </li>
                            ))}
                            {!activitiesQuery.data?.length ? (
                              <li className="text-muted">No activities</li>
                            ) : null}
                          </ul>
                        </div>
                      );
                    }
                    if (rl.childTableCode === "project" && canViewProjects) {
                      return (
                        <div key={rl.id} className="mb-3">
                          <h2 className="h6">{rl.label}</h2>
                          <ul className="small mb-0">
                            {(projectsQuery.data ?? []).map((p) => (
                              <li key={p.id}>
                                {p.name} — <StatusBadge status={p.status} />
                                {p.health ? (
                                  <>
                                    {" "}
                                    · <StatusBadge status={p.health} />
                                  </>
                                ) : null}
                              </li>
                            ))}
                            {!projectsQuery.data?.length ? (
                              <li className="text-muted">No linked projects</li>
                            ) : null}
                          </ul>
                        </div>
                      );
                    }
                    if (rl.childTableCode === "document" && canViewDocs) {
                      return (
                        <div key={rl.id} className="mb-3">
                          <h2 className="h6">{rl.label}</h2>
                          <ul className="small mb-0">
                            {(docsQuery.data ?? []).map((d) => (
                              <li key={d.id}>
                                {d.fileName}
                                {d.visibility ? ` — ${d.visibility}` : ""}
                              </li>
                            ))}
                            {!docsQuery.data?.length ? (
                              <li className="text-muted">No documents</li>
                            ) : null}
                          </ul>
                        </div>
                      );
                    }
                    if (rl.childTableCode === "note" && canViewNotes) {
                      return (
                        <div key={rl.id} className="mb-3">
                          <h2 className="h6">{rl.label}</h2>
                          <ul className="small mb-0">
                            {(notesQuery.data ?? []).map((n) => (
                              <li key={n.id}>{n.body}</li>
                            ))}
                            {!notesQuery.data?.length ? (
                              <li className="text-muted">No notes</li>
                            ) : null}
                          </ul>
                        </div>
                      );
                    }
                    return null;
                  })}
                  {!relatedListsQuery.data?.length ? (
                    <p className="text-muted small mb-0">No related lists configured.</p>
                  ) : null}
                </>
              ),
            },
            {
              id: "timeline",
              label: "Timeline",
              visible: canViewActivities || canViewAudit,
              content: <TechEarnestRecordTimeline entries={timelineEntries} />,
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
                <ul className="small mb-0">
                  {(docsQuery.data ?? []).map((d) => (
                    <li key={d.id}>{d.fileName}</li>
                  ))}
                  {!docsQuery.data?.length ? <li className="text-muted">No documents</li> : null}
                </ul>
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
      ) : (
    <ModuleListShell
      title="Accounts"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Accounts</span>}
      toolbarActions={
        <button
          type="button"
          className={`btn btn-sm ${filterOpen ? "btn-primary" : "btn-outline-secondary"}`}
          onClick={() => setFilterOpen((o) => !o)}
        >
          Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </button>
      }
      primaryAction={
        canCreate ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openCreate()}>
            Create Account
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Accounts by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or email"
            />
          </div>
          <div className="module-filter-section">
            <h3>Filter by fields</h3>
            <TechEarnestFilterSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusFilterOptions}
              searchPlaceholder="Search Status"
            />
            <TechEarnestFilterSelect
              label="Type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={typeFilterOptions}
              searchPlaceholder="Search Types"
            />
            <label className="form-label small mb-1">Industry</label>
            <input
              className="form-control form-control-sm mb-2"
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              placeholder="e.g. Technology"
            />
            <TechEarnestFilterSelect
              label="Region"
              value={regionFilter}
              onChange={setRegionFilter}
              options={regionFilterOptions}
              searchPlaceholder="Search Regions"
            />
          </div>
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {accountsQuery.isLoading ? <LoadingState label="Loading accounts..." /> : null}
      {accountsQuery.error ? <ErrorState title="Unable to load accounts" message="Try again." /> : null}

      {!accountsQuery.isLoading && !accountsQuery.error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <ModuleListTable
                tableCode="account"
                defaultColumns={[
                  { field: "name", label: "Account Name" },
                  { field: "accountType", label: "Type" },
                  { field: "email", label: "Email" },
                  { field: "phone", label: "Phone" },
                  { field: "status", label: "Status" },
                ]}
                rows={rows}
                rowKey={(account) => account.id}
                selectedRowKey={(selected as Account | null)?.id}
                onRowClick={setSelected}
                renderCell={(account, field) =>
                  field === "status" ? (
                    <StatusBadge status={account.status} />
                  ) : (() => {
                      const value = (account as unknown as Record<string, unknown>)[field];
                      return value == null || value === "" ? "—" : String(value);
                    })()
                }
                nameFields={["name"]}
                emptyMessage="No accounts match the current filters."
            />
          ) : (
            <div className="module-tile-grid">
              {rows.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  className={`module-tile text-start${(selected as Account | null)?.id === account.id ? " is-selected" : ""}`}
                  onClick={() => setSelected(account)}
                >
                  <div className="tile-title">{account.name}</div>
                  <div className="small text-muted">
                    {account.accountType} · {account.status}
                  </div>
                </button>
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
