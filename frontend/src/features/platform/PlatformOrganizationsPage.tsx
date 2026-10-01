import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ModuleFilterField, ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { formatDate } from "@/features/admin/adminKit";
import { listPlatformOrganizations } from "./platformOrgApi";

export function PlatformOrganizationsPage() {
  const navigate = useNavigate();
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");

  const query = useQuery({
    queryKey: ["platform", "organizations", appliedSearch, appliedStatus],
    queryFn: () =>
      listPlatformOrganizations({
        search: appliedSearch || undefined,
        status: appliedStatus || undefined,
      }),
  });

  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? 0;

  return (
    <ModuleListShell
      title="Organizations"
      filterOpen={filterOpen}
      filterToggle={{ onToggle: () => setFilterOpen((open) => !open) }}
      primaryAction={
        <Link to="/platform/organizations/new" className="btn btn-primary btn-sm">
          Register organization
        </Link>
      }
      filterPanel={
        <div className="module-filter-section">
          <ModuleFilterField label="Name / slug" htmlFor="platformOrgSearchFilter">
            <input
              id="platformOrgSearchFilter"
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
            />
          </ModuleFilterField>
          <ModuleFilterField label="Status" htmlFor="platformOrgStatusFilter">
            <select
              id="platformOrgStatusFilter"
              className="form-select form-select-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </ModuleFilterField>
          <button
            type="button"
            className="btn btn-primary btn-sm w-100"
            onClick={() => {
              setAppliedSearch(search.trim());
              setAppliedStatus(status);
            }}
          >
            Apply
          </button>
        </div>
      }
      activeFilterCount={[appliedSearch, appliedStatus].filter(Boolean).length}
      onClearFilters={() => {
        setSearch("");
        setStatus("");
        setAppliedSearch("");
        setAppliedStatus("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span className="small text-muted">{total} organizations</span>}
    >
      {query.isLoading ? <LoadingState label="Loading organizations…" /> : null}
      {query.isError ? <ErrorState title="Could not load organizations" message="Try again in a moment." /> : null}
      {!query.isLoading && !query.isError ? (
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 platform-org-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Status</th>
                <th className="text-end">Users</th>
                <th>Modules</th>
                <th>Locale</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((org) => (
                <tr
                  key={org.id}
                  role="button"
                  onClick={() => navigate(`/platform/organizations/${org.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span className="platform-org-avatar platform-org-avatar--sm" aria-hidden>
                        {org.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="fw-semibold text-truncate">{org.name}</div>
                        <div className="small text-muted text-truncate">{org.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={org.status} />
                  </td>
                  <td className="text-end">{org.userCount ?? "—"}</td>
                  <td>
                    {org.enabledModuleCount != null ? (
                      <span className="platform-module-count">{org.enabledModuleCount} enabled</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="small text-muted">
                    {org.timezone} · {org.currencyCode}
                  </td>
                  <td className="small text-muted">{formatDate(org.createdAt)}</td>
                  <td className="text-end text-nowrap">
                    <Link
                      to={`/platform/organizations/${org.id}?section=modules`}
                      className="btn btn-light border btn-sm me-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Modules
                    </Link>
                    <Link
                      to={`/platform/organizations/${org.id}`}
                      className="btn btn-outline-primary btn-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-muted text-center py-5">
                    {appliedSearch || appliedStatus ? (
                      "No organizations match the filters."
                    ) : (
                      <>
                        No organizations yet.{" "}
                        <Link to="/platform/organizations/new">Register the first one</Link>.
                      </>
                    )}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </ModuleListShell>
  );
}
