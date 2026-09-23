# Product Scope

**Product:** TechEarnest CRM + Project + Resource Management Platform  
**Audience:** Organizations that sell, staff, and deliver professional services work

This is not a clone of Zoho CRM or any other vendor product. UX, information architecture, and implementation are original. The comparable *category* is enterprise CRM plus professional-services operations.

---

## 1. Product thesis

Build **one connected operating system** for:

**Lead → Account / Contact → Deal → Project → Task → Resource → Timesheet → (V2) Invoice → Payment**

Differentiation:

1. CRM and project management in one product
2. Resource allocation and utilization as a first-class module
3. Region-based access control
4. End-to-end commercial lifecycle
5. Project profitability (rates + hours; invoices in V2)
6. Extensible workflow and approval architecture
7. Clean enterprise UX
8. Multi-tenant-ready from day one

The product fails if modules are isolated CRUDs. An Account must show its contacts, deals, projects, resources, timesheets, documents, and activities as one lifecycle.

---

## 2. Users and jobs to be done

| Role | Primary jobs |
| --- | --- |
| Super Admin | Operate the platform, manage organizations |
| Organization Admin | Configure org, regions, users, roles |
| Regional Admin | Run a geography: people, pipeline, projects |
| Sales Executive | Capture and work leads/deals they own |
| Sales Manager | Coach a team pipeline |
| Project Manager | Plan work, assign tasks, approve time |
| Resource Manager | Allocate people, watch capacity |
| Finance User | (V2) invoices, PO, expenses; MVP may view dashboards if permitted |
| Employee | Enter time, complete tasks |
| Viewer | Read-only where permitted |
| Customer (V2 portal) | See their projects, invoices, documents only |

---

## 3. MVP in scope

### 3.1 Administration

- Organization profile and settings (timezone, locale, currency)
- Regions, branches, departments, teams
- Users, roles, permissions
- Regional access control
- Audit logs
- In-app notifications

### 3.2 CRM

- Leads with assignment, notes, attachments, activities
- Transactional lead conversion to Account + Contact + Deal
- Contacts, accounts, deals
- Deal pipeline (kanban + list), stage changes, forecast from value × probability
- Won deal → create project
- Activities: task, call, meeting, note, follow-up, attachable to lead/contact/account/deal/project

### 3.3 Project management

- Projects, milestones, tasks, subtasks
- Assignment, dates, priority, progress %
- Basic task dependencies (finish-to-start)
- Project status and roll-up progress
- Comments and attachments on tasks

### 3.4 Resource management

- Resources (employee, contractor, freelancer, consultant)
- Optional link to a login user
- Skills and resource-skill proficiency
- Availability, capacity hours/week
- Allocations with hours and percentage
- Utilization calculation and over-allocation warning

### 3.5 Timesheets

- Daily entries on a weekly timesheet
- Project/task, billable flag, hours, description
- Submit → PM approve/reject
- Rejected sheets editable and resubmittable
- No self-approval by default

### 3.6 Dashboards

- Organization, regional, sales, project, employee
- Cards backed by real aggregations, scoped by access

### 3.7 Platform capabilities

- Authentication and authorization
- Search, filter, sort, database pagination
- CSV import/export for major entities (leads at minimum; accounts/contacts/deals next)
- File attachments via object storage
- Notifications and audit logs

---

## 4. MVP explicitly out of scope

Do not implement now. Keep as extension points only.

- AI assistant, AI lead scoring, AI predictions
- Advanced marketing automation
- Helpdesk
- Full accounting / GL / tax filing
- Payroll, HRMS
- Mobile native apps
- Partner portal
- Customer portal (V2)
- Invoices, payments, credit notes (V2)
- Purchase orders and vendors (V2)
- Expenses (V2)
- Contracts (V2)
- Generic workflow engine (V2)
- Generic approval engine (V2) — MVP has timesheet approve only
- Advanced analytics suite (V2)
- Kubernetes, Kafka, microservices split

Finance navigation may appear in the UI as disabled or hidden until V2.

---

## 5. Version 2 in scope

### Finance

- Invoices, invoice items, taxes (GST-ready data model)
- Payments and tracking
- Credit notes
- Billable hours from approved timesheets → invoice draft

### Procurement

- Vendors, purchase orders, PO items, PO approval, PO status

### Expenses

- Employee, project, and travel expenses with approval

### Contracts

- Customer contracts, value, dates, renewal, payment terms, documents, expiry reminders

### Advanced resources

- Skill matrix, resource calendar, capacity planning
- Over-allocation detection (enhanced), utilization reporting
- Cost rate vs billing rate used in profitability

### Workflow engine

Generic **Trigger → Condition → Action** (in-process). Example: deal stage WON → create project, notify PM, create default tasks.

### Approval engine

Reusable sequential/parallel approvals for timesheets, POs, expenses, invoices, deals, allocations.

### Analytics

Sales, pipeline, project, resource, timesheet, invoice, expense, profitability reports.

### Customer portal

Customers see only their projects, milestones, tasks, documents, invoices, payments. Never: other customers, employee cost rates, margins, internal notes.

---

## 6. MVP golden path (acceptance)

The MVP is not done until this path works against PostgreSQL with authorization:

1. Admin creates organization
2. Admin creates regions
3. Admin creates departments
4. Admin creates users
5. Admin assigns roles
6. Regional Admin sees only their region
7. Sales Executive creates a lead
8. Lead is assigned
9. Lead is converted (transactional)
10. Account and Contact exist
11. Deal exists
12. Deal moves through the pipeline
13. Deal becomes Won
14. Project is created from the deal
15. Project Manager is assigned
16. Project tasks are created
17. Resources are assigned
18. Allocation / utilization is calculated (over-allocation warned)
19. Employee records time
20. Employee submits timesheet
21. Project Manager approves or rejects
22. Dashboards reflect the data
23. Audit log records important changes
24. Notifications are generated

---

## 7. V2 golden path (acceptance)

- Deal → Project → Resource → Timesheet → billable hours → Invoice → Payment
- Project → Expense
- Vendor → Purchase Order → Approval
- Account → Contract → renewal reminder
- Workflow and approval engines reused across modules

---

## 8. Non-functional scope (MVP)

| Area | Bar |
| --- | --- |
| Tenancy | No cross-organization data access |
| Regions | Regional Admin cannot read other regions via API |
| Performance | List endpoints paginated at the database |
| Security | JWT, BCrypt, permission + region checks server-side |
| UX | Sidebar + top nav + breadcrumb; responsive enterprise UI |
| Quality | Tests per module; security tests for isolation |
| Docs | OpenAPI for production APIs |

---

## 9. Assumptions

1. **Single currency per organization** in MVP (ISO code on organization). Multi-currency is V2+.
2. **English UI** in MVP.
3. **Email delivery** can be logged locally in development; SES in production config.
4. **One login identity per person per organization.** The same human in two orgs is two user records (standard SaaS).
5. **Project tasks and CRM activities are different entities.** A CRM “Task” activity is follow-up work; a project task is WBS work.
6. **Customer portal users** are a different principal type in V2, not reused Employee logins.
7. **GST-ready** means tax rates, HSN/SAC optional fields, and invoice tax lines — not GSTR filing.
8. **Profitability in MVP** can show planned vs actual hours and cost/bill rates on allocations; recognized revenue waits for invoices in V2.

---

## 10. Success metric for this documentation phase

Stakeholders can agree:

- What is in MVP vs V2
- How tenants, regions, and roles work
- The relational model and API style
- The first implementation slice to build

Feature screens are **not** in this phase.
