import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { DynamicForm, FormActions, UnsavedGuard } from "@/components/FormKit";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listUsers } from "@/features/admin/adminApi";
import { getPublishedFormBundle } from "@/features/admin/studio/metadataApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { createContact, listAccounts, listContacts } from "./crmApi";

const schema = z.object({
  accountId: z.string().min(1, "Account is required"),
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
});

type FormValues = z.infer<typeof schema>;

export function ContactsPage() {
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const canCreate = useHasPermission("CONTACT_CREATE");
  const canViewUsers = useHasPermission("USER_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [saveAndNew, setSaveAndNew] = useState(false);

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
  const accountsQuery = useQuery({ queryKey: ["crm", "accounts"], queryFn: () => listAccounts() });
  const contactFormBundleQuery = useQuery({
    queryKey: ["metadata", "runtime", "contact", "form-bundle", "CREATE"],
    queryFn: () => getPublishedFormBundle("contact", "CREATE"),
    enabled: showForm,
    staleTime: 60_000,
  });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: canViewUsers,
  });

  const accountName = useMemo(() => {
    const map = new Map((accountsQuery.data ?? []).map((a) => [a.id, a.name]));
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [accountsQuery.data]);

  const rows = contactsQuery.data ?? [];
  const activeFilterCount = [
    search,
    statusFilter,
    accountFilter,
    ownerFilter,
    emailFilter,
    designationFilter,
  ].filter(Boolean).length;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountId: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      mobile: "",
      designation: "",
      department: "",
      linkedinUrl: "",
      status: "ACTIVE",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: createContact,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
      setFormError(null);
      if (saveAndNew) {
        reset({
          accountId: "",
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          mobile: "",
          designation: "",
          department: "",
          linkedinUrl: "",
          status: "ACTIVE",
          notes: "",
        });
        setSaveAndNew(false);
        setShowMore(false);
      } else {
        reset();
        setShowForm(false);
        setShowMore(false);
      }
    },
    onError: () => setFormError("Could not create contact."),
  });

  return (
    <ModuleListShell
      title="Contacts"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Contacts</span>}
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
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Create Contact"}
          </button>
        ) : null
      }
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
            <label className="form-label small mb-1">Status</label>
            <select
              className="form-select form-select-sm mb-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
            <label className="form-label small mb-1">Account</label>
            <select
              className="form-select form-select-sm mb-2"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
            >
              <option value="">All</option>
              {(accountsQuery.data ?? []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            {canViewUsers ? (
              <>
                <label className="form-label small mb-1">Owner</label>
                <select
                  className="form-select form-select-sm mb-2"
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                >
                  <option value="">All</option>
                  {auth.userId ? (
                    <option value={auth.userId}>Current user</option>
                  ) : null}
                  {(usersQuery.data ?? [])
                    .filter((u) => u.id !== auth.userId)
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName}
                      </option>
                    ))}
                </select>
              </>
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
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {showForm ? (
        <form
          className="border-bottom p-3 bg-white"
          onSubmit={handleSubmit((values) =>
            createMutation.mutate({
              accountId: values.accountId,
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
            }),
          )}
        >
          <UnsavedGuard when={isDirty && showForm} />
          {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
          {contactFormBundleQuery.isLoading ? <LoadingState label="Loading form layout..." /> : null}
          {contactFormBundleQuery.error ? (
            <ErrorState title="Form layout unavailable" message="Published Contact CREATE layout is required." />
          ) : null}
          {contactFormBundleQuery.data ? (
            <DynamicForm
              layout={contactFormBundleQuery.data.layout.layout}
              fields={contactFormBundleQuery.data.fields}
              register={register}
              errors={errors}
              moreOpen={showMore}
              onMoreToggle={() => setShowMore((v) => !v)}
              fieldConfig={{
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
                email: { typeOverride: "email", colClass: "col-md-4" },
                firstName: { colClass: "col-md-4" },
                lastName: { colClass: "col-md-4" },
              }}
            />
          ) : null}
          <FormActions
            submitLabel="Save"
            showSaveAndNew
            submitting={isSubmitting || createMutation.isPending}
            onSaveAndNew={() => {
              setSaveAndNew(true);
              void handleSubmit((values) =>
                createMutation.mutate({
                  accountId: values.accountId,
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
                }),
              )();
            }}
            onCancel={() => {
              if (isDirty && !window.confirm("Discard unsaved changes?")) return;
              setShowForm(false);
              setShowMore(false);
              reset();
            }}
          />
        </form>
      ) : null}

      {contactsQuery.isLoading ? <LoadingState label="Loading contacts..." /> : null}
      {contactsQuery.error ? <ErrorState title="Unable to load contacts" message="Try again." /> : null}

      {!contactsQuery.isLoading && !contactsQuery.error && viewMode === "list" ? (
        <div className="module-list-table-wrap">
          <table className="table module-list-table align-middle">
            <thead>
              <tr>
                <th>Contact Name</th>
                <th>Account</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((contact) => (
                <tr key={contact.id}>
                  <td className="lead-name">
                    {contact.firstName} {contact.lastName}
                  </td>
                  <td>{accountName(contact.accountId)}</td>
                  <td>{contact.email ?? "—"}</td>
                  <td>{contact.phone ?? contact.mobile ?? "—"}</td>
                  <td>
                    <StatusBadge status={contact.status} />
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-5">
                    No contacts match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {!contactsQuery.isLoading && !contactsQuery.error && viewMode === "tile" ? (
        <div className="module-tile-grid">
          {rows.map((contact) => (
            <div key={contact.id} className="module-tile">
              <div className="tile-title">
                {contact.firstName} {contact.lastName}
              </div>
              <div className="small text-muted">{accountName(contact.accountId)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </ModuleListShell>
  );
}
