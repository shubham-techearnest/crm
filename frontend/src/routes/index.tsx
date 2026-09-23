import { createBrowserRouter, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { AppShell } from "@/layouts/AppShell";
import { PlatformShell } from "@/layouts/PlatformShell";
import { AuthLayout } from "@/layouts/AuthLayout";
import { GuestGuard } from "@/features/auth/GuestGuard";
import { AuthGuard } from "@/features/auth/AuthGuard";
import { PlatformGuard, TenantGuard } from "@/features/auth/ScopeGuards";
import { RoutePermission } from "@/components/PermissionGuard/RoutePermission";
import { DashboardsPage } from "@/features/dashboards/DashboardsPage";
import { UsersPage } from "@/features/admin/UsersPage";
import { RolesPage } from "@/features/admin/RolesPage";
import { RegionsPage } from "@/features/admin/RegionsPage";
import { DepartmentsPage } from "@/features/admin/DepartmentsPage";
import { SettingsPage } from "@/features/admin/SettingsPage";
import { AuditLogsPage } from "@/features/admin/AuditLogsPage";
import { StudioPage } from "@/features/admin/studio/StudioPage";
import { AclMatrixPage } from "@/features/admin/AclMatrixPage";
import { FieldAclMatrixPage } from "@/features/admin/FieldAclMatrixPage";
import { LeadsPage } from "@/features/crm/LeadsPage";
import { ContactsPage } from "@/features/crm/ContactsPage";
import { AccountsPage } from "@/features/crm/AccountsPage";
import { DealsPage } from "@/features/crm/DealsPage";
import { ActivitiesPage } from "@/features/crm/ActivitiesPage";
import { DocumentsPage } from "@/features/crm/DocumentsPage";
import { ProjectsPage } from "@/features/projects/ProjectsPage";
import { TasksPage } from "@/features/projects/TasksPage";
import { MilestonesPage } from "@/features/projects/MilestonesPage";
import { ResourcesPage } from "@/features/resources/ResourcesPage";
import { AllocationsPage } from "@/features/resources/AllocationsPage";
import { SkillsPage } from "@/features/resources/SkillsPage";
import { TimesheetsPage } from "@/features/timesheets/TimesheetsPage";
import { ApprovalsPage } from "@/features/approvals/ApprovalsPage";
import { TaxRatesPage } from "@/features/finance/TaxRatesPage";
import { InvoicesPage } from "@/features/finance/InvoicesPage";
import { ContractsPage } from "@/features/contracts/ContractsPage";
import { ComingSoonPage } from "@/features/common/ComingSoonPage";
import { PlatformDashboardPage } from "@/features/platform/PlatformDashboardPage";
import { PlatformPlaceholderPage } from "@/features/platform/PlatformPlaceholderPage";
import { PlatformProspectsPage } from "@/features/platform/PlatformProspectsPage";
import { PlatformOrganizationsPage } from "@/features/platform/PlatformOrganizationsPage";
import { PlatformOrganizationCreatePage } from "@/features/platform/PlatformOrganizationCreatePage";
import { PlatformOrganizationDetailPage } from "@/features/platform/PlatformOrganizationDetailPage";

function guard(anyOf: string[], element: ReactNode) {
  return <RoutePermission anyOf={anyOf}>{element}</RoutePermission>;
}

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [{ path: "/login", element: <GuestGuard /> }],
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
              { path: "/platform", element: <PlatformDashboardPage /> },
              { path: "/platform/organizations", element: <PlatformOrganizationsPage /> },
              { path: "/platform/organizations/new", element: <PlatformOrganizationCreatePage /> },
              { path: "/platform/organizations/:id", element: <PlatformOrganizationDetailPage /> },
              {
                path: "/platform/prospects",
                element: <PlatformProspectsPage />,
              },
              {
                path: "/platform/settings",
                element: (
                  <PlatformPlaceholderPage
                    title="Platform Settings"
                    description="Feature flags and platform-level defaults will land in a later sprint."
                  />
                ),
              },
              {
                path: "/platform/audit",
                element: (
                  <PlatformPlaceholderPage
                    title="Platform Audit"
                    description="Platform-scoped audit of org create/suspend actions is planned with Organizations."
                  />
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
              {
                path: "/",
                element: guard(
                  [
                    "DASHBOARD_ORG",
                    "DASHBOARD_REGION",
                    "DASHBOARD_SALES",
                    "DASHBOARD_PROJECT",
                    "DASHBOARD_EMPLOYEE",
                  ],
                  <DashboardsPage />,
                ),
              },
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
              {
                path: "/purchase-orders",
                element: (
                  <ComingSoonPage
                    title="Purchase Orders"
                    description="Vendors, POs, and procurement approvals are planned after Finance foundation."
                  />
                ),
              },
              {
                path: "/expenses",
                element: (
                  <ComingSoonPage
                    title="Expenses"
                    description="Employee and project expenses with approvals are part of V2 Expenses."
                  />
                ),
              },
              {
                path: "/contracts",
                element: (
                  <ComingSoonPage
                    title="Contracts"
                    description="Customer contracts, renewals, and expiry reminders are planned in V2."
                  />
                ),
              },
              {
                path: "/reports",
                element: (
                  <ComingSoonPage
                    title="Reports"
                    description="Advanced analytics and profitability reports follow Finance and Timesheet data."
                  />
                ),
              },
              { path: "/admin/users", element: guard(["USER_VIEW"], <UsersPage />) },
              { path: "/admin/roles", element: guard(["ROLE_VIEW"], <RolesPage />) },
              { path: "/admin/regions", element: guard(["REGION_VIEW"], <RegionsPage />) },
              { path: "/admin/departments", element: guard(["DEPARTMENT_VIEW"], <DepartmentsPage />) },
              { path: "/admin/settings", element: guard(["ORG_VIEW"], <SettingsPage />) },
              { path: "/admin/studio", element: guard(["METADATA_VIEW"], <StudioPage />) },
              { path: "/admin/acl-matrix", element: guard(["ACL_VIEW"], <AclMatrixPage />) },
              { path: "/admin/field-acl", element: guard(["FIELD_ACL_VIEW"], <FieldAclMatrixPage />) },
              { path: "/admin/audit-logs", element: guard(["AUDIT_VIEW"], <AuditLogsPage />) },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/login" replace /> },
]);
