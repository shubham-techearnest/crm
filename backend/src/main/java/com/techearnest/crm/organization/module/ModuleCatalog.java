package com.techearnest.crm.organization.module;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Sidebar modules the platform can switch on or off per organization. Each module owns a set of
 * permission codes; permissions that belong to no module (dashboards, notes, notifications, saved
 * views) are always available.
 */
public final class ModuleCatalog {

    public record ModuleDefinition(String code, String label, String group, String description, Set<String> permissions) {}

    public static final String GROUP_CRM = "CRM";
    public static final String GROUP_DELIVERY = "Delivery";
    public static final String GROUP_FINANCE = "Finance";
    public static final String GROUP_ADMIN = "Administration";
    public static final String GROUP_CUSTOMIZATION = "Customization";

    public static final List<ModuleDefinition> MODULES = List.of(
            new ModuleDefinition("LEADS", "Leads", GROUP_CRM, "Capture, qualify and convert leads", Set.of(
                    "LEAD_VIEW", "LEAD_CREATE", "LEAD_UPDATE", "LEAD_DELETE", "LEAD_ASSIGN", "LEAD_CONVERT",
                    "LEAD_EXPORT", "LEAD_IMPORT")),
            new ModuleDefinition("CONTACTS", "Contacts", GROUP_CRM, "People at customer accounts", Set.of(
                    "CONTACT_VIEW", "CONTACT_CREATE", "CONTACT_UPDATE", "CONTACT_DELETE", "CONTACT_EXPORT",
                    "CONTACT_IMPORT")),
            new ModuleDefinition("ACCOUNTS", "Accounts", GROUP_CRM, "Customer companies", Set.of(
                    "ACCOUNT_VIEW", "ACCOUNT_CREATE", "ACCOUNT_UPDATE", "ACCOUNT_DELETE", "ACCOUNT_EXPORT",
                    "ACCOUNT_IMPORT")),
            new ModuleDefinition("DEALS", "Deals", GROUP_CRM, "Sales pipeline and opportunities", Set.of(
                    "DEAL_VIEW", "DEAL_CREATE", "DEAL_UPDATE", "DEAL_DELETE", "DEAL_STAGE", "DEAL_EXPORT",
                    "DEAL_IMPORT")),
            new ModuleDefinition("ACTIVITIES", "Activities", GROUP_CRM, "Tasks, meetings and calls", Set.of(
                    "ACTIVITY_VIEW", "ACTIVITY_CREATE", "ACTIVITY_UPDATE", "ACTIVITY_DELETE", "ACTIVITY_COMPLETE")),
            new ModuleDefinition("DOCUMENTS", "Documents", GROUP_CRM, "File storage on records", Set.of(
                    "DOCUMENT_VIEW", "DOCUMENT_UPLOAD", "DOCUMENT_DELETE")),
            new ModuleDefinition("CONTRACTS", "Contracts", GROUP_CRM, "Customer contracts", Set.of(
                    "CONTRACT_VIEW", "CONTRACT_MANAGE")),
            new ModuleDefinition("APPROVALS", "Approvals", GROUP_CRM, "Approval inbox", Set.of(
                    "APPROVAL_VIEW", "APPROVAL_ACT", "APPROVAL_ADMIN")),
            new ModuleDefinition("REPORTS", "Reports", GROUP_CRM, "Operational reports", Set.of("REPORT_VIEW")),
            new ModuleDefinition("PROJECTS", "Projects", GROUP_DELIVERY, "Delivery projects", Set.of(
                    "PROJECT_VIEW", "PROJECT_CREATE", "PROJECT_UPDATE", "PROJECT_DELETE", "PROJECT_IMPORT")),
            new ModuleDefinition("PROJECT_TASKS", "Project Tasks", GROUP_DELIVERY, "Tasks inside projects", Set.of(
                    "TASK_VIEW", "TASK_CREATE", "TASK_UPDATE", "TASK_DELETE", "TASK_ASSIGN")),
            new ModuleDefinition("MILESTONES", "Milestones", GROUP_DELIVERY, "Project milestones", Set.of(
                    "MILESTONE_VIEW", "MILESTONE_MANAGE")),
            new ModuleDefinition("RESOURCES", "Resources", GROUP_DELIVERY, "People, rates and self-service", Set.of(
                    "RESOURCE_VIEW", "RESOURCE_MANAGE", "RESOURCE_IMPORT", "RESOURCE_PORTAL_INVITE", "MY_WORK_VIEW",
                    "RATE_VIEW", "RATE_MANAGE")),
            new ModuleDefinition("RESOURCE_BOARD", "Resource Board", GROUP_DELIVERY, "Utilisation whiteboard", Set.of(
                    "RESOURCE_BOARD_VIEW", "RESOURCE_BOARD_CONFIGURE")),
            new ModuleDefinition("ALLOCATIONS", "Allocations", GROUP_DELIVERY, "Resource allocation to projects", Set.of(
                    "ALLOCATION_VIEW", "ALLOCATION_OVERRIDE", "RESOURCE_ALLOCATE")),
            new ModuleDefinition("SKILLS", "Skills", GROUP_DELIVERY, "Skill catalog", Set.of("SKILL_VIEW", "SKILL_MANAGE")),
            new ModuleDefinition("TIMESHEETS", "Timesheets", GROUP_DELIVERY, "Time entry and approval", Set.of(
                    "TIMESHEET_VIEW", "TIMESHEET_CREATE", "TIMESHEET_SUBMIT", "TIMESHEET_APPROVE", "TIMESHEET_EXPORT",
                    "TIMESHEET_IMPORT", "TIMESHEET_PROXY", "TIMESHEET_LINK_SEND")),
            new ModuleDefinition("INVOICES", "Invoices", GROUP_FINANCE, "Invoices, payments and credit notes", Set.of(
                    "INVOICE_VIEW", "INVOICE_CREATE", "INVOICE_UPDATE", "INVOICE_DELETE", "INVOICE_IMPORT",
                    "PAYMENT_MANAGE", "CREDIT_NOTE_MANAGE")),
            new ModuleDefinition("PURCHASE_ORDERS", "Purchase Orders", GROUP_FINANCE, "Customer purchase orders", Set.of(
                    "PO_VIEW", "PO_CREATE", "PO_UPDATE", "PO_DELETE", "PO_APPROVE", "PO_IMPORT")),
            new ModuleDefinition("VENDORS", "Vendors", GROUP_FINANCE, "Supplier records", Set.of(
                    "VENDOR_VIEW", "VENDOR_MANAGE")),
            new ModuleDefinition("EXPENSES", "Expenses", GROUP_FINANCE, "Expense claims", Set.of(
                    "EXPENSE_VIEW", "EXPENSE_CREATE", "EXPENSE_UPDATE", "EXPENSE_DELETE", "EXPENSE_APPROVE")),
            new ModuleDefinition("TAX_RATES", "Tax Rates", GROUP_FINANCE, "Tax configuration", Set.of(
                    "TAX_VIEW", "TAX_MANAGE")),
            new ModuleDefinition("USERS", "Users", GROUP_ADMIN, "Invite and manage users", Set.of(
                    "USER_VIEW", "USER_MANAGE")),
            new ModuleDefinition("ROLES", "Roles", GROUP_ADMIN, "Roles and permissions", Set.of(
                    "ROLE_VIEW", "ROLE_MANAGE")),
            new ModuleDefinition("REGIONS", "Regions", GROUP_ADMIN, "Regions and branches", Set.of(
                    "REGION_VIEW", "REGION_MANAGE", "BRANCH_VIEW", "BRANCH_MANAGE")),
            new ModuleDefinition("DEPARTMENTS", "Departments", GROUP_ADMIN, "Departments", Set.of(
                    "DEPARTMENT_VIEW", "DEPARTMENT_MANAGE")),
            new ModuleDefinition("TEAMS", "Teams", GROUP_ADMIN, "Teams", Set.of("TEAM_VIEW", "TEAM_MANAGE")),
            new ModuleDefinition("SETTINGS", "Settings", GROUP_ADMIN, "Organization profile and settings", Set.of(
                    "ORG_VIEW", "ORG_UPDATE")),
            new ModuleDefinition("WORKFLOWS", "Workflows", GROUP_ADMIN, "Workflow automation", Set.of(
                    "WORKFLOW_VIEW", "WORKFLOW_MANAGE")),
            new ModuleDefinition("AUDIT_LOGS", "Audit Logs", GROUP_ADMIN, "Audit trail", Set.of("AUDIT_VIEW")),
            new ModuleDefinition("METADATA_STUDIO", "Metadata Studio", GROUP_CUSTOMIZATION,
                    "Organization can customise fields, layouts and forms itself", Set.of(
                            "METADATA_VIEW", "METADATA_MANAGE")),
            new ModuleDefinition("TABLE_ACL", "Table ACL", GROUP_CUSTOMIZATION,
                    "Organization can manage table permissions itself", Set.of("ACL_VIEW", "ACL_MANAGE")),
            new ModuleDefinition("FIELD_ACL", "Field ACL", GROUP_CUSTOMIZATION,
                    "Organization can manage field permissions itself", Set.of(
                            "FIELD_ACL_VIEW", "FIELD_ACL_MANAGE")));

    /** Metadata table code → owning module, so table ACL rows cannot reopen a disabled module. */
    private static final Map<String, String> TABLE_MODULES = Map.ofEntries(
            Map.entry("lead", "LEADS"),
            Map.entry("contact", "CONTACTS"),
            Map.entry("account", "ACCOUNTS"),
            Map.entry("deal", "DEALS"),
            Map.entry("activity", "ACTIVITIES"),
            Map.entry("document", "DOCUMENTS"),
            Map.entry("contract", "CONTRACTS"),
            Map.entry("project", "PROJECTS"),
            Map.entry("project_task", "PROJECT_TASKS"),
            Map.entry("milestone", "MILESTONES"),
            Map.entry("resource", "RESOURCES"),
            Map.entry("allocation", "ALLOCATIONS"),
            Map.entry("skill", "SKILLS"),
            Map.entry("timesheet", "TIMESHEETS"),
            Map.entry("invoice", "INVOICES"),
            Map.entry("purchase_order", "PURCHASE_ORDERS"),
            Map.entry("vendor", "VENDORS"),
            Map.entry("expense", "EXPENSES"),
            Map.entry("tax_rate", "TAX_RATES"),
            Map.entry("user", "USERS"),
            Map.entry("role", "ROLES"),
            Map.entry("region", "REGIONS"),
            Map.entry("department", "DEPARTMENTS"));

    private static final Map<String, ModuleDefinition> BY_CODE = new HashMap<>();
    private static final Map<String, String> MODULE_BY_PERMISSION = new HashMap<>();

    static {
        for (ModuleDefinition module : MODULES) {
            BY_CODE.put(module.code(), module);
            for (String permission : module.permissions()) {
                MODULE_BY_PERMISSION.put(permission, module.code());
            }
        }
    }

    private ModuleCatalog() {}

    public static Optional<ModuleDefinition> find(String code) {
        return Optional.ofNullable(code == null ? null : BY_CODE.get(code));
    }

    /** Module that owns the permission, or empty when the permission is always available. */
    public static Optional<String> moduleForPermission(String permission) {
        return Optional.ofNullable(MODULE_BY_PERMISSION.get(permission));
    }

    public static Optional<String> moduleForTable(String tableCode) {
        return Optional.ofNullable(tableCode == null ? null : TABLE_MODULES.get(tableCode));
    }
}
