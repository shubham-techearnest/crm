import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormSection } from "@/components/FormKit";
import {
  enumPickerOptions,
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
import { listProjects } from "@/features/projects/projectApi";
import { listResources } from "@/features/resources/resourceApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import {
  approveExpense,
  createExpense,
  getExpense,
  listExpenses,
  queryExpenses,
  rejectExpense,
  submitExpense,
  type Expense,
} from "./expenseApi";
import { buildExpenseFilterConditions, needsExpenseQuery } from "./expenseFilterCatalog";

const EXPENSE_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"] as const;
const CATEGORIES = ["Travel", "Meals", "Lodging", "Supplies", "Software", "Other"] as const;

const categoryOptions = enumPickerOptions(CATEGORIES);

const schema = z.object({
  regionId: z.string().min(1, "Region is required"),
  resourceId: z.string().optional(),
  projectId: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  amount: z.string().min(1, "Amount is required"),
  expenseDate: z.string().min(1, "Date is required"),
  billable: z.boolean().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  regionId: "",
  resourceId: "",
  projectId: "",
  category: "Travel",
  description: "",
  amount: "",
  expenseDate: new Date().toISOString().slice(0, 10),
  billable: false,
  notes: "",
};

export function ExpensesPage() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission("EXPENSE_CREATE");
  const canApprove = useHasPermission("EXPENSE_APPROVE");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [billableFilter, setBillableFilter] = useState<"" | "true" | "false">("");
  const [expenseFrom, setExpenseFrom] = useState("");
  const [expenseTo, setExpenseTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const billableBool =
    billableFilter === "true" ? true : billableFilter === "false" ? false : ("" as const);
  const advanced = needsExpenseQuery({
    category: categoryFilter,
    billable: billableBool,
    regionId: regionFilter,
    expenseFrom,
    expenseTo,
  });

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter || undefined,
      category: categoryFilter || undefined,
      projectId: projectFilter || undefined,
      resourceId: resourceFilter || undefined,
      billable: billableBool === "" ? undefined : billableBool,
    }),
    [search, statusFilter, categoryFilter, projectFilter, resourceFilter, billableBool],
  );

  const queryBody = useMemo(() => {
    const conditions = buildExpenseFilterConditions({
      status: statusFilter || undefined,
      category: categoryFilter || undefined,
      projectId: projectFilter || undefined,
      resourceId: resourceFilter || undefined,
      regionId: regionFilter || undefined,
      billable: billableBool,
      expenseFrom: expenseFrom || undefined,
      expenseTo: expenseTo || undefined,
    });
    return {
      search: search || undefined,
      filter: conditions.length ? { op: "AND" as const, conditions } : undefined,
    };
  }, [
    search,
    statusFilter,
    categoryFilter,
    projectFilter,
    resourceFilter,
    regionFilter,
    billableBool,
    expenseFrom,
    expenseTo,
  ]);

  const expensesQuery = useQuery({
    queryKey: ["expenses", advanced ? "query" : "list", advanced ? queryBody : listParams],
    queryFn: () => (advanced ? queryExpenses(queryBody) : listExpenses(listParams)),
  });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => listProjects() });
  const resourcesQuery = useQuery({ queryKey: ["resources"], queryFn: () => listResources() });
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const detailQuery = useQuery({
    queryKey: ["expenses", selectedId],
    queryFn: () => getExpense(selectedId!),
    enabled: !!selectedId,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  const { photo, cancelCreate, afterCreateSuccess } = useZohoCreateFlow({
    defaults: DEFAULTS,
    reset,
    setShowForm,
    setFormError,
    setSelected: (entity) => setSelectedId(entity.id),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["expenses"] });
  };

  const createMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: async (expense) => {
      await invalidate();
      setFormError(null);
      await afterCreateSuccess(expense, "EXPENSE");
    },
    onError: () => setFormError("Could not create expense."),
  });

  const regionOptions = useMemo(
    () => optionsFromPairs((regionsQuery.data ?? []).map((r) => ({ value: r.id, label: r.name }))),
    [regionsQuery.data],
  );
  const resourceOptions = useMemo(
    () =>
      optionsFromPairs(
        (resourcesQuery.data ?? []).map((r) => ({
          value: r.id,
          label: r.employeeCode ?? r.designation ?? r.id.slice(0, 8),
        })),
      ),
    [resourcesQuery.data],
  );
  const projectOptions = useMemo(
    () => optionsFromPairs((projectsQuery.data ?? []).map((p) => ({ value: p.id, label: p.name }))),
    [projectsQuery.data],
  );

  const onCreateSubmit = (values: FormValues) => {
    createMutation.mutate({
      regionId: values.regionId,
      resourceId: values.resourceId || undefined,
      projectId: values.projectId || undefined,
      category: values.category,
      description: values.description || undefined,
      amount: Number(values.amount),
      expenseDate: values.expenseDate,
      billable: values.billable,
      notes: values.notes || undefined,
    });
  };

  const submitMutation = useMutation({
    mutationFn: (id: string) => submitExpense(id),
    onSuccess: invalidate,
    onError: () => setActionError("Could not submit expense."),
  });
  const approveMutation = useMutation({
    mutationFn: (id: string) => approveExpense(id),
    onSuccess: invalidate,
    onError: () => setActionError("Could not approve expense."),
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectExpense(id, { reason }),
    onSuccess: invalidate,
    onError: () => setActionError("Could not reject expense."),
  });

  const rows = expensesQuery.data ?? [];
  const selectedRow = rows.find((row) => row.id === selectedId) ?? null;
  const recordNav = useRecordNavigation(rows, selectedRow, (item) => {
    setSelectedId(item?.id ?? null);
    setActionError(null);
    setRejectReason("");
  });
  const selected: Expense | undefined = detailQuery.data;
  const resourceLabel = (id: string | null) => {
    if (!id) return "—";
    const r = resourcesQuery.data?.find((x) => x.id === id);
    return r?.employeeCode ?? r?.designation ?? id.slice(0, 8);
  };
  const projectName = (id: string | null) =>
    id ? (projectsQuery.data?.find((p) => p.id === id)?.name ?? id.slice(0, 8)) : "—";
  const activeFilterCount = [
    search,
    statusFilter,
    projectFilter,
    resourceFilter,
    regionFilter,
    categoryFilter,
    billableFilter,
    expenseFrom,
    expenseTo,
  ].filter(Boolean).length;

  return (
    <>
      {showForm && canCreate ? (
        <ZohoFormKitCreateView
          title="Create Expense"
          tableCode="expense"
          entityLabel="Expense"
          pending={isSubmitting || createMutation.isPending}
          isDirty={isDirty}
          formError={formError}
          onCancel={() => cancelCreate(isDirty)}
          onSave={() => void handleSubmit(onCreateSubmit)()}
          onSubmit={() => void handleSubmit(onCreateSubmit)()}
          photo={photo}
        >
          <FormSection title="Expense" description="Employee or project cost with category and billable flag">
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
            <div className="col-md-2">
              <label className="form-label required">Category</label>
              <ZohoFormSelect
                control={control}
                name="category"
                options={categoryOptions}
                searchPlaceholder="Search Categories"
                allowEmpty={false}
                invalid={!!errors.category}
              />
            </div>
            <div className="col-md-2">
              <FormField
                label="Expense date"
                type="date"
                required
                error={errors.expenseDate}
                {...register("expenseDate")}
              />
            </div>
            <div className="col-md-2">
              <FormField label="Amount" type="number" required error={errors.amount} {...register("amount")} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Employee</label>
              <ZohoFormSelect
                control={control}
                name="resourceId"
                options={resourceOptions}
                searchPlaceholder="Search Employees"
                lookupIcon="users"
                placeholder="Self / default"
              />
            </div>
            <div className="col-md-2">
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
            <div className="col-md-4">
              <FormField label="Description" {...register("description")} />
            </div>
            <div className="col-md-4">
              <FormField label="Notes" {...register("notes")} />
            </div>
            <div className="col-md-2 form-check mt-4">
              <input className="form-check-input" type="checkbox" id="expBillable" {...register("billable")} />
              <label className="form-check-label" htmlFor="expBillable">
                Billable
              </label>
            </div>
          </FormSection>
        </ZohoFormKitCreateView>
      ) : selectedId ? (
        detailQuery.isLoading ? (
          <LoadingState label="Loading expense…" />
        ) : selected ? (
          <RecordShell
            layout="page"
            title={`${selected.category} · ${selected.expenseDate}`}
            subtitle={`${selected.currencyCode} ${selected.amount}`}
            avatarLabel={`${selected.category} · ${selected.expenseDate}`}
            meta={selected.billable ? "Billable" : undefined}
            status={<StatusBadge status={selected.status} />}
            recordKey={selected.id}
            onBack={recordNav.goBack}
            onPrev={recordNav.goPrev}
            onNext={recordNav.goNext}
            hasPrev={recordNav.hasPrev}
            hasNext={recordNav.hasNext}
            relatedLinks={[...DEFAULT_RELATED_LINKS]}
            primaryAction={
              canCreate && (selected.status === "DRAFT" || selected.status === "REJECTED") ? (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={submitMutation.isPending}
                  onClick={() => submitMutation.mutate(selected.id)}
                >
                  Submit
                </button>
              ) : null
            }
            secondaryActions={
              canApprove && selected.status === "SUBMITTED" ? (
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(selected.id)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    disabled={rejectMutation.isPending || !rejectReason.trim()}
                    onClick={() => rejectMutation.mutate({ id: selected.id, reason: rejectReason.trim() })}
                  >
                    Reject
                  </button>
                </>
              ) : null
            }
            tabs={[
              {
                id: "overview",
                label: "Overview",
                content: (
                  <>
                    {actionError ? <div className="alert alert-danger py-2 small">{actionError}</div> : null}
                    <p className="small mb-1">Employee: {resourceLabel(selected.resourceId)}</p>
                    <p className="small mb-1">Project: {projectName(selected.projectId)}</p>
                    <p className="small mb-1">{selected.description ?? "No description"}</p>
                    <p className="small mb-3">{selected.notes ?? "No notes"}</p>
                    {selected.status === "REJECTED" && selected.rejectionReason ? (
                      <p className="small text-danger mb-3">Rejected: {selected.rejectionReason}</p>
                    ) : null}
                    {canApprove && selected.status === "SUBMITTED" ? (
                      <div className="mb-3">
                        <label className="form-label small">Rejection reason</label>
                        <input
                          className="form-control form-control-sm"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Required to reject"
                        />
                      </div>
                    ) : null}
                    {selected.approvalRequestId ? (
                      <p className="small text-muted mb-0">Approval request linked</p>
                    ) : null}
                  </>
                ),
              },
            ]}
          />
        ) : null
      ) : (
    <ModuleListShell
      title="Expenses"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Expenses</span>}
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
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              reset(DEFAULTS);
              setShowForm(true);
            }}
          >
            Create Expense
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Expenses by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Notes or description"
            />
          </div>
          <div className="module-filter-section">
            <h3>Status</h3>
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              {EXPENSE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="module-filter-section">
            <h3>Category</h3>
            <select
              className="form-select form-select-sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="module-filter-section">
            <h3>Project</h3>
            <select
              className="form-select form-select-sm"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="">All</option>
              {(projectsQuery.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="module-filter-section">
            <h3>Employee</h3>
            <select
              className="form-select form-select-sm"
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
            >
              <option value="">All</option>
              {(resourcesQuery.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.employeeCode ?? r.designation ?? r.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div className="module-filter-section">
            <h3>Region</h3>
            <select
              className="form-select form-select-sm"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
            >
              <option value="">All</option>
              {(regionsQuery.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="module-filter-section">
            <h3>Billable</h3>
            <select
              className="form-select form-select-sm"
              value={billableFilter}
              onChange={(e) => setBillableFilter(e.target.value as "" | "true" | "false")}
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="module-filter-section">
            <h3>Expense from</h3>
            <input
              className="form-control form-control-sm"
              type="date"
              value={expenseFrom}
              onChange={(e) => setExpenseFrom(e.target.value)}
            />
            <h3 className="mt-2">Expense to</h3>
            <input
              className="form-control form-control-sm"
              type="date"
              value={expenseTo}
              onChange={(e) => setExpenseTo(e.target.value)}
            />
          </div>
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {expensesQuery.isLoading ? <LoadingState label="Loading expenses..." /> : null}
      {expensesQuery.error ? <ErrorState title="Unable to load expenses" message="Try again." /> : null}

      {!expensesQuery.isLoading && !expensesQuery.error ? (
        <div className="module-list-table-wrap">
            <table className="table module-list-table align-middle">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Employee</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Billable</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={selectedId === row.id ? "table-active" : undefined}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setSelectedId(row.id);
                      setActionError(null);
                      setRejectReason("");
                    }}
                  >
                    <td className="lead-name">{row.expenseDate}</td>
                    <td>{row.category}</td>
                    <td>{resourceLabel(row.resourceId)}</td>
                    <td>{projectName(row.projectId)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      {row.currencyCode} {row.amount}
                    </td>
                    <td>{row.billable ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-5">
                      No expenses
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
