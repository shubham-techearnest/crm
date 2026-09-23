import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { getPlatformOrganization, setPlatformOrganizationStatus } from "./platformOrgApi";

type Tab = "overview" | "users" | "audit";

export function PlatformOrganizationDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["platform", "organizations", id],
    queryFn: () => getPlatformOrganization(id),
    enabled: Boolean(id),
  });

  const statusMutation = useMutation({
    mutationFn: (status: "ACTIVE" | "SUSPENDED") => setPlatformOrganizationStatus(id, status),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
    },
    onError: (err: Error) => setActionError(err.message || "Status update failed"),
  });

  if (query.isLoading) {
    return <LoadingState label="Loading organization…" />;
  }
  if (query.isError || !query.data) {
    return <ErrorState title="Organization not found" />;
  }

  const org = query.data;
  const suspended = org.status === "SUSPENDED";

  return (
    <div>
      <Link to="/platform/organizations" className="small">
        ← Organizations
      </Link>
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mt-2 mb-3">
        <div>
          <h1 className="h3 mb-1">{org.name}</h1>
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted">{org.slug}</span>
            <StatusBadge status={org.status} />
          </div>
        </div>
        <div className="d-flex gap-2">
          {suspended ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate("ACTIVE")}
            >
              Activate
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              disabled={statusMutation.isPending}
              onClick={() => {
                if (window.confirm(`Suspend ${org.name}? Users in this org will not be able to sign in.`)) {
                  statusMutation.mutate("SUSPENDED");
                }
              }}
            >
              Suspend
            </button>
          )}
        </div>
      </div>

      {actionError ? <div className="alert alert-danger py-2">{actionError}</div> : null}

      <ul className="nav nav-tabs mb-3">
        {(
          [
            ["overview", "Overview"],
            ["users", "Users"],
            ["audit", "Audit"],
          ] as const
        ).map(([key, label]) => (
          <li className="nav-item" key={key}>
            <button
              type="button"
              className={`nav-link${tab === key ? " active" : ""}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>

      {tab === "overview" ? (
        <div className="row g-3">
          <div className="col-md-6">
            <div className="border rounded p-3 h-100">
              <h2 className="h6">Settings</h2>
              <dl className="row mb-0 small">
                <dt className="col-5 text-muted">Timezone</dt>
                <dd className="col-7">{org.timezone}</dd>
                <dt className="col-5 text-muted">Locale</dt>
                <dd className="col-7">{org.locale}</dd>
                <dt className="col-5 text-muted">Currency</dt>
                <dd className="col-7">{org.currencyCode}</dd>
                <dt className="col-5 text-muted">Email</dt>
                <dd className="col-7">{org.email || "—"}</dd>
                <dt className="col-5 text-muted">Phone</dt>
                <dd className="col-7">{org.phone || "—"}</dd>
              </dl>
            </div>
          </div>
          <div className="col-md-6">
            <div className="border rounded p-3 h-100">
              <h2 className="h6">Usage</h2>
              <div className="row g-2">
                <div className="col-6">
                  <div className="bg-light rounded p-2">
                    <div className="text-muted small">Users</div>
                    <div className="fs-4 fw-semibold">{org.userCount ?? "—"}</div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="bg-light rounded p-2">
                    <div className="text-muted small">Regions</div>
                    <div className="fs-4 fw-semibold">{org.regionCount ?? "—"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "users" ? (
        <div className="border rounded p-3">
          <p className="mb-1">
            <strong>{org.userCount ?? 0}</strong> users in this organization (aggregate).
          </p>
          <p className="text-muted small mb-0">
            Per-user management stays inside the tenant app after Org Admin signs in. Platform Console does not edit
            tenant CRM data.
          </p>
        </div>
      ) : null}

      {tab === "audit" ? (
        <div className="border rounded p-3">
          <p className="text-muted small mb-0">
            Organization create/status changes are written to audit logs. A dedicated platform audit browser ships with
            a later sprint; use tenant Audit Logs after signing in as Org Admin for in-org actions.
          </p>
        </div>
      ) : null}
    </div>
  );
}
