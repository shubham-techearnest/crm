import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ModuleFilterField, ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { listPlatformOrganizations } from "./platformOrgApi";

export function PlatformOrganizationsPage() {
  const navigate = useNavigate();
  const [filterOpen, setFilterOpen] = useState(true);
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
      toolbarActions={
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => setFilterOpen((v) => !v)}
        >
          {filterOpen ? "Hide filters" : "Filters"}
        </button>
      }
      primaryAction={
        <Link to="/platform/organizations/new" className="btn btn-primary btn-sm">
          Create organization
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
          <table className="table table-sm table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Timezone</th>
                <th>Currency</th>
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
                  <td className="fw-medium">{org.name}</td>
                  <td className="text-muted">{org.slug}</td>
                  <td>
                    <StatusBadge status={org.status} />
                  </td>
                  <td>{org.timezone}</td>
                  <td>{org.currencyCode}</td>
                  <td className="text-end">
                    <Link
                      to={`/platform/organizations/${org.id}`}
                      className="btn btn-outline-secondary btn-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted text-center py-4">
                    No organizations match the filters.
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
