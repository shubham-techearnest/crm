import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormActions, FormSection, UnsavedGuard } from "@/components/FormKit";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { RecordShell } from "@/components/RecordShell";
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

const EXPENSE_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "REIMBURSED"] as const;
const EXPENSE_TYPES = ["EMPLOYEE", "PROJECT", "TRAVEL"] as const;
const CATEGORIES = ["Travel", "Meals", "Lodging", "Supplies", "Software", "Other"] as const;

const itemSchema = z.object({
  category: z.string().min(1, "Category required"),
  description: z.string().optional(),
  amount: z.string().min(1, "Amount required"),
  taxAmount: z.string().optional(),
});

const schema = z.object({
  regionId: z.string().min(1, "Region is required"),
  resourceId: z.string().optional(),
  projectId: z.string().optional(),
  expenseType: z.string().min(1, "Type is required"),
  incurredOn: z.string().min(1, "Date is required"),
  billable: z.boolean().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Add at least one line"),
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  regionId: "",
  resourceId: "",
  projectId: "",
  expenseType: "EMPLOYEE",
  incurredOn: new Date().toISOString().slice(0, 10),
  billable: false,
  notes: "",
  items: [{ category: "Travel", description: "", amount: "", taxAmount: "" }],
};

export function ExpensesPage() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission("EXPENSE_CREATE");
  const canApprove = useHasPermission("EXPENSE_APPROVE");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [billableFilter, setBillableFilter] = useState<"" | "true" | "false">("");
  const [incurredFrom, setIncurredFrom] = useState("");
  const [incurredTo, setIncurredTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const billableBool =
    billableFilter === "true" ? true : billableFilter === "false" ? false : ("" as const);
  const advanced = needsExpenseQuery({
    category: categoryFilter,
    billable: billableBool,
    regionId: regionFilter,
    incurredFrom,
    incurredTo,
  });

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter || undefined,
      expenseType: typeFilter || undefined,
      projectId: projectFilter || undefined,
      resourceId: resourceFilter || undefined,
    }),
    [search, statusFilter, typeFilter, projectFilter, resourceFilter],
  );

  const queryBody = useMemo(() => {
    const conditions = buildExpenseFilterConditions({
      status: statusFilter || undefined,
      expenseType: typeFilter || undefined,
      projectId: projectFilter || undefined,
      resourceId: resourceFilter || undefined,
      regionId: regionFilter || undefined,
      billable: billableBool,
      category: categoryFilter || undefined,
      incurredFrom: incurredFrom || undefined,
      incurredTo: incurredTo || undefined,
    });
    return {
      search: search || undefined,
      filter: conditions.length ? { op: "AND" as const, conditions } : undefined,
    };
  }, [
    search,
    statusFilter,
    typeFilter,
    projectFilter,
    resourceFilter,
    regionFilter,
    billableBool,
    categoryFilter,
    incurredFrom,
    incurredTo,
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
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["expenses"] });
  };

  const createMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: async (expense) => {
      await invalidate();
      setFormError(null);
      reset(DEFAULTS);
      setShowForm(false);
      setSelectedId(expense.id);
    },
    onError: () => setFormError("Could not create expense."),
  });

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
    mutationFn: (id: string) => rejectExpense(id),
    onSuccess: invalidate,
    onError: () => setActionError("Could not reject expense."),
  });

  const rows = expensesQuery.data ?? [];
  const selected: Expense | undefined = detailQuery.data;
  const resourceLabel = (id: string) => {
    const r = resourcesQuery.data?.find((x) => x.id === id);
    return r?.employeeCode ?? r?.designation ?? id.slice(0, 8);
  };
  const projectName = (id: string | null) =>
    id ? (projectsQuery.data?.find((p) => p.id === id)?.name ?? id.slice(0, 8)) : "—";
  const activeFilterCount = [
    search,
    statusFilter,
    typeFilter,
    projectFilter,
    resourceFilter,
    regionFilter,
    categoryFilter,
    billableFilter,
    incurredFrom,
    incurredTo,
  ].filter(Boolean).length;

  return (
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
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Create Expense"}
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
              placeholder="Notes or category"
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
            <h3>Type</h3>
            <select
              className="form-select form-select-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All</option>
              {EXPENSE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
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
            <h3>Incurred from</h3>
            <input
              className="form-control form-control-sm"
              type="date"
              value={incurredFrom}
              onChange={(e) => setIncurredFrom(e.target.value)}
            />
            <h3 className="mt-2">Incurred to</h3>
            <input
              className="form-control form-control-sm"
              type="date"
              value={incurredTo}
              onChange={(e) => setIncurredTo(e.target.value)}
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
              regionId: values.regionId,
              resourceId: values.resourceId || undefined,
              projectId: values.projectId || undefined,
              expenseType: values.expenseType,
              incurredOn: values.incurredOn,
              billable: values.billable,
              notes: values.notes || undefined,
              items: values.items.map((item) => ({
                category: item.category,
                description: item.description || undefined,
                amount: Number(item.amount),
                taxAmount: item.taxAmount ? Number(item.taxAmount) : undefined,
              })),
            }),
          )}
        >
          <UnsavedGuard when={isDirty && showForm} />
          {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
          <FormSection title="Expense" description="Employee/project cost with categories and billable flag">
            <div className="col-md-3">
              <label className="form-label required">Region</label>
              <select className="form-select" {...register("regionId")}>
                <option value="">Select</option>
                {(regionsQuery.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {errors.regionId ? <div className="invalid-feedback d-block">{errors.regionId.message}</div> : null}
            </div>
            <div className="col-md-2">
              <label className="form-label required">Type</label>
              <select className="form-select" {...register("expenseType")}>
                {EXPENSE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <FormField label="Incurred on" type="date" required error={errors.incurredOn} {...register("incurredOn")} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Employee</label>
              <select className="form-select" {...register("resourceId")}>
                <option value="">Self / default</option>
                {(resourcesQuery.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.employeeCode ?? r.designation ?? r.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Project</label>
              <select className="form-select" {...register("projectId")}>
                <option value="">Optional</option>
                {(projectsQuery.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-1 form-check mt-4">
              <input className="form-check-input" type="checkbox" id="expBillable" {...register("billable")} />
              <label className="form-check-label" htmlFor="expBillable">
                Billable
              </label>
            </div>
          </FormSection>
          <FormSection title="Line items" description="Category, amount; receipt upload via Documents in a later slice">
            {fields.map((field, index) => (
              <div key={field.id} className="row g-2 mb-2 align-items-end">
                <div className="col-md-2">
                  <label className="form-label">Category</label>
                  <select className="form-select" {...register(`items.${index}.category`)}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <FormField label="Description" {...register(`items.${index}.description`)} />
                </div>
                <div className="col-md-2">
                  <FormField
                    label="Amount"
                    type="number"
                    required
                    error={errors.items?.[index]?.amount}
                    {...register(`items.${index}.amount`)}
                  />
                </div>
                <div className="col-md-2">
                  <FormField label="Tax" type="number" {...register(`items.${index}.taxAmount`)} />
                </div>
                <div className="col-md-2">
                  {fields.length > 1 ? (
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(index)}>
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {errors.items?.root ? (
              <div className="invalid-feedback d-block">{errors.items.root.message}</div>
            ) : null}
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => append({ category: "Other", description: "", amount: "", taxAmount: "" })}
            >
              Add line
            </button>
          </FormSection>
          <FormActions
            submitLabel="Save draft"
            submitting={isSubmitting || createMutation.isPending}
            onCancel={() => {
              setShowForm(false);
              reset(DEFAULTS);
            }}
          />
        </form>
      ) : null}

      {expensesQuery.isLoading ? <LoadingState label="Loading expenses..." /> : null}
      {expensesQuery.error ? <ErrorState title="Unable to load expenses" message="Try again." /> : null}

      {!expensesQuery.isLoading && !expensesQuery.error ? (
        <div className="d-flex" style={{ flex: 1, minHeight: 0 }}>
          <div className="module-list-table-wrap" style={{ flex: 1 }}>
            <table className="table module-list-table align-middle">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Total</th>
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
                    }}
                  >
                    <td className="lead-name">{row.incurredOn}</td>
                    <td>{resourceLabel(row.resourceId)}</td>
                    <td>{row.expenseType}</td>
                    <td>{projectName(row.projectId)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      {row.currencyCode} {row.total}
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

          {selectedId ? (
            <div style={{ width: 380, overflow: "auto" }}>
              {detailQuery.isLoading ? <LoadingState label="Loading…" /> : null}
              {selected ? (
                <RecordShell
                  title={`${selected.expenseType} · ${selected.incurredOn}`}
                  subtitle={`${selected.currencyCode} ${selected.total}${selected.billable ? " · Billable" : ""}`}
                  badges={<StatusBadge status={selected.status} />}
                  onClose={() => setSelectedId(null)}
                  actions={
                    <div className="d-flex flex-wrap gap-1">
                      {canCreate && selected.status === "DRAFT" ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={submitMutation.isPending}
                          onClick={() => submitMutation.mutate(selected.id)}
                        >
                          Submit
                        </button>
                      ) : null}
                      {canApprove && selected.status === "SUBMITTED" ? (
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
                            disabled={rejectMutation.isPending}
                            onClick={() => {
                              if (window.confirm("Reject this expense?")) {
                                rejectMutation.mutate(selected.id);
                              }
                            }}
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                    </div>
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
                          <p className="small mb-3">{selected.notes ?? "No notes"}</p>
                          <h3 className="h6">Lines</h3>
                          <ul className="small mb-0">
                            {(selected.items ?? []).map((item) => (
                              <li key={item.id}>
                                {item.category}: {item.amount}
                                {item.taxAmount ? ` (+tax ${item.taxAmount})` : ""}
                                {item.description ? ` — ${item.description}` : ""}
                                {item.documentId ? " (receipt)" : ""}
                              </li>
                            ))}
                            {!selected.items?.length ? <li className="text-muted">No lines</li> : null}
                          </ul>
                        </>
                      ),
                    },
                  ]}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </ModuleListShell>
  );
}
