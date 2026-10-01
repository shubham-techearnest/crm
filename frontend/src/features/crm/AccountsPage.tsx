import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ACCESS_TOKEN_KEY } from "@/api/client";
import { AccountCreateView } from "./AccountCreateView";
import { buildOwnerOptions, enumPickerOptions, optionsFromPairs, TechEarnestFilterSelect } from "@/components/TechEarnestCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleFilterField, ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { deleteRecord, postServerBulk, putRecord } from "@/components/BulkActions/bulkActions";
import { enumOptions, useActiveUserOptions } from "@/components/BulkActions/useBulkOptions";
import { RecordShell, DEFAULT_RELATED_LINKS } from "@/components/RecordShell";
import {
  buildTimelineEntries,
  recordLifecycleInfo,
  TechEarnestRecordInfoSection,
  TechEarnestRecordRelatedCard,
  TechEarnestRecordSummaryStrip,
  TechEarnestRecordTimeline,
  useRecordNavigation,
} from "@/components/TechEarnestRecord";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listAuditLogs, listRegions, listUsers } from "@/features/admin/adminApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { useBulkImport } from "@/features/import/useBulkImport";
import { RelatedRecordList } from "@/components/RecordLink";
import { useUrlSelection } from "@/hooks/useUrlRecord";
import { listContracts } from "@/features/contracts/contractApi";
import { listInvoices } from "@/features/finance/invoiceApi";
import {
  getAccount,
  listAccountContacts,
  listAccountDeals,
  listAccountProjects,
  listAccounts,
  listActivities,
  type Account,
} from "./crmApi";
import {
  createNote,
  deleteDocument,
  deleteNote,
  documentDownloadUrl,
  listDocuments,
  listNotes,
  uploadDocument,
} from "./foundationApi";

function accountUpdateBody(account: Account, patch: { status?: string; accountType?: string }) {
  return {
    regionId: account.regionId,
    ownerId: account.ownerId,
    name: account.name,
    industry: account.industry,
    website: account.website,
    email: account.email,
    phone: account.phone,
    billingAddress: account.billingAddress,
    shippingAddress: account.shippingAddress,
    taxNumber: account.taxNumber,
    status: patch.status ?? account.status,
    accountType: patch.accountType ?? account.accountType,
    description: account.description,
  };
}

export function AccountsPage() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const [params] = useSearchParams();
  const canCreate = useHasPermission("ACCOUNT_CREATE");
  const canUpdate = useHasPermission("ACCOUNT_UPDATE");
  const canDelete = useHasPermission("ACCOUNT_DELETE");
  const canViewUsers = useHasPermission("USER_VIEW");
  const bulkOwnerOptions = useActiveUserOptions(canUpdate);
  const canViewNotes = useHasPermission("NOTE_VIEW");
  const canCreateNotes = useHasPermission("NOTE_CREATE");
  const canDeleteNotes = useHasPermission("NOTE_DELETE");
  const canViewDocs = useHasPermission("DOCUMENT_VIEW");
  const canUploadDocs = useHasPermission("DOCUMENT_UPLOAD");
  const canDeleteDocs = useHasPermission("DOCUMENT_DELETE");
  const canViewActivities = useHasPermission("ACTIVITY_VIEW");
  const canViewProjects = useHasPermission("PROJECT_VIEW");
  const canViewAudit = useHasPermission("AUDIT_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const canViewInvoices = useHasPermission("INVOICE_VIEW");
  const canViewContracts = useHasPermission("CONTRACT_VIEW");

  useEffect(() => {
    if (params.get("create") === "1") setShowForm(true);
  }, [params, setShowForm]);

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter || undefined,
      accountType: typeFilter || undefined,
      industry: industryFilter || undefined,
      regionId: regionFilter || undefined,
    }),
    [search, statusFilter, typeFilter, industryFilter, regionFilter],
  );

  const accountsQuery = useQuery({
    queryKey: ["crm", "accounts", listParams],
    queryFn: () => listAccounts(listParams),
  });
  const [selected, setSelected] = useUrlSelection(accountsQuery.data, { fetchById: getAccount });
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: (!!selected && canViewUsers) || (showForm && canCreate) || (showEdit && canUpdate),
  });
  const contactsQuery = useQuery({
    queryKey: ["crm", "accounts", (selected as Account | null)?.id, "contacts"],
    queryFn: () => listAccountContacts(selected!.id),
    enabled: !!selected,
  });
  const dealsQuery = useQuery({
    queryKey: ["crm", "accounts", (selected as Account | null)?.id, "deals"],
    queryFn: () => listAccountDeals(selected!.id),
    enabled: !!selected,
  });
  const activitiesQuery = useQuery({
    queryKey: ["crm", "activities", "ACCOUNT", (selected as Account | null)?.id],
    queryFn: () => listActivities({ relatedEntityType: "ACCOUNT", relatedEntityId: selected!.id }),
    enabled: !!selected && canViewActivities,
  });
  const notesQuery = useQuery({
    queryKey: ["crm", "notes", "ACCOUNT", (selected as Account | null)?.id],
    queryFn: () => listNotes("ACCOUNT", selected!.id),
    enabled: !!selected && canViewNotes,
  });
  const docsQuery = useQuery({
    queryKey: ["crm", "documents", "ACCOUNT", (selected as Account | null)?.id],
    queryFn: () => listDocuments("ACCOUNT", selected!.id),
    enabled: !!selected && canViewDocs,
  });
  const projectsQuery = useQuery({
    queryKey: ["projects", "account", (selected as Account | null)?.id],
    queryFn: () => listAccountProjects(selected!.id),
    enabled: !!selected && canViewProjects,
  });
  const auditQuery = useQuery({
    queryKey: ["admin", "audit-logs", "ACCOUNT", (selected as Account | null)?.id],
    queryFn: () => listAuditLogs({ entityType: "ACCOUNT", entityId: selected!.id, size: 30 }),
    enabled: !!selected && canViewAudit,
  });
  const invoicesQuery = useQuery({
    queryKey: ["finance", "invoices", "account", selected?.id],
    queryFn: () => listInvoices({ accountId: selected!.id }),
    enabled: !!selected && canViewInvoices,
  });
  const contractsQuery = useQuery({
    queryKey: ["contracts", "account", selected?.id],
    queryFn: () => listContracts({ accountId: selected!.id }),
    enabled: !!selected && canViewContracts,
  });

  const userLabel = useMemo(() => {
    const map = new Map(
      (usersQuery.data ?? []).map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]),
    );
    return (id: string | null | undefined) => (id ? (map.get(id) ?? id.slice(0, 8)) : "—");
  }, [usersQuery.data]);

  const rows = accountsQuery.data ?? [];
  const recordNav = useRecordNavigation(rows, selected, setSelected);
  const timelineEntries = useMemo(
    () =>
      buildTimelineEntries(
        auditQuery.data,
        activitiesQuery.data,
        (userId) => (userId === auth.userId ? auth.displayName : userLabel(userId)),
        recordLifecycleInfo("Account", selected),
        notesQuery.data,
      ),
    [auditQuery.data, activitiesQuery.data, notesQuery.data, auth.displayName, auth.userId, userLabel, selected],
  );
  const statusFilterOptions = enumPickerOptions(["ACTIVE", "INACTIVE"]);
  const typeFilterOptions = enumPickerOptions(["PROSPECT", "CUSTOMER", "PARTNER", "VENDOR"]);
  const regionFilterOptions = useMemo(
    () => optionsFromPairs((regionsQuery.data ?? []).map((region) => ({ value: region.id, label: region.name }))),
    [regionsQuery.data],
  );
  const activeFilterCount = [search, statusFilter, typeFilter, industryFilter, regionFilter].filter(Boolean)
    .length;
  const bulkImport = useBulkImport("accounts", () =>
    queryClient.invalidateQueries({ queryKey: ["crm", "accounts"] }),
  );

  async function handleAccountCreated(account: Account, mode: "save" | "saveAndNew") {
    await queryClient.invalidateQueries({ queryKey: ["crm", "accounts"] });
    if (mode === "save") {
      setShowForm(false);
      setShowEdit(false);
      setSelected(account);
    }
  }

  function openCreate() {
    setSelected(null);
    setShowForm(true);
  }

  const regionName = useMemo(() => {
    const map = new Map((regionsQuery.data ?? []).map((region) => [region.id, region.name]));
    return (id: string) => map.get(id) ?? "—";
  }, [regionsQuery.data]);

  const openActivities = useMemo(
    () => (activitiesQuery.data ?? []).filter((activity) => activity.status !== "COMPLETED"),
    [activitiesQuery.data],
  );
  const closedActivities = useMemo(
    () => (activitiesQuery.data ?? []).filter((activity) => activity.status === "COMPLETED"),
    [activitiesQuery.data],
  );

  const noteMutation = useMutation({
    mutationFn: () => createNote("ACCOUNT", selected!.id, noteBody),
    onSuccess: async () => {
      setNoteBody("");
      await queryClient.invalidateQueries({ queryKey: ["crm", "notes", "ACCOUNT", selected?.id] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "notes", "ACCOUNT", selected?.id] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument("ACCOUNT", selected!.id, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "documents", "ACCOUNT", selected?.id] });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "documents", "ACCOUNT", selected?.id] });
    },
  });

  const openDownload = async (id: string, fileName: string) => {
    const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const response = await fetch(documentDownloadUrl(id), {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) return;
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const ownerOptions = useMemo(
    () =>
      buildOwnerOptions(usersQuery.data, {
        userId: auth.userId,
        displayName: auth.displayName,
      }),
    [usersQuery.data, auth.displayName, auth.userId],
  );

  return (
    <>
      {(showForm && canCreate) || (showEdit && selected && canUpdate) ? (
        <AccountCreateView
          regions={(regionsQuery.data ?? []).map((region) => ({ id: region.id, name: region.name }))}
          users={ownerOptions}
          accounts={(accountsQuery.data ?? []).map((account) => ({ id: account.id, name: account.name }))}
          defaultOwnerId={auth.userId}
          defaultRegionId={auth.regionIds[0]}
          account={showEdit ? selected ?? undefined : undefined}
          onCancel={() => {
            setShowForm(false);
            setShowEdit(false);
          }}
          onCreated={(account, mode) => void handleAccountCreated(account, mode)}
        />
      ) : selected ? (
        <RecordShell
          layout="page"
          title={selected.name}
          subtitle={selected.accountType}
          avatarLabel={selected.name}
          avatarVariant="building"
          status={<StatusBadge status={selected.status} />}
          recordKey={selected.id}
          customFieldsTable="account"
          onBack={recordNav.goBack}
          onPrev={recordNav.goPrev}
          onNext={recordNav.goNext}
          hasPrev={recordNav.hasPrev}
          hasNext={recordNav.hasNext}
          relatedLinks={[
            { id: "contacts", label: "Contacts" },
            { id: "deals", label: "Deals" },
            ...(canViewProjects ? [{ id: "projects", label: "Projects" }] : []),
            ...(canViewInvoices ? [{ id: "invoices", label: "Invoices" }] : []),
            ...(canViewContracts ? [{ id: "contracts", label: "Contracts" }] : []),
            ...DEFAULT_RELATED_LINKS,
          ]}
          primaryAction={
            selected.email ? (
              <a className="btn btn-primary btn-sm" href={`mailto:${selected.email}`}>
                Send Email
              </a>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" disabled>
                Send Email
              </button>
            )
          }
          secondaryActions={
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={!canUpdate}
              onClick={() => setShowEdit(true)}
            >
              Edit
            </button>
          }
          tabs={[
            {
              id: "overview",
              label: "Overview",
              content: (
                <>
                  <TechEarnestRecordSummaryStrip
                    fields={[
                      { label: "Account Owner", value: userLabel(selected.ownerId) },
                      { label: "Email", value: selected.email ?? "—" },
                      { label: "Phone", value: selected.phone ?? "—" },
                      { label: "Account Type", value: selected.accountType },
                      { label: "Status", value: <StatusBadge status={selected.status} /> },
                    ]}
                  />

                  <TechEarnestRecordInfoSection
                    title="Account Information"
                    fields={[
                      { label: "Account Owner", value: userLabel(selected.ownerId) },
                      { label: "Account Name", value: selected.name },
                      { label: "Account Type", value: selected.accountType },
                      { label: "Industry", value: selected.industry ?? "—" },
                      {
                        label: "Website",
                        value: selected.website ? (
                          <a
                            href={/^https?:\/\//i.test(selected.website) ? selected.website : `https://${selected.website}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {selected.website}
                          </a>
                        ) : (
                          "—"
                        ),
                      },
                      { label: "Email", value: selected.email ?? "—" },
                      { label: "Phone", value: selected.phone ?? "—" },
                      { label: "Tax Number", value: selected.taxNumber ?? "—" },
                      { label: "Region", value: regionName(selected.regionId) },
                      { label: "Status", value: selected.status },
                      { label: "Created", value: new Date(selected.createdAt).toLocaleString() },
                      { label: "Modified", value: new Date(selected.updatedAt).toLocaleString() },
                    ]}
                  />

                  {selected.billingAddress || selected.shippingAddress ? (
                    <TechEarnestRecordInfoSection
                      title="Address Information"
                      collapsible={false}
                      fields={[
                        { label: "Billing Address", value: selected.billingAddress ?? "—" },
                        { label: "Shipping Address", value: selected.shippingAddress ?? "—" },
                      ]}
                    />
                  ) : null}

                  {selected.description ? (
                    <TechEarnestRecordInfoSection
                      title="Description Information"
                      collapsible={false}
                      fields={[{ label: "Description", value: selected.description }]}
                    />
                  ) : null}

                  <TechEarnestRecordRelatedCard
                    id="techearnest-record-section-contacts"
                    title="Contacts"
                    isEmpty={!contactsQuery.isLoading && !(contactsQuery.data ?? []).length}
                    emptyLabel="No records found"
                  >
                    <RelatedRecordList
                      module="contact"
                      loading={contactsQuery.isLoading}
                      loadingLabel="Loading contacts…"
                      items={(contactsQuery.data ?? []).map((contact) => ({
                        id: contact.id,
                        label: `${contact.firstName} ${contact.lastName}`.trim(),
                        secondary: contact.designation,
                        trailing: contact.email ?? contact.phone ?? undefined,
                      }))}
                    />
                  </TechEarnestRecordRelatedCard>

                  <TechEarnestRecordRelatedCard
                    id="techearnest-record-section-deals"
                    title="Deals"
                    isEmpty={!dealsQuery.isLoading && !(dealsQuery.data ?? []).length}
                    emptyLabel="No records found"
                  >
                    <RelatedRecordList
                      module="deal"
                      loading={dealsQuery.isLoading}
                      items={(dealsQuery.data ?? []).map((deal) => ({
                        id: deal.id,
                        label: deal.name,
                        secondary: deal.value != null ? deal.value.toLocaleString() : undefined,
                        trailing: <StatusBadge status={deal.stage} />,
                      }))}
                    />
                  </TechEarnestRecordRelatedCard>

                  {canViewProjects ? (
                    <TechEarnestRecordRelatedCard
                      id="techearnest-record-section-projects"
                      title="Projects"
                      isEmpty={!projectsQuery.isLoading && !(projectsQuery.data ?? []).length}
                      emptyLabel="No records found"
                    >
                      <RelatedRecordList
                        module="project"
                        loading={projectsQuery.isLoading}
                        items={(projectsQuery.data ?? []).map((project) => ({
                          id: project.id,
                          label: project.name,
                          secondary: project.projectCode,
                          trailing: (
                            <>
                              <StatusBadge status={project.status} />
                              {project.health ? <StatusBadge status={project.health} /> : null}
                            </>
                          ),
                        }))}
                      />
                    </TechEarnestRecordRelatedCard>
                  ) : null}

                  {canViewInvoices ? (
                    <TechEarnestRecordRelatedCard
                      id="techearnest-record-section-invoices"
                      title="Invoices"
                      isEmpty={!invoicesQuery.isLoading && !(invoicesQuery.data ?? []).length}
                      emptyLabel="No records found"
                    >
                      <RelatedRecordList
                        module="invoice"
                        loading={invoicesQuery.isLoading}
                        items={(invoicesQuery.data ?? []).map((invoice) => ({
                          id: invoice.id,
                          label: invoice.invoiceNumber ?? "Draft invoice",
                          secondary: `${invoice.currencyCode} ${invoice.total.toLocaleString()}`,
                          trailing: <StatusBadge status={invoice.status} />,
                        }))}
                      />
                    </TechEarnestRecordRelatedCard>
                  ) : null}

                  {canViewContracts ? (
                    <TechEarnestRecordRelatedCard
                      id="techearnest-record-section-contracts"
                      title="Contracts"
                      isEmpty={!contractsQuery.isLoading && !(contractsQuery.data ?? []).length}
                      emptyLabel="No records found"
                    >
                      <RelatedRecordList
                        module="contract"
                        loading={contractsQuery.isLoading}
                        items={(contractsQuery.data ?? []).map((contract) => ({
                          id: contract.id,
                          label: contract.name,
                          secondary: contract.contractNumber,
                          trailing: <StatusBadge status={contract.status} />,
                        }))}
                      />
                    </TechEarnestRecordRelatedCard>
                  ) : null}

                  {canViewNotes ? (
                    <TechEarnestRecordRelatedCard
                      id="techearnest-record-section-notes"
                      title="Notes"
                      isEmpty={!(notesQuery.data ?? []).length && !canCreateNotes}
                      emptyLabel="No notes yet"
                      actions={
                        canCreateNotes ? (
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            disabled={!noteBody.trim() || noteMutation.isPending}
                            onClick={() => noteMutation.mutate()}
                          >
                            Save
                          </button>
                        ) : null
                      }
                    >
                      {canCreateNotes ? (
                        <textarea
                          className="form-control form-control-sm mb-2"
                          rows={2}
                          value={noteBody}
                          onChange={(e) => setNoteBody(e.target.value)}
                          placeholder="Add a note"
                        />
                      ) : null}
                      <ul className="list-unstyled small mb-0">
                        {(notesQuery.data ?? []).map((note) => (
                          <li key={note.id} className="mb-2 border-bottom pb-2">
                            <div>{note.body}</div>
                            <div className="text-muted d-flex justify-content-between">
                              <span>{new Date(note.createdAt).toLocaleString()}</span>
                              {canDeleteNotes ? (
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm p-0"
                                  onClick={() => deleteNoteMutation.mutate(note.id)}
                                >
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </TechEarnestRecordRelatedCard>
                  ) : null}

                  {canViewDocs ? (
                    <TechEarnestRecordRelatedCard
                      id="techearnest-record-section-attachments"
                      title="Attachments"
                      isEmpty={!(docsQuery.data ?? []).length}
                      emptyLabel="No Attachment"
                      actions={
                        canUploadDocs ? (
                          <label className="btn btn-outline-secondary btn-sm mb-0">
                            Attach
                            <input
                              type="file"
                              className="d-none"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  uploadMutation.mutate(file);
                                  e.target.value = "";
                                }
                              }}
                            />
                          </label>
                        ) : null
                      }
                    >
                      <ul className="list-unstyled small mb-0">
                        {(docsQuery.data ?? []).map((doc) => (
                          <li key={doc.id} className="mb-2 d-flex justify-content-between gap-2">
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 text-start"
                              onClick={() => void openDownload(doc.id, doc.fileName)}
                            >
                              {doc.fileName}
                            </button>
                            {canDeleteDocs ? (
                              <button
                                type="button"
                                className="btn btn-link btn-sm p-0 text-danger"
                                onClick={() => deleteDocMutation.mutate(doc.id)}
                              >
                                Delete
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </TechEarnestRecordRelatedCard>
                  ) : null}

                  <TechEarnestRecordRelatedCard id="techearnest-record-section-emails" title="Emails" isEmpty emptyLabel="No records found" />
                  {canViewActivities ? (
                    <>
                      <TechEarnestRecordRelatedCard
                        id="techearnest-record-section-open-activities"
                        title="Open Activities"
                        isEmpty={!openActivities.length}
                        emptyLabel="No records found"
                      >
                        <RelatedRecordList
                          module="activity"
                          items={openActivities.map((activity) => ({
                            id: activity.id,
                            label: activity.subject,
                            trailing: <StatusBadge status={activity.status} />,
                          }))}
                        />
                      </TechEarnestRecordRelatedCard>
                      <TechEarnestRecordRelatedCard
                        id="techearnest-record-section-closed-activities"
                        title="Closed Activities"
                        isEmpty={!closedActivities.length}
                        emptyLabel="No records found"
                      >
                        <RelatedRecordList
                          module="activity"
                          items={closedActivities.map((activity) => ({
                            id: activity.id,
                            label: activity.subject,
                            trailing: <StatusBadge status={activity.status} />,
                          }))}
                        />
                      </TechEarnestRecordRelatedCard>
                    </>
                  ) : null}
                  <TechEarnestRecordRelatedCard id="techearnest-record-section-meetings" title="Invited Meetings" isEmpty emptyLabel="No records found" />
                  <TechEarnestRecordRelatedCard id="techearnest-record-section-social" title="Social" isEmpty emptyLabel="No records found" />
                </>
              ),
            },
            {
              id: "timeline",
              label: "Timeline",
              visible: true,
              content: (
                <TechEarnestRecordTimeline
                  entries={timelineEntries}
                  loading={auditQuery.isLoading || activitiesQuery.isLoading || notesQuery.isLoading}
                />
              ),
            },
          ]}
        />
      ) : (
    <ModuleListShell
      title="Accounts"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Accounts</span>}
      toolbarActions={
        <button
          type="button"
          className={`btn btn-sm ${filterOpen ? "btn-primary" : "btn-outline-secondary"}`}
          onClick={() => setFilterOpen((o) => !o)}
        >
          Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </button>
      }
      primaryAction={
        canCreate ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openCreate()}>
            Create Account
          </button>
        ) : null
      }
      createMenuItems={bulkImport.menuItems}
      moreMenuItems={bulkImport.menuItems}
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Accounts by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or email"
            />
          </div>
          <div className="module-filter-section">
            <h3>Filter by fields</h3>
            <TechEarnestFilterSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusFilterOptions}
              searchPlaceholder="Search Status"
            />
            <TechEarnestFilterSelect
              label="Type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={typeFilterOptions}
              searchPlaceholder="Search Types"
            />
            <ModuleFilterField label="Industry" htmlFor="accountIndustryFilter">
              <input
                id="accountIndustryFilter"
                className="form-control form-control-sm"
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
                placeholder="e.g. Technology"
              />
            </ModuleFilterField>
            <TechEarnestFilterSelect
              label="Region"
              value={regionFilter}
              onChange={setRegionFilter}
              options={regionFilterOptions}
              searchPlaceholder="Search Regions"
            />
          </div>
        </>
      }
      activeFilterCount={activeFilterCount}
      onClearFilters={() => {
        setSearch("");
        setStatusFilter("");
        setTypeFilter("");
        setIndustryFilter("");
        setRegionFilter("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {accountsQuery.isLoading ? <LoadingState label="Loading accounts..." /> : null}
      {accountsQuery.error ? <ErrorState title="Unable to load accounts" message="Try again." /> : null}

      {!accountsQuery.isLoading && !accountsQuery.error && !rows.length && !activeFilterCount
        ? bulkImport.renderEmptyState({ canCreate, createLabel: "Create Account", onCreate: () => openCreate() })
        : null}

      {!accountsQuery.isLoading && !accountsQuery.error && (rows.length || activeFilterCount) ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <ModuleListTable
                tableCode="account"
                defaultColumns={[
                  { field: "name", label: "Account Name" },
                  { field: "accountType", label: "Type" },
                  { field: "email", label: "Email" },
                  { field: "phone", label: "Phone" },
                  { field: "status", label: "Status" },
                ]}
                rows={rows}
                rowKey={(account) => account.id}
                bulk={{
                  noun: "accounts",
                  exportFileName: "accounts",
                  onComplete: () => void queryClient.invalidateQueries({ queryKey: ["crm", "accounts"] }),
                  actions: [
                    {
                      id: "assign-owner",
                      label: "Assign owner",
                      visible: canUpdate,
                      doneLabel: "reassigned",
                      input: { kind: "select", label: "New owner", options: bulkOwnerOptions },
                      runBatch: (ids, ownerId) => postServerBulk("/accounts/bulk-assign", { ids, ownerId }),
                    },
                    {
                      id: "change-status",
                      label: "Change status",
                      visible: canUpdate,
                      doneLabel: "updated",
                      input: { kind: "select", label: "New status", options: enumOptions(["ACTIVE", "INACTIVE"]) },
                      run: (account, status) => putRecord(`/accounts/${account.id}`, accountUpdateBody(account, { status })),
                    },
                    {
                      id: "change-type",
                      label: "Change type",
                      visible: canUpdate,
                      doneLabel: "updated",
                      input: {
                        kind: "select",
                        label: "New account type",
                        options: enumOptions(["PROSPECT", "CUSTOMER", "PARTNER", "VENDOR"]),
                      },
                      run: (account, accountType) =>
                        putRecord(`/accounts/${account.id}`, accountUpdateBody(account, { accountType })),
                    },
                    {
                      id: "delete",
                      label: "Delete",
                      tone: "danger",
                      visible: canDelete,
                      doneLabel: "deleted",
                      confirm: "Deleted accounts disappear from lists. Their contacts and deals are kept.",
                      run: (account) => deleteRecord(`/accounts/${account.id}`),
                    },
                  ],
                }}
                selectedRowKey={(selected as Account | null)?.id}
                onRowClick={setSelected}
                renderCell={(account, field) =>
                  field === "status" ? (
                    <StatusBadge status={account.status} />
                  ) : (() => {
                      const value = (account as unknown as Record<string, unknown>)[field];
                      return value == null || value === "" ? "—" : String(value);
                    })()
                }
                nameFields={["name"]}
                emptyMessage="No accounts match the current filters."
            />
          ) : (
            <div className="module-tile-grid">
              {rows.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  className={`module-tile text-start${(selected as Account | null)?.id === account.id ? " is-selected" : ""}`}
                  onClick={() => setSelected(account)}
                >
                  <div className="tile-title">{account.name}</div>
                  <div className="small text-muted">
                    {account.accountType} · {account.status}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </ModuleListShell>
      )}
      {bulkImport.dialog}
    </>
  );
}
