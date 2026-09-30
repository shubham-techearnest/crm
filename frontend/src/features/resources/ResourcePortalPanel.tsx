import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { isAxiosError } from "axios";
import { RecordSection } from "@/components/RecordShell";
import { useHasPermission } from "@/features/auth/AuthContext";
import { mondayOf } from "@/features/timesheets/timesheetApi";
import {
  getPortalAccess,
  inviteToPortal,
  issueTimesheetLink,
  isExternalType,
  revokePortalAccess,
  updatePortalAccess,
  type Resource,
  type TimesheetLinkIssued,
} from "./resourceApi";

const LOGIN_BADGES: Record<string, { label: string; className: string }> = {
  NONE: { label: "No login", className: "bg-secondary" },
  INVITED: { label: "Invited", className: "bg-info text-dark" },
  ACTIVE: { label: "Portal active", className: "bg-success" },
  EXPIRED: { label: "Access expired", className: "bg-warning text-dark" },
  DEACTIVATED: { label: "Deactivated", className: "bg-dark" },
};

export function LoginStatusBadge({ status }: { status: string | null | undefined }) {
  const badge = LOGIN_BADGES[status ?? "NONE"] ?? { label: status ?? "—", className: "bg-secondary" };
  return <span className={`badge ${badge.className}`}>{badge.label}</span>;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function isoDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

function previousMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return mondayOf(d);
}

function CopyableLink({ url, note }: { url: string; note: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border rounded p-2 bg-light small mt-2">
      <div className="text-muted mb-1">{note}</div>
      <div className="input-group input-group-sm">
        <input className="form-control" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/** Portal login and weekly timesheet-link controls for one resource. */
export function ResourcePortalPanel({ resource }: { resource: Resource }) {
  const queryClient = useQueryClient();
  const canInvite = useHasPermission("RESOURCE_PORTAL_INVITE");
  const canSendLink = useHasPermission("TIMESHEET_LINK_SEND");
  const [inviteEmail, setInviteEmail] = useState(resource.email ?? "");
  const [expiresOn, setExpiresOn] = useState(isoDate(resource.engagementEndDate));
  const [weekStart, setWeekStart] = useState(previousMonday());
  const [sendEmail, setSendEmail] = useState(true);
  const [issuedLink, setIssuedLink] = useState<TimesheetLinkIssued | null>(null);
  const [inviteUrl, setInviteUrl] = useState<{ url: string; emailed: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accessQuery = useQuery({
    queryKey: ["resources", resource.id, "portal-access"],
    queryFn: () => getPortalAccess(resource.id),
  });
  const access = accessQuery.data;
  const status = access?.loginStatus ?? resource.loginStatus;
  const hasOtherLogin = access ? !access.portalManaged : false;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["resources"] });
  };

  const inviteMutation = useMutation({
    mutationFn: () =>
      inviteToPortal(resource.id, {
        email: inviteEmail.trim() || undefined,
        accessExpiresOn: expiresOn || null,
      }),
    onSuccess: async (result) => {
      setError(null);
      setInviteUrl(result.inviteUrl ? { url: result.inviteUrl, emailed: result.emailed } : null);
      await refresh();
    },
    onError: (e) => setError(errorMessage(e, "Could not send the invitation.")),
  });

  const expiryMutation = useMutation({
    mutationFn: () => updatePortalAccess(resource.id, expiresOn),
    onSuccess: async () => {
      setError(null);
      await refresh();
    },
    onError: (e) => setError(errorMessage(e, "Could not update access.")),
  });

  const revokeMutation = useMutation({
    mutationFn: () => revokePortalAccess(resource.id),
    onSuccess: async () => {
      setError(null);
      setInviteUrl(null);
      await refresh();
    },
    onError: (e) => setError(errorMessage(e, "Could not revoke access.")),
  });

  const linkMutation = useMutation({
    mutationFn: () => issueTimesheetLink(resource.id, { weekStartDate: weekStart, sendEmail }),
    onSuccess: (result) => {
      setError(null);
      setIssuedLink(result);
    },
    onError: (e) => setError(errorMessage(e, "Could not create the timesheet link.")),
  });

  const noLogin = status === "NONE" || !resource.userId;

  return (
    <>
      {error ? <div className="alert alert-danger py-2 small">{error}</div> : null}

      <RecordSection title="Portal login">
        <div className="d-flex align-items-center gap-2 mb-2 small">
          <LoginStatusBadge status={status} />
          {access?.email ? <span className="text-muted">{access.email}</span> : null}
          {access?.accessExpiresAt ? (
            <span className="text-muted">· access until {formatDate(access.accessExpiresAt)}</span>
          ) : null}
        </div>
        <p className="small text-muted mb-2">
          A portal login lets this person sign in to fill in their own timesheets and see their projects and tasks
          (My Work) — nothing else. Access ends automatically on the expiry date.
        </p>

        {!isExternalType(resource.resourceType) ? (
          <p className="small mb-0">
            Internal employees sign in with their own user account; portal logins are for contractors and freelancers.
          </p>
        ) : hasOtherLogin ? (
          <p className="small mb-0">This resource is linked to a regular user account; manage it under Users.</p>
        ) : canInvite ? (
          <div className="row g-2 align-items-end">
            {noLogin ? (
              <div className="col-md-5">
                <label className="form-label small mb-1">Email</label>
                <input
                  type="email"
                  className="form-control form-control-sm"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>
            ) : null}
            <div className="col-md-4">
              <label className="form-label small mb-1">Access expires on</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={expiresOn}
                onChange={(e) => setExpiresOn(e.target.value)}
              />
            </div>
            <div className="col-md-auto d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={inviteMutation.isPending || (noLogin && !inviteEmail.trim())}
                onClick={() => inviteMutation.mutate()}
              >
                {noLogin ? "Invite to portal" : "Resend invitation"}
              </button>
              {!noLogin && status !== "DEACTIVATED" ? (
                <>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={!expiresOn || expiryMutation.isPending}
                    onClick={() => expiryMutation.mutate()}
                  >
                    Change expiry
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    disabled={revokeMutation.isPending}
                    onClick={() => {
                      if (window.confirm("Revoke portal access for this resource?")) revokeMutation.mutate();
                    }}
                  >
                    Revoke
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        {inviteUrl ? (
          <CopyableLink
            url={inviteUrl.url}
            note={
              inviteUrl.emailed
                ? "Invitation emailed. You can also share this link directly:"
                : "Share this link so they can set a password:"
            }
          />
        ) : null}
      </RecordSection>

      {canSendLink && noLogin ? (
        <RecordSection title="Timesheet link (no login needed)">
          <p className="small text-muted mb-2">
            Sends a one-time secure link for a single week. The person fills in hours for their allocated projects and
            submits; it then goes through normal approval. Links are also emailed automatically every Monday for last
            week to allocated resources with an email and no login.
          </p>
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label small mb-1">Week starting (Monday)</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value ? mondayOf(new Date(`${e.target.value}T00:00:00`)) : "")}
              />
            </div>
            <div className="col-md-auto">
              <div className="form-check small mb-1">
                <input
                  id="send-link-email"
                  type="checkbox"
                  className="form-check-input"
                  checked={sendEmail}
                  disabled={!resource.email}
                  onChange={(e) => setSendEmail(e.target.checked)}
                />
                <label htmlFor="send-link-email" className="form-check-label">
                  {resource.email ? `Email to ${resource.email}` : "No email on file"}
                </label>
              </div>
            </div>
            <div className="col-md-auto">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                disabled={!weekStart || linkMutation.isPending}
                onClick={() => linkMutation.mutate()}
              >
                Create timesheet link
              </button>
            </div>
          </div>
          {issuedLink ? (
            <CopyableLink
              url={issuedLink.url}
              note={`${issuedLink.emailed ? `Emailed to ${issuedLink.email}. ` : ""}Link for the week of ${formatDate(
                issuedLink.weekStartDate,
              )}, valid until ${formatDate(issuedLink.expiresAt)}:`}
            />
          ) : null}
        </RecordSection>
      ) : null}
    </>
  );
}
