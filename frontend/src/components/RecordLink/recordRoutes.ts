import { RECORD_ID_PARAM } from "@/hooks/useUrlRecord";

export type RecordModule =
  | "lead"
  | "contact"
  | "account"
  | "deal"
  | "activity"
  | "project"
  | "task"
  | "milestone"
  | "resource"
  | "allocation"
  | "timesheet"
  | "invoice"
  | "contract"
  | "expense"
  | "vendor"
  | "purchaseOrder"
  | "user"
  | "role"
  | "region"
  | "department"
  | "team";

interface RecordRoute {
  path: string;
  permission: string;
  /** Singular label used in "Back to …" hints and tooltips. */
  label: string;
}

export const RECORD_ROUTES: Record<RecordModule, RecordRoute> = {
  lead: { path: "/leads", permission: "LEAD_VIEW", label: "Lead" },
  contact: { path: "/contacts", permission: "CONTACT_VIEW", label: "Contact" },
  account: { path: "/accounts", permission: "ACCOUNT_VIEW", label: "Account" },
  deal: { path: "/deals", permission: "DEAL_VIEW", label: "Deal" },
  activity: { path: "/activities", permission: "ACTIVITY_VIEW", label: "Activity" },
  project: { path: "/projects", permission: "PROJECT_VIEW", label: "Project" },
  task: { path: "/tasks", permission: "TASK_VIEW", label: "Task" },
  milestone: { path: "/milestones", permission: "MILESTONE_VIEW", label: "Milestone" },
  resource: { path: "/resources", permission: "RESOURCE_VIEW", label: "Resource" },
  allocation: { path: "/allocations", permission: "ALLOCATION_VIEW", label: "Allocation" },
  timesheet: { path: "/timesheets", permission: "TIMESHEET_VIEW", label: "Timesheet" },
  invoice: { path: "/invoices", permission: "INVOICE_VIEW", label: "Invoice" },
  contract: { path: "/contracts", permission: "CONTRACT_VIEW", label: "Contract" },
  expense: { path: "/expenses", permission: "EXPENSE_VIEW", label: "Expense" },
  vendor: { path: "/vendors", permission: "VENDOR_VIEW", label: "Vendor" },
  purchaseOrder: { path: "/purchase-orders", permission: "PO_VIEW", label: "Purchase Order" },
  user: { path: "/admin/users", permission: "USER_VIEW", label: "User" },
  role: { path: "/admin/roles", permission: "ROLE_VIEW", label: "Role" },
  region: { path: "/admin/regions", permission: "REGION_VIEW", label: "Region" },
  department: { path: "/admin/departments", permission: "DEPARTMENT_VIEW", label: "Department" },
  team: { path: "/admin/teams", permission: "TEAM_VIEW", label: "Team" },
};

const ENTITY_TYPE_MODULES: Record<string, RecordModule> = {
  LEAD: "lead",
  CONTACT: "contact",
  ACCOUNT: "account",
  DEAL: "deal",
  ACTIVITY: "activity",
  PROJECT: "project",
  TASK: "task",
  PROJECT_TASK: "task",
  MILESTONE: "milestone",
  RESOURCE: "resource",
  ALLOCATION: "allocation",
  RESOURCE_ALLOCATION: "allocation",
  TIMESHEET: "timesheet",
  INVOICE: "invoice",
  CONTRACT: "contract",
  EXPENSE: "expense",
  VENDOR: "vendor",
  PURCHASE_ORDER: "purchaseOrder",
  PO: "purchaseOrder",
};

/** Maps backend entity types (notes, activities, audit, approvals, notifications) to a linkable module. */
export function recordModuleForEntityType(entityType: string | null | undefined): RecordModule | null {
  if (!entityType) return null;
  return ENTITY_TYPE_MODULES[entityType.trim().toUpperCase()] ?? null;
}

export function recordHref(module: RecordModule, id: string): string {
  return `${RECORD_ROUTES[module].path}?${RECORD_ID_PARAM}=${encodeURIComponent(id)}`;
}
