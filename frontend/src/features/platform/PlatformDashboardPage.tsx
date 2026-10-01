import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { NavIcon } from "@/components/NavIcon/NavIcon";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { formatDate } from "@/features/admin/adminKit";
import { fetchPlatformDashboard } from "./platformApi";
import { listPlatformOrganizations } from "./platformOrgApi";

const SETUP_STEPS = [
  {
    title: "Register an organization",
    text: "Set the organization admin email and password, and choose its sidebar modules.",
  },
  {
    title: "Fine-tune access",
    text: "From the organization page, adjust modules, roles, table ACL, field ACL and Metadata Studio.",
  },
  {
    title: "Hand over to the org admin",
    text: "The admin signs in, invites users and works with leads, projects and resources you enabled.",
  },
];

export function PlatformDashboardPage() {
  const dashboardQuery = useQuery({ queryKey: ["platform", "dashboard"], queryFn: fetchPlatformDashboard });
  const orgsQuery = useQuery({
    queryKey: ["platform", "organizations", "recent"],
    queryFn: () => listPlatformOrganizations({ size: 100 }),
  });
  const recent = [...(orgsQuery.data?.items ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
  const metrics = dashboardQuery.data;

  return (
    <div className="platform-page">
      <div className="platform-page-head">
        <div>
          <h1 className="platform-page-title">Platform dashboard</h1>
          <p className="platform-page-subtitle">Register organizations and control what each one can use.</p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/platform/organizations" className="btn btn-light border btn-sm">
            All organizations
          </Link>
          <Link to="/platform/organizations/new" className="btn btn-primary btn-sm">
            Register organization
          </Link>
        </div>
      </div>

      {dashboardQuery.isError ? (
        <div className="alert alert-danger py-2">Unable to load platform metrics. You may not have platform access.</div>
      ) : null}

      <div className="platform-stats">
        <Kpi label="Organizations" value={metrics?.orgCount} icon="accounts" />
        <Kpi label="Active" value={metrics?.activeOrgCount} icon="approvals" />
        <Kpi label="Suspended" value={metrics?.suspendedOrgCount} icon="acl" />
        <Kpi label="Active users" value={metrics?.activeUserCount} icon="users" />
      </div>

      <div className="row g-3">
        <div className="col-xl-8">
          <section className="platform-card h-100">
            <div className="platform-card-head">
              <h2 className="platform-card-title mb-0">Recently registered</h2>
              <Link to="/platform/organizations" className="small">
                View all
              </Link>
            </div>
            {orgsQuery.isLoading ? <LoadingState label="Loading organizations…" /> : null}
            {orgsQuery.data && recent.length === 0 ? (
              <p className="text-muted small mb-0">
                No organizations yet. <Link to="/platform/organizations/new">Register the first one</Link>.
              </p>
            ) : null}
            <ul className="platform-recent-list">
              {recent.map((org) => (
                <li key={org.id}>
                  <Link to={`/platform/organizations/${org.id}`}>
                    <span className="platform-org-avatar platform-org-avatar--sm" aria-hidden>
                      {org.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="flex-grow-1 min-w-0">
                      <span className="d-block fw-semibold text-truncate">{org.name}</span>
                      <span className="d-block small text-muted text-truncate">
                        {org.userCount ?? 0} users · {org.enabledModuleCount ?? "—"} modules · created{" "}
                        {formatDate(org.createdAt)}
                      </span>
                    </span>
                    <StatusBadge status={org.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="col-xl-4">
          <section className="platform-card h-100">
            <h2 className="platform-card-title">Onboarding a new organization</h2>
            <ol className="platform-steps-list">
              {SETUP_STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className="platform-steps-index">{index + 1}</span>
                  <div>
                    <div className="fw-semibold">{step.title}</div>
                    <div className="small text-muted">{step.text}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number | undefined; icon: string }) {
  return (
    <div className="platform-stat">
      <NavIcon name={icon} colored />
      <div>
        <div className="platform-stat-value">{value == null ? "—" : value.toLocaleString()}</div>
        <div className="platform-stat-label">{label}</div>
      </div>
    </div>
  );
}
