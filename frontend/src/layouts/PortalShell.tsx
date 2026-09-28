import { NavLink, Outlet } from "react-router-dom";
import { PORTAL_ACCESS_TOKEN_KEY } from "@/features/portal/portalApi";

export function PortalShell() {
  return (
    <div className="portal-shell min-vh-100 bg-light">
      <header className="border-bottom bg-white px-4 py-3 d-flex align-items-center justify-content-between">
        <div>
          <strong>TechEarnest Customer Portal</strong>
          <div className="small text-muted">Projects, invoices, and shared documents</div>
        </div>
        <nav className="d-flex gap-3 align-items-center">
          <NavLink to="/portal" end className="text-decoration-none">
            Home
          </NavLink>
          <NavLink to="/portal/projects" className="text-decoration-none">
            Projects
          </NavLink>
          <NavLink to="/portal/invoices" className="text-decoration-none">
            Invoices
          </NavLink>
          <NavLink to="/portal/documents" className="text-decoration-none">
            Documents
          </NavLink>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => {
              window.localStorage.removeItem(PORTAL_ACCESS_TOKEN_KEY);
              window.location.href = "/portal/login";
            }}
          >
            Sign out
          </button>
        </nav>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
