import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  enumPickerOptions,
  optionsFromPairs,
  TechEarnestCreateColumn,
  TechEarnestCreateField,
  TechEarnestCreateGrid,
  TechEarnestCreateSection,
  TechEarnestFilterSelect,
  TechEarnestFormKitCreateView,
  TechEarnestFormSelect,
  useTechEarnestCreateFlow,
} from "@/components/TechEarnestCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import {
  ModuleFilterCheckbox,
  ModuleFilterDateRange,
  ModuleFilterField,
  ModuleListShell,
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
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listAuditLogs, listRegions, listUsers } from "@/features/admin/adminApi";
import { listAccounts } from "@/features/crm/crmApi";
import { listProjects } from "@/features/projects/projectApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { useUrlRecordId } from "@/hooks/useUrlRecord";
import { RecordLink } from "@/components/RecordLink";
import { useBulkImport } from "@/features/import/useBulkImport";
import {
  applyCreditNote,
  addInvoiceLine,
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

const invoiceStatusOptions = enumPickerOptions(["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"]);

const createSchema = z.object({
  regionId: z.string().min(1, "Region is required"),
  accountId: z.string().min(1, "Account is required"),
  projectId: z.string().optional(),
  currencyCode: z
    .string()
    .trim()
    .refine((value) => !value || /^[A-Za-z]{3}$/.test(value), "Use a 3-letter currency code, e.g. INR")
    .optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

const CREATE_DEFAULTS: CreateFormValues = {
  regionId: "",
  accountId: "",
  projectId: "",
  currencyCode: "",
  dueDate: "",
  notes: "",
};

export function InvoicesPage() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const canViewAudit = useHasPermission("AUDIT_VIEW");
  const canViewUsers = useHasPermission("USER_VIEW");
  const canCreate = useHasPermission("INVOICE_CREATE");
  const canUpdate = useHasPermission("INVOICE_UPDATE");
  const canVoid = useHasPermission("INVOICE_DELETE");
  const canPay = useHasPermission("PAYMENT_MANAGE");
  const canManageCredit = useHasPermission("CREDIT_NOTE_MANAGE");
  const canCredit = canManageCredit || canUpdate;
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
  const [selectedId, setSelectedId] = useUrlRecordId();
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [selectedTimeIds, setSelectedTimeIds] = useState<string[]>([]);
  const [showAddLine, setShowAddLine] = useState(false);
  const [lineDescription, setLineDescription] = useState("");
  const [lineQuantity, setLineQuantity] = useState("1");
  const [lineUnitPrice, setLineUnitPrice] = useState("");

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
  const auditQuery = useQuery({
    queryKey: ["admin", "audit-logs", "INVOICE", selectedId],
    queryFn: () => listAuditLogs({ entityType: "INVOICE", entityId: selectedId!, size: 30 }),
    enabled: !!selectedId && canViewAudit,
  });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: !!selectedId && canViewUsers,
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

  const { setSaveAndNew, cancelCreate, afterCreateSuccess } = useTechEarnestCreateFlow({
    defaults: CREATE_DEFAULTS,
    reset,
    setShowForm,
    setFormError,
    setSelected: (entity) => setSelectedId(entity.id),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["invoices"] });
  };
  const bulkImport = useBulkImport("invoices", invalidate);

  function openCreateInvoice() {
    reset(CREATE_DEFAULTS);
    setShowForm(true);
  }

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
      currencyCode: values.currencyCode ? values.currencyCode.toUpperCase() : undefined,
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
  const addLineMutation = useMutation({
    mutationFn: ({ id, description, quantity, unitPrice }: { id: string; description: string; quantity: number; unitPrice: number }) =>
      addInvoiceLine(id, { description, quantity, unitPrice }),
    onSuccess: async () => {
      setShowAddLine(false);
      setLineDescription("");
      setLineQuantity("1");
      setLineUnitPrice("");
      setActionError(null);
      await invalidate();
      await detailQuery.refetch();
    },
    onError: () => setActionError("Could not add invoice line. Check the values and invoice status."),
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
  const projectName = (id: string | null) =>
    id ? (projectsQuery.data?.find((p) => p.id === id)?.name ?? id.slice(0, 8)) : "—";
  const regionName = (id: string) => regionsQuery.data?.find((r) => r.id === id)?.name ?? id.slice(0, 8);
  const selectedAccount = selected ? accountsQuery.data?.find((a) => a.id === selected.accountId) : undefined;
  const userLabel = useMemo(() => {
    const map = new Map(
      (usersQuery.data ?? []).map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]),
    );
    return (id: string | null | undefined) =>
      id ? (id === auth.userId ? auth.displayName : (map.get(id) ?? id.slice(0, 8))) : "—";
  }, [usersQuery.data, auth.userId, auth.displayName]);
  const timelineEntries = useMemo(
    () => buildTimelineEntries(auditQuery.data, undefined, userLabel, recordLifecycleInfo("Invoice", selected ?? null)),
    [auditQuery.data, userLabel, selected],
  );
  const money = (value: number | null | undefined) =>
    value == null ? "—" : `${selected?.currencyCode ?? ""} ${value}`.trim();
  const canTakeMoney = !!selected && ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(selected.status) && selected.balanceDue > 0;
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
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setAccountFilter("");
    setProjectFilter("");
    setRegionFilter("");
    setDueFrom("");
    setDueTo("");
    setMinBalance("");
    setOverdueOnly(false);
  };

  return (
    <>
      {showForm && canCreate ? (
        <TechEarnestFormKitCreateView
          title="Create Invoice"
          tableCode="invoice"
          entityLabel="Invoice"
          pending={isSubmitting || createMutation.isPending}
          isDirty={isDirty}
          formError={formError}
          onCancel={() => cancelCreate(isDirty)}
          onSave={() => void handleSubmit(onCreateSubmit)()}
          onSaveAndNew={() => {
            setSaveAndNew(true);
            void handleSubmit(onCreateSubmit)();
          }}
          onSubmit={() => void handleSubmit(onCreateSubmit)()}
          showRecordImage={false}
        >
          <TechEarnestCreateSection title="Invoice Information">
            <TechEarnestCreateGrid>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Account Name" required error={errors.accountId?.message}>
                  <TechEarnestFormSelect
                    control={control}
                    name="accountId"
                    options={accountOptions}
                    searchPlaceholder="Search Accounts"
                    lookupIcon="building"
                    allowEmpty={false}
                    placeholder="Select account"
                    invalid={!!errors.accountId}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Project">
                  <TechEarnestFormSelect
                    control={control}
                    name="projectId"
                    options={projectOptions}
                    searchPlaceholder="Search Projects"
                    lookupIcon="apps"
                    placeholder="Optional"
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Region" required error={errors.regionId?.message}>
                  <TechEarnestFormSelect
                    control={control}
                    name="regionId"
                    options={regionOptions}
                    searchPlaceholder="Search Regions"
                    lookupIcon="building"
                    allowEmpty={false}
                    placeholder="Select region"
                    invalid={!!errors.regionId}
                  />
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Due Date" error={errors.dueDate?.message}>
                  <input type="date" className="form-control form-control-sm" {...register("dueDate")} />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Currency" error={errors.currencyCode?.message}>
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="Organisation default"
                    className={`form-control form-control-sm text-uppercase${errors.currencyCode ? " is-invalid" : ""}`}
                    {...register("currencyCode")}
                  />
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
            </TechEarnestCreateGrid>
          </TechEarnestCreateSection>
          <TechEarnestCreateSection title="Description Information">
            <TechEarnestCreateField label="Notes" wide error={errors.notes?.message}>
              <textarea rows={4} className="form-control form-control-sm" {...register("notes")} />
            </TechEarnestCreateField>
            <p className="small text-muted mb-0 mt-2">
              The invoice is saved as a draft. Add line items or pull unbilled time from the invoice record after saving.
            </p>
          </TechEarnestCreateSection>
        </TechEarnestFormKitCreateView>
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
              selectedAccount?.email ? (
                <a
                  className="btn btn-primary btn-sm"
                  href={`mailto:${selectedAccount.email}?subject=${encodeURIComponent(
                    `Invoice ${selected.invoiceNumber ?? ""}`.trim(),
                  )}`}
                >
                  Send Email
                </a>
              ) : (
                <button type="button" className="btn btn-primary btn-sm" disabled>
                  Send Email
                </button>
              )
            }
            secondaryActions={
              <>
                {selected.status === "DRAFT" ? (
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={!canUpdate || issueMutation.isPending}
                    onClick={() => issueMutation.mutate(selected.id)}
                  >
                    Issue
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  disabled={
                    !canVoid || !["DRAFT", "ISSUED", "OVERDUE"].includes(selected.status) || voidMutation.isPending
                  }
                  onClick={() => {
                    if (window.confirm("Void this invoice?")) voidMutation.mutate(selected.id);
                  }}
                >
                  Void
                </button>
              </>
            }
            tabs={[
              {
                id: "overview",
                label: "Overview",
                content: (
                  <>
                    {actionError ? <div className="alert alert-danger py-2 small">{actionError}</div> : null}
                    <TechEarnestRecordSummaryStrip
                      fields={[
                        {
                          label: "Account",
                          value: (
                            <RecordLink module="account" id={selected.accountId}>
                              {accountName(selected.accountId)}
                            </RecordLink>
                          ),
                        },
                        { label: "Total", value: money(selected.total) },
                        { label: "Balance Due", value: money(selected.balanceDue) },
                        { label: "Due Date", value: selected.dueDate ?? "—" },
                        { label: "Status", value: <StatusBadge status={selected.status} /> },
                      ]}
                    />

                    <TechEarnestRecordInfoSection
                      title="Invoice Information"
                      fields={[
                        { label: "Invoice Number", value: selected.invoiceNumber ?? "Draft" },
                        {
                          label: "Account",
                          value: (
                            <RecordLink module="account" id={selected.accountId}>
                              {accountName(selected.accountId)}
                            </RecordLink>
                          ),
                        },
                        {
                          label: "Project",
                          value: (
                            <RecordLink module="project" id={selected.projectId}>
                              {projectName(selected.projectId)}
                            </RecordLink>
                          ),
                        },
                        { label: "Region", value: regionName(selected.regionId) },
                        { label: "Currency", value: selected.currencyCode },
                        { label: "Status", value: selected.status },
                        { label: "Issue Date", value: selected.issueDate ?? "—" },
                        { label: "Due Date", value: selected.dueDate ?? "—" },
                      ]}
                    />

                    <TechEarnestRecordInfoSection
                      title="Amounts"
                      fields={[
                        { label: "Subtotal", value: money(selected.subtotal) },
                        { label: "Tax", value: money(selected.taxTotal) },
                        { label: "Total", value: money(selected.total) },
                        { label: "Amount Paid", value: money(selected.amountPaid) },
                        { label: "Amount Credited", value: money(selected.amountCredited ?? 0) },
                        { label: "Balance Due", value: money(selected.balanceDue) },
                      ]}
                    />

                    <TechEarnestRecordInfoSection
                      title="Description"
                      fields={[{ label: "Notes", value: selected.notes || "—" }]}
                    />

                    <TechEarnestRecordRelatedCard
                      id="techearnest-record-section-lines"
                      title={`Line Items (${selected.lines?.length ?? 0})`}
                      isEmpty={!selected.lines?.length}
                      emptyLabel="No records found"
                      actions={
                        selected.status === "DRAFT" && canUpdate ? (
                          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowAddLine(true)}>
                            New Line
                          </button>
                        ) : null
                      }
                    >
                      <div className="table-responsive">
                        <table className="table table-sm small mb-0">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Description</th>
                              <th className="text-end">Qty</th>
                              <th className="text-end">Unit Price</th>
                              <th className="text-end">Tax</th>
                              <th className="text-end">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selected.lines ?? []).map((line) => (
                              <tr key={line.id}>
                                <td>{line.lineNo}</td>
                                <td>
                                  {line.description}
                                  {line.timeEntryId ? <span className="badge bg-light text-dark ms-1">Time</span> : null}
                                  {line.projectId && line.projectId !== selected.projectId ? (
                                    <div className="text-muted">
                                      <RecordLink module="project" id={line.projectId}>
                                        {projectName(line.projectId)}
                                      </RecordLink>
                                    </div>
                                  ) : null}
                                </td>
                                <td className="text-end">{line.quantity}</td>
                                <td className="text-end">{line.unitPrice}</td>
                                <td className="text-end">{line.taxAmount}</td>
                                <td className="text-end">{line.amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </TechEarnestRecordRelatedCard>

                    {selected.status === "DRAFT" && canUpdate ? (
                      <TechEarnestRecordRelatedCard
                        id="techearnest-record-section-unbilled"
                        title={`Unbilled Time (${unbilledQuery.data?.length ?? 0})`}
                        isEmpty={!unbilledQuery.isLoading && !unbilledQuery.data?.length}
                        emptyLabel="No unbilled approved time"
                        actions={
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            disabled={!selectedTimeIds.length || pullMutation.isPending}
                            onClick={() => pullMutation.mutate({ id: selected.id, ids: selectedTimeIds })}
                          >
                            Add Selected Time
                          </button>
                        }
                      >
                        <ul className="small mb-0 list-unstyled">
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
                        </ul>
                      </TechEarnestRecordRelatedCard>
                    ) : null}

                    <TechEarnestRecordRelatedCard
                      id="techearnest-record-section-payments"
                      title={`Payments (${selected.payments?.length ?? 0})`}
                      isEmpty={!selected.payments?.length && !(canPay && canTakeMoney)}
                      emptyLabel="No records found"
                    >
                    {canPay && canTakeMoney ? (
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
                    <ul className="list-unstyled small mb-0">
                      {(selected.payments ?? []).map((p) => (
                        <li key={p.id} className="mb-2 d-flex justify-content-between gap-2">
                          <span>
                            {p.paidAt}
                            {p.method ? <span className="text-muted"> · {p.method}</span> : null}
                          </span>
                          <span className="fw-semibold">{money(p.amount)}</span>
                        </li>
                      ))}
                    </ul>
                    </TechEarnestRecordRelatedCard>

                    <TechEarnestRecordRelatedCard
                      id="techearnest-record-section-credit-notes"
                      title={`Credit Notes (${selected.creditNotes?.length ?? 0})`}
                      isEmpty={!selected.creditNotes?.length && !(canCredit && canTakeMoney)}
                      emptyLabel="No records found"
                    >
                    {canCredit && canTakeMoney ? (
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
                    <ul className="list-unstyled small mb-0">
                      {(selected.creditNotes ?? []).map((c) => (
                        <li key={c.id} className="mb-2 d-flex justify-content-between gap-2">
                          <span>
                            {c.creditNumber ?? "Draft"} · {money(c.amount)}
                            {c.reason ? <span className="text-muted"> · {c.reason}</span> : null}
                          </span>
                          <StatusBadge status={c.status} />
                        </li>
                      ))}
                    </ul>
                    </TechEarnestRecordRelatedCard>
                  </>
                ),
              },
              {
                id: "timeline",
                label: "Timeline",
                visible: true,
                content: <TechEarnestRecordTimeline entries={timelineEntries} loading={auditQuery.isLoading} />,
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
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreateInvoice}>
            Create Invoice
          </button>
        ) : null
      }
      createMenuItems={bulkImport.menuItems}
      moreMenuItems={bulkImport.menuItems}
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
            <h3>Filter by fields</h3>
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={invoiceStatusOptions} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search invoice statuses" />
            <TechEarnestFilterSelect label="Account" value={accountFilter} onChange={setAccountFilter} options={accountOptions} placeholder="All accounts" emptyLabel="All accounts" searchPlaceholder="Search accounts" />
            <TechEarnestFilterSelect label="Project" value={projectFilter} onChange={setProjectFilter} options={projectOptions} placeholder="All projects" emptyLabel="All projects" searchPlaceholder="Search projects" />
            <TechEarnestFilterSelect label="Region" value={regionFilter} onChange={setRegionFilter} options={regionOptions} placeholder="All regions" emptyLabel="All regions" searchPlaceholder="Search regions" />
            <ModuleFilterDateRange label="Due" from={dueFrom} to={dueTo} onFromChange={setDueFrom} onToChange={setDueTo} />
            <ModuleFilterField label="Min balance" htmlFor="invMinBalanceFilter">
              <input
                id="invMinBalanceFilter"
                className="form-control form-control-sm"
                type="number"
                value={minBalance}
                onChange={(e) => setMinBalance(e.target.value)}
              />
            </ModuleFilterField>
            <ModuleFilterCheckbox id="invOverdue" label="Overdue only" checked={overdueOnly} onChange={setOverdueOnly} />
          </div>
        </>
      }
      activeFilterCount={activeFilterCount}
      onClearFilters={clearFilters}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {invoicesQuery.isLoading ? <LoadingState label="Loading invoices..." /> : null}
      {invoicesQuery.error ? <ErrorState title="Unable to load invoices" message="Try again." /> : null}

      {!invoicesQuery.isLoading && !invoicesQuery.error && !rows.length && !activeFilterCount
        ? bulkImport.renderEmptyState({ canCreate, createLabel: "Create Invoice", onCreate: openCreateInvoice })
        : null}

      {!invoicesQuery.isLoading && !invoicesQuery.error && (rows.length || activeFilterCount) ? (
        <ModuleListTable
          tableCode="invoice"
          defaultColumns={[
            { field: "invoiceNumber", label: "Number" },
            { field: "accountId", label: "Account" },
            { field: "status", label: "Status" },
            { field: "dueDate", label: "Due" },
            { field: "total", label: "Total" },
            { field: "balanceDue", label: "Balance" },
          ]}
          rows={rows}
          rowKey={(inv) => inv.id}
          selectedRowKey={selectedId}
          onRowClick={(inv) => {
            setSelectedId(inv.id);
            setActionError(null);
          }}
          renderCell={(inv, field) => {
            if (field === "invoiceNumber") return inv.invoiceNumber ?? "Draft";
            if (field === "accountId")
              return (
                <RecordLink module="account" id={inv.accountId}>
                  {accountName(inv.accountId)}
                </RecordLink>
              );
            if (field === "status") return <StatusBadge status={inv.status} />;
            if (field === "total" || field === "balanceDue") return `${inv.currencyCode} ${(inv as unknown as Record<string, unknown>)[field] ?? "—"}`;
            const value = (inv as unknown as Record<string, unknown>)[field];
            return value == null || value === "" ? "—" : String(value);
          }}
          nameFields={["invoiceNumber"]}
          emptyMessage="No invoices"
        />
      ) : null}
    </ModuleListShell>
      )}
      {showAddLine && selected ? (
        <div className="module-modal-backdrop" role="presentation" onClick={() => addLineMutation.isPending ? null : setShowAddLine(false)}>
          <section className="module-modal" role="dialog" aria-modal="true" aria-labelledby="add-invoice-line-title" onClick={(event) => event.stopPropagation()}>
            <header className="d-flex align-items-center justify-content-between gap-3 mb-3">
              <h2 id="add-invoice-line-title" className="h5 mb-0">Add invoice line</h2>
              <button type="button" className="btn-close" aria-label="Close" disabled={addLineMutation.isPending} onClick={() => setShowAddLine(false)} />
            </header>
            <div className="mb-3">
              <label className="form-label" htmlFor="invoice-line-description">Description</label>
              <input id="invoice-line-description" autoFocus className="form-control" maxLength={500} value={lineDescription} onChange={(event) => setLineDescription(event.target.value)} />
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label" htmlFor="invoice-line-quantity">Quantity</label>
                <input id="invoice-line-quantity" className="form-control" type="number" min="0.01" step="0.01" value={lineQuantity} onChange={(event) => setLineQuantity(event.target.value)} />
              </div>
              <div className="col-6">
                <label className="form-label" htmlFor="invoice-line-unit-price">Unit price ({selected.currencyCode})</label>
                <input id="invoice-line-unit-price" className="form-control" type="number" min="0" step="0.01" value={lineUnitPrice} onChange={(event) => setLineUnitPrice(event.target.value)} />
              </div>
            </div>
            <footer className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={addLineMutation.isPending} onClick={() => setShowAddLine(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!lineDescription.trim() || Number(lineQuantity) <= 0 || !lineUnitPrice || Number(lineUnitPrice) < 0 || addLineMutation.isPending}
                onClick={() => addLineMutation.mutate({ id: selected.id, description: lineDescription.trim(), quantity: Number(lineQuantity), unitPrice: Number(lineUnitPrice) })}
              >
                {addLineMutation.isPending ? "Adding…" : "Add line"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {bulkImport.dialog}
    </>
  );
}
