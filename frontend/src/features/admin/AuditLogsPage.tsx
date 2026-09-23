import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { listAuditLogs, listRegions, listUsers } from "./adminApi";

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "REJECT",
  "ASSIGN",
  "CONVERT",
  "LOGIN",
  "LOGOUT",
  "PUBLISH",
  "UPSERT",
  "SAVE_DRAFT",
] as const;

export function AuditLogsPage() {
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch } = useModuleWorkspace();
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const listParams = useMemo(
    () => ({
      action: actionFilter || undefined,
      entityType: entityFilter || undefined,
      userId: userFilter || undefined,
      regionId: regionFilter || undefined,
      from: fromDate ? new Date(fromDate).toISOString() : undefined,
      to: toDate ? new Date(`${toDate}T23:59:59.999Z`).toISOString() : undefined,
      size: 100,
    }),
    [actionFilter, entityFilter, userFilter, regionFilter, fromDate, toDate],
  );

  const auditQuery = useQuery({
    queryKey: ["admin", "audit-logs", listParams],
    queryFn: () => listAuditLogs(listParams),
  });
  const usersQuery = useQuery({ queryKey: ["admin", "users"], queryFn: () => listUsers() });
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });

  const userLabel = useMemo(() => {
    const map = new Map(
      (usersQuery.data ?? []).map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim() || u.email]),
    );
    return (id: string | null) => (id ? (map.get(id) ?? id.slice(0, 8)) : "—");
  }, [usersQuery.data]);

  const regionLabel = useMemo(() => {
    const map = new Map((regionsQuery.data ?? []).map((r) => [r.id, r.name]));
    return (id: string | null | undefined) => (id ? (map.get(id) ?? id.slice(0, 8)) : "—");
  }, [regionsQuery.data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (auditQuery.data ?? []).filter((log) => {
      if (!q) return true;
      return (
        log.action.toLowerCase().includes(q) ||
        log.entityType.toLowerCase().includes(q) ||
        (log.entityId ?? "").toLowerCase().includes(q) ||
        userLabel(log.userId).toLowerCase().includes(q)
      );
    });
  }, [auditQuery.data, search, userLabel]);

  return (
    <ModuleListShell
      title="Audit logs"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All events</span>}
      toolbarActions={
        <button
          type="button"
          className={`btn btn-sm ${filterOpen ? "btn-primary" : "btn-outline-secondary"}`}
          onClick={() => setFilterOpen((o) => !o)}
        >
          Filter
        </button>
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Audit by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Action, entity, user"
            />
          </div>
          <div className="module-filter-section">
            <h3>Filter by fields</h3>
            <label className="form-label small mb-1">Action</label>
            <select
              className="form-select form-select-sm mb-2"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All</option>
              {ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
            <label className="form-label small mb-1">Entity type</label>
            <input
              className="form-control form-control-sm mb-2"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              placeholder="e.g. LEAD, SYS_FORM_LAYOUT"
            />
            <label className="form-label small mb-1">User</label>
            <select
              className="form-select form-select-sm mb-2"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
            >
              <option value="">All</option>
              {(usersQuery.data ?? []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
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
            <label className="form-label small mb-1">From date</label>
            <input
              type="date"
              className="form-control form-control-sm mb-2"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <label className="form-label small mb-1">To date</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-link btn-sm px-0"
            onClick={() => {
              setSearch("");
              setActionFilter("");
              setEntityFilter("");
              setUserFilter("");
              setRegionFilter("");
              setFromDate("");
              setToDate("");
            }}
          >
            Clear filters
          </button>
          <p className="small text-muted mt-2 mb-0">Payload / secret fields are never shown.</p>
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {auditQuery.isLoading ? <LoadingState label="Loading audit logs..." /> : null}
      {auditQuery.error ? <ErrorState title="Unable to load audit logs" message="Try again." /> : null}

      {!auditQuery.isLoading && !auditQuery.error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <div className="module-list-table-wrap">
              <table className="table module-list-table align-middle">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Entity ID</th>
                    <th>User</th>
                    <th>Region</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((log) => (
                    <tr key={log.id}>
                      <td className="small">{new Date(log.createdAt).toLocaleString()}</td>
                      <td>{log.action}</td>
                      <td>{log.entityType}</td>
                      <td>
                        <code className="small">{log.entityId ? `${log.entityId.slice(0, 8)}…` : "—"}</code>
                      </td>
                      <td>{userLabel(log.userId)}</td>
                      <td>{regionLabel(log.regionId)}</td>
                      <td className="small text-muted" style={{ maxWidth: 280 }}>
                        {log.newValue ? (
                          <code className="small">{log.newValue.length > 120 ? `${log.newValue.slice(0, 120)}…` : log.newValue}</code>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-5">
                        No audit events match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="module-tile-grid">
              {rows.map((log) => (
                <div key={log.id} className="module-tile text-start">
                  <div className="tile-title">
                    {log.action} · {log.entityType}
                  </div>
                  <div className="small text-muted">
                    {new Date(log.createdAt).toLocaleString()} · {userLabel(log.userId)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </ModuleListShell>
  );
}
