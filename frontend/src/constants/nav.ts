export interface NavItem {
  label: string;
  to: string;
  disabled?: boolean;
  comingSoon?: boolean;
  permissions?: string[];
  /** When set, sidebar also requires table ACL read for this code. */
  tableCode?: string;
  icon?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
  /** Primary CRM modules — always visible, not filtered by module search. */
  primary?: boolean;
  /** Show module search input above this section. */
  searchable?: boolean;
}

/** Nine core CRM modules — fixed order in the primary sidebar. */
export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: "Leads", to: "/leads", icon: "leads", permissions: ["LEAD_VIEW"], tableCode: "lead" },
  { label: "Contacts", to: "/contacts", icon: "contacts", permissions: ["CONTACT_VIEW"], tableCode: "contact" },
  { label: "Accounts", to: "/accounts", icon: "accounts", permissions: ["ACCOUNT_VIEW"], tableCode: "account" },
  { label: "Deals", to: "/deals", icon: "deals", permissions: ["DEAL_VIEW"], tableCode: "deal" },
  { label: "Projects", to: "/projects", icon: "projects", permissions: ["PROJECT_VIEW"], tableCode: "project" },
  { label: "Resources", to: "/resources", icon: "resources", permissions: ["RESOURCE_VIEW"], tableCode: "resource" },
  { label: "Invoice", to: "/invoices", icon: "invoices", permissions: ["INVOICE_VIEW"], tableCode: "invoice" },
  { label: "Purchase Order", to: "/purchase-orders", icon: "po", permissions: ["PO_VIEW"], tableCode: "purchase_order" },
  { label: "TimeSheet", to: "/timesheets", icon: "timesheets", permissions: ["TIMESHEET_VIEW"], tableCode: "timesheet" },
];

/** Tenant CRM sidebar registry (Home → primary modules → supporting sections). */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Home",
    items: [
      {
        label: "Home",
        to: "/",
        icon: "home",
        permissions: [
          "DASHBOARD_ORG",
          "DASHBOARD_REGION",
          "DASHBOARD_SALES",
          "DASHBOARD_PROJECT",
          "DASHBOARD_EMPLOYEE",
        ],
      },
    ],
  },
  {
    title: "",
    primary: true,
    items: PRIMARY_NAV_ITEMS,
  },
  {
    title: "More modules",
    searchable: true,
    items: [
      { label: "Tasks", to: "/activities?type=TASK", icon: "tasks", permissions: ["ACTIVITY_VIEW"], tableCode: "activity" },
      { label: "Meetings", to: "/activities?type=MEETING", icon: "meetings", permissions: ["ACTIVITY_VIEW"], tableCode: "activity" },
      { label: "Calls", to: "/activities?type=CALL", icon: "calls", permissions: ["ACTIVITY_VIEW"], tableCode: "activity" },
      { label: "Activities", to: "/activities", icon: "activities", permissions: ["ACTIVITY_VIEW"], tableCode: "activity" },
      { label: "Documents", to: "/documents", icon: "documents", permissions: ["DOCUMENT_VIEW"], tableCode: "document" },
      { label: "Project Tasks", to: "/tasks", icon: "ptasks", permissions: ["TASK_VIEW"], tableCode: "project_task" },
      { label: "Milestones", to: "/milestones", icon: "milestones", permissions: ["MILESTONE_VIEW"], tableCode: "milestone" },
      { label: "Resource Board", to: "/resource-board", icon: "board", permissions: ["RESOURCE_BOARD_VIEW"] },
      { label: "Allocation", to: "/allocations", icon: "allocation", permissions: ["ALLOCATION_VIEW"], tableCode: "allocation" },
      { label: "Skills", to: "/skills", icon: "skills", permissions: ["SKILL_VIEW"], tableCode: "skill" },
      {
        label: "My Approvals",
        to: "/approvals",
        icon: "approvals",
        permissions: ["APPROVAL_VIEW", "APPROVAL_ACT", "TIMESHEET_APPROVE", "APPROVAL_ADMIN"],
      },
      { label: "Contracts", to: "/contracts", icon: "contracts", permissions: ["CONTRACT_VIEW"], tableCode: "contract" },
      { label: "Reports", to: "/reports", icon: "reports", permissions: ["REPORT_VIEW"] },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Tax Rates", to: "/tax-rates", icon: "tax", permissions: ["TAX_VIEW"], tableCode: "tax_rate" },
      { label: "Vendors", to: "/vendors", icon: "vendors", permissions: ["VENDOR_VIEW"], tableCode: "vendor" },
      { label: "Expenses", to: "/expenses", icon: "expenses", permissions: ["EXPENSE_VIEW"], tableCode: "expense" },
    ],
  },
  {
    title: "Setup",
    items: [
      { label: "Users", to: "/admin/users", icon: "users", permissions: ["USER_VIEW"], tableCode: "user" },
      { label: "Roles", to: "/admin/roles", icon: "roles", permissions: ["ROLE_VIEW"], tableCode: "role" },
      { label: "Regions", to: "/admin/regions", icon: "regions", permissions: ["REGION_VIEW"], tableCode: "region" },
      { label: "Departments", to: "/admin/departments", icon: "departments", permissions: ["DEPARTMENT_VIEW"], tableCode: "department" },
      { label: "Teams", to: "/admin/teams", icon: "teams", permissions: ["TEAM_VIEW"] },
      { label: "Settings", to: "/admin/settings", icon: "settings", permissions: ["ORG_VIEW"] },
      { label: "Metadata Studio", to: "/admin/studio", icon: "studio", permissions: ["METADATA_VIEW"] },
      { label: "Workflows", to: "/admin/workflows", icon: "workflows", permissions: ["WORKFLOW_VIEW"] },
      { label: "Table ACL", to: "/admin/acl-matrix", icon: "acl", permissions: ["ACL_VIEW"] },
      { label: "Field ACL", to: "/admin/field-acl", icon: "fieldAcl", permissions: ["FIELD_ACL_VIEW"] },
      { label: "Audit Logs", to: "/admin/audit-logs", icon: "audit", permissions: ["AUDIT_VIEW"] },
    ],
  },
];

/** Resolve sidebar/toolbar icon for the current route (longest path match). */
export function navIconForPath(pathname: string): string | undefined {
  const allItems = NAV_SECTIONS.flatMap((section) => section.items);
  const matches = allItems
    .filter((item) => {
      const [itemPath] = item.to.split("?");
      if (itemPath === "/") return pathname === "/";
      return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
    })
    .sort((a, b) => b.to.length - a.to.length);
  return matches[0]?.icon;
}

/**
 * Nav item for the current location: the longest matching path, preferring an item whose query
 * (e.g. `?type=TASK`) is present in `search` so Tasks/Meetings/Calls resolve to their own entry.
 */
export function navItemForLocation(
  pathname: string,
  search = "",
  sections: NavSection[] = NAV_SECTIONS,
): NavItem | undefined {
  const candidates = sections
    .flatMap((section) => section.items)
    .filter((item) => {
      const [itemPath, itemSearch] = item.to.split("?");
      const pathMatches =
        itemPath === "/" ? pathname === "/" : pathname === itemPath || pathname.startsWith(`${itemPath}/`);
      return pathMatches && (!itemSearch || search.includes(itemSearch));
    })
    .sort((a, b) => b.to.length - a.to.length);
  return candidates[0];
}

/** Page title for the top bar: the matching nav label, else the first path segment in title case. */
export function pageTitleForLocation(pathname: string, search = "", sections: NavSection[] = NAV_SECTIONS): string {
  const item = navItemForLocation(pathname, search, sections);
  if (item) return item.label;
  const segment = pathname.split("/").filter(Boolean)[0];
  if (!segment) return "Home";
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export const QUICK_CREATE_ITEMS: { label: string; to: string; permissions: string[] }[] = [
  { label: "Lead", to: "/leads?create=1", permissions: ["LEAD_CREATE"] },
  { label: "Contact", to: "/contacts?create=1", permissions: ["CONTACT_CREATE"] },
  { label: "Account", to: "/accounts?create=1", permissions: ["ACCOUNT_CREATE"] },
  { label: "Deal", to: "/deals?create=1", permissions: ["DEAL_CREATE"] },
  { label: "Activity", to: "/activities?create=1", permissions: ["ACTIVITY_CREATE"] },
  { label: "Project", to: "/projects?create=1", permissions: ["PROJECT_CREATE"] },
];

/** Super Admin / PLATFORM scope only — never include tenant CRM modules. */
export const PLATFORM_NAV_SECTIONS: NavSection[] = [
  {
    title: "Home",
    items: [{ label: "Dashboard", to: "/platform", icon: "home" }],
  },
  {
    title: "SaaS operations",
    items: [
      { label: "Organizations", to: "/platform/organizations", icon: "accounts" },
      { label: "Prospect Orgs", to: "/platform/prospects", icon: "deals" },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Platform Settings", to: "/platform/settings", comingSoon: true },
      { label: "Platform Audit", to: "/platform/audit", comingSoon: true },
    ],
  },
];
