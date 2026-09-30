import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { publicErrorMessage } from "@/api/publicClient";
import { acceptInvite, getInvite } from "./selfServiceApi";

/** Public page reached from the invitation email: the invited person chooses a password. */
export function AcceptInvitePage() {
  const { token = "" } = useParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [validation, setValidation] = useState<string | null>(null);

  const inviteQuery = useQuery({
    queryKey: ["public", "invite", token],
    queryFn: () => getInvite(token),
    retry: false,
  });
  const acceptMutation = useMutation({ mutationFn: () => acceptInvite(token, password) });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setValidation("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setValidation("Passwords do not match.");
      return;
    }
    setValidation(null);
    acceptMutation.mutate();
  }

  return (
    <div className="auth-card">
      <div className="d-flex align-items-center gap-2 mb-3">
        <span className="app-brand-mark">TE</span>
        <div>
          <div className="fw-semibold">TechEarnest CRM</div>
          <div className="text-muted small">Accept your invitation</div>
        </div>
      </div>

      {inviteQuery.isLoading ? <p className="text-muted">Checking your invitation…</p> : null}

      {inviteQuery.isError ? (
        <>
          <div className="alert alert-warning py-2">
            {publicErrorMessage(inviteQuery.error, "This invitation is invalid or has expired.")}
          </div>
          <p className="small text-muted mb-0">Ask your project manager to send a new invitation.</p>
        </>
      ) : null}

      {acceptMutation.isSuccess ? (
        <>
          <div className="alert alert-success py-2">Your password is set. You can sign in now.</div>
          <Link className="btn btn-primary w-100" to="/login">
            Go to sign in
          </Link>
        </>
      ) : inviteQuery.data ? (
        <>
          <h1 className="h5 mb-1">Welcome, {inviteQuery.data.name}</h1>
          <p className="small text-muted">
            {inviteQuery.data.organizationName ? `${inviteQuery.data.organizationName} invited you` : "You were invited"}{" "}
            to fill in your timesheets and see your assigned work. Choose a password for{" "}
            <strong>{inviteQuery.data.email}</strong>.
          </p>
          {validation || acceptMutation.isError ? (
            <div className="alert alert-danger py-2">
              {validation ?? publicErrorMessage(acceptMutation.error, "Could not set your password.")}
            </div>
          ) : null}
          <form onSubmit={onSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label" htmlFor="invite-password">
                Password
              </label>
              <input
                id="invite-password"
                type="password"
                autoComplete="new-password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="invite-confirm">
                Confirm password
              </label>
              <input
                id="invite-confirm"
                type="password"
                autoComplete="new-password"
                className="form-control"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary w-100" disabled={acceptMutation.isPending}>
              {acceptMutation.isPending ? "Saving…" : "Set password"}
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}
