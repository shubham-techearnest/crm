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
import { ModuleFilterDateRange, ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { deleteRecord, postRecordAction, statusIn } from "@/components/BulkActions/bulkActions";
import { RecordShell, DEFAULT_RELATED_LINKS } from "@/components/RecordShell";
import { useRecordNavigation } from "@/components/TechEarnestRecord";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listRegions } from "@/features/admin/adminApi";
import { listProjects } from "@/features/projects/projectApi";
import { listResources } from "@/features/resources/resourceApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { useUrlRecordId } from "@/hooks/useUrlRecord";
import { RecordLink } from "@/components/RecordLink";
import {
  approveExpense,
  createExpense,
  getExpense,
  listExpenses,
  queryExpenses,
  rejectExpense,
  submitExpense,
  updateExpense,
  type Expense,
} from "./expenseApi";
import { buildExpenseFilterConditions, needsExpenseQuery } from "./expenseFilterCatalog";

const EXPENSE_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"] as const;
const CATEGORIES = ["Travel", "Meals", "Lodging", "Supplies", "Software", "Other"] as const;

const categoryOptions = enumPickerOptions(CATEGORIES);
const expenseStatusFilterOptions = enumPickerOptions(EXPENSE_STATUSES);
const billableFilterOptions = optionsFromPairs([{ value: "true", label: "Yes" }, { value: "false", label: "No" }]);

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
  const canUpdate = useHasPermission("EXPENSE_UPDATE");
  const canApprove = useHasPermission("EXPENSE_APPROVE");
  const canDelete = useHasPermission("EXPENSE_DELETE");
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
  const [selectedId, setSelectedId] = useUrlRecordId();
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

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

  const { setSaveAndNew, cancelCreate, afterCreateSuccess } = useTechEarnestCreateFlow({
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

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: FormValues }) =>
      updateExpense(id, {
        resourceId: values.resourceId || null,
        projectId: values.projectId || null,
        category: values.category,
        description: values.description || null,
        amount: Number(values.amount),
        expenseDate: values.expenseDate,
        billable: values.billable,
        notes: values.notes || null,
      }),
    onSuccess: async () => {
      await invalidate();
      setFormError(null);
      setEditingExpenseId(null);
      setShowForm(false);
      reset(DEFAULTS);
      await detailQuery.refetch();
    },
    onError: () => setFormError("Could not update expense. Only draft or rejected expenses can be changed."),
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

  const onUpdateSubmit = (values: FormValues) => {
    if (!editingExpenseId) return;
    updateMutation.mutate({ id: editingExpenseId, values });
  };

  function openExpenseEdit(expense: Expense) {
    setEditingExpenseId(expense.id);
    setFormError(null);
    reset({
      regionId: expense.regionId,
      resourceId: expense.resourceId ?? "",
      projectId: expense.projectId ?? "",
      category: expense.category,
      description: expense.description ?? "",
      amount: String(expense.amount),
      expenseDate: expense.expenseDate,
      billable: expense.billable,
      notes: expense.notes ?? "",
    });
    setShowForm(true);
  }

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
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setProjectFilter("");
    setResourceFilter("");
    setRegionFilter("");
    setCategoryFilter("");
    setBillableFilter("");
    setExpenseFrom("");
    setExpenseTo("");
  };

  return (
    <>
      {showForm && (editingExpenseId ? canUpdate : canCreate) ? (
        <TechEarnestFormKitCreateView
          title={editingExpenseId ? "Edit Expense" : "Create Expense"}
          tableCode="expense"
          recordId={editingExpenseId}
          entityLabel="Expense"
          pending={isSubmitting || createMutation.isPending || updateMutation.isPending}
          isDirty={isDirty}
          formError={formError}
          onCancel={() => {
            if (editingExpenseId) {
              setEditingExpenseId(null);
              setShowForm(false);
              reset(DEFAULTS);
            } else cancelCreate(isDirty);
          }}
          onSave={() => void handleSubmit(editingExpenseId ? onUpdateSubmit : onCreateSubmit)()}
          onSaveAndNew={!editingExpenseId ? () => {
            setSaveAndNew(true);
            void handleSubmit(onCreateSubmit)();
          } : undefined}
          onSubmit={() => void handleSubmit(editingExpenseId ? onUpdateSubmit : onCreateSubmit)()}
          showRecordImage={false}
        >
          <TechEarnestCreateSection title="Expense Information">
            <TechEarnestCreateGrid>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Region" required={!editingExpenseId} error={errors.regionId?.message}>
                  <TechEarnestFormSelect
                    control={control}
                    name="regionId"
                    options={regionOptions}
                    searchPlaceholder="Search Regions"
                    allowEmpty={false}
                    placeholder="Select region"
                    invalid={!!errors.regionId}
                    disabled={!!editingExpenseId}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Employee" error={errors.resourceId?.message}>
                  <TechEarnestFormSelect
                    control={control}
                    name="resourceId"
                    options={resourceOptions}
                    searchPlaceholder="Search Employees"
                    lookupIcon="users"
                    placeholder="Self / default"
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Project" error={errors.projectId?.message}>
                  <TechEarnestFormSelect
                    control={control}
                    name="projectId"
                    options={projectOptions}
                    searchPlaceholder="Search Projects"
                    lookupIcon="apps"
                    placeholder="Optional"
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Category" required error={errors.category?.message}>
                  <TechEarnestFormSelect
                    control={control}
                    name="category"
                    options={categoryOptions}
                    searchPlaceholder="Search Categories"
                    allowEmpty={false}
                    invalid={!!errors.category}
                  />
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Expense Date" required error={errors.expenseDate?.message}>
                  <input
                    type="date"
                    className={`form-control form-control-sm${errors.expenseDate ? " is-invalid" : ""}`}
                    {...register("expenseDate")}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Amount" required error={errors.amount?.message}>
                  <input
                    type="number"
                    className={`form-control form-control-sm${errors.amount ? " is-invalid" : ""}`}
                    {...register("amount")}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Billable">
                  <div className="form-check techearnest-checkbox-field">
                    <input type="checkbox" className="form-check-input" id="expBillable" {...register("billable")} />
                  </div>
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
            </TechEarnestCreateGrid>
          </TechEarnestCreateSection>
          <TechEarnestCreateSection title="Description Information">
            <TechEarnestCreateField label="Description" wide error={errors.description?.message}>
              <textarea rows={4} className="form-control form-control-sm" {...register("description")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Notes" wide error={errors.notes?.message}>
              <textarea rows={4} className="form-control form-control-sm" {...register("notes")} />
            </TechEarnestCreateField>
          </TechEarnestCreateSection>
        </TechEarnestFormKitCreateView>
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
            customFieldsTable="expense"
            onBack={recordNav.goBack}
            onPrev={recordNav.goPrev}
            onNext={recordNav.goNext}
            hasPrev={recordNav.hasPrev}
            hasNext={recordNav.hasNext}
            relatedLinks={[...DEFAULT_RELATED_LINKS]}
            primaryAction={
              <>
                {canUpdate && (selected.status === "DRAFT" || selected.status === "REJECTED") ? (
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => openExpenseEdit(selected)}>
                    Edit
                  </button>
                ) : null}
                {canCreate && (selected.status === "DRAFT" || selected.status === "REJECTED") ? (
                  <button type="button" className="btn btn-sm btn-primary" disabled={submitMutation.isPending} onClick={() => submitMutation.mutate(selected.id)}>
                    Submit
                  </button>
                ) : null}
              </>
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
                    <p className="small mb-1">
                      Employee:{" "}
                      <RecordLink module="resource" id={selected.resourceId}>
                        {resourceLabel(selected.resourceId)}
                      </RecordLink>
                    </p>
                    <p className="small mb-1">
                      Project:{" "}
                      <RecordLink module="project" id={selected.projectId}>
                        {projectName(selected.projectId)}
                      </RecordLink>
                    </p>
                    {selected.purchaseOrderId ? (
                      <p className="small mb-1">
                        Purchase order:{" "}
                        <RecordLink module="purchaseOrder" id={selected.purchaseOrderId}>
                          Open purchase order
                        </RecordLink>
                      </p>
                    ) : null}
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
            <h3>Filter by fields</h3>
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={expenseStatusFilterOptions} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search expense statuses" />
            <TechEarnestFilterSelect label="Category" value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} placeholder="All categories" emptyLabel="All categories" searchPlaceholder="Search categories" />
            <TechEarnestFilterSelect label="Project" value={projectFilter} onChange={setProjectFilter} options={projectOptions} placeholder="All projects" emptyLabel="All projects" searchPlaceholder="Search projects" />
            <TechEarnestFilterSelect label="Employee" value={resourceFilter} onChange={setResourceFilter} options={resourceOptions} placeholder="All employees" emptyLabel="All employees" searchPlaceholder="Search employees" />
            <TechEarnestFilterSelect label="Region" value={regionFilter} onChange={setRegionFilter} options={regionOptions} placeholder="All regions" emptyLabel="All regions" searchPlaceholder="Search regions" />
            <TechEarnestFilterSelect label="Billable" value={billableFilter} onChange={(value) => setBillableFilter(value as "" | "true" | "false")} options={billableFilterOptions} placeholder="All" emptyLabel="All" searchPlaceholder="Search options" />
            <ModuleFilterDateRange
              label="Expense date"
              from={expenseFrom}
              to={expenseTo}
              onFromChange={setExpenseFrom}
              onToChange={setExpenseTo}
            />
          </div>
        </>
      }
      activeFilterCount={activeFilterCount}
      onClearFilters={clearFilters}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {expensesQuery.isLoading ? <LoadingState label="Loading expenses..." /> : null}
      {expensesQuery.error ? <ErrorState title="Unable to load expenses" message="Try again." /> : null}

      {!expensesQuery.isLoading && !expensesQuery.error ? (
        <ModuleListTable
          tableCode="expense"
          defaultColumns={[
            { field: "expenseDate", label: "Date" },
            { field: "category", label: "Category" },
            { field: "resourceId", label: "Employee" },
            { field: "projectId", label: "Project" },
            { field: "status", label: "Status" },
            { field: "amount", label: "Amount" },
            { field: "billable", label: "Billable" },
          ]}
          rows={rows}
          rowKey={(expense) => expense.id}
          bulk={{
            noun: "expenses",
            exportFileName: "expenses",
            rowLabel: (expense) => expense.description || expense.category,
            onComplete: () => {
              void queryClient.invalidateQueries({ queryKey: ["expenses"] });
              void queryClient.invalidateQueries({ queryKey: ["approvals"] });
            },
            actions: [
              {
                id: "submit",
                label: "Submit",
                visible: canCreate,
                doneLabel: "submitted",
                applies: statusIn("DRAFT", "REJECTED"),
                run: (expense) => postRecordAction(`/expenses/${expense.id}/submit`),
              },
              {
                id: "approve",
                label: "Approve",
                tone: "success",
                visible: canApprove,
                doneLabel: "approved",
                applies: statusIn("SUBMITTED"),
                run: (expense) => postRecordAction(`/expenses/${expense.id}/approve`),
              },
              {
                id: "reject",
                label: "Reject",
                tone: "danger",
                visible: canApprove,
                doneLabel: "rejected",
                applies: statusIn("SUBMITTED"),
                input: { kind: "text", label: "Rejection reason", multiline: true },
                run: (expense, reason) => postRecordAction(`/expenses/${expense.id}/reject`, { reason }),
              },
              {
                id: "delete",
                label: "Delete",
                tone: "danger",
                visible: canDelete,
                doneLabel: "deleted",
                applies: statusIn("DRAFT", "REJECTED"),
                confirm: "Only draft or rejected expenses can be deleted.",
                run: (expense) => deleteRecord(`/expenses/${expense.id}`),
              },
            ],
          }}
          selectedRowKey={selectedId}
          onRowClick={(expense) => {
            setSelectedId(expense.id);
            setActionError(null);
            setRejectReason("");
          }}
          renderCell={(expense, field) => {
            if (field === "resourceId")
              return (
                <RecordLink module="resource" id={expense.resourceId}>
                  {resourceLabel(expense.resourceId)}
                </RecordLink>
              );
            if (field === "projectId")
              return (
                <RecordLink module="project" id={expense.projectId}>
                  {projectName(expense.projectId)}
                </RecordLink>
              );
            if (field === "status") return <StatusBadge status={expense.status} />;
            if (field === "amount") return `${expense.currencyCode} ${expense.amount}`;
            if (field === "billable") return expense.billable ? "Yes" : "No";
            const value = (expense as unknown as Record<string, unknown>)[field];
            return value == null || value === "" ? "—" : String(value);
          }}
          nameFields={["expenseDate"]}
          emptyMessage="No expenses"
        />
      ) : null}
    </ModuleListShell>
      )}
    </>
  );
}
