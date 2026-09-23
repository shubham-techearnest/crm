import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { PLATFORM_NAV_SECTIONS } from "@/constants/nav";
import { logout } from "@/features/auth/authApi";
import { useAuth } from "@/features/auth/AuthContext";

export function PlatformShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuth();

  async function signOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      queryClient.clear();
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className="app-shell d-flex">
      {sidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop d-lg-none border-0"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside className={`app-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="app-brand">
          <span className="app-brand-mark">TE</span>
          <span>Platform Console</span>
        </div>
        <nav className="pb-4" aria-label="Platform">
          {PLATFORM_NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="nav-section-label">{section.title}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/platform"}
                  className={({ isActive }) =>
                    `nav-link${isActive ? " active" : ""}${item.comingSoon ? " coming-soon" : ""}`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <span>{item.label}</span>
                  {item.comingSoon ? <span className="nav-badge">Soon</span> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="app-main d-flex flex-column">
        <header className="app-topbar">
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-lg-none"
              onClick={() => setSidebarOpen(true)}
            >
              Menu
            </button>
            <span className="text-muted small d-none d-md-inline">PLATFORM</span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="small d-none d-sm-inline">{user.displayName}</span>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={signOut} disabled={signingOut}>
              Sign out
            </button>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
