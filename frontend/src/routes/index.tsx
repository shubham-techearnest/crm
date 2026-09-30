import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { AppShell } from "@/layouts/AppShell";
import { PlatformShell } from "@/layouts/PlatformShell";
import { AuthLayout } from "@/layouts/AuthLayout";
import { GuestGuard } from "@/features/auth/GuestGuard";
import { AuthGuard } from "@/features/auth/AuthGuard";
import { PlatformGuard, TenantGuard } from "@/features/auth/ScopeGuards";
import { RoutePermission } from "@/components/PermissionGuard/RoutePermission";
import { PortalGuard } from "@/features/portal/PortalGuard";
import { PortalShell } from "@/layouts/PortalShell";
import { useHasPermission } from "@/features/auth/AuthContext";

const DashboardsPage = lazy(() => import("@/features/dashboards/DashboardsPage").then((m) => ({ default: m.DashboardsPage })));
const UsersPage = lazy(() => import("@/features/admin/UsersPage").then((m) => ({ default: m.UsersPage })));
const RolesPage = lazy(() => import("@/features/admin/RolesPage").then((m) => ({ default: m.RolesPage })));
const RegionsPage = lazy(() => import("@/features/admin/RegionsPage").then((m) => ({ default: m.RegionsPage })));
const DepartmentsPage = lazy(() => import("@/features/admin/DepartmentsPage").then((m) => ({ default: m.DepartmentsPage })));
const TeamsPage = lazy(() => import("@/features/admin/TeamsPage").then((m) => ({ default: m.TeamsPage })));
const SettingsPage = lazy(() => import("@/features/admin/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const AuditLogsPage = lazy(() => import("@/features/admin/AuditLogsPage").then((m) => ({ default: m.AuditLogsPage })));
const StudioPage = lazy(() => import("@/features/admin/studio/StudioPage").then((m) => ({ default: m.StudioPage })));
const AclMatrixPage = lazy(() => import("@/features/admin/AclMatrixPage").then((m) => ({ default: m.AclMatrixPage })));
const FieldAclMatrixPage = lazy(() => import("@/features/admin/FieldAclMatrixPage").then((m) => ({ default: m.FieldAclMatrixPage })));
const LeadsPage = lazy(() => import("@/features/crm/LeadsPage").then((m) => ({ default: m.LeadsPage })));
const ContactsPage = lazy(() => import("@/features/crm/ContactsPage").then((m) => ({ default: m.ContactsPage })));
const AccountsPage = lazy(() => import("@/features/crm/AccountsPage").then((m) => ({ default: m.AccountsPage })));
const DealsPage = lazy(() => import("@/features/crm/DealsPage").then((m) => ({ default: m.DealsPage })));
const ActivitiesPage = lazy(() => import("@/features/crm/ActivitiesPage").then((m) => ({ default: m.ActivitiesPage })));
const DocumentsPage = lazy(() => import("@/features/crm/DocumentsPage").then((m) => ({ default: m.DocumentsPage })));
const ProjectsPage = lazy(() => import("@/features/projects/ProjectsPage").then((m) => ({ default: m.ProjectsPage })));
const TasksPage = lazy(() => import("@/features/projects/TasksPage").then((m) => ({ default: m.TasksPage })));
const MilestonesPage = lazy(() => import("@/features/projects/MilestonesPage").then((m) => ({ default: m.MilestonesPage })));
const ResourcesPage = lazy(() => import("@/features/resources/ResourcesPage").then((m) => ({ default: m.ResourcesPage })));
const AllocationsPage = lazy(() => import("@/features/resources/AllocationsPage").then((m) => ({ default: m.AllocationsPage })));
const SkillsPage = lazy(() => import("@/features/resources/SkillsPage").then((m) => ({ default: m.SkillsPage })));
const TimesheetsPage = lazy(() => import("@/features/timesheets/TimesheetsPage").then((m) => ({ default: m.TimesheetsPage })));
const ApprovalsPage = lazy(() => import("@/features/approvals/ApprovalsPage").then((m) => ({ default: m.ApprovalsPage })));
const TaxRatesPage = lazy(() => import("@/features/finance/TaxRatesPage").then((m) => ({ default: m.TaxRatesPage })));
const InvoicesPage = lazy(() => import("@/features/finance/InvoicesPage").then((m) => ({ default: m.InvoicesPage })));
const ContractsPage = lazy(() => import("@/features/contracts/ContractsPage").then((m) => ({ default: m.ContractsPage })));
const ExpensesPage = lazy(() => import("@/features/expenses/ExpensesPage").then((m) => ({ default: m.ExpensesPage })));
const VendorsPage = lazy(() => import("@/features/procurement/VendorsPage").then((m) => ({ default: m.VendorsPage })));
const PurchaseOrdersPage = lazy(() => import("@/features/procurement/PurchaseOrdersPage").then((m) => ({ default: m.PurchaseOrdersPage })));
const ReportsPage = lazy(() => import("@/features/reports/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const WorkflowAdminPage = lazy(() => import("@/features/admin/WorkflowAdminPage").then((m) => ({ default: m.WorkflowAdminPage })));
const PortalLoginPage = lazy(() => import("@/features/portal/PortalLoginPage").then((m) => ({ default: m.PortalLoginPage })));
const PortalHomePage = lazy(() => import("@/features/portal/PortalHomePage").then((m) => ({ default: m.PortalHomePage })));
const PortalListPage = lazy(() => import("@/features/portal/PortalListPage").then((m) => ({ default: m.PortalListPage })));
const PlatformDashboardPage = lazy(() => import("@/features/platform/PlatformDashboardPage").then((m) => ({ default: m.PlatformDashboardPage })));
const PlatformPlaceholderPage = lazy(() => import("@/features/platform/PlatformPlaceholderPage").then((m) => ({ default: m.PlatformPlaceholderPage })));
const PlatformProspectsPage = lazy(() => import("@/features/platform/PlatformProspectsPage").then((m) => ({ default: m.PlatformProspectsPage })));
const PlatformOrganizationsPage = lazy(() => import("@/features/platform/PlatformOrganizationsPage").then((m) => ({ default: m.PlatformOrganizationsPage })));
const PlatformOrganizationCreatePage = lazy(() => import("@/features/platform/PlatformOrganizationCreatePage").then((m) => ({ default: m.PlatformOrganizationCreatePage })));
const PlatformOrganizationDetailPage = lazy(() => import("@/features/platform/PlatformOrganizationDetailPage").then((m) => ({ default: m.PlatformOrganizationDetailPage })));

const AcceptInvitePage = lazy(() => import("@/features/selfservice/AcceptInvitePage").then((m) => ({ default: m.AcceptInvitePage })));
const TimesheetLinkPage = lazy(() => import("@/features/selfservice/TimesheetLinkPage").then((m) => ({ default: m.TimesheetLinkPage })));

const DASHBOARD_PERMISSIONS = [
  "DASHBOARD_ORG",
  "DASHBOARD_REGION",
  "DASHBOARD_SALES",
  "DASHBOARD_PROJECT",
  "DASHBOARD_EMPLOYEE",
];

/** Portal contributors have no dashboard; send them to their timesheets instead of "Access restricted". */
function HomeRoute() {
  const hasDashboard = useHasPermission(DASHBOARD_PERMISSIONS);
  const hasTimesheets = useHasPermission("TIMESHEET_VIEW");
  if (!hasDashboard && hasTimesheets) {
    return <Navigate to="/timesheets" replace />;
  }
  return guard(DASHBOARD_PERMISSIONS, <DashboardsPage />);
}

function suspend(element: ReactNode) {
  return <Suspense fallback={<div className="route-loading" role="status">Loading page…</div>}>{element}</Suspense>;
}

function guard(anyOf: string[], element: ReactNode) {
  return suspend(<RoutePermission anyOf={anyOf}>{element}</RoutePermission>);
}

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <GuestGuard /> },
      { path: "/portal/login", element: suspend(<PortalLoginPage />) },
      { path: "/accept-invite/:token", element: suspend(<AcceptInvitePage />) },
      { path: "/timesheet-link/:token", element: suspend(<TimesheetLinkPage />) },
    ],
  },
  {
    path: "/portal",
    element: <PortalGuard />,
    children: [
      {
        element: <PortalShell />,
        children: [
          { index: true, element: suspend(<PortalHomePage />) },
          { path: "projects", element: suspend(<PortalListPage tab="projects" />) },
          { path: "invoices", element: suspend(<PortalListPage tab="invoices" />) },
          { path: "documents", element: suspend(<PortalListPage tab="documents" />) },
        ],
      },
    ],
  },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <PlatformGuard />,
        children: [
          {
            element: <PlatformShell />,
            children: [
              { path: "/platform", element: suspend(<PlatformDashboardPage />) },
              { path: "/platform/organizations", element: suspend(<PlatformOrganizationsPage />) },
              { path: "/platform/organizations/new", element: suspend(<PlatformOrganizationCreatePage />) },
              { path: "/platform/organizations/:id", element: suspend(<PlatformOrganizationDetailPage />) },
              {
                path: "/platform/prospects",
                element: suspend(<PlatformProspectsPage />),
              },
              {
                path: "/platform/settings",
                element: suspend(
                  <PlatformPlaceholderPage
                    title="Platform Settings"
                    description="Feature flags and platform-level defaults will land in a later sprint."
                  />,
                ),
              },
              {
                path: "/platform/audit",
                element: suspend(
                  <PlatformPlaceholderPage
                    title="Platform Audit"
                    description="Platform-scoped audit of org create/suspend actions is planned with Organizations."
                  />,
                ),
              },
            ],
          },
        ],
      },
      {
        element: <TenantGuard />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: "/", element: <HomeRoute /> },
              { path: "/leads", element: guard(["LEAD_VIEW"], <LeadsPage />) },
              { path: "/contacts", element: guard(["CONTACT_VIEW"], <ContactsPage />) },
              { path: "/accounts", element: guard(["ACCOUNT_VIEW"], <AccountsPage />) },
              { path: "/deals", element: guard(["DEAL_VIEW"], <DealsPage />) },
              { path: "/activities", element: guard(["ACTIVITY_VIEW"], <ActivitiesPage />) },
              { path: "/documents", element: guard(["DOCUMENT_VIEW"], <DocumentsPage />) },
              { path: "/projects", element: guard(["PROJECT_VIEW"], <ProjectsPage />) },
              { path: "/tasks", element: guard(["TASK_VIEW"], <TasksPage />) },
              { path: "/milestones", element: guard(["MILESTONE_VIEW"], <MilestonesPage />) },
              { path: "/resources", element: guard(["RESOURCE_VIEW"], <ResourcesPage />) },
              { path: "/allocations", element: guard(["ALLOCATION_VIEW"], <AllocationsPage />) },
              { path: "/skills", element: guard(["SKILL_VIEW"], <SkillsPage />) },
              { path: "/timesheets", element: guard(["TIMESHEET_VIEW"], <TimesheetsPage />) },
              {
                path: "/approvals",
                element: guard(
                  ["APPROVAL_VIEW", "APPROVAL_ACT", "TIMESHEET_APPROVE", "APPROVAL_ADMIN"],
                  <ApprovalsPage />,
                ),
              },
              { path: "/tax-rates", element: guard(["TAX_VIEW"], <TaxRatesPage />) },
              { path: "/invoices", element: guard(["INVOICE_VIEW"], <InvoicesPage />) },
              { path: "/contracts", element: guard(["CONTRACT_VIEW"], <ContractsPage />) },
              { path: "/vendors", element: guard(["VENDOR_VIEW"], <VendorsPage />) },
              { path: "/purchase-orders", element: guard(["PO_VIEW"], <PurchaseOrdersPage />) },
              { path: "/expenses", element: guard(["EXPENSE_VIEW"], <ExpensesPage />) },
              { path: "/reports", element: guard(["REPORT_VIEW"], <ReportsPage />) },
              { path: "/admin/users", element: guard(["USER_VIEW"], <UsersPage />) },
              { path: "/admin/roles", element: guard(["ROLE_VIEW"], <RolesPage />) },
              { path: "/admin/regions", element: guard(["REGION_VIEW"], <RegionsPage />) },
              { path: "/admin/departments", element: guard(["DEPARTMENT_VIEW"], <DepartmentsPage />) },
              { path: "/admin/teams", element: guard(["TEAM_VIEW"], <TeamsPage />) },
              { path: "/admin/settings", element: guard(["ORG_VIEW"], <SettingsPage />) },
              { path: "/admin/studio", element: guard(["METADATA_VIEW"], <StudioPage />) },
              { path: "/admin/acl-matrix", element: guard(["ACL_VIEW"], <AclMatrixPage />) },
              { path: "/admin/field-acl", element: guard(["FIELD_ACL_VIEW"], <FieldAclMatrixPage />) },
              { path: "/admin/audit-logs", element: guard(["AUDIT_VIEW"], <AuditLogsPage />) },
              { path: "/admin/workflows", element: guard(["WORKFLOW_VIEW"], <WorkflowAdminPage />) },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/login" replace /> },
]);
