import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { NAV_SECTIONS, QUICK_CREATE_ITEMS } from "@/constants/nav";
import { PermissionGuard } from "@/components/PermissionGuard/PermissionGuard";
import { GlobalSearch } from "@/components/GlobalSearch/GlobalSearch";
import { NotificationsMenu } from "@/components/NotificationsMenu/NotificationsMenu";
import { logout } from "@/features/auth/authApi";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { getMyTableAcls } from "@/features/admin/studio/metadataApi";

function parseNavTo(to: string) {
  const [pathname, search = ""] = to.split("?");
  return search ? { pathname, search: `?${search}` } : pathname;
}

function isNavActive(pathname: string, search: string, itemTo: string): boolean {
  const [itemPath, itemSearch = ""] = itemTo.split("?");
  if (pathname !== itemPath) {
    return false;
  }
  if (!itemSearch) {
    // Exact module root — avoid marking Activities active when ?type=TASK
    return !search || search === "?" || search === "";
  }
  return search.includes(itemSearch);
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [moduleQuery, setModuleQuery] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuth();
  const tableAclsQuery = useQuery({
    queryKey: ["metadata", "table-acls", "me"],
    queryFn: getMyTableAcls,
    staleTime: 60_000,
    retry: false,
  });

  async function signOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      queryClient.clear();
      navigate("/login", { replace: true });
    }
  }

  const q = moduleQuery.trim().toLowerCase();
  const tableAcls = tableAclsQuery.data;

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
          <span>TechEarnest CRM</span>
        </div>
        <nav className="pb-4" aria-label="Primary">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter((item) => {
              if (item.disabled) return false;
              if (q && !item.label.toLowerCase().includes(q)) return false;
              if (item.tableCode && tableAcls) {
                const read = tableAcls[item.tableCode]?.read;
                if (read === false) return false;
              }
              return true;
            });
            if (visibleItems.length === 0) {
              return null;
            }
            return (
              <div key={section.title}>
                <div className="nav-section-label">{section.title}</div>
                {section.title === "Modules" ? (
                  <div className="module-search">
                    <input
                      className="form-control form-control-sm"
                      placeholder="Search modules"
                      value={moduleQuery}
                      onChange={(e) => setModuleQuery(e.target.value)}
                      aria-label="Search modules"
                    />
                  </div>
                ) : null}
                {visibleItems.map((item) => {
                  const link = (
                    <NavLink
                      key={item.to}
                      to={item.comingSoon ? item.to : parseNavTo(item.to)}
                      end={item.to === "/"}
                      className={() => {
                        const active = isNavActive(location.pathname, location.search, item.to);
                        return `nav-link${active ? " active" : ""}${item.comingSoon ? " coming-soon" : ""}`;
                      }}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span>{item.label}</span>
                      {item.comingSoon ? <span className="nav-badge">Soon</span> : null}
                    </NavLink>
                  );
                  if (!item.permissions?.length) {
                    return link;
                  }
                  return (
                    <PermissionGuard key={item.to} anyOf={item.permissions}>
                      {link}
                    </PermissionGuard>
                  );
                })}
              </div>
            );
          })}
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
            <span className="text-muted small d-none d-md-inline">{user.dataScope.replaceAll("_", " ")}</span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <GlobalSearch />
            <div className="dropdown">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                aria-expanded={quickOpen}
                onClick={() => setQuickOpen((v) => !v)}
                title="Quick create"
              >
                +
              </button>
              {quickOpen ? (
                <div className="dropdown-menu show quick-create-menu dropdown-menu-end">
                  {QUICK_CREATE_ITEMS.map((item) => (
                    <QuickCreateItem
                      key={item.to}
                      label={item.label}
                      to={item.to}
                      permissions={item.permissions}
                      onPick={() => setQuickOpen(false)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <NotificationsMenu />
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

function QuickCreateItem({
  label,
  to,
  permissions,
  onPick,
}: {
  label: string;
  to: string;
  permissions: string[];
  onPick: () => void;
}) {
  const allowed = useHasPermission(permissions);
  if (!allowed) {
    return null;
  }
  return (
    <Link className="dropdown-item" to={to} onClick={onPick}>
      {label}
    </Link>
  );
}
