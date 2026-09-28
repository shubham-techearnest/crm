import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { NAV_SECTIONS, QUICK_CREATE_ITEMS, type NavItem } from "@/constants/nav";
import { NavIcon } from "@/components/NavIcon/NavIcon";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";
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

function filterNavItems(
  items: NavItem[],
  moduleQuery: string,
  tableAcls: Record<string, { read?: boolean }> | undefined,
  primary: boolean | undefined,
) {
  const q = moduleQuery.trim().toLowerCase();
  return items.filter((item) => {
    if (item.disabled) return false;
    if (!primary && q && !item.label.toLowerCase().includes(q)) return false;
    if (item.tableCode && tableAcls) {
      const read = tableAcls[item.tableCode]?.read;
      if (read === false) return false;
    }
    return true;
  });
}

function SidebarNavItem({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate: () => void;
}) {
  const location = useLocation();
  const link = (
    <NavLink
      to={item.comingSoon ? item.to : parseNavTo(item.to)}
      end={item.to === "/"}
      className={() => {
        const active = isNavActive(location.pathname, location.search, item.to);
        return `nav-link${active ? " active" : ""}${item.comingSoon ? " coming-soon" : ""}`;
      }}
      onClick={onNavigate}
    >
      <NavIcon name={item.icon} colored />
      <span>{item.label}</span>
      {item.comingSoon ? <span className="nav-badge">Soon</span> : null}
    </NavLink>
  );

  if (!item.permissions?.length) {
    return link;
  }

  return (
    <PermissionGuard anyOf={item.permissions}>
      {link}
    </PermissionGuard>
  );
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("te-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [signingOut, setSigningOut] = useState(false);
  const [moduleQuery, setModuleQuery] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const topbarRef = useRef<HTMLElement>(null);
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

  const canViewSettings = useHasPermission("ORG_VIEW");
  const tableAcls = tableAclsQuery.data;
  const closeSidebar = () => setSidebarOpen(false);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      try {
        localStorage.setItem("te-sidebar-collapsed", next ? "1" : "0");
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }

  const userInitials = user.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  useEffect(() => {
    if (!quickOpen && !accountOpen) return;
    function onDocClick(event: MouseEvent) {
      if (topbarRef.current && !topbarRef.current.contains(event.target as Node)) {
        setQuickOpen(false);
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [quickOpen, accountOpen]);

  return (
    <div className="app-shell d-flex">
      {sidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop d-lg-none border-0"
          aria-label="Close navigation"
          onClick={closeSidebar}
        />
      ) : null}

      <aside className={`app-sidebar${sidebarOpen ? " open" : ""}${sidebarCollapsed ? " collapsed" : ""}`}>
        <div className="app-brand">
          <span className="app-brand-mark">TE</span>
          <span className="app-brand-name">TechEarnest CRM</span>
          <button
            type="button"
            className={`app-sidebar-collapse d-none d-lg-inline-flex${sidebarCollapsed ? " is-collapsed" : ""}`}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={sidebarCollapsed}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleSidebarCollapsed}
          >
            <ToolbarIcon name="sidebar" />
          </button>
        </div>
        <nav className="app-sidebar-nav" aria-label="Primary">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = filterNavItems(section.items, moduleQuery, tableAcls, section.primary);
            if (visibleItems.length === 0) {
              return null;
            }
            return (
              <div
                key={section.primary ? "primary-modules" : section.title}
                className={section.primary ? "nav-primary-block" : undefined}
              >
                {section.title ? <div className="nav-section-label">{section.title}</div> : null}
                {section.searchable ? (
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
                {visibleItems.map((item) => (
                  <SidebarNavItem key={item.to} item={item} onNavigate={closeSidebar} />
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="app-main d-flex flex-column">
        <header className="app-topbar" ref={topbarRef}>
          <div className="app-topbar-left">
            <button
              type="button"
              className="app-topbar-icon-btn d-lg-none"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <ToolbarIcon name="menu" />
            </button>
            <span className="app-topbar-scope d-none d-md-inline">{user.dataScope.replaceAll("_", " ")}</span>
          </div>

          <div className="app-topbar-center d-none d-md-flex">
            <GlobalSearch />
          </div>

          <div className="app-topbar-right">
            <div className="app-topbar-actions">
              <div className="d-md-none app-topbar-mobile-search">
                <GlobalSearch compact />
              </div>
              <div className="dropdown">
                <button
                  type="button"
                  className="app-topbar-icon-btn app-topbar-icon-btn--primary"
                  aria-expanded={quickOpen}
                  onClick={() => {
                    setQuickOpen((value) => !value);
                    setAccountOpen(false);
                  }}
                  title="Quick create"
                  aria-label="Quick create"
                >
                  <ToolbarIcon name="plus" />
                </button>
                {quickOpen ? (
                  <div className="dropdown-menu show quick-create-menu topbar-panel dropdown-menu-end">
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
              <button
                type="button"
                className="app-topbar-icon-btn d-none d-lg-inline-flex"
                title="Calendar"
                aria-label="Calendar"
              >
                <ToolbarIcon name="calendar" />
              </button>
              <NotificationsMenu />
              {canViewSettings ? (
                <Link
                  to="/admin/settings"
                  className="app-topbar-icon-btn d-none d-md-inline-flex"
                  title="Settings"
                  aria-label="Settings"
                  onClick={() => setAccountOpen(false)}
                >
                  <ToolbarIcon name="settings" />
                </Link>
              ) : null}
              <button
                type="button"
                className="app-topbar-icon-btn d-none d-xl-inline-flex"
                title="Help"
                aria-label="Help"
              >
                <ToolbarIcon name="help" />
              </button>
            </div>

            <div className="app-topbar-divider d-none d-md-block" aria-hidden="true" />

            <div className="dropdown app-topbar-account">
              <button
                type="button"
                className="app-topbar-account-btn"
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setAccountOpen((value) => !value);
                  setQuickOpen(false);
                }}
              >
                <span className="app-topbar-avatar" aria-hidden="true">
                  {userInitials}
                </span>
                <span className="app-topbar-user d-none d-lg-inline">{user.displayName}</span>
                <ToolbarIcon name="chevron-down" className="app-topbar-account-caret d-none d-lg-inline-flex" />
              </button>
              {accountOpen ? (
                <div className="dropdown-menu show topbar-panel dropdown-menu-end app-topbar-account-menu">
                  <div className="app-topbar-account-menu-head">
                    <div className="fw-semibold">{user.displayName}</div>
                    <div className="small text-muted">{user.dataScope.replaceAll("_", " ")}</div>
                  </div>
                  <button
                    type="button"
                    className="dropdown-item"
                    disabled={signingOut}
                    onClick={() => {
                      setAccountOpen(false);
                      void signOut();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
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
