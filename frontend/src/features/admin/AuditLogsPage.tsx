import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ModuleFilterDateRange,
  ModuleFilterField,
  ModuleListShell,
} from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { TechEarnestFilterSelect } from "@/components/TechEarnestCreate/TechEarnestFilterSelect";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { EntityRecordLink } from "@/components/RecordLink";
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
            <TechEarnestFilterSelect label="Action" value={actionFilter} onChange={setActionFilter} options={ACTIONS.map((value) => ({ value, label: value }))} placeholder="All actions" emptyLabel="All actions" searchPlaceholder="Search audit actions" />
            <ModuleFilterField label="Entity type" htmlFor="auditEntityFilter">
              <input
                id="auditEntityFilter"
                className="form-control form-control-sm"
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                placeholder="e.g. LEAD, SYS_FORM_LAYOUT"
              />
            </ModuleFilterField>
            <TechEarnestFilterSelect label="User" value={userFilter} onChange={setUserFilter} options={(usersQuery.data ?? []).map((user) => ({ value: user.id, label: `${user.firstName} ${user.lastName}`.trim(), subtitle: user.email ?? undefined }))} placeholder="All users" emptyLabel="All users" searchPlaceholder="Search users" />
            <TechEarnestFilterSelect label="Region" value={regionFilter} onChange={setRegionFilter} options={(regionsQuery.data ?? []).map((region) => ({ value: region.id, label: region.name }))} placeholder="All regions" emptyLabel="All regions" searchPlaceholder="Search regions" />
            <ModuleFilterDateRange
              label="Date"
              from={fromDate}
              to={toDate}
              onFromChange={setFromDate}
              onToChange={setToDate}
            />
          </div>
          <p className="small text-muted mt-2 mb-0">Payload / secret fields are never shown.</p>
        </>
      }
      activeFilterCount={
        [search.trim(), actionFilter, entityFilter, userFilter, regionFilter, fromDate, toDate].filter(Boolean).length
      }
      onClearFilters={() => {
        setSearch("");
        setActionFilter("");
        setEntityFilter("");
        setUserFilter("");
        setRegionFilter("");
        setFromDate("");
        setToDate("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {auditQuery.isLoading ? <LoadingState label="Loading audit logs..." /> : null}
      {auditQuery.error ? <ErrorState title="Unable to load audit logs" message="Try again." /> : null}

      {!auditQuery.isLoading && !auditQuery.error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <ModuleListTable
              tableCode="audit_log"
              enabled={false}
              defaultColumns={[
                { field: "createdAt", label: "When" },
                { field: "action", label: "Action" },
                { field: "entityType", label: "Entity" },
                { field: "entityId", label: "Entity ID" },
                { field: "userId", label: "User" },
                { field: "regionId", label: "Region" },
                { field: "newValue", label: "Summary" },
              ]}
              rows={rows}
              rowKey={(log) => log.id}
              renderCell={(log, field) => {
                if (field === "createdAt") return <span className="small">{new Date(log.createdAt).toLocaleString()}</span>;
                if (field === "entityId")
                  return (
                    <EntityRecordLink entityType={log.entityType} id={log.entityId}>
                      <code className="small">{log.entityId?.slice(0, 8)}…</code>
                    </EntityRecordLink>
                  );
                if (field === "userId") return userLabel(log.userId);
                if (field === "regionId") return regionLabel(log.regionId);
                if (field === "newValue") return log.newValue ? <code className="small">{log.newValue.length > 120 ? `${log.newValue.slice(0, 120)}…` : log.newValue}</code> : "—";
                const value = (log as unknown as Record<string, unknown>)[field];
                return value == null || value === "" ? "—" : String(value);
              }}
              emptyMessage="No audit events match the current filters."
            />
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
