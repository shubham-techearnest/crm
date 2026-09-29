import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { ACCESS_TOKEN_KEY } from "@/api/client";
import { DynamicForm, FormActions, UnsavedGuard } from "@/components/FormKit";
import { ContactCreateView } from "./ContactCreateView";
import { buildOwnerOptions, buildFilterOwnerOptions, enumPickerOptions, optionsFromPairs, TechEarnestFilterSelect } from "@/components/TechEarnestCreate";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import {
  ModuleListShell,
  countActiveFilters,
} from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { RecordShell, DEFAULT_RELATED_LINKS } from "@/components/RecordShell";
import { buildTimelineEntries, recordLifecycleInfo, useRecordNavigation, TechEarnestRecordTimeline } from "@/components/TechEarnestRecord";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listAuditLogs, listRegions, listUsers } from "@/features/admin/adminApi";
import { getPublishedFormBundle, getPublishedRelatedLists } from "@/features/admin/studio/metadataApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { useBulkImport } from "@/features/import/useBulkImport";
import {
  getAccount,
  getContact,
  listAccountDeals,
  listAccounts,
  listActivities,
  listContacts,
  updateContact,
  type Contact,
} from "./crmApi";
import {
  createNote,
  deleteNote,
  documentDownloadUrl,
  listDocuments,
  listNotes,
  uploadDocument,
} from "./foundationApi";

const editSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
  linkedinUrl: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  ownerId: z.string().optional(),
});

type EditFormValues = z.infer<typeof editSchema>;

function contactName(contact: Pick<Contact, "firstName" | "lastName">) {
  return `${contact.firstName} ${contact.lastName}`.trim();
}

function buildUpdateBody(values: EditFormValues) {
  return {
    ownerId: values.ownerId || undefined,
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email || undefined,
    phone: values.phone || undefined,
    mobile: values.mobile || undefined,
    designation: values.designation || undefined,
    department: values.department || undefined,
    linkedinUrl: values.linkedinUrl || undefined,
    status: values.status || "ACTIVE",
    notes: values.notes || undefined,
  };
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
  const canViewActivities = useHasPermission("ACTIVITY_VIEW");
  const canViewAudit = useHasPermission("AUDIT_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
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
  const contactEditBundleQuery = useQuery({
    queryKey: ["metadata", "runtime", "contact", "form-bundle", "CREATE", "edit"],
    queryFn: () => getPublishedFormBundle("contact", "CREATE"),
    enabled: !!selected && showEdit,
    staleTime: 60_000,
  });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: canViewUsers || (showForm && canCreate),
  });
  const regionsQuery = useQuery({
    queryKey: ["admin", "regions", "contact-account-quick-create"],
    queryFn: listRegions,
    enabled: showForm && canCreate,
  });
  const relatedListsQuery = useQuery({
    queryKey: ["metadata", "runtime", "contact", "related-lists"],
    queryFn: () => getPublishedRelatedLists("contact"),
    enabled: !!selected,
    staleTime: 60_000,
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

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    control: controlEdit,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting, isDirty: isEditDirty },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
  });

  useEffect(() => {
    if (!selected) {
      setShowEdit(false);
      return;
    }
    resetEdit({
      firstName: selected.firstName,
      lastName: selected.lastName,
      email: selected.email ?? "",
      phone: selected.phone ?? "",
      mobile: selected.mobile ?? "",
      designation: selected.designation ?? "",
      department: selected.department ?? "",
      linkedinUrl: selected.linkedinUrl ?? "",
      status: selected.status,
      notes: selected.notes ?? "",
      ownerId: selected.ownerId ?? "",
    });
    setEditError(null);
  }, [selected, resetEdit]);

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

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReturnType<typeof buildUpdateBody> }) =>
      updateContact(id, body),
    onSuccess: async (contact) => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
      setSelected(contact);
      setShowEdit(false);
      setEditError(null);
    },
    onError: () => setEditError("Could not update contact."),
  });

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

  const contactFieldConfig = {
    accountId: {
      options: (accountsQuery.data ?? []).map((account) => ({
        value: account.id,
        label: account.name,
      })),
      colClass: "col-md-4",
    },
    status: {
      options: [
        { value: "ACTIVE", label: "ACTIVE" },
        { value: "INACTIVE", label: "INACTIVE" },
      ],
      colClass: "col-md-3",
    },
    email: { typeOverride: "email" as const, colClass: "col-md-4" },
    firstName: { colClass: "col-md-4" },
    lastName: { colClass: "col-md-4" },
    ownerId: {
      options: (usersQuery.data ?? []).map((user) => ({
        value: user.id,
        label: `${user.firstName} ${user.lastName}`.trim(),
        subtitle: user.email,
      })),
      colClass: "col-md-4",
      pickerMode: "user" as const,
      searchPlaceholder: "Search Users",
      lookupIcon: "users" as const,
    },
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
      ) : selected ? (
        <RecordShell
          layout="page"
          title={contactName(selected)}
          subtitle={accountName(selected.accountId)}
          avatarLabel={contactName(selected)}
          status={<StatusBadge status={selected.status} />}
          recordKey={selected.id}
          onBack={() => {
            setSelected(null);
            setShowEdit(false);
          }}
          onPrev={recordNav.goPrev}
          onNext={recordNav.goNext}
          hasPrev={recordNav.hasPrev}
          hasNext={recordNav.hasNext}
          relatedLinks={[...DEFAULT_RELATED_LINKS]}
          primaryAction={
            canUpdate ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowEdit((value) => !value)}
              >
                {showEdit ? "Cancel edit" : "Edit"}
              </button>
            ) : null
          }
          tabs={[
            {
              id: "overview",
              label: "Overview",
              content: (
                <>
                  {editError ? <div className="alert alert-danger py-2">{editError}</div> : null}
                  {showEdit && canUpdate ? (
                    <form
                      className="mb-3"
                      onSubmit={handleEditSubmit((values) =>
                        updateMutation.mutate({ id: selected.id, body: buildUpdateBody(values) }),
                      )}
                    >
                      <UnsavedGuard when={isEditDirty && showEdit} />
                      {contactEditBundleQuery.isLoading ? (
                        <LoadingState label="Loading form layout..." workspace />
                      ) : null}
                      {contactEditBundleQuery.error ? (
                        <ErrorState
                          title="Form layout unavailable"
                          message="Published Contact layout is required."
                          workspace
                        />
                      ) : null}
                      {contactEditBundleQuery.data ? (
                        <DynamicForm
                          layout={contactEditBundleQuery.data.layout.layout}
                          fields={contactEditBundleQuery.data.fields.filter((field) => field.code !== "accountId")}
                          register={registerEdit}
                          control={controlEdit}
                          errors={editErrors}
                          fieldConfig={{
                            ...contactFieldConfig,
                            ownerId: canViewUsers ? contactFieldConfig.ownerId : undefined,
                          }}
                        />
                      ) : null}
                      <FormActions
                        submitLabel="Update"
                        submitting={isEditSubmitting || updateMutation.isPending}
                        onCancel={() => {
                          if (isEditDirty && !window.confirm("Discard unsaved changes?")) return;
                          setShowEdit(false);
                          resetEdit({
                            firstName: selected.firstName,
                            lastName: selected.lastName,
                            email: selected.email ?? "",
                            phone: selected.phone ?? "",
                            mobile: selected.mobile ?? "",
                            designation: selected.designation ?? "",
                            department: selected.department ?? "",
                            linkedinUrl: selected.linkedinUrl ?? "",
                            status: selected.status,
                            notes: selected.notes ?? "",
                            ownerId: selected.ownerId ?? "",
                          });
                        }}
                      />
                    </form>
                  ) : (
                    <>
                      <p className="small mb-1">Email: {selected.email ?? "—"}</p>
                      <p className="small mb-1">Phone: {selected.phone ?? selected.mobile ?? "—"}</p>
                      <p className="small mb-1">Designation: {selected.designation ?? "—"}</p>
                      <p className="small mb-1">Department: {selected.department ?? "—"}</p>
                      <p className="small mb-3">Owner: {userLabel(selected.ownerId)}</p>
                      {selected.notes ? <p className="small text-muted mb-0">{selected.notes}</p> : null}
                    </>
                  )}
                </>
              ),
            },
            {
              id: "related",
              label: "Related",
              content: (
                <>
                  <div className="mb-3">
                    <h2 className="h6">Account</h2>
                    {accountQuery.isLoading ? <LoadingState label="Loading account…" workspace /> : null}
                    {accountQuery.error ? (
                      <p className="small text-muted mb-0">Unable to load account.</p>
                    ) : accountQuery.data ? (
                      <div className="small">
                        <div className="fw-semibold">{accountQuery.data.name}</div>
                        <div className="text-muted">
                          {accountQuery.data.accountType} · {accountQuery.data.status}
                        </div>
                        <div>{accountQuery.data.email ?? "—"}</div>
                        <Link className="small" to="/accounts">
                          Open Accounts
                        </Link>
                      </div>
                    ) : (
                      <p className="small text-muted mb-0">No linked account.</p>
                    )}
                  </div>
                  <div className="mb-3">
                    <h2 className="h6">Deals</h2>
                    <ul className="small mb-0">
                      {relatedDeals.map((deal) => (
                        <li key={deal.id}>
                          {deal.name} — <StatusBadge status={deal.stage} />
                        </li>
                      ))}
                      {!relatedDeals.length ? <li className="text-muted">No linked deals</li> : null}
                    </ul>
                  </div>
                  {(relatedListsQuery.data ?? []).map((relatedList) => {
                    if (relatedList.childTableCode === "activity" && canViewActivities) {
                      return (
                        <div key={relatedList.id} className="mb-3">
                          <h2 className="h6">{relatedList.label}</h2>
                          <ul className="small mb-0">
                            {(activitiesQuery.data ?? []).map((activity) => (
                              <li key={activity.id}>
                                {activity.subject} — <StatusBadge status={activity.status} />
                              </li>
                            ))}
                            {!activitiesQuery.data?.length ? (
                              <li className="text-muted">No activities</li>
                            ) : null}
                          </ul>
                        </div>
                      );
                    }
                    if (relatedList.childTableCode === "deal") {
                      return (
                        <div key={relatedList.id} className="mb-3">
                          <h2 className="h6">{relatedList.label}</h2>
                          <ul className="small mb-0">
                            {relatedDeals.map((deal) => (
                              <li key={deal.id}>
                                {deal.name} — <StatusBadge status={deal.stage} />
                              </li>
                            ))}
                            {!relatedDeals.length ? <li className="text-muted">No linked deals</li> : null}
                          </ul>
                        </div>
                      );
                    }
                    return null;
                  })}
                  {!relatedListsQuery.data?.length && !accountQuery.data && !relatedDeals.length ? (
                    <p className="text-muted small mb-0">No related records.</p>
                  ) : null}
                </>
              ),
            },
            {
              id: "timeline",
              label: "Timeline",
              visible: canViewActivities || canViewAudit,
              content: <TechEarnestRecordTimeline entries={timelineEntries} />,
            },
            {
              id: "notes",
              label: "Notes",
              visible: canViewNotes,
              content: (
                <>
                  {canCreateNotes ? (
                    <div className="mb-3">
                      <textarea
                        className="form-control form-control-sm mb-2"
                        rows={2}
                        value={noteBody}
                        onChange={(e) => setNoteBody(e.target.value)}
                        placeholder="Add a note…"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        disabled={!noteBody.trim() || noteMutation.isPending}
                        onClick={() => noteMutation.mutate()}
                      >
                        Add note
                      </button>
                    </div>
                  ) : null}
                  <ul className="small mb-0">
                    {(notesQuery.data ?? []).map((note) => (
                      <li key={note.id} className="mb-2">
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
                    {!notesQuery.data?.length ? <li className="text-muted">No notes</li> : null}
                  </ul>
                </>
              ),
            },
            {
              id: "documents",
              label: "Documents",
              visible: canViewDocs,
              content: (
                <>
                  {canUploadDocs ? (
                    <input
                      className="form-control form-control-sm mb-2"
                      type="file"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file || !selected) return;
                        try {
                          await uploadDocument("CONTACT", selected.id, file);
                          await queryClient.invalidateQueries({
                            queryKey: ["crm", "documents", "CONTACT", selected.id],
                          });
                        } catch {
                          /* ignore */
                        }
                        event.target.value = "";
                      }}
                    />
                  ) : null}
                  <ul className="small mb-0">
                    {(docsQuery.data ?? []).map((doc) => (
                      <li key={doc.id}>
                        <button
                          type="button"
                          className="btn btn-link btn-sm px-0"
                          onClick={async () => {
                            const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
                            const response = await fetch(documentDownloadUrl(doc.id), {
                              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                            });
                            if (!response.ok) return;
                            const blob = await response.blob();
                            const url = URL.createObjectURL(blob);
                            const anchor = document.createElement("a");
                            anchor.href = url;
                            anchor.download = doc.fileName;
                            anchor.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          {doc.fileName}
                        </button>
                      </li>
                    ))}
                    {!docsQuery.data?.length ? <li className="text-muted">No documents</li> : null}
                  </ul>
                </>
              ),
            },
            {
              id: "audit",
              label: "Audit",
              visible: canViewAudit,
              content: (
                <ul className="small mb-0">
                  {(auditQuery.data ?? []).map((log) => (
                    <li key={log.id}>
                      {log.action} · {new Date(log.createdAt).toLocaleString()}
                    </li>
                  ))}
                  {!auditQuery.data?.length ? <li className="text-muted">No audit events</li> : null}
                </ul>
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
            <label className="form-label small mb-1">Email contains</label>
            <input
              className="form-control form-control-sm mb-2"
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
              placeholder="email@"
            />
            <label className="form-label small mb-1">Designation</label>
            <input
              className="form-control form-control-sm"
              value={designationFilter}
              onChange={(e) => setDesignationFilter(e.target.value)}
              placeholder="e.g. Manager"
            />
          </div>
        </>
      }
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
                  if (field === "accountId") return accountName(contact.accountId);
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
