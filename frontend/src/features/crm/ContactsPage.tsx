import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ACCESS_TOKEN_KEY } from "@/api/client";
import { ContactCreateView } from "./ContactCreateView";
import { ContactEditView } from "./ContactEditView";
import { buildOwnerOptions, buildFilterOwnerOptions, enumPickerOptions, optionsFromPairs, TechEarnestFilterSelect } from "@/components/TechEarnestCreate";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import {
  ModuleFilterField,
  ModuleListShell,
  countActiveFilters,
} from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
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
import { RecordLink, RelatedRecordList } from "@/components/RecordLink";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { useUrlSelection } from "@/hooks/useUrlRecord";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listAuditLogs, listRegions, listUsers } from "@/features/admin/adminApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { useBulkImport } from "@/features/import/useBulkImport";
import {
  getAccount,
  getContact,
  listAccountDeals,
  listAccounts,
  listActivities,
  listContacts,
  type Contact,
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

function contactName(contact: Pick<Contact, "firstName" | "lastName">) {
  return `${contact.firstName} ${contact.lastName}`.trim();
}

export function ContactsPage() {
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const auth = useAuth();
  const canCreate = useHasPermission("CONTACT_CREATE");
  const canUpdate = useHasPermission("CONTACT_UPDATE");
  const canViewUsers = useHasPermission("USER_VIEW");
  const canViewNotes = useHasPermission("NOTE_VIEW");
  const canCreateNotes = useHasPermission("NOTE_CREATE");
  const canDeleteNotes = useHasPermission("NOTE_DELETE");
  const canViewDocs = useHasPermission("DOCUMENT_VIEW");
  const canUploadDocs = useHasPermission("DOCUMENT_UPLOAD");
  const canDeleteDocs = useHasPermission("DOCUMENT_DELETE");
  const canViewActivities = useHasPermission("ACTIVITY_VIEW");
  const canViewAudit = useHasPermission("AUDIT_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [noteBody, setNoteBody] = useState("");

  useEffect(() => {
    if (params.get("create") === "1") setShowForm(true);
  }, [params, setShowForm]);

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      accountId: accountFilter || undefined,
      status: statusFilter || undefined,
      ownerId: ownerFilter || undefined,
      email: emailFilter || undefined,
      designation: designationFilter || undefined,
    }),
    [search, accountFilter, statusFilter, ownerFilter, emailFilter, designationFilter],
  );

  const contactsQuery = useQuery({
    queryKey: ["crm", "contacts", listParams],
    queryFn: () => listContacts(listParams),
  });
  const [selected, setSelected] = useUrlSelection(contactsQuery.data, { fetchById: getContact });
  const contactRecordQuery = useQuery({
    queryKey: ["crm", "contacts", "record", selected?.id],
    queryFn: () => getContact(selected!.id),
    enabled: !!selected,
  });
  useEffect(() => {
    if (contactRecordQuery.data && selected?.id === contactRecordQuery.data.id) {
      setSelected((current) =>
        current?.id === contactRecordQuery.data!.id ? contactRecordQuery.data! : current,
      );
    }
  }, [contactRecordQuery.data, selected?.id]);
  const accountsQuery = useQuery({ queryKey: ["crm", "accounts"], queryFn: () => listAccounts() });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: canViewUsers || (showForm && canCreate) || showEdit,
  });
  const regionsQuery = useQuery({
    queryKey: ["admin", "regions", "contact-account-quick-create"],
    queryFn: listRegions,
    enabled: showForm && canCreate,
  });
  const accountQuery = useQuery({
    queryKey: ["crm", "accounts", selected?.accountId],
    queryFn: () => getAccount(selected!.accountId),
    enabled: !!selected,
  });
  const dealsQuery = useQuery({
    queryKey: ["crm", "accounts", selected?.accountId, "deals"],
    queryFn: () => listAccountDeals(selected!.accountId),
    enabled: !!selected,
  });
  const activitiesQuery = useQuery({
    queryKey: ["crm", "activities", "CONTACT", (selected as Contact | null)?.id],
    queryFn: () => listActivities({ relatedEntityType: "CONTACT", relatedEntityId: selected!.id }),
    enabled: !!selected && canViewActivities,
  });
  const notesQuery = useQuery({
    queryKey: ["crm", "notes", "CONTACT", (selected as Contact | null)?.id],
    queryFn: () => listNotes("CONTACT", selected!.id),
    enabled: !!selected && canViewNotes,
  });
  const docsQuery = useQuery({
    queryKey: ["crm", "documents", "CONTACT", (selected as Contact | null)?.id],
    queryFn: () => listDocuments("CONTACT", selected!.id),
    enabled: !!selected && canViewDocs,
  });
  const auditQuery = useQuery({
    queryKey: ["admin", "audit-logs", "CONTACT", (selected as Contact | null)?.id],
    queryFn: () => listAuditLogs({ entityType: "CONTACT", entityId: selected!.id, size: 30 }),
    enabled: !!selected && canViewAudit,
  });

  const accountName = useMemo(() => {
    const map = new Map((accountsQuery.data ?? []).map((a) => [a.id, a.name]));
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [accountsQuery.data]);

  const userLabel = useMemo(() => {
    const map = new Map(
      (usersQuery.data ?? []).map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]),
    );
    return (id: string | null) => (id ? (map.get(id) ?? id.slice(0, 8)) : "—");
  }, [usersQuery.data]);

  const rows = contactsQuery.data ?? [];
  const recordNav = useRecordNavigation(rows, selected, setSelected);
  const timelineEntries = useMemo(
    () =>
      buildTimelineEntries(
        auditQuery.data,
        activitiesQuery.data,
        (userId) => (userId === auth.userId ? auth.displayName : userLabel(userId ?? null)),
        recordLifecycleInfo("Contact", selected),
        notesQuery.data,
      ),
    [auditQuery.data, activitiesQuery.data, notesQuery.data, auth.displayName, auth.userId, userLabel, selected],
  );
  const activeFilterCount = countActiveFilters(
    search,
    statusFilter,
    accountFilter,
    ownerFilter,
    emailFilter,
    designationFilter,
  );
  const bulkImport = useBulkImport("contacts", () =>
    queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] }),
  );
  const relatedDeals = useMemo(
    () => (dealsQuery.data ?? []).filter((deal) => deal.contactId === (selected as Contact | null)?.id),
    [dealsQuery.data, (selected as Contact | null)?.id],
  );

  const openActivities = useMemo(
    () => (activitiesQuery.data ?? []).filter((activity) => activity.status !== "COMPLETED"),
    [activitiesQuery.data],
  );
  const closedActivities = useMemo(
    () => (activitiesQuery.data ?? []).filter((activity) => activity.status === "COMPLETED"),
    [activitiesQuery.data],
  );

  useEffect(() => {
    if (!selected) setShowEdit(false);
  }, [selected]);

  async function handleContactCreated(contact: Contact, mode: "save" | "saveAndNew") {
    await queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
    if (mode === "save") {
      setShowForm(false);
      setSelected(contact);
    }
  }

  function openCreate() {
    setSelected(null);
    setShowForm(true);
  }

  const noteMutation = useMutation({
    mutationFn: () => createNote("CONTACT", selected!.id, noteBody),
    onSuccess: async () => {
      setNoteBody("");
      await queryClient.invalidateQueries({ queryKey: ["crm", "notes", "CONTACT", selected!.id] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "notes", "CONTACT", selected!.id] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument("CONTACT", selected!.id, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "documents", "CONTACT", selected?.id] });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "documents", "CONTACT", selected?.id] });
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

  const statusFilterOptions = enumPickerOptions(["ACTIVE", "INACTIVE"]);
  const accountFilterOptions = useMemo(
    () => optionsFromPairs((accountsQuery.data ?? []).map((account) => ({ value: account.id, label: account.name }))),
    [accountsQuery.data],
  );
  const ownerFilterOptions = useMemo(
    () => buildFilterOwnerOptions(usersQuery.data, auth.userId),
    [usersQuery.data, auth.userId],
  );

  return (
    <>
      {showForm && canCreate ? (
        <ContactCreateView
          accounts={(accountsQuery.data ?? []).map((account) => ({ id: account.id, name: account.name }))}
          regions={(regionsQuery.data ?? []).map((region) => ({ id: region.id, name: region.name }))}
          users={ownerOptions}
          defaultOwnerId={auth.userId}
          onCancel={() => setShowForm(false)}
          onCreated={(contact, mode) => void handleContactCreated(contact, mode)}
        />
      ) : showEdit && selected && canUpdate ? (
        <ContactEditView
          contact={selected}
          accountName={accountName(selected.accountId)}
          users={ownerOptions}
          onCancel={() => setShowEdit(false)}
          onUpdated={(contact) => {
            setSelected(contact);
            setShowEdit(false);
            void queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
          }}
        />
      ) : selected ? (
        <RecordShell
          layout="page"
          title={contactName(selected)}
          subtitle={accountName(selected.accountId)}
          avatarLabel={contactName(selected)}
          status={<StatusBadge status={selected.status} />}
          recordKey={selected.id}
          onBack={() => {
            setShowEdit(false);
            recordNav.goBack();
          }}
          onPrev={recordNav.goPrev}
          onNext={recordNav.goNext}
          hasPrev={recordNav.hasPrev}
          hasNext={recordNav.hasNext}
          relatedLinks={[{ id: "account", label: "Account" }, { id: "deals", label: "Deals" }, ...DEFAULT_RELATED_LINKS]}
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
                      { label: "Contact Owner", value: userLabel(selected.ownerId) },
                      { label: "Email", value: selected.email ?? "—" },
                      { label: "Phone", value: selected.phone ?? "—" },
                      { label: "Mobile", value: selected.mobile ?? "—" },
                      { label: "Status", value: <StatusBadge status={selected.status} /> },
                    ]}
                  />

                  <TechEarnestRecordInfoSection
                    title="Contact Information"
                    fields={[
                      { label: "Contact Owner", value: userLabel(selected.ownerId) },
                      { label: "Contact Name", value: contactName(selected) || "—" },
                      {
                        label: "Account Name",
                        value: (
                          <RecordLink module="account" id={selected.accountId}>
                            {accountName(selected.accountId)}
                          </RecordLink>
                        ),
                      },
                      { label: "Title", value: selected.designation ?? "—" },
                      { label: "Department", value: selected.department ?? "—" },
                      { label: "Email", value: selected.email ?? "—" },
                      { label: "Phone", value: selected.phone ?? "—" },
                      { label: "Mobile", value: selected.mobile ?? "—" },
                      {
                        label: "LinkedIn",
                        value: selected.linkedinUrl ? (
                          <a href={selected.linkedinUrl} target="_blank" rel="noreferrer">
                            {selected.linkedinUrl}
                          </a>
                        ) : (
                          "—"
                        ),
                      },
                      { label: "Status", value: selected.status },
                      { label: "Created", value: new Date(selected.createdAt).toLocaleString() },
                      { label: "Modified", value: new Date(selected.updatedAt).toLocaleString() },
                    ]}
                  />

                  {selected.notes ? (
                    <TechEarnestRecordInfoSection
                      title="Description Information"
                      collapsible={false}
                      fields={[{ label: "Description", value: selected.notes }]}
                    />
                  ) : null}

                  <TechEarnestRecordRelatedCard
                    id="techearnest-record-section-account"
                    title="Account"
                    isEmpty={!accountQuery.isLoading && !accountQuery.data}
                    emptyLabel={accountQuery.error ? "Unable to load account" : "No linked account"}
                  >
                    {accountQuery.isLoading ? <LoadingState label="Loading account…" workspace /> : null}
                    {accountQuery.data ? (
                      <div className="small">
                        <div className="fw-semibold">
                          <RecordLink module="account" id={accountQuery.data.id}>
                            {accountQuery.data.name}
                          </RecordLink>
                        </div>
                        <div className="text-muted">
                          {accountQuery.data.accountType} · {accountQuery.data.status}
                        </div>
                        <div>{accountQuery.data.email ?? "—"}</div>
                      </div>
                    ) : null}
                  </TechEarnestRecordRelatedCard>

                  <TechEarnestRecordRelatedCard
                    id="techearnest-record-section-deals"
                    title="Deals"
                    isEmpty={!relatedDeals.length}
                    emptyLabel="No records found"
                  >
                    <RelatedRecordList
                      module="deal"
                      items={relatedDeals.map((deal) => ({
                        id: deal.id,
                        label: deal.name,
                        secondary: deal.value != null ? deal.value.toLocaleString() : undefined,
                        trailing: <StatusBadge status={deal.stage} />,
                      }))}
                    />
                  </TechEarnestRecordRelatedCard>

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
                  <TechEarnestRecordRelatedCard id="techearnest-record-section-campaigns" title="Campaigns" isEmpty emptyLabel="No records found" />
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
      title="Contacts"
      filterOpen={filterOpen}
      activeFilterCount={activeFilterCount}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Contacts</span>}
      filterToggle={{ onToggle: () => setFilterOpen((open) => !open) }}
      primaryAction={
        canCreate ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openCreate()}>
            Create Contact
          </button>
        ) : null
      }
      createMenuItems={bulkImport.menuItems}
      moreMenuItems={bulkImport.menuItems}
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Contacts by</p>
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
              label="Account"
              value={accountFilter}
              onChange={setAccountFilter}
              options={accountFilterOptions}
              searchPlaceholder="Search Accounts"
            />
            {canViewUsers ? (
              <TechEarnestFilterSelect
                label="Owner"
                value={ownerFilter}
                onChange={setOwnerFilter}
                options={ownerFilterOptions}
                searchPlaceholder="Search Owners"
              />
            ) : null}
            <ModuleFilterField label="Email contains" htmlFor="contactEmailFilter">
              <input
                id="contactEmailFilter"
                className="form-control form-control-sm"
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                placeholder="email@"
              />
            </ModuleFilterField>
            <ModuleFilterField label="Designation" htmlFor="contactDesignationFilter">
              <input
                id="contactDesignationFilter"
                className="form-control form-control-sm"
                value={designationFilter}
                onChange={(e) => setDesignationFilter(e.target.value)}
                placeholder="e.g. Manager"
              />
            </ModuleFilterField>
          </div>
        </>
      }
      onClearFilters={() => {
        setSearch("");
        setStatusFilter("");
        setAccountFilter("");
        setOwnerFilter("");
        setEmailFilter("");
        setDesignationFilter("");
      }}
      recordCount={rows.length}
    >
      {contactsQuery.isLoading ? <LoadingState label="Loading contacts..." workspace /> : null}
      {contactsQuery.error ? (
        <ErrorState
          title="Unable to load contacts"
          message="Try again."
          workspace
          onRetry={() => contactsQuery.refetch()}
        />
      ) : null}

      {!contactsQuery.isLoading && !contactsQuery.error && !rows.length && !activeFilterCount
        ? bulkImport.renderEmptyState({ canCreate, createLabel: "Create Contact", onCreate: () => openCreate() })
        : null}

      {!contactsQuery.isLoading && !contactsQuery.error && (rows.length || activeFilterCount) ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <ModuleListTable
                tableCode="contact"
                defaultColumns={[
                  { field: "firstName", label: "Contact Name" },
                  { field: "accountId", label: "Account" },
                  { field: "email", label: "Email" },
                  { field: "phone", label: "Phone" },
                  { field: "designation", label: "Designation" },
                  { field: "status", label: "Status" },
                ]}
                rows={rows}
                rowKey={(contact) => contact.id}
                selectedRowKey={(selected as Contact | null)?.id}
                onRowClick={(contact) => {
                  setSelected(contact);
                  setShowEdit(false);
                }}
                renderCell={(contact, field) => {
                  if (field === "firstName") return contactName(contact);
                  if (field === "accountId")
                    return (
                      <RecordLink module="account" id={contact.accountId}>
                        {accountName(contact.accountId)}
                      </RecordLink>
                    );
                  if (field === "phone") return contact.phone ?? contact.mobile ?? "—";
                  if (field === "status") return <StatusBadge status={contact.status} />;
                  const value = (contact as unknown as Record<string, unknown>)[field];
                  return value == null || value === "" ? "—" : String(value);
                }}
                nameFields={["firstName"]}
                emptyMessage="No contacts found. Adjust filters or create a contact to get started."
            />
          ) : (
            <div className="module-tile-grid">
              {rows.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  className={`module-tile text-start${(selected as Contact | null)?.id === contact.id ? " is-selected" : ""}`}
                  onClick={() => {
                    setSelected(contact);
                    setShowEdit(false);
                  }}
                >
                  <div className="tile-title">{contactName(contact)}</div>
                  <div className="small text-muted">
                    {accountName(contact.accountId)} · {contact.status}
                  </div>
                </button>
              ))}
              {!rows.length ? (
                <EmptyState
                  workspace
                  title="No contacts found"
                  description="Adjust filters or create a contact to get started."
                />
              ) : null}
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
