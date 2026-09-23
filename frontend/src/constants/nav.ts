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
}

/** Zoho-style flat module registry (searchable in the sidebar). */
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
    title: "Modules",
    items: [
      { label: "Leads", to: "/leads", icon: "leads", permissions: ["LEAD_VIEW"], tableCode: "lead" },
      { label: "Contacts", to: "/contacts", icon: "contacts", permissions: ["CONTACT_VIEW"], tableCode: "contact" },
      { label: "Accounts", to: "/accounts", icon: "accounts", permissions: ["ACCOUNT_VIEW"], tableCode: "account" },
      { label: "Deals", to: "/deals", icon: "deals", permissions: ["DEAL_VIEW"], tableCode: "deal" },
      { label: "Tasks", to: "/activities?type=TASK", icon: "tasks", permissions: ["ACTIVITY_VIEW"], tableCode: "activity" },
      { label: "Meetings", to: "/activities?type=MEETING", icon: "meetings", permissions: ["ACTIVITY_VIEW"], tableCode: "activity" },
      { label: "Calls", to: "/activities?type=CALL", icon: "calls", permissions: ["ACTIVITY_VIEW"], tableCode: "activity" },
      { label: "Activities", to: "/activities", icon: "activities", permissions: ["ACTIVITY_VIEW"], tableCode: "activity" },
      { label: "Documents", to: "/documents", icon: "documents", permissions: ["DOCUMENT_VIEW"], tableCode: "document" },
      { label: "Projects", to: "/projects", icon: "projects", permissions: ["PROJECT_VIEW"], tableCode: "project" },
      { label: "Project Tasks", to: "/tasks", icon: "ptasks", permissions: ["TASK_VIEW"], tableCode: "project_task" },
      { label: "Milestones", to: "/milestones", icon: "milestones", permissions: ["MILESTONE_VIEW"], tableCode: "milestone" },
      { label: "Resources", to: "/resources", icon: "resources", permissions: ["RESOURCE_VIEW"], tableCode: "resource" },
      { label: "Allocation", to: "/allocations", icon: "allocation", permissions: ["ALLOCATION_VIEW"], tableCode: "allocation" },
      { label: "Skills", to: "/skills", icon: "skills", permissions: ["SKILL_VIEW"], tableCode: "skill" },
      { label: "Timesheets", to: "/timesheets", icon: "timesheets", permissions: ["TIMESHEET_VIEW"], tableCode: "timesheet" },
      {
        label: "My Approvals",
        to: "/approvals",
        icon: "approvals",
        permissions: ["APPROVAL_VIEW", "APPROVAL_ACT", "TIMESHEET_APPROVE", "APPROVAL_ADMIN"],
      },
      { label: "Tax Rates", to: "/tax-rates", icon: "invoices", permissions: ["TAX_VIEW"], tableCode: "tax_rate" },
      { label: "Invoices", to: "/invoices", icon: "invoices", permissions: ["INVOICE_VIEW"], tableCode: "invoice" },
      { label: "Purchase Orders", to: "/purchase-orders", icon: "po", comingSoon: true, permissions: ["DOCUMENT_VIEW"] },
      { label: "Expenses", to: "/expenses", icon: "expenses", comingSoon: true, permissions: ["DOCUMENT_VIEW"] },
      { label: "Contracts", to: "/contracts", icon: "contracts", permissions: ["CONTRACT_VIEW"], tableCode: "contract" },
      { label: "Reports", to: "/reports", icon: "reports", comingSoon: true, permissions: ["DASHBOARD_ORG", "DASHBOARD_SALES"] },
    ],
  },
  {
    title: "Setup",
    items: [
      { label: "Users", to: "/admin/users", permissions: ["USER_VIEW"], tableCode: "user" },
      { label: "Roles", to: "/admin/roles", permissions: ["ROLE_VIEW"], tableCode: "role" },
      { label: "Regions", to: "/admin/regions", permissions: ["REGION_VIEW"], tableCode: "region" },
      { label: "Departments", to: "/admin/departments", permissions: ["DEPARTMENT_VIEW"], tableCode: "department" },
      { label: "Settings", to: "/admin/settings", permissions: ["ORG_VIEW"] },
      { label: "Metadata Studio", to: "/admin/studio", permissions: ["METADATA_VIEW"] },
      { label: "Table ACL", to: "/admin/acl-matrix", permissions: ["ACL_VIEW"] },
      { label: "Field ACL", to: "/admin/field-acl", permissions: ["FIELD_ACL_VIEW"] },
      { label: "Audit Logs", to: "/admin/audit-logs", permissions: ["AUDIT_VIEW"] },
    ],
  },
];

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
      { label: "Organizations", to: "/platform/organizations", icon: "orgs" },
      { label: "Prospect Orgs", to: "/platform/prospects", icon: "pipeline", comingSoon: true },
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
