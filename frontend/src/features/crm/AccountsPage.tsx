import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { DynamicForm, FormActions, UnsavedGuard } from "@/components/FormKit";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { RecordShell } from "@/components/RecordShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listAuditLogs, listRegions } from "@/features/admin/adminApi";
import { getPublishedFormBundle, getPublishedRelatedLists } from "@/features/admin/studio/metadataApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import {
  createAccount,
  listAccountContacts,
  listAccountDeals,
  listAccounts,
  listActivities,
  type Account,
} from "./crmApi";
import { listDocuments, listNotes } from "./foundationApi";
import { listProjects } from "@/features/projects/projectApi";

const schema = z.object({
  regionId: z.string().min(1, "Region is required"),
  name: z.string().min(1, "Name is required"),
  accountType: z.string().min(1, "Type is required"),
  industry: z.string().optional(),
  email: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  status: z.string().optional(),
  billingAddress: z.string().optional(),
  shippingAddress: z.string().optional(),
  taxNumber: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function AccountsPage() {
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const canCreate = useHasPermission("ACCOUNT_CREATE");
  const canViewNotes = useHasPermission("NOTE_VIEW");
  const canViewDocs = useHasPermission("DOCUMENT_VIEW");
  const canViewActivities = useHasPermission("ACTIVITY_VIEW");
  const canViewProjects = useHasPermission("PROJECT_VIEW");
  const canViewAudit = useHasPermission("AUDIT_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [selected, setSelected] = useState<Account | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [saveAndNew, setSaveAndNew] = useState(false);

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
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const accountFormBundleQuery = useQuery({
    queryKey: ["metadata", "runtime", "account", "form-bundle", "CREATE"],
    queryFn: () => getPublishedFormBundle("account", "CREATE"),
    enabled: showForm,
    staleTime: 60_000,
  });
  const relatedListsQuery = useQuery({
    queryKey: ["metadata", "runtime", "account", "related-lists"],
    queryFn: () => getPublishedRelatedLists("account"),
    enabled: !!selected,
    staleTime: 60_000,
  });
  const contactsQuery = useQuery({
    queryKey: ["crm", "accounts", selected?.id, "contacts"],
    queryFn: () => listAccountContacts(selected!.id),
    enabled: !!selected,
  });
  const dealsQuery = useQuery({
    queryKey: ["crm", "accounts", selected?.id, "deals"],
    queryFn: () => listAccountDeals(selected!.id),
    enabled: !!selected,
  });
  const activitiesQuery = useQuery({
    queryKey: ["crm", "activities", "ACCOUNT", selected?.id],
    queryFn: () => listActivities({ relatedEntityType: "ACCOUNT", relatedEntityId: selected!.id }),
    enabled: !!selected && canViewActivities,
  });
  const notesQuery = useQuery({
    queryKey: ["crm", "notes", "ACCOUNT", selected?.id],
    queryFn: () => listNotes("ACCOUNT", selected!.id),
    enabled: !!selected && canViewNotes,
  });
  const docsQuery = useQuery({
    queryKey: ["crm", "documents", "ACCOUNT", selected?.id],
    queryFn: () => listDocuments("ACCOUNT", selected!.id),
    enabled: !!selected && canViewDocs,
  });
  const projectsQuery = useQuery({
    queryKey: ["projects", "account", selected?.id],
    queryFn: () => listProjects({ accountId: selected!.id }),
    enabled: !!selected && canViewProjects,
  });
  const auditQuery = useQuery({
    queryKey: ["admin", "audit-logs", "ACCOUNT", selected?.id],
    queryFn: () => listAuditLogs({ entityType: "ACCOUNT", entityId: selected!.id, size: 30 }),
    enabled: !!selected && canViewAudit,
  });

  const rows = accountsQuery.data ?? [];
  const activeFilterCount = [search, statusFilter, typeFilter, industryFilter, regionFilter].filter(Boolean)
    .length;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      regionId: "",
      name: "",
      accountType: "PROSPECT",
      industry: "",
      email: "",
      phone: "",
      website: "",
      status: "ACTIVE",
      billingAddress: "",
      shippingAddress: "",
      taxNumber: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "accounts"] });
      setFormError(null);
      if (saveAndNew) {
        reset();
        setSaveAndNew(false);
        setShowMore(false);
      } else {
        reset();
        setShowForm(false);
        setShowMore(false);
      }
    },
    onError: () => setFormError("Could not create account."),
  });

  function buildAccountBody(values: FormValues) {
    return {
      regionId: values.regionId,
      name: values.name,
      accountType: values.accountType,
      industry: values.industry || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      website: values.website || undefined,
      status: values.status || "ACTIVE",
      billingAddress: values.billingAddress || undefined,
      shippingAddress: values.shippingAddress || undefined,
      taxNumber: values.taxNumber || undefined,
      description: values.description || undefined,
    };
  }

  return (
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
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Create Account"}
          </button>
        ) : null
      }
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
            <label className="form-label small mb-1">Status</label>
            <select className="form-select form-select-sm mb-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
            <label className="form-label small mb-1">Type</label>
            <select className="form-select form-select-sm mb-2" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All</option>
              <option value="PROSPECT">PROSPECT</option>
              <option value="CUSTOMER">CUSTOMER</option>
              <option value="PARTNER">PARTNER</option>
              <option value="VENDOR">VENDOR</option>
            </select>
            <label className="form-label small mb-1">Industry</label>
            <input
              className="form-control form-control-sm mb-2"
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              placeholder="e.g. Technology"
            />
            <label className="form-label small mb-1">Region</label>
            <select
              className="form-select form-select-sm"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
            >
              <option value="">All</option>
              {(regionsQuery.data ?? []).map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {showForm ? (
        <form
          className="border-bottom p-3 bg-white"
          onSubmit={handleSubmit((values) => createMutation.mutate(buildAccountBody(values)))}
        >
          <UnsavedGuard when={isDirty && showForm} />
          {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
          {accountFormBundleQuery.isLoading ? <LoadingState label="Loading form layout..." /> : null}
          {accountFormBundleQuery.error ? (
            <ErrorState title="Form layout unavailable" message="Published Account CREATE layout is required." />
          ) : null}
          {accountFormBundleQuery.data ? (
            <DynamicForm
              layout={accountFormBundleQuery.data.layout.layout}
              fields={accountFormBundleQuery.data.fields}
              register={register}
              errors={errors}
              moreOpen={showMore}
              onMoreToggle={() => setShowMore((v) => !v)}
              fieldConfig={{
                regionId: {
                  options: (regionsQuery.data ?? []).map((region) => ({
                    value: region.id,
                    label: region.name,
                  })),
                  colClass: "col-md-3",
                },
                accountType: {
                  options: [
                    { value: "PROSPECT", label: "PROSPECT" },
                    { value: "CUSTOMER", label: "CUSTOMER" },
                    { value: "PARTNER", label: "PARTNER" },
                    { value: "VENDOR", label: "VENDOR" },
                  ],
                  colClass: "col-md-3",
                },
                status: {
                  options: [
                    { value: "ACTIVE", label: "ACTIVE" },
                    { value: "INACTIVE", label: "INACTIVE" },
                  ],
                },
                email: { typeOverride: "email" },
                name: { colClass: "col-md-4" },
              }}
            />
          ) : null}
          <FormActions
            submitLabel="Save"
            showSaveAndNew
            submitting={isSubmitting || createMutation.isPending}
            onSaveAndNew={() => {
              setSaveAndNew(true);
              void handleSubmit((values) => createMutation.mutate(buildAccountBody(values)))();
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

      {accountsQuery.isLoading ? <LoadingState label="Loading accounts..." /> : null}
      {accountsQuery.error ? <ErrorState title="Unable to load accounts" message="Try again." /> : null}

      {!accountsQuery.isLoading && !accountsQuery.error ? (
        <div className={selected ? "module-list-split" : undefined} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <div className="module-list-table-wrap">
              <table className="table module-list-table align-middle">
                <thead>
                  <tr>
                    <th>Account Name</th>
                    <th>Type</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((account) => (
                    <tr
                      key={account.id}
                      className={selected?.id === account.id ? "is-selected" : undefined}
                      onClick={() => setSelected(account)}
                    >
                      <td className="lead-name">{account.name}</td>
                      <td>{account.accountType}</td>
                      <td>{account.email ?? "—"}</td>
                      <td>{account.phone ?? "—"}</td>
                      <td>
                        <StatusBadge status={account.status} />
                      </td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-5">
                        No accounts match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="module-tile-grid">
              {rows.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  className={`module-tile text-start${selected?.id === account.id ? " is-selected" : ""}`}
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

          {selected ? (
            <RecordShell
              title={selected.name}
              subtitle={selected.accountType}
              badges={<StatusBadge status={selected.status} />}
              onClose={() => setSelected(null)}
              tabs={[
                {
                  id: "overview",
                  label: "Overview",
                  content: (
                    <>
                      <p className="small mb-3">Email: {selected.email ?? "—"}</p>
                      <p className="small mb-0">Phone: {selected.phone ?? "—"}</p>
                    </>
                  ),
                },
                {
                  id: "related",
                  label: "Related",
                  content: (
                    <>
                      {(relatedListsQuery.data ?? []).map((rl) => {
                        if (rl.childTableCode === "contact") {
                          return (
                            <div key={rl.id} className="mb-3">
                              <h2 className="h6">{rl.label}</h2>
                              <ul className="small mb-0">
                                {(contactsQuery.data ?? []).map((c) => (
                                  <li key={c.id}>
                                    {rl.columns?.length
                                      ? rl.columns
                                          .map((col) => String((c as unknown as Record<string, unknown>)[col.field] ?? ""))
                                          .filter(Boolean)
                                          .join(" · ")
                                      : `${c.firstName} ${c.lastName}`}
                                  </li>
                                ))}
                                {!contactsQuery.data?.length ? (
                                  <li className="text-muted">No linked contacts</li>
                                ) : null}
                              </ul>
                            </div>
                          );
                        }
                        if (rl.childTableCode === "deal") {
                          return (
                            <div key={rl.id} className="mb-3">
                              <h2 className="h6">{rl.label}</h2>
                              <ul className="small mb-0">
                                {(dealsQuery.data ?? []).map((d) => (
                                  <li key={d.id}>
                                    {d.name} — <StatusBadge status={d.stage} />
                                  </li>
                                ))}
                                {!dealsQuery.data?.length ? (
                                  <li className="text-muted">No linked deals</li>
                                ) : null}
                              </ul>
                            </div>
                          );
                        }
                        if (rl.childTableCode === "activity" && canViewActivities) {
                          return (
                            <div key={rl.id} className="mb-3">
                              <h2 className="h6">{rl.label}</h2>
                              <ul className="small mb-0">
                                {(activitiesQuery.data ?? []).map((a) => (
                                  <li key={a.id}>
                                    {a.subject} — <StatusBadge status={a.status} />
                                  </li>
                                ))}
                                {!activitiesQuery.data?.length ? (
                                  <li className="text-muted">No activities</li>
                                ) : null}
                              </ul>
                            </div>
                          );
                        }
                        if (rl.childTableCode === "project" && canViewProjects) {
                          return (
                            <div key={rl.id} className="mb-3">
                              <h2 className="h6">{rl.label}</h2>
                              <ul className="small mb-0">
                                {(projectsQuery.data ?? []).map((p) => (
                                  <li key={p.id}>
                                    {p.name} — <StatusBadge status={p.status} />
                                    {p.health ? (
                                      <>
                                        {" "}
                                        · <StatusBadge status={p.health} />
                                      </>
                                    ) : null}
                                  </li>
                                ))}
                                {!projectsQuery.data?.length ? (
                                  <li className="text-muted">No linked projects</li>
                                ) : null}
                              </ul>
                            </div>
                          );
                        }
                        if (rl.childTableCode === "document" && canViewDocs) {
                          return (
                            <div key={rl.id} className="mb-3">
                              <h2 className="h6">{rl.label}</h2>
                              <ul className="small mb-0">
                                {(docsQuery.data ?? []).map((d) => (
                                  <li key={d.id}>
                                    {d.fileName}
                                    {d.visibility ? ` — ${d.visibility}` : ""}
                                  </li>
                                ))}
                                {!docsQuery.data?.length ? (
                                  <li className="text-muted">No documents</li>
                                ) : null}
                              </ul>
                            </div>
                          );
                        }
                        if (rl.childTableCode === "note" && canViewNotes) {
                          return (
                            <div key={rl.id} className="mb-3">
                              <h2 className="h6">{rl.label}</h2>
                              <ul className="small mb-0">
                                {(notesQuery.data ?? []).map((n) => (
                                  <li key={n.id}>{n.body}</li>
                                ))}
                                {!notesQuery.data?.length ? (
                                  <li className="text-muted">No notes</li>
                                ) : null}
                              </ul>
                            </div>
                          );
                        }
                        return null;
                      })}
                      {!relatedListsQuery.data?.length ? (
                        <p className="text-muted small mb-0">No related lists configured.</p>
                      ) : null}
                    </>
                  ),
                },
                {
                  id: "activities",
                  label: "Activities",
                  visible: canViewActivities,
                  content: (
                    <ul className="small mb-0">
                      {(activitiesQuery.data ?? []).map((a) => (
                        <li key={a.id}>
                          {a.subject} — <StatusBadge status={a.status} />
                        </li>
                      ))}
                      {!activitiesQuery.data?.length ? <li className="text-muted">No activities</li> : null}
                    </ul>
                  ),
                },
                {
                  id: "notes",
                  label: "Notes",
                  visible: canViewNotes,
                  content: (
                    <ul className="small mb-0">
                      {(notesQuery.data ?? []).map((n) => (
                        <li key={n.id}>{n.body}</li>
                      ))}
                      {!notesQuery.data?.length ? <li className="text-muted">No notes</li> : null}
                    </ul>
                  ),
                },
                {
                  id: "documents",
                  label: "Documents",
                  visible: canViewDocs,
                  content: (
                    <ul className="small mb-0">
                      {(docsQuery.data ?? []).map((d) => (
                        <li key={d.id}>{d.fileName}</li>
                      ))}
                      {!docsQuery.data?.length ? <li className="text-muted">No documents</li> : null}
                    </ul>
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
          ) : null}
        </div>
      ) : null}
    </ModuleListShell>
  );
}
