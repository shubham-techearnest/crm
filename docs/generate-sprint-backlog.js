/**
 * Generates TECH_EARNEST_CRM_SPRINT_BACKLOG.xlsx
 * Run: node generate-sprint-backlog.js
 */
const XLSX = require("xlsx");
const path = require("path");

const STATUS = "Not Started";
const PRIORITIES = { P0: "P0", P1: "P1", P2: "P2", P3: "P3" };

/** @type {Array<Record<string, string|number>>} */
const stories = [];

function add(s) {
  stories.push({
    "Story ID": s.id,
    Sprint: s.sprint,
    Phase: s.phase,
    Epic: s.epic,
    Module: s.module,
    Title: s.title,
    Description: s.description,
    "Acceptance Criteria": s.ac,
    Persona: s.persona,
    Priority: s.priority,
    "Story Points": s.points,
    Status: STATUS,
    Owner: "",
    Dependencies: s.deps || "",
    "Updated On": "",
    Notes: s.notes || "",
  });
}

// ——— S1 Platform Console foundation ———
add({
  id: "US-S1-001",
  sprint: "S1",
  phase: "P0 Platform Split",
  epic: "Platform Console",
  module: "Platform",
  title: "Separate Platform Console layout for Super Admin",
  description: "Super Admin lands on /platform with Platform nav; tenant CRM modules are hidden.",
  ac: "SUPER_ADMIN default home is Platform Dashboard; /leads not in Platform nav; tenant routes redirect or 403 unless explicitly designed support tool.",
  persona: "Super Admin",
  priority: PRIORITIES.P0,
  points: 8,
});
add({
  id: "US-S1-002",
  sprint: "S1",
  phase: "P0 Platform Split",
  epic: "Platform Console",
  module: "Auth/RBAC",
  title: "Enforce PLATFORM-only access on /api/v1/platform/**",
  description: "All platform APIs require PLATFORM data scope and platform permissions.",
  ac: "Org-scoped users receive 403/404 on platform APIs; tests cover cross-access.",
  persona: "Super Admin",
  priority: PRIORITIES.P0,
  points: 5,
  deps: "US-S1-001",
});
add({
  id: "US-S1-003",
  sprint: "S1",
  phase: "P0 Platform Split",
  epic: "Platform Console",
  module: "Navigation",
  title: "Tenant users never see Platform Console nav",
  description: "Org Admin and below only see tenant modules.",
  ac: "No Platform links for ORGANIZATION/REGION/TEAM/OWN scopes.",
  persona: "Org Admin",
  priority: PRIORITIES.P0,
  points: 3,
});
add({
  id: "US-S1-004",
  sprint: "S1",
  phase: "P0 Platform Split",
  epic: "Platform Console",
  module: "Dashboard",
  title: "Platform dashboard KPIs (orgs, users, active orgs)",
  description: "High-level SaaS health cards without exposing tenant PII.",
  ac: "Shows org count, active users (aggregate), suspended orgs; clutter-free cards.",
  persona: "Super Admin",
  priority: PRIORITIES.P1,
  points: 5,
  deps: "US-S1-001",
});

// ——— S2 Organizations ———
add({
  id: "US-S2-001",
  sprint: "S2",
  phase: "P0 Platform Split",
  epic: "Organizations",
  module: "Organizations",
  title: "List organizations with search/filter/status",
  description: "Platform Organizations module list with ModuleListShell pattern.",
  ac: "Filter by status/name; total records; no tenant CRM fields.",
  persona: "Super Admin",
  priority: PRIORITIES.P0,
  points: 5,
  deps: "US-S1-001",
});
add({
  id: "US-S2-002",
  sprint: "S2",
  phase: "P0 Platform Split",
  epic: "Organizations",
  module: "Organizations",
  title: "Create organization wizard",
  description: "Create org: name, slug, timezone, currency, primary admin invite/password, default region.",
  ac: "Creates org + default region + ORGANIZATION_ADMIN user; audit logged; Save works; validation clear.",
  persona: "Super Admin",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S2-001",
});
add({
  id: "US-S2-003",
  sprint: "S2",
  phase: "P0 Platform Split",
  epic: "Organizations",
  module: "Organizations",
  title: "Activate / Suspend organization",
  description: "Lifecycle controls; suspended org users cannot login.",
  ac: "Suspend blocks login with clear message; reactivate restores; audited.",
  persona: "Super Admin",
  priority: PRIORITIES.P0,
  points: 5,
  deps: "US-S2-001",
});
add({
  id: "US-S2-004",
  sprint: "S2",
  phase: "P0 Platform Split",
  epic: "Organizations",
  module: "Organizations",
  title: "Organization detail RecordShell (platform)",
  description: "Overview of org settings, admin contacts, usage counts.",
  ac: "Detail tabs Overview/Users summary/Audit; clutter-free.",
  persona: "Super Admin",
  priority: PRIORITIES.P1,
  points: 5,
});

// ——— S3 SaaS sales pipeline ———
add({
  id: "US-S3-001",
  sprint: "S3",
  phase: "P0 Platform Split",
  epic: "Prospect Orgs",
  module: "Prospect Orgs",
  title: "Prospect Organizations module (SaaS sales)",
  description: "Track companies we sell TechEarnest CRM to — separate from tenant Leads.",
  ac: "CRUD prospect orgs; stages New→Qualified→Proposal→Won/Lost; Super Admin only; never writes tenant leads.",
  persona: "Super Admin",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S1-001",
});
add({
  id: "US-S3-002",
  sprint: "S3",
  phase: "P0 Platform Split",
  epic: "Prospect Orgs",
  module: "Prospect Orgs",
  title: "Convert Won Prospect Org → Create Organization",
  description: "From won prospect, launch org create wizard with prefill.",
  ac: "Prefills name; creates tenant org; links prospect to organization_id; audited.",
  persona: "Super Admin",
  priority: PRIORITIES.P1,
  points: 8,
  deps: "US-S3-001,US-S2-002",
});
add({
  id: "US-S3-003",
  sprint: "S3",
  phase: "P0 Platform Split",
  epic: "Prospect Orgs",
  module: "Prospect Orgs",
  title: "Advanced filters for Prospect Orgs",
  description: "Stage, owner, value range, created date, source.",
  ac: "FilterEngine whitelist; saved views private.",
  persona: "Super Admin",
  priority: PRIORITIES.P1,
  points: 5,
  deps: "US-S3-001",
});
add({
  id: "US-S3-004",
  sprint: "S3",
  phase: "P0 Platform Split",
  epic: "Platform Console",
  module: "Leads",
  title: "Remove/hide tenant Leads from Super Admin UX",
  description: "Ensure Super Admin does not manage tenant leads as SaaS ops work.",
  ac: "No default Leads menu; documentation updated; QA checklist signed.",
  persona: "Super Admin",
  priority: PRIORITIES.P0,
  points: 3,
  deps: "US-S1-001",
});

// ——— S4 Design system & forms ———
const formModules = [
  ["Leads", "Lead"],
  ["Contacts", "Contact"],
  ["Accounts", "Account"],
  ["Deals", "Deal"],
  ["Activities", "Activity"],
];
formModules.forEach((m, i) => {
  add({
    id: `US-S4-${String(i + 1).padStart(3, "0")}`,
    sprint: "S4",
    phase: "P1 UX System",
    epic: "Form System",
    module: m[0],
    title: `Optimize ${m[1]} create/edit form (sections + progressive disclosure)`,
    description: `Redesign ${m[1]} form: primary fields first, Additional details, Save/Save & New, unsaved guard, lookup filters.`,
    ac: "≤8 primary fields visible; validation inline; Cancel/Save/Save&New; region/owner defaults; mobile single column.",
    persona: "Org User",
    priority: PRIORITIES.P0,
    points: 5,
  });
});
add({
  id: "US-S4-006",
  sprint: "S4",
  phase: "P1 UX System",
  epic: "Form System",
  module: "Design System",
  title: "Shared FormSection / FormActions / UnsavedGuard components",
  description: "Reusable form kit used by all modules.",
  ac: "Documented usage; used by at least Leads+Accounts+Contacts.",
  persona: "Engineer",
  priority: PRIORITIES.P0,
  points: 8,
});

// ——— S5 Forms delivery modules ———
[
  ["Projects", "Project"],
  ["Project Tasks", "Project Task"],
  ["Milestones", "Milestone"],
  ["Resources", "Resource"],
  ["Allocations", "Allocation"],
  ["Skills", "Skill"],
  ["Timesheets", "Timesheet / Time Entry"],
].forEach((m, i) => {
  add({
    id: `US-S5-${String(i + 1).padStart(3, "0")}`,
    sprint: "S5",
    phase: "P1 UX System",
    epic: "Form System",
    module: m[0],
    title: `Optimize ${m[1]} create/edit form`,
    description: `Apply form kit to ${m[1]} with module-specific sections.`,
    ac: "Same DoD as S4 forms; permissions respected; clutter-free.",
    persona: "Org User",
    priority: PRIORITIES.P1,
    points: 5,
  });
});

// ——— S6 Admin forms + RecordShell ———
[
  ["Users", "User"],
  ["Roles", "Role"],
  ["Regions", "Region"],
  ["Departments", "Department"],
  ["Settings", "Organization Settings"],
].forEach((m, i) => {
  add({
    id: `US-S6-${String(i + 1).padStart(3, "0")}`,
    sprint: "S6",
    phase: "P1 UX System",
    epic: "Form System",
    module: m[0],
    title: `Optimize ${m[1]} forms & list UX`,
    description: `Tenant admin ${m[1]} uses ModuleListShell + form kit.`,
    ac: "Consistent with CRM lists; scoped by permissions.",
    persona: "Org Admin",
    priority: PRIORITIES.P1,
    points: 5,
  });
});
add({
  id: "US-S6-006",
  sprint: "S6",
  phase: "P1 UX System",
  epic: "RecordShell",
  module: "Platform UI",
  title: "RecordShell component (Overview/Related/Activities/Notes/Documents/Audit)",
  description: "Reusable record detail architecture.",
  ac: "Adopted on Lead + Account + Deal; tabs permission-aware.",
  persona: "Org User",
  priority: PRIORITIES.P0,
  points: 13,
});
add({
  id: "US-S6-007",
  sprint: "S6",
  phase: "P1 UX System",
  epic: "RecordShell",
  module: "Audit Logs",
  title: "Optimize Audit Logs list + filters",
  description: "Filter by action, entity, user, date, region.",
  ac: "Advanced filters; no secrets in payload display.",
  persona: "Org Admin",
  priority: PRIORITIES.P1,
  points: 5,
});

// ——— S7 Advanced filters all modules ———
const filterMods = [
  ["Leads", "status,source,priority,owner,region,value,created,unconverted"],
  ["Contacts", "account,status,owner,email,designation"],
  ["Accounts", "type,status,industry,region,hasOpenDeals"],
  ["Deals", "stage,value,closeDate,account,owner,aging"],
  ["Activities", "type,status,due,relatedType,assignee"],
  ["Documents", "entityType,visibility,uploadedBy,created"],
  ["Projects", "status,account,manager,dates,delayed"],
  ["Project Tasks", "status,project,assignee,due,priority"],
  ["Milestones", "project,status,due"],
  ["Resources", "status,region,skill,availability"],
  ["Allocations", "project,resource,status,overlap"],
  ["Skills", "name,category"],
  ["Timesheets", "status,week,resource,billable"],
];
filterMods.forEach((m, i) => {
  add({
    id: `US-S7-${String(i + 1).padStart(3, "0")}`,
    sprint: "S7",
    phase: "P1 UX System",
    epic: "Advanced Filters",
    module: m[0],
    title: `Advanced filter catalog for ${m[0]}`,
    description: `Whitelist fields: ${m[1]}. Nested AND/OR where engine supports; saved views.`,
    ac: "Filter rail works; invalid fields rejected server-side; Current User/Region operators where applicable.",
    persona: "Org User",
    priority: PRIORITIES.P0,
    points: 5,
  });
});

// ——— S8 Metadata Studio foundation (ServiceNow-like) ———
add({
  id: "US-S8-001",
  sprint: "S8",
  phase: "P2 Metadata Studio",
  epic: "Metadata Studio",
  module: "Studio",
  title: "Metadata & ACL Studio shell (Org Admin)",
  description: "Clutter-free Studio at /admin/studio: table navigator, canvas, property inspector, Preview/Publish.",
  ac: "Org Admin only; Super Admin does not use for tenant CRM; nav entry under Admin; empty states.",
  persona: "Org Admin",
  priority: PRIORITIES.P0,
  points: 13,
});
add({
  id: "US-S8-002",
  sprint: "S8",
  phase: "P2 Metadata Studio",
  epic: "Metadata Studio",
  module: "Dictionary",
  title: "Table Dictionary: register all business modules as tables",
  description: "sys_table (or equivalent): code, label, plural, active, module group; seed all CRM/delivery/admin tables.",
  ac: "API list/get; Studio Tables view; cannot delete system tables; org-scoped overrides supported.",
  persona: "Org Admin",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S8-001",
});
add({
  id: "US-S8-003",
  sprint: "S8",
  phase: "P2 Metadata Studio",
  epic: "Metadata Studio",
  module: "Dictionary",
  title: "Field Dictionary: system fields + custom field types",
  description: "sys_field: type, label, help, mandatory, default, reference, active, system flag; custom fields storage decision implemented.",
  ac: "Add/edit/deactivate custom field; system fields editable for label/help only; max custom fields enforced; audited.",
  persona: "Org Admin",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S8-002",
});
add({
  id: "US-S8-004",
  sprint: "S8",
  phase: "P2 Metadata Studio",
  epic: "Metadata Studio",
  module: "Dictionary",
  title: "Seed Field Dictionary for Leads, Contacts, Accounts, Deals, Activities",
  description: "Import current schema into dictionary so Studio reflects live modules.",
  ac: "All primary fields listed; types match DB; Studio browse works without manual entry.",
  persona: "Engineer",
  priority: PRIORITIES.P0,
  points: 8,
  deps: "US-S8-003",
});
add({
  id: "US-S8-005",
  sprint: "S8",
  phase: "P2 Metadata Studio",
  epic: "Metadata Studio",
  module: "Permissions",
  title: "Studio permissions METADATA_VIEW / METADATA_MANAGE",
  description: "Gate Studio APIs and UI; default grant to ORGANIZATION_ADMIN.",
  ac: "Non-admin 403; ROLE_MANAGE alone insufficient unless seeded; tests.",
  persona: "Org Admin",
  priority: PRIORITIES.P0,
  points: 5,
  deps: "US-S8-001",
});

// ——— S9 Form + List layout designers ———
add({
  id: "US-S9-001",
  sprint: "S9",
  phase: "P2 Metadata Studio",
  epic: "Form Designer",
  module: "Studio",
  title: "Form Layout Designer (sections, order, progressive disclosure)",
  description: "Drag fields into sections; mark primary vs Additional details; create vs edit layouts.",
  ac: "Publish updates effective layout; discard draft; Preview; no scripts required.",
  persona: "Org Admin",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S8-003",
});
add({
  id: "US-S9-002",
  sprint: "S9",
  phase: "P2 Metadata Studio",
  epic: "Form Designer",
  module: "Platform UI",
  title: "Runtime DynamicForm reads published form layout",
  description: "Form kit renders from metadata for Lead create/edit as pilot.",
  ac: "Changing layout in Studio changes Lead form without redeploy; validation still server-side.",
  persona: "Org User",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S9-001,US-S4-006",
});
add({
  id: "US-S9-003",
  sprint: "S9",
  phase: "P2 Metadata Studio",
  epic: "List Designer",
  module: "Studio",
  title: "List Layout Designer (columns, order, default sort)",
  description: "Configure default list columns per table; optional role-based default.",
  ac: "Studio UI clutter-free; publish; personalize list can override columns for user.",
  persona: "Org Admin",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S8-002",
});
add({
  id: "US-S9-004",
  sprint: "S9",
  phase: "P2 Metadata Studio",
  epic: "List Designer",
  module: "Platform UI",
  title: "ModuleListShell consumes published list layout",
  description: "Leads list columns driven by metadata; column chooser persists personal layout.",
  ac: "Admin default applies for new users; personal override saved; export respects visible columns.",
  persona: "Org User",
  priority: PRIORITIES.P0,
  points: 8,
  deps: "US-S9-003",
});
add({
  id: "US-S9-005",
  sprint: "S9",
  phase: "P2 Metadata Studio",
  epic: "Form Designer",
  module: "Studio",
  title: "Declarative form policies (show/hide/mandatory)",
  description: "If field/condition then set visibility/mandatory/read-only — ServiceNow UI Policy lite.",
  ac: "At least Deal stage→lost reason policy configurable; evaluated client+server; no script editor.",
  persona: "Org Admin",
  priority: PRIORITIES.P1,
  points: 13,
  deps: "US-S9-002",
});
add({
  id: "US-S9-006",
  sprint: "S9",
  phase: "P2 Metadata Studio",
  epic: "List Designer",
  module: "RecordShell",
  title: "Related list layout configuration on RecordShell",
  description: "Choose which related lists appear and their columns per parent table.",
  ac: "Account related lists configurable; permission-scoped; empty states remain.",
  persona: "Org Admin",
  priority: PRIORITIES.P1,
  points: 8,
  deps: "US-S6-006,US-S9-003",
});

// ——— S10 Table ACL CRUD matrix ———
add({
  id: "US-S10-001",
  sprint: "S10",
  phase: "P2 Metadata Studio",
  epic: "ACL Studio",
  module: "Security",
  title: "Table ACL matrix UI (Role × Table × CRUD)",
  description: "ServiceNow-like checkbox matrix for Create/Read/Update/Delete per role per table.",
  ac: "Org Admin can grant/revoke; changes audited; cannot remove last Org Admin escape hatch.",
  persona: "Org Admin",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S8-002",
});
add({
  id: "US-S10-002",
  sprint: "S10",
  phase: "P2 Metadata Studio",
  epic: "ACL Studio",
  module: "Security",
  title: "Server ACL evaluator enforces table CRUD on all tenant APIs",
  description: "Central check before service mutate/read; maps to existing permission codes + matrix.",
  ac: "Denied role gets 403 on API; UI hides Create/Edit/Delete; tests for Viewer vs Sales Exec vs Admin.",
  persona: "Engineer",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S10-001",
});
add({
  id: "US-S10-003",
  sprint: "S10",
  phase: "P2 Metadata Studio",
  epic: "ACL Studio",
  module: "Roles",
  title: "User-friendly Roles & Permissions screen redesign",
  description: "Replace dense permission lists with grouped modules + CRUD summary + link to ACL matrix.",
  ac: "Clutter-free; search permissions; show effective scope; save with confirmation.",
  persona: "Org Admin",
  priority: PRIORITIES.P0,
  points: 8,
  deps: "US-S10-001",
});
add({
  id: "US-S10-004",
  sprint: "S10",
  phase: "P2 Metadata Studio",
  epic: "ACL Studio",
  module: "Security",
  title: "Seed default Table ACLs for all live modules by role",
  description: "Align ROLE_PERMISSION_MATRIX into ACL seed so out-of-box CRUD matches product intent.",
  ac: "VIEWER read-only; EMPLOYEE limited; ORG_ADMIN full tenant; documented matrix in Studio.",
  persona: "Org Admin",
  priority: PRIORITIES.P0,
  points: 8,
  deps: "US-S10-001",
});
add({
  id: "US-S10-005",
  sprint: "S10",
  phase: "P2 Metadata Studio",
  epic: "ACL Studio",
  module: "Navigation",
  title: "Sidebar module visibility driven by Read ACL + nav config",
  description: "Hide modules user cannot read; Studio can reorder/hide groups per role.",
  ac: "No dead links; Super Admin platform nav unchanged; tenant nav ACL-aware.",
  persona: "Org User",
  priority: PRIORITIES.P1,
  points: 8,
  deps: "US-S10-002",
});

// ——— S11 Field ACL + roll out layouts ———
add({
  id: "US-S11-001",
  sprint: "S11",
  phase: "P2 Metadata Studio",
  epic: "FLS",
  module: "Security",
  title: "Field ACL Studio (Hidden / Read / Write by role)",
  description: "Configurable FLS beyond hard-coded rates; applies to system + custom fields.",
  ac: "Matrix UI; API strips/hides fields; audit on change.",
  persona: "Org Admin",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S8-003,US-S10-001",
});
add({
  id: "US-S11-002",
  sprint: "S11",
  phase: "P2 Metadata Studio",
  epic: "FLS",
  module: "Security",
  title: "Apply FLS to cost_rate / billing_rate / margin via Field ACL",
  description: "Replace one-off hard-code with Field ACL seed for finance-sensitive fields.",
  ac: "Sales cannot see rates; Finance can; tests; ready for invoice profitability.",
  persona: "Org Admin",
  priority: PRIORITIES.P0,
  points: 8,
  deps: "US-S11-001",
});
add({
  id: "US-S11-003",
  sprint: "S11",
  phase: "P2 Metadata Studio",
  epic: "Form Designer",
  module: "Studio",
  title: "Publish default form+list layouts for all CRM & delivery modules",
  description: "Roll DynamicForm + list layouts beyond Leads pilot to Contacts…Timesheets + admin tables.",
  ac: "Each module uses published layout; Studio editable; no regression on Save/Save&New.",
  persona: "Org Admin",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S9-002,US-S9-004",
});
add({
  id: "US-S11-004",
  sprint: "S11",
  phase: "P2 Metadata Studio",
  epic: "Metadata Studio",
  module: "Studio",
  title: "Filter catalog fields sourced from Field Dictionary",
  description: "Advanced filter whitelists generated from dictionary filterable flags.",
  ac: "New custom field can be marked filterable and appears in filter rail after publish.",
  persona: "Org Admin",
  priority: PRIORITIES.P1,
  points: 8,
  deps: "US-S8-003,US-S7-001",
});
add({
  id: "US-S11-005",
  sprint: "S11",
  phase: "P2 Metadata Studio",
  epic: "Metadata Studio",
  module: "Audit Logs",
  title: "Audit metadata publish and ACL changes",
  description: "Every Studio publish and ACL edit writes audit with before/after summary.",
  ac: "Filterable in Audit; no secrets; Org Admin can review.",
  persona: "Org Admin",
  priority: PRIORITIES.P1,
  points: 5,
  deps: "US-S8-001",
});
add({
  id: "US-S11-006",
  sprint: "S11",
  phase: "P2 Metadata Studio",
  epic: "Metadata Studio",
  module: "Studio",
  title: "V2 module onboarding rule: register table/fields/layouts/ACLs",
  description: "Checklist + seed helpers so Invoices/POs/etc always join Studio before UI ship.",
  ac: "Documented DoD; sample registration for a stub module; engineering wiki link in plan.",
  persona: "Tech Lead",
  priority: PRIORITIES.P1,
  points: 5,
  deps: "US-S11-003,US-S10-004",
});

// ——— S12 CRM depth ———
add({
  id: "US-S12-001",
  sprint: "S12",
  phase: "P3 Depth",
  epic: "CRM Depth",
  module: "Leads",
  title: "Bulk assign / bulk status change for Leads",
  description: "Select rows; bulk actions with permission + audit.",
  ac: "Batch size capped; partial success report; audited; respects Table ACL Update.",
  persona: "Sales Manager",
  priority: PRIORITIES.P1,
  points: 8,
});
add({
  id: "US-S12-002",
  sprint: "S12",
  phase: "P3 Depth",
  epic: "CRM Depth",
  module: "Leads",
  title: "Duplicate detection warning on Lead create",
  description: "Warn on matching email/company; allow proceed.",
  ac: "Warning modal; does not block unless configured later.",
  persona: "Sales Exec",
  priority: PRIORITIES.P1,
  points: 5,
});
add({
  id: "US-S12-003",
  sprint: "S12",
  phase: "P3 Depth",
  epic: "CRM Depth",
  module: "Deals",
  title: "Deal stage conditional fields (close date / lost reason)",
  description: "Require close date on WON; lost reason on LOST.",
  ac: "Client+server validation; form shows fields conditionally.",
  persona: "Sales Exec",
  priority: PRIORITIES.P1,
  points: 5,
});
add({
  id: "US-S12-004",
  sprint: "S12",
  phase: "P3 Depth",
  epic: "CRM Depth",
  module: "Meetings",
  title: "Meeting activity richness (attendees, location, outcome)",
  description: "Extend meeting form/detail without breaking activity model.",
  ac: "Fields optional; list filters by outcome; clutter-free layout.",
  persona: "Sales Exec",
  priority: PRIORITIES.P2,
  points: 8,
});
add({
  id: "US-S12-005",
  sprint: "S12",
  phase: "P3 Depth",
  epic: "CRM Depth",
  module: "Calls",
  title: "Call activity richness (direction, duration, outcome)",
  description: "Call-specific fields on activity type CALL.",
  ac: "Create/edit/detail support; filters include direction/outcome.",
  persona: "Sales Exec",
  priority: PRIORITIES.P2,
  points: 5,
});
add({
  id: "US-S12-006",
  sprint: "S12",
  phase: "P3 Depth",
  epic: "CRM Depth",
  module: "Documents",
  title: "Documents module UX polish + upload from library",
  description: "Upload attaching to entity from Documents page.",
  ac: "Upload requires entity lookup; list/tile; download works.",
  persona: "Org User",
  priority: PRIORITIES.P1,
  points: 5,
});

// ——— S9 Delivery depth + FLS ———
add({
  id: "US-S13-001",
  sprint: "S13",
  phase: "P3 Depth",
  epic: "Delivery Depth",
  module: "Projects",
  title: "Project health indicators on list (on track / delayed)",
  description: "Derived from dates/milestones without clutter.",
  ac: "Badge on list; filter Delayed works.",
  persona: "PM",
  priority: PRIORITIES.P2,
  points: 5,
});
add({
  id: "US-S13-002",
  sprint: "S13",
  phase: "P3 Depth",
  epic: "Delivery Depth",
  module: "Allocations",
  title: "Over-allocation warning UX",
  description: "Surface utilization conflicts clearly on create/edit.",
  ac: "Warning before save; server still enforces rules.",
  persona: "Resource Manager",
  priority: PRIORITIES.P1,
  points: 5,
});
add({
  id: "US-S13-003",
  sprint: "S13",
  phase: "P3 Depth",
  epic: "FLS",
  module: "Security",
  title: "Regression: rate fields remain protected via Field ACL on delivery screens",
  description: "Verify Resource/Allocation/Timesheet UIs honor Field ACL from Studio (US-S11-002).",
  ac: "Sales cannot see rates on delivery screens; Finance can; no hard-coded bypass left.",
  persona: "Org Admin",
  priority: PRIORITIES.P1,
  points: 5,
  deps: "US-S11-002",
});
add({
  id: "US-S13-004",
  sprint: "S13",
  phase: "P3 Depth",
  epic: "CRM Depth",
  module: "Accounts",
  title: "Account RecordShell related lists complete",
  description: "Contacts, Deals, Projects, Activities, Documents, Notes.",
  ac: "All related lists permission-scoped; empty states.",
  persona: "Sales Manager",
  priority: PRIORITIES.P1,
  points: 8,
  deps: "US-S6-006",
});

// ——— S14 Approval ———
add({
  id: "US-S14-001",
  sprint: "S14",
  phase: "P4 Engines",
  epic: "Approval Engine",
  module: "Approvals",
  title: "Approval tables + domain model",
  description: "approval_workflows, steps, requests, actions.",
  ac: "Migrations; entities; no UI yet required.",
  persona: "Engineer",
  priority: PRIORITIES.P0,
  points: 8,
});
add({
  id: "US-S14-002",
  sprint: "S14",
  phase: "P4 Engines",
  epic: "Approval Engine",
  module: "Timesheets",
  title: "Timesheet approval via Approval Engine (dual-write)",
  description: "Keep timesheet status in sync with approval_request.",
  ac: "Approve/reject works; history preserved; tests.",
  persona: "PM",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S14-001",
});
add({
  id: "US-S14-003",
  sprint: "S14",
  phase: "P4 Engines",
  epic: "Approval Engine",
  module: "Approvals",
  title: "My Approvals inbox UI",
  description: "Clutter-free list of pending approvals.",
  ac: "Filter by type; act approve/reject with comment.",
  persona: "Approver",
  priority: PRIORITIES.P1,
  points: 8,
  deps: "US-S14-001",
});

// ——— S11 Workflow ———
add({
  id: "US-S15-001",
  sprint: "S15",
  phase: "P4 Engines",
  epic: "Workflow Engine",
  module: "Workflow",
  title: "Outbox/domain_events + workflow skeleton",
  description: "Reliable async actions after commit.",
  ac: "Outbox table; poller; idempotent handler stub.",
  persona: "Engineer",
  priority: PRIORITIES.P0,
  points: 13,
});
add({
  id: "US-S15-002",
  sprint: "S15",
  phase: "P4 Engines",
  epic: "Workflow Engine",
  module: "Deals",
  title: "Workflow: Deal WON → notify PM (action pack v1)",
  description: "Typed action NOTIFY; no Deluge.",
  ac: "Event published; notification created; execution audited.",
  persona: "Org Admin",
  priority: PRIORITIES.P1,
  points: 8,
  deps: "US-S15-001",
});

// ——— S12–S14 Finance ———
add({
  id: "US-S16-001",
  sprint: "S16",
  phase: "P5 Finance",
  epic: "Finance",
  module: "Taxes",
  title: "Tax rates master (GST-ready)",
  description: "Tax name/code/rate/jurisdiction; CGST/SGST/IGST capable.",
  ac: "CRUD org-scoped; used on invoice lines.",
  persona: "Finance",
  priority: PRIORITIES.P0,
  points: 8,
});
add({
  id: "US-S16-002",
  sprint: "S16",
  phase: "P5 Finance",
  epic: "Finance",
  module: "Invoices",
  title: "Invoice schema + draft create from project/account",
  description: "Invoices, items, numbering sequence.",
  ac: "Draft invoice; org+region; permissions; list shell UX.",
  persona: "Finance",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S16-001,US-S11-002",
});
add({
  id: "US-S16-003",
  sprint: "S16",
  phase: "P5 Finance",
  epic: "Finance",
  module: "Invoices",
  title: "Pull billable approved timesheet lines into invoice",
  description: "Prevent double billing with unique guard.",
  ac: "Only approved billable; cannot invoice twice; tests.",
  persona: "Finance",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S16-002",
});
add({
  id: "US-S17-001",
  sprint: "S17",
  phase: "P5 Finance",
  epic: "Finance",
  module: "Invoices",
  title: "Invoice lifecycle Issue / Void / Overdue",
  description: "Immutable issued money fields; void path.",
  ac: "Status transitions validated; audited; UI actions clear.",
  persona: "Finance",
  priority: PRIORITIES.P0,
  points: 8,
  deps: "US-S16-002",
});
add({
  id: "US-S17-002",
  sprint: "S17",
  phase: "P5 Finance",
  epic: "Finance",
  module: "Payments",
  title: "Record payments (partial/full) against invoice",
  description: "Payment allocation updates balance/status.",
  ac: "Partial→PARTIALLY_PAID; full→PAID; form optimized.",
  persona: "Finance",
  priority: PRIORITIES.P0,
  points: 8,
  deps: "US-S17-001",
});
add({
  id: "US-S17-003",
  sprint: "S17",
  phase: "P5 Finance",
  epic: "Finance",
  module: "Invoices",
  title: "Advanced filters for Invoices",
  description: "Status, due, overdue, account, balance, date.",
  ac: "FilterEngine catalog; saved views.",
  persona: "Finance",
  priority: PRIORITIES.P1,
  points: 5,
});
add({
  id: "US-S18-001",
  sprint: "S18",
  phase: "P5 Finance",
  epic: "Finance",
  module: "Credit Notes",
  title: "Credit notes issue/apply",
  description: "Corrections without editing issued invoices.",
  ac: "Apply reduces balance; audited; permission gated.",
  persona: "Finance",
  priority: PRIORITIES.P1,
  points: 13,
  deps: "US-S17-001",
});
add({
  id: "US-S18-002",
  sprint: "S18",
  phase: "P5 Finance",
  epic: "Finance",
  module: "Invoices",
  title: "Invoice RecordShell + PDF/export later stub",
  description: "Detail experience for invoice; export CSV first.",
  ac: "Related payments/credits; clutter-free header actions.",
  persona: "Finance",
  priority: PRIORITIES.P1,
  points: 8,
});

// ——— S15 Contracts ———
add({
  id: "US-S19-001",
  sprint: "S19",
  phase: "P6 Contracts/Expenses",
  epic: "Contracts",
  module: "Contracts",
  title: "Contracts CRUD + Account/Project link",
  description: "Value, dates, renewal, terms, status.",
  ac: "ModuleListShell; form sections; org isolation.",
  persona: "Org Admin",
  priority: PRIORITIES.P0,
  points: 13,
});
add({
  id: "US-S19-002",
  sprint: "S19",
  phase: "P6 Contracts/Expenses",
  epic: "Contracts",
  module: "Contracts",
  title: "Expiry reminders notifications",
  description: "Scheduler creates notifications N days before end.",
  ac: "Configurable window; no duplicate spam; audited runs.",
  persona: "Org Admin",
  priority: PRIORITIES.P1,
  points: 8,
  deps: "US-S19-001",
});
add({
  id: "US-S19-003",
  sprint: "S19",
  phase: "P6 Contracts/Expenses",
  epic: "Contracts",
  module: "Contracts",
  title: "Advanced filters for Contracts",
  description: "Status, expiry window, account, auto-renew.",
  ac: "Relative date expiry filters work.",
  persona: "Org Admin",
  priority: PRIORITIES.P1,
  points: 5,
});

// ——— S16 Expenses ———
add({
  id: "US-S20-001",
  sprint: "S20",
  phase: "P6 Contracts/Expenses",
  epic: "Expenses",
  module: "Expenses",
  title: "Expenses CRUD with receipt documents",
  description: "Employee/project expenses; categories; billable flag.",
  ac: "Upload receipt via Documents; form optimized; list filters.",
  persona: "Employee",
  priority: PRIORITIES.P0,
  points: 13,
});
add({
  id: "US-S20-002",
  sprint: "S20",
  phase: "P6 Contracts/Expenses",
  epic: "Expenses",
  module: "Expenses",
  title: "Expense approval via Approval Engine",
  description: "Submit → approve/reject.",
  ac: "Appears in My Approvals; status synced.",
  persona: "PM/Finance",
  priority: PRIORITIES.P0,
  points: 8,
  deps: "US-S14-001,US-S20-001",
});
add({
  id: "US-S20-003",
  sprint: "S20",
  phase: "P6 Contracts/Expenses",
  epic: "Expenses",
  module: "Expenses",
  title: "Advanced filters for Expenses",
  description: "Category, project, employee, approval status, billable.",
  ac: "Catalog complete; saved views.",
  persona: "Finance",
  priority: PRIORITIES.P1,
  points: 5,
});

// ——— S17–S18 Procurement ———
add({
  id: "US-S21-001",
  sprint: "S21",
  phase: "P7 Procurement",
  epic: "Procurement",
  module: "Vendors",
  title: "Vendors module CRUD",
  description: "Vendor master for procurement.",
  ac: "List/form/detail; filters; org isolation.",
  persona: "Finance",
  priority: PRIORITIES.P0,
  points: 8,
});
add({
  id: "US-S21-002",
  sprint: "S21",
  phase: "P7 Procurement",
  epic: "Procurement",
  module: "Purchase Orders",
  title: "Purchase Orders + PO items draft",
  description: "PO linked to vendor/project.",
  ac: "Create draft with lines; totals; ModuleListShell UX.",
  persona: "Finance",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S21-001",
});
add({
  id: "US-S22-001",
  sprint: "S22",
  phase: "P7 Procurement",
  epic: "Procurement",
  module: "Purchase Orders",
  title: "PO approval + status lifecycle",
  description: "PENDING_APPROVAL → APPROVED/REJECTED → SENT/CLOSED.",
  ac: "Uses Approval Engine; audited.",
  persona: "Org Admin",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S14-001,US-S21-002",
});
add({
  id: "US-S22-002",
  sprint: "S22",
  phase: "P7 Procurement",
  epic: "Procurement",
  module: "Purchase Orders",
  title: "Advanced filters for POs and Vendors",
  description: "Status, vendor, project, amount, approval state.",
  ac: "Filter catalogs live.",
  persona: "Finance",
  priority: PRIORITIES.P1,
  points: 5,
});

// ——— S19–S20 Reports ———
add({
  id: "US-S23-001",
  sprint: "S23",
  phase: "P8 Reports",
  epic: "Reports",
  module: "Reports",
  title: "Reports module shell + permission REPORT_VIEW",
  description: "Clutter-free report gallery.",
  ac: "Nav enabled; cards for available reports only.",
  persona: "Org Admin",
  priority: PRIORITIES.P0,
  points: 5,
});
add({
  id: "US-S23-002",
  sprint: "S23",
  phase: "P8 Reports",
  epic: "Reports",
  module: "Reports",
  title: "Sales & pipeline analytics report",
  description: "Lead funnel, win/loss, pipeline by stage.",
  ac: "Filters region/date; export CSV; org scoped.",
  persona: "Sales Manager",
  priority: PRIORITIES.P0,
  points: 13,
});
add({
  id: "US-S23-003",
  sprint: "S23",
  phase: "P8 Reports",
  epic: "Reports",
  module: "Reports",
  title: "Project & timesheet analytics report",
  description: "Status, hours billable/non-billable, delays.",
  ac: "Filters project/date; permissioned.",
  persona: "PM",
  priority: PRIORITIES.P1,
  points: 8,
});
add({
  id: "US-S24-001",
  sprint: "S24",
  phase: "P8 Reports",
  epic: "Reports",
  module: "Reports",
  title: "Finance AR & invoice aging report",
  description: "Outstanding, aging buckets.",
  ac: "Respects FLS; Finance permission.",
  persona: "Finance",
  priority: PRIORITIES.P0,
  points: 8,
  deps: "US-S17-002",
});
add({
  id: "US-S24-002",
  sprint: "S24",
  phase: "P8 Reports",
  epic: "Reports",
  module: "Reports",
  title: "Project profitability report",
  description: "Revenue − resource cost − expenses.",
  ac: "RATE_VIEW for cost; formula documented; export.",
  persona: "Org Admin",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S11-002,US-S16-002,US-S20-001",
});
add({
  id: "US-S24-003",
  sprint: "S24",
  phase: "P8 Reports",
  epic: "Reports",
  module: "Reports",
  title: "Advanced filters on all report pages",
  description: "Date range, region, owner, account, project.",
  ac: "Consistent filter UX; no clutter.",
  persona: "Org User",
  priority: PRIORITIES.P1,
  points: 5,
});

// ——— S21–S22 Portal + harden ———
add({
  id: "US-S25-001",
  sprint: "S25",
  phase: "P9 Portal",
  epic: "Customer Portal",
  module: "Portal",
  title: "portal_users + portal auth audience",
  description: "Separate auth; never mix with internal users.",
  ac: "Login/refresh; JWT audience PORTAL; isolation tests.",
  persona: "Customer User",
  priority: PRIORITIES.P0,
  points: 13,
});
add({
  id: "US-S25-002",
  sprint: "S25",
  phase: "P9 Portal",
  epic: "Customer Portal",
  module: "Portal",
  title: "Portal read APIs for projects/invoices/documents",
  description: "Account-scoped only; no costs/margins/audit.",
  ac: "IDOR tests; visibility=CUSTOMER documents only.",
  persona: "Customer User",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S25-001",
});
add({
  id: "US-S26-001",
  sprint: "S26",
  phase: "P9 Portal",
  epic: "Customer Portal",
  module: "Portal",
  title: "Portal UI (clutter-free customer experience)",
  description: "/portal routes; limited nav.",
  ac: "Projects, invoices, docs; no admin chrome.",
  persona: "Customer User",
  priority: PRIORITIES.P0,
  points: 13,
  deps: "US-S25-002",
});
add({
  id: "US-S26-002",
  sprint: "S26",
  phase: "P9 Portal",
  epic: "Hardening",
  module: "Platform",
  title: "V2 production hardening checklist",
  description: "Swagger off, rate limits, backups, seed cleanup, perf smoke.",
  ac: "Checklist signed; CRITICAL bugs zero.",
  persona: "Tech Lead",
  priority: PRIORITIES.P0,
  points: 8,
});
add({
  id: "US-S26-003",
  sprint: "S26",
  phase: "P9 Portal",
  epic: "Hardening",
  module: "All",
  title: "End-to-end UAT: Platform sell → Org CRM → Invoice → Portal",
  description: "Golden path across Super Admin and tenant.",
  ac: "UAT script pass; Excel stories for path marked Done.",
  persona: "Product Owner",
  priority: PRIORITIES.P0,
  points: 8,
});

// Extra cross-cutting stories
add({
  id: "US-CX-001",
  sprint: "S4",
  phase: "P1 UX System",
  epic: "UX Quality",
  module: "All",
  title: "Empty/Loading/Error/Forbidden states audit all modules",
  description: "Every list/detail has consistent states.",
  ac: "Checklist per module; no blank white failures.",
  persona: "QA",
  priority: PRIORITIES.P1,
  points: 5,
});
add({
  id: "US-CX-002",
  sprint: "S7",
  phase: "P1 UX System",
  epic: "Advanced Filters",
  module: "All",
  title: "Saved Views shared/public (org admin)",
  description: "Extend private views to SHARED/PUBLIC with ACL.",
  ac: "Only Org Admin publishes PUBLIC; others private/shared.",
  persona: "Org Admin",
  priority: PRIORITIES.P2,
  points: 8,
});
add({
  id: "US-CX-003",
  sprint: "S1",
  phase: "P0 Platform Split",
  epic: "Documentation",
  module: "Docs",
  title: "Update ROLE_PERMISSION_MATRIX for Platform vs Tenant",
  description: "Document Super Admin cannot use tenant Leads.",
  ac: "Matrix updated; linked from plan.",
  persona: "Product Owner",
  priority: PRIORITIES.P1,
  points: 2,
});

// Additional coverage — meetings/tasks/calls manage, settings, timesheet UX, org isolation tests
add({
  id: "US-S5-008",
  sprint: "S5",
  phase: "P1 UX System",
  epic: "Form System",
  module: "Timesheets",
  title: "Timesheet submit/approve UI polish (clutter-free)",
  description: "Clear week grid actions; approval comments; status badges.",
  ac: "Employee and approver flows obvious; errors inline.",
  persona: "Employee/PM",
  priority: PRIORITIES.P1,
  points: 5,
});
add({
  id: "US-S6-008",
  sprint: "S6",
  phase: "P1 UX System",
  epic: "Form System",
  module: "Settings",
  title: "Organization settings form (currency, timezone, tax defaults)",
  description: "Tenant settings page optimized; Super Admin does not edit tenant settings here.",
  ac: "Org Admin only; validation; audited updates.",
  persona: "Org Admin",
  priority: PRIORITIES.P1,
  points: 5,
});
add({
  id: "US-S12-007",
  sprint: "S12",
  phase: "P3 Depth",
  epic: "CRM Depth",
  module: "Tasks",
  title: "Activity Task manage (complete, reschedule, priority)",
  description: "Full manage actions inside Tasks list/detail.",
  ac: "Complete/reschedule from detail; filters overdue/today.",
  persona: "Sales Exec",
  priority: PRIORITIES.P1,
  points: 5,
});
add({
  id: "US-S12-008",
  sprint: "S12",
  phase: "P3 Depth",
  epic: "CRM Depth",
  module: "Meetings",
  title: "Manage meetings (reschedule, complete, related record)",
  description: "Meeting lifecycle from list and RecordShell.",
  ac: "Actions permissioned; related entity required.",
  persona: "Sales Exec",
  priority: PRIORITIES.P1,
  points: 5,
});
add({
  id: "US-S12-009",
  sprint: "S12",
  phase: "P3 Depth",
  epic: "CRM Depth",
  module: "Calls",
  title: "Manage calls (log outcome, complete)",
  description: "Call logging optimized for speed.",
  ac: "Quick log form; outcome required on complete.",
  persona: "Sales Exec",
  priority: PRIORITIES.P1,
  points: 5,
});
add({
  id: "US-S2-005",
  sprint: "S2",
  phase: "P0 Platform Split",
  epic: "Organizations",
  module: "Organizations",
  title: "Seed default roles/permissions when creating organization",
  description: "New org gets system roles catalog copy/grants.",
  ac: "Org Admin can login and manage users; isolation verified.",
  persona: "Super Admin",
  priority: PRIORITIES.P0,
  points: 8,
  deps: "US-S2-002",
});
add({
  id: "US-S13-005",
  sprint: "S13",
  phase: "P3 Depth",
  epic: "Delivery Depth",
  module: "Skills",
  title: "Skill matrix UX on Resource detail",
  description: "Assign proficiency levels clutter-free.",
  ac: "Add/remove skills; filters by skill on Resources.",
  persona: "Resource Manager",
  priority: PRIORITIES.P2,
  points: 5,
});
add({
  id: "US-S15-003",
  sprint: "S15",
  phase: "P4 Engines",
  epic: "Workflow Engine",
  module: "Workflow",
  title: "Workflow admin UI (definitions list — read/configure basic)",
  description: "Minimal UI to enable/disable workflow definitions.",
  ac: "Org Admin can toggle; no script injection; audited.",
  persona: "Org Admin",
  priority: PRIORITIES.P2,
  points: 8,
  deps: "US-S15-001",
});
add({
  id: "US-S18-003",
  sprint: "S18",
  phase: "P5 Finance",
  epic: "Finance",
  module: "Finance",
  title: "Finance nav module group + permission seeding",
  description: "Enable Invoices/Payments nav by permission after seed.",
  ac: "Hidden without permission; Super Admin platform nav separate.",
  persona: "Finance",
  priority: PRIORITIES.P0,
  points: 3,
});
add({
  id: "US-S23-004",
  sprint: "S23",
  phase: "P8 Reports",
  epic: "Reports",
  module: "Reports",
  title: "Resource utilization report",
  description: "Capacity vs allocated vs timesheet hours.",
  ac: "Date/region filters; RATE fields FLS safe.",
  persona: "Resource Manager",
  priority: PRIORITIES.P1,
  points: 8,
  deps: "US-S11-002",
});
add({
  id: "US-S24-004",
  sprint: "S24",
  phase: "P8 Reports",
  epic: "Reports",
  module: "Reports",
  title: "Procurement & expense spend reports",
  description: "PO spend by vendor/project; expenses by category.",
  ac: "Exports; org scoped.",
  persona: "Finance",
  priority: PRIORITIES.P1,
  points: 8,
  deps: "US-S20-001,US-S21-002",
});
add({
  id: "US-S3-005",
  sprint: "S3",
  phase: "P0 Platform Split",
  epic: "Prospect Orgs",
  module: "Prospect Orgs",
  title: "Prospect Org notes/documents (platform)",
  description: "Attach proposals while selling TechEarnest.",
  ac: "Notes+docs on prospect; platform-only storage scope.",
  persona: "Super Admin",
  priority: PRIORITIES.P2,
  points: 5,
  deps: "US-S3-001",
});
add({
  id: "US-CX-004",
  sprint: "S7",
  phase: "P1 UX System",
  epic: "UX Quality",
  module: "All",
  title: "Accessibility pass (keyboard, focus, labels) on ModuleListShell",
  description: "High-level UI remains usable via keyboard.",
  ac: "Filter toggle, table, create reachable; contrast OK.",
  persona: "QA",
  priority: PRIORITIES.P2,
  points: 5,
});
add({
  id: "US-CX-005",
  sprint: "S26",
  phase: "P9 Portal",
  epic: "Hardening",
  module: "Security",
  title: "Cross-tenant isolation regression suite for all V2 modules",
  description: "Automated tests org A cannot see org B finance/CRM.",
  ac: "Suite green in CI; covers invoices/expenses/contracts/POs.",
  persona: "Tech Lead",
  priority: PRIORITIES.P0,
  points: 13,
});

// ——— Workbook ———
const wb = XLSX.utils.book_new();

// Overview
const overview = [
  ["TechEarnest CRM — Full Application Sprint Backlog (through V2)"],
  ["Companion plan", "docs/PRODUCT_OPTIMIZATION_AND_V2_DELIVERY_PLAN.md"],
  ["Generated", new Date().toISOString().slice(0, 10)],
  [],
  ["How to use"],
  ["1. Implement in batches of 5 user stories (sheet order) — see all-sprint-testing/EXECUTION-CADENCE.md"],
  ["2. Filter UserStories by Status = Not Started; take next 5"],
  ["3. Set Status In Progress → Done; fill Updated On"],
  ["4. Allowed Status: Not Started | In Progress | Blocked | Done | Deferred"],
  ["5. Do not delete Story IDs; add new rows at bottom if needed"],
  [],
  ["Phase summary"],
  ["P0 Platform Split", "S1–S3", "Super Admin console; org create; Prospect Orgs; hide tenant Leads"],
  ["P1 UX System", "S4–S7", "Forms, RecordShell, advanced filters all live modules"],
  ["P2 Metadata Studio", "S8–S11", "ServiceNow-like tables/fields/forms/lists/CRUD ACL/FLS"],
  ["P3 Depth", "S12–S13", "Bulk, duplicates, meetings/calls, delivery UX"],
  ["P4 Engines", "S14–S15", "Approval + Workflow"],
  ["P5 Finance", "S16–S18", "Taxes, Invoices, Payments, Credit Notes"],
  ["P6 Contracts/Expenses", "S19–S20", "Contracts + Expenses"],
  ["P7 Procurement", "S21–S22", "Vendors + POs"],
  ["P8 Reports", "S23–S24", "Analytics + profitability"],
  ["P9 Portal", "S25–S26", "Customer portal + hardening"],
  [],
  ["Product rules"],
  ["Super Admin sells/manages organizations — does NOT run tenant CRM Leads"],
  ["Organization Admin runs complete tenant CRM + V2 modules"],
  ["Org Admin configures tables/forms/lists/CRUD via Metadata & ACL Studio (role-based)"],
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overview), "Overview");

// Sprint calendar
const calendar = [
  ["Sprint", "Phase", "Theme", "Goal", "Status"],
  ["S1", "P0", "Platform Console", "Layout + API gate + hide tenant CRM for Super Admin", "Not Started"],
  ["S2", "P0", "Organizations", "Multi-org create/suspend/detail", "Not Started"],
  ["S3", "P0", "Prospect Orgs", "SaaS sales pipeline + convert to org", "Not Started"],
  ["S4", "P1", "Form kit CRM", "Shared form system + CRM forms", "Not Started"],
  ["S5", "P1", "Form kit Delivery", "Projects/resources/timesheet forms", "Not Started"],
  ["S6", "P1", "Admin + RecordShell", "Admin forms + RecordShell", "Not Started"],
  ["S7", "P1", "Advanced Filters", "Filter catalogs every module", "Not Started"],
  ["S8", "P2", "Dictionary", "Studio shell + Table/Field dictionary + seeds", "Not Started"],
  ["S9", "P2", "Form/List designers", "Form + List + related layouts + policies", "Not Started"],
  ["S10", "P2", "Table ACL", "CRUD matrix UI + server enforce + roles UX", "Not Started"],
  ["S11", "P2", "FLS + rollout", "Field ACL + layouts on all modules", "Not Started"],
  ["S12", "P3", "CRM depth", "Bulk, duplicates, meetings/calls", "Not Started"],
  ["S13", "P3", "Delivery depth", "Project/allocation UX + related lists", "Not Started"],
  ["S14", "P4", "Approvals", "Engine + timesheet + inbox", "Not Started"],
  ["S15", "P4", "Workflow", "Outbox + Deal WON notify", "Not Started"],
  ["S16", "P5", "Finance foundation", "Tax + invoice draft + billable pull", "Not Started"],
  ["S17", "P5", "Finance lifecycle", "Issue/pay/overdue + filters", "Not Started"],
  ["S18", "P5", "Credit notes", "Credits + invoice detail", "Not Started"],
  ["S19", "P6", "Contracts", "CRUD + reminders + filters", "Not Started"],
  ["S20", "P6", "Expenses", "CRUD + approval + filters", "Not Started"],
  ["S21", "P7", "Vendors/PO draft", "Vendors + PO draft", "Not Started"],
  ["S22", "P7", "PO approval", "Lifecycle + filters", "Not Started"],
  ["S23", "P8", "Reports core", "Gallery + sales/project reports", "Not Started"],
  ["S24", "P8", "AR + Profit", "Aging + profitability", "Not Started"],
  ["S25", "P9", "Portal auth/API", "portal_users + read APIs", "Not Started"],
  ["S26", "P9", "Portal UI + UAT", "UI + hardening + E2E UAT", "Not Started"],
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(calendar), "SprintCalendar");

// User stories
const ws = XLSX.utils.json_to_sheet(stories);
ws["!cols"] = [
  { wch: 12 },
  { wch: 6 },
  { wch: 18 },
  { wch: 18 },
  { wch: 16 },
  { wch: 48 },
  { wch: 55 },
  { wch: 55 },
  { wch: 14 },
  { wch: 8 },
  { wch: 8 },
  { wch: 12 },
  { wch: 14 },
  { wch: 20 },
  { wch: 12 },
  { wch: 20 },
];
XLSX.utils.book_append_sheet(wb, ws, "UserStories");

// Status legend
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.aoa_to_sheet([
    ["Status", "Meaning"],
    ["Not Started", "Queued"],
    ["In Progress", "Actively being built"],
    ["Blocked", "Waiting on dependency/decision"],
    ["Done", "Meets Definition of Done"],
    ["Deferred", "Moved out of current release intentionally"],
    [],
    ["Priority", "Meaning"],
    ["P0", "Must for phase gate"],
    ["P1", "Should in phase"],
    ["P2", "Nice / deepen"],
    ["P3", "Future"],
  ]),
  "Legend",
);

// Epic rollup
const epicMap = new Map();
for (const s of stories) {
  const key = s.Epic;
  if (!epicMap.has(key)) epicMap.set(key, { Epic: key, Stories: 0, Points: 0 });
  const row = epicMap.get(key);
  row.Stories += 1;
  row.Points += Number(s["Story Points"]) || 0;
}
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet([...epicMap.values()]),
  "Epics",
);

const out = path.join(__dirname, "TECH_EARNEST_CRM_SPRINT_BACKLOG.xlsx");
try {
  XLSX.writeFile(wb, out);
  console.log(`Wrote ${out} with ${stories.length} user stories`);
} catch (e) {
  if (e && e.code === "EBUSY") {
    const alt = path.join(__dirname, "TECH_EARNEST_CRM_SPRINT_BACKLOG_v2.xlsx");
    XLSX.writeFile(wb, alt);
    console.log(`Primary xlsx locked; wrote ${alt} with ${stories.length} user stories`);
  } else {
    throw e;
  }
}
