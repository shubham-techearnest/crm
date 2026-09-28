import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { portalLogin, PORTAL_ACCESS_TOKEN_KEY } from "./portalApi";

export function PortalLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("portal@horizon-retail.example.com");
  const [password, setPassword] = useState("ChangeMe!123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <form
        className="card shadow-sm p-4"
        style={{ width: 420 }}
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setError(null);
          try {
            const token = await portalLogin({ email, password });
            window.localStorage.setItem(PORTAL_ACCESS_TOKEN_KEY, token.accessToken);
            navigate("/portal");
          } catch {
            setError("Invalid portal credentials.");
          } finally {
            setLoading(false);
          }
        }}
      >
        <h1 className="h4 mb-1">Customer Portal</h1>
        <p className="text-muted small mb-4">Sign in to view your projects, invoices, and documents.</p>
        {error ? <div className="alert alert-danger py-2">{error}</div> : null}
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label">Password</label>
          <input
            className="form-control"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary w-100" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
