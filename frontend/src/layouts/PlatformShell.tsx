import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { PLATFORM_NAV_SECTIONS, navItemForLocation, pageTitleForLocation } from "@/constants/nav";
import { NavIcon } from "@/components/NavIcon/NavIcon";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";
import { logout } from "@/features/auth/authApi";
import { useAuth } from "@/features/auth/AuthContext";

export function PlatformShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuth();
  const { pathname, search } = useLocation();
  const pageTitle = pageTitleForLocation(pathname, search, PLATFORM_NAV_SECTIONS);
  const pageIcon = navItemForLocation(pathname, search, PLATFORM_NAV_SECTIONS)?.icon;

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
          <span className="app-brand-name">Platform Console</span>
        </div>
        <nav className="app-sidebar-nav" aria-label="Platform">
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
                  <NavIcon name={item.icon} colored />
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
          <div className="app-topbar-left">
            <button
              type="button"
              className="app-topbar-icon-btn d-lg-none"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <ToolbarIcon name="menu" />
            </button>
            <div className="app-topbar-page">
              {pageIcon ? <NavIcon name={pageIcon} colored /> : null}
              <span className="app-topbar-title" title={pageTitle}>
                {pageTitle}
              </span>
            </div>
          </div>
          <div className="app-topbar-right">
            <div className="app-topbar-account">
              <span className="app-topbar-avatar" title={user.displayName} aria-hidden="true">
                {user.displayName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() ?? "")
                  .join("")}
              </span>
              <span className="app-topbar-user d-none d-sm-inline">{user.displayName}</span>
              <button
                type="button"
                className="btn btn-link btn-sm app-topbar-signout"
                onClick={signOut}
                disabled={signingOut}
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
