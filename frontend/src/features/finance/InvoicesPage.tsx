import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormSection } from "@/components/FormKit";
import {
  optionsFromPairs,
  ZohoFormKitCreateView,
  ZohoFormSelect,
  useZohoCreateFlow,
} from "@/components/ZohoCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { RecordShell, DEFAULT_RELATED_LINKS } from "@/components/RecordShell";
import { useRecordNavigation } from "@/components/ZohoRecord";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listRegions } from "@/features/admin/adminApi";
import { listAccounts } from "@/features/crm/crmApi";
import { listProjects } from "@/features/projects/projectApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import {
  applyCreditNote,
  createCreditNote,
  createInvoice,
  exportInvoicesCsv,
  getInvoice,
  issueInvoice,
  listInvoices,
  listUnbilledTime,
  pullTimeIntoInvoice,
  queryInvoices,
  recordPayment,
  voidInvoice,
  type Invoice,
} from "./invoiceApi";
import { buildInvoiceFilterConditions, needsInvoiceQuery } from "./invoiceFilterCatalog";

const createSchema = z.object({
  regionId: z.string().min(1, "Region is required"),
  accountId: z.string().min(1, "Account is required"),
  projectId: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

const CREATE_DEFAULTS: CreateFormValues = {
  regionId: "",
  accountId: "",
  projectId: "",
  dueDate: "",
  notes: "",
};

export function InvoicesPage() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission("INVOICE_CREATE");
  const canUpdate = useHasPermission("INVOICE_UPDATE");
  const canVoid = useHasPermission("INVOICE_DELETE");
  const canPay = useHasPermission("PAYMENT_MANAGE");
  const canCredit = useHasPermission("CREDIT_NOTE_MANAGE") || useHasPermission("INVOICE_UPDATE");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [minBalance, setMinBalance] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [selectedTimeIds, setSelectedTimeIds] = useState<string[]>([]);

  const advanced = needsInvoiceQuery({
    dueFrom,
    dueTo,
    minBalance,
    regionId: regionFilter,
    overdueOnly,
  });

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter || undefined,
      accountId: accountFilter || undefined,
      projectId: projectFilter || undefined,
      overdueOnly: overdueOnly || undefined,
    }),
    [search, statusFilter, accountFilter, projectFilter, overdueOnly],
  );

  const queryBody = useMemo(() => {
    const conditions = buildInvoiceFilterConditions({
      status: statusFilter || undefined,
      accountId: accountFilter || undefined,
      projectId: projectFilter || undefined,
      regionId: regionFilter || undefined,
      dueFrom: dueFrom || undefined,
      dueTo: dueTo || undefined,
      minBalance: minBalance || undefined,
      overdueOnly,
    });
    return {
      search: search || undefined,
      overdueOnly: overdueOnly || undefined,
      filter: conditions.length ? { op: "AND" as const, conditions } : undefined,
    };
  }, [
    search,
    statusFilter,
    accountFilter,
    projectFilter,
    regionFilter,
    dueFrom,
    dueTo,
    minBalance,
    overdueOnly,
  ]);

  const invoicesQuery = useQuery({
    queryKey: ["invoices", advanced ? "query" : "list", advanced ? queryBody : listParams],
    queryFn: () => (advanced ? queryInvoices(queryBody) : listInvoices(listParams)),
  });
  const accountsQuery = useQuery({ queryKey: ["crm", "accounts"], queryFn: () => listAccounts() });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => listProjects() });
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const detailQuery = useQuery({
    queryKey: ["invoices", selectedId],
    queryFn: () => getInvoice(selectedId!),
    enabled: !!selectedId,
  });
  const unbilledQuery = useQuery({
    queryKey: ["invoices", "unbilled", detailQuery.data?.projectId],
    queryFn: () => listUnbilledTime(detailQuery.data?.projectId ?? undefined),
    enabled: !!selectedId && detailQuery.data?.status === "DRAFT",
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: CREATE_DEFAULTS,
  });

  const { photo, cancelCreate, afterCreateSuccess } = useZohoCreateFlow({
    defaults: CREATE_DEFAULTS,
    reset,
    setShowForm,
    setFormError,
    setSelected: (entity) => setSelectedId(entity.id),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["invoices"] });
  };

  const createMutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: async (invoice) => {
      await invalidate();
      setFormError(null);
      await afterCreateSuccess(invoice, "INVOICE");
    },
    onError: () => setFormError("Could not create invoice draft."),
  });

  const regionOptions = useMemo(
    () => optionsFromPairs((regionsQuery.data ?? []).map((r) => ({ value: r.id, label: r.name }))),
    [regionsQuery.data],
  );
  const accountOptions = useMemo(
    () => optionsFromPairs((accountsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name }))),
    [accountsQuery.data],
  );
  const projectOptions = useMemo(
    () => optionsFromPairs((projectsQuery.data ?? []).map((p) => ({ value: p.id, label: p.name }))),
    [projectsQuery.data],
  );

  const onCreateSubmit = (values: CreateFormValues) => {
    createMutation.mutate({
      regionId: values.regionId,
      accountId: values.accountId,
      projectId: values.projectId || undefined,
      dueDate: values.dueDate || undefined,
      notes: values.notes || undefined,
    });
  };

  const issueMutation = useMutation({
    mutationFn: (id: string) => issueInvoice(id),
    onSuccess: invalidate,
    onError: () => setActionError("Could not issue invoice."),
  });
  const voidMutation = useMutation({
    mutationFn: (id: string) => voidInvoice(id),
    onSuccess: invalidate,
    onError: () => setActionError("Could not void invoice."),
  });
  const payMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      recordPayment(id, { amount, paidAt: new Date().toISOString().slice(0, 10), method: "BANK_TRANSFER" }),
    onSuccess: async () => {
      setPayAmount("");
      await invalidate();
    },
    onError: () => setActionError("Could not record payment."),
  });
  const pullMutation = useMutation({
    mutationFn: ({ id, ids }: { id: string; ids: string[] }) =>
      pullTimeIntoInvoice(id, { timeEntryIds: ids }),
    onSuccess: async () => {
      setSelectedTimeIds([]);
      await invalidate();
    },
    onError: () => setActionError("Could not pull time entries (already billed or not approved)."),
  });
  const creditMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const note = await createCreditNote(id, { amount, reason: "Adjustment" });
      return applyCreditNote(note.id);
    },
    onSuccess: async () => {
      setCreditAmount("");
      await invalidate();
    },
    onError: () => setActionError("Could not apply credit note."),
  });

  async function downloadCsv() {
    const blob = await exportInvoicesCsv();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invoices.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const rows = invoicesQuery.data ?? [];
  const selectedRow = rows.find((row) => row.id === selectedId) ?? null;
  const recordNav = useRecordNavigation(rows, selectedRow, (item) => {
    setSelectedId(item?.id ?? null);
    setActionError(null);
    setPayAmount("");
    setCreditAmount("");
    setSelectedTimeIds([]);
  });
  const selected: Invoice | undefined = detailQuery.data;
  const accountName = (id: string) =>
    accountsQuery.data?.find((a) => a.id === id)?.name ?? id.slice(0, 8);
  const activeFilterCount = [
    search,
    statusFilter,
    accountFilter,
    projectFilter,
    regionFilter,
    dueFrom,
    dueTo,
    minBalance,
    overdueOnly ? "1" : "",
  ].filter(Boolean).length;

  return (
    <>
      {showForm && canCreate ? (
        <ZohoFormKitCreateView
          title="Create Invoice"
          tableCode="invoice"
          entityLabel="Invoice"
          pending={isSubmitting || createMutation.isPending}
          isDirty={isDirty}
          formError={formError}
          onCancel={() => cancelCreate(isDirty)}
          onSave={() => void handleSubmit(onCreateSubmit)()}
          onSubmit={() => void handleSubmit(onCreateSubmit)()}
          photo={photo}
        >
          <FormSection title="Draft invoice" description="Account, optional project, due date">
            <div className="col-md-3">
              <label className="form-label required">Region</label>
              <ZohoFormSelect
                control={control}
                name="regionId"
                options={regionOptions}
                searchPlaceholder="Search Regions"
                allowEmpty={false}
                placeholder="Select"
                invalid={!!errors.regionId}
              />
              {errors.regionId ? <div className="invalid-feedback d-block">{errors.regionId.message}</div> : null}
            </div>
            <div className="col-md-3">
              <label className="form-label required">Account</label>
              <ZohoFormSelect
                control={control}
                name="accountId"
                options={accountOptions}
                searchPlaceholder="Search Accounts"
                lookupIcon="building"
                allowEmpty={false}
                placeholder="Select"
                invalid={!!errors.accountId}
              />
              {errors.accountId ? <div className="invalid-feedback d-block">{errors.accountId.message}</div> : null}
            </div>
            <div className="col-md-3">
              <label className="form-label">Project</label>
              <ZohoFormSelect
                control={control}
                name="projectId"
                options={projectOptions}
                searchPlaceholder="Search Projects"
                lookupIcon="apps"
                placeholder="Optional"
              />
            </div>
            <div className="col-md-3">
              <FormField label="Due date" type="date" error={errors.dueDate} {...register("dueDate")} />
            </div>
          </FormSection>
        </ZohoFormKitCreateView>
      ) : selectedId ? (
        detailQuery.isLoading ? (
          <LoadingState label="Loading invoice…" />
        ) : selected ? (
        <RecordShell
            title={selected.invoiceNumber ?? "Draft invoice"}
            subtitle={`${selected.currencyCode} ${selected.total}`}
            meta={`Balance ${selected.balanceDue}`}
            status={<StatusBadge status={selected.status} />}
            recordKey={selected.id}
            layout="page"
            avatarLabel={selected.invoiceNumber ?? "Draft invoice"}
            onBack={recordNav.goBack}
            onPrev={recordNav.goPrev}
            onNext={recordNav.goNext}
            hasPrev={recordNav.hasPrev}
            hasNext={recordNav.hasNext}
            relatedLinks={[...DEFAULT_RELATED_LINKS]}
            primaryAction={
              canUpdate && selected.status === "DRAFT" ? (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={issueMutation.isPending}
                  onClick={() => issueMutation.mutate(selected.id)}
                >
                  Issue
                </button>
              ) : null
            }
            secondaryActions={
              canVoid && ["DRAFT", "ISSUED", "OVERDUE"].includes(selected.status) ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  disabled={voidMutation.isPending}
                  onClick={() => {
                    if (window.confirm("Void this invoice?")) voidMutation.mutate(selected.id);
                  }}
                >
                  Void
                </button>
              ) : null
            }
            tabs={[
              {
                id: "overview",
                label: "Overview",
                content: (
                  <>
                    {actionError ? <div className="alert alert-danger py-2 small">{actionError}</div> : null}
                    <p className="small mb-1">Account: {accountName(selected.accountId)}</p>
                    <p className="small mb-1">Due: {selected.dueDate ?? "—"}</p>
                    <p className="small mb-3">
                      Paid {selected.amountPaid} · Credited {selected.amountCredited ?? 0}
                    </p>
                    <h3 className="h6">Lines</h3>
                    <ul className="small mb-3">
                      {(selected.lines ?? []).map((l) => (
                        <li key={l.id}>
                          {l.description} — {l.amount}
                          {l.timeEntryId ? " (time)" : ""}
                        </li>
                      ))}
                      {!selected.lines?.length ? <li className="text-muted">No lines</li> : null}
                    </ul>
                    {selected.status === "DRAFT" && canUpdate ? (
                      <>
                        <h3 className="h6">Pull billable time</h3>
                        <ul className="small mb-2 list-unstyled">
                          {(unbilledQuery.data ?? []).map((e) => (
                            <li key={e.id} className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`te-${e.id}`}
                                checked={selectedTimeIds.includes(e.id)}
                                onChange={(ev) => {
                                  setSelectedTimeIds((prev) =>
                                    ev.target.checked
                                      ? [...prev, e.id]
                                      : prev.filter((x) => x !== e.id),
                                  );
                                }}
                              />
                              <label className="form-check-label" htmlFor={`te-${e.id}`}>
                                {e.workDate} · {e.hours}h @ {e.billingRate ?? 0}
                              </label>
                            </li>
                          ))}
                          {!unbilledQuery.data?.length ? (
                            <li className="text-muted">No unbilled approved time</li>
                          ) : null}
                        </ul>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          disabled={!selectedTimeIds.length || pullMutation.isPending}
                          onClick={() =>
                            pullMutation.mutate({ id: selected.id, ids: selectedTimeIds })
                          }
                        >
                          Add selected time
                        </button>
                      </>
                    ) : null}
                  </>
                ),
              },
              {
                id: "payments",
                label: "Payments",
                content: (
                  <>
                    {canPay &&
                    ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(selected.status) &&
                    selected.balanceDue > 0 ? (
                      <div className="input-group input-group-sm mb-3">
                        <input
                          className="form-control"
                          type="number"
                          placeholder="Amount"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-success"
                          disabled={!payAmount || payMutation.isPending}
                          onClick={() =>
                            payMutation.mutate({ id: selected.id, amount: Number(payAmount) })
                          }
                        >
                          Pay
                        </button>
                      </div>
                    ) : null}
                    <ul className="small mb-0">
                      {(selected.payments ?? []).map((p) => (
                        <li key={p.id}>
                          {p.paidAt}: {p.amount} {p.method ? `(${p.method})` : ""}
                        </li>
                      ))}
                      {!selected.payments?.length ? (
                        <li className="text-muted">No payments</li>
                      ) : null}
                    </ul>
                  </>
                ),
              },
              {
                id: "credits",
                label: "Credits",
                content: (
                  <>
                    {canCredit &&
                    ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(selected.status) &&
                    selected.balanceDue > 0 ? (
                      <div className="input-group input-group-sm mb-3">
                        <input
                          className="form-control"
                          type="number"
                          placeholder="Credit amount"
                          value={creditAmount}
                          onChange={(e) => setCreditAmount(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-warning"
                          disabled={!creditAmount || creditMutation.isPending}
                          onClick={() =>
                            creditMutation.mutate({
                              id: selected.id,
                              amount: Number(creditAmount),
                            })
                          }
                        >
                          Apply credit
                        </button>
                      </div>
                    ) : null}
                    <ul className="small mb-0">
                      {(selected.creditNotes ?? []).map((c) => (
                        <li key={c.id}>
                          {c.creditNumber ?? "Draft"} · {c.amount} ·{" "}
                          <StatusBadge status={c.status} />
                        </li>
                      ))}
                      {!selected.creditNotes?.length ? (
                        <li className="text-muted">No credit notes</li>
                      ) : null}
                    </ul>
                  </>
                ),
              },
            ]}
                />

        ) : null
      ) : (
    <ModuleListShell
      title="Invoices"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Invoices</span>}
      toolbarActions={
        <>
          <button type="button" className="btn btn-sm btn-outline-secondary me-1" onClick={() => void downloadCsv()}>
            Export CSV
          </button>
          <button
            type="button"
            className={`btn btn-sm ${filterOpen ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setFilterOpen((o) => !o)}
          >
            Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </button>
        </>
      }
      primaryAction={
        canCreate ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              reset(CREATE_DEFAULTS);
              setShowForm(true);
            }}
          >
            Create Invoice
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Invoices by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Number or notes"
            />
          </div>
          <div className="module-filter-section">
            <h3>Status</h3>
            <select className="form-select form-select-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              {["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="module-filter-section">
            <h3>Account</h3>
            <select className="form-select form-select-sm" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
              <option value="">All</option>
              {(accountsQuery.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="module-filter-section">
            <h3>Project</h3>
            <select className="form-select form-select-sm" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <option value="">All</option>
              {(projectsQuery.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="module-filter-section">
            <h3>Region</h3>
            <select className="form-select form-select-sm" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
              <option value="">All</option>
              {(regionsQuery.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="module-filter-section">
            <h3>Due from</h3>
            <input className="form-control form-control-sm" type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} />
            <h3 className="mt-2">Due to</h3>
            <input className="form-control form-control-sm" type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} />
          </div>
          <div className="module-filter-section">
            <h3>Min balance</h3>
            <input
              className="form-control form-control-sm"
              type="number"
              value={minBalance}
              onChange={(e) => setMinBalance(e.target.value)}
            />
          </div>
          <div className="module-filter-section">
            <div className="form-check">
              <input
                id="invOverdue"
                className="form-check-input"
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
              />
              <label className="form-check-label small" htmlFor="invOverdue">
                Overdue only
              </label>
            </div>
          </div>
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {invoicesQuery.isLoading ? <LoadingState label="Loading invoices..." /> : null}
      {invoicesQuery.error ? <ErrorState title="Unable to load invoices" message="Try again." /> : null}

      {!invoicesQuery.isLoading && !invoicesQuery.error ? (
        <div className="module-list-table-wrap">
            <table className="table module-list-table align-middle">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Account</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th>Total</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => (
                  <tr
                    key={inv.id}
                    className={selectedId === inv.id ? "table-active" : undefined}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setSelectedId(inv.id);
                      setActionError(null);
                    }}
                  >
                    <td className="lead-name">{inv.invoiceNumber ?? "Draft"}</td>
                    <td>{accountName(inv.accountId)}</td>
                    <td>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td>{inv.dueDate ?? "—"}</td>
                    <td>
                      {inv.currencyCode} {inv.total}
                    </td>
                    <td>{inv.balanceDue}</td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-5">
                      No invoices
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
      ) : null}
    </ModuleListShell>
      )}
    </>
  );
}
