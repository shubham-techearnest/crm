import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchPlatformDashboard } from "./platformApi";

export function PlatformDashboardPage() {
  const query = useQuery({
    queryKey: ["platform", "dashboard"],
    queryFn: fetchPlatformDashboard,
  });

  return (
    <div>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-4">
        <div>
          <h1 className="h3 mb-1">Platform Dashboard</h1>
          <p className="text-muted mb-0">
            Operate TechEarnest across organizations. Tenant CRM leads are not managed here.
          </p>
        </div>
        <Link to="/platform/organizations" className="btn btn-primary btn-sm">
          Organizations
        </Link>
      </div>

      {query.isLoading ? <p className="text-muted">Loading platform health…</p> : null}
      {query.isError ? (
        <div className="alert alert-danger py-2">Unable to load platform metrics. You may not have platform access.</div>
      ) : null}

      {query.data ? (
        <div className="row g-3">
          <KpiCard label="Organizations" value={query.data.orgCount} hint="All non-deleted tenants" />
          <KpiCard label="Active orgs" value={query.data.activeOrgCount} hint="Status = ACTIVE" />
          <KpiCard label="Suspended orgs" value={query.data.suspendedOrgCount} hint="Status = SUSPENDED" />
          <KpiCard label="Active users" value={query.data.activeUserCount} hint="Tenant users only (aggregate)" />
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="border rounded p-3 h-100 bg-light">
        <div className="text-muted small">{label}</div>
        <div className="fs-3 fw-semibold">{value.toLocaleString()}</div>
        <div className="text-muted small mt-1">{hint}</div>
      </div>
    </div>
  );
}
