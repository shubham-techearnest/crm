import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  enumPickerOptions,
  optionsFromPairs,
  TechEarnestCreateColumn,
  TechEarnestCreateField,
  TechEarnestCreateGrid,
  TechEarnestCreateSection,
  TechEarnestFormKitCreateView,
  TechEarnestFormSelect,
  TechEarnestFormUserSelect,
  TechEarnestPicker,
  TechEarnestFilterSelect,
  useTechEarnestCreateFlow,
} from "@/components/TechEarnestCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { RecordShell, DEFAULT_RELATED_LINKS } from "@/components/RecordShell";
import { useRecordNavigation } from "@/components/TechEarnestRecord";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listRegions, listUsers } from "@/features/admin/adminApi";
import { listProjects } from "@/features/projects/projectApi";
import { listTaxRates } from "@/features/finance/taxApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { useBulkImport } from "@/features/import/useBulkImport";
import { getVendor, listVendors } from "./vendorsApi";
import {
  addPurchaseOrderItem,
  approvePurchaseOrder,
  closePurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrder,
  queryPurchaseOrders,
  rejectPurchaseOrder,
  sendPurchaseOrder,
  submitPurchaseOrder,
  updatePurchaseOrder,
  type PurchaseOrder,
} from "./purchaseOrdersApi";

const PO_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "SENT",
  "PARTIAL_RECEIVED",
  "CLOSED",
  "CANCELLED",
] as const;
const poStatusFilterOptions = enumPickerOptions(PO_STATUSES);

const lineSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.string().min(1, "Qty required"),
  unitPrice: z.string().min(1, "Price required"),
  taxRateId: z.string().optional(),
});

const schema = z.object({
  regionId: z.string().min(1, "Region is required"),
  vendorId: z.string().min(1, "Vendor is required"),
  projectId: z.string().optional(),
  requesterId: z.string().optional(),
  poNumber: z.string().max(64).optional(),
  currencyCode: z
    .string()
    .trim()
    .refine((value) => !value || /^[A-Za-z]{3}$/.test(value), "Use a 3-letter currency code, e.g. INR")
    .optional(),
  neededBy: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(lineSchema).min(1, "Add at least one line"),
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  regionId: "",
  vendorId: "",
  projectId: "",
  requesterId: "",
  poNumber: "",
  currencyCode: "",
  neededBy: "",
  notes: "",
  items: [{ description: "", quantity: "1", unitPrice: "", taxRateId: "" }],
};

export function PurchaseOrdersPage() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission("PO_CREATE");
  const canApprove = useHasPermission("PO_APPROVE");
  const canUpdate = useHasPermission("PO_UPDATE");
  const canViewVendors = useHasPermission("VENDOR_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addDesc, setAddDesc] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addPrice, setAddPrice] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [editProjectId, setEditProjectId] = useState("");
  const [editNeededBy, setEditNeededBy] = useState("");
  const [editCurrencyCode, setEditCurrencyCode] = useState("");
  const [editPoNumber, setEditPoNumber] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter || undefined,
      vendorId: vendorFilter || undefined,
      projectId: projectFilter || undefined,
    }),
    [search, statusFilter, vendorFilter, projectFilter],
  );

  const posQuery = useQuery({
    queryKey: ["purchase-orders", listParams],
    queryFn: () => queryPurchaseOrders(listParams),
  });
  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: () => listVendors() });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => listProjects() });
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: showForm && canCreate,
    retry: false,
  });
  const taxQuery = useQuery({
    queryKey: ["tax-rates", { activeOnly: true }],
    queryFn: () => listTaxRates({ activeOnly: true }),
  });
  const detailQuery = useQuery({
    queryKey: ["purchase-orders", selectedId],
    queryFn: () => getPurchaseOrder(selectedId!),
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

  const { photo, cancelCreate, afterCreateSuccess } = useTechEarnestCreateFlow({
    defaults: DEFAULTS,
    reset,
    setShowForm,
    setFormError,
    setSelected: (entity) => setSelectedId(entity.id),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
  };
  const bulkImport = useBulkImport("purchase-orders", invalidate);

  function openCreatePurchaseOrder() {
    reset(DEFAULTS);
    setShowForm(true);
  }

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      let po = await createPurchaseOrder({
        regionId: values.regionId,
        vendorId: values.vendorId,
        projectId: values.projectId || undefined,
        requesterId: values.requesterId || undefined,
        poNumber: values.poNumber?.trim() || undefined,
        currencyCode: values.currencyCode ? values.currencyCode.toUpperCase() : undefined,
        neededBy: values.neededBy || undefined,
        notes: values.notes || undefined,
      });
      for (const line of values.items) {
        po = await addPurchaseOrderItem(po.id, {
          description: line.description.trim(),
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          taxRateId: line.taxRateId || undefined,
        });
      }
      return po;
    },
    onSuccess: async (po) => {
      await invalidate();
      setFormError(null);
      await afterCreateSuccess(po, "PURCHASE_ORDER");
    },
    onError: async () => {
      await invalidate();
      setFormError("Could not create the purchase order, or some line items were not saved. Check the draft in the list.");
    },
  });

  const onCreateSubmit = (values: FormValues) => {
    createMutation.mutate(values);
  };

  const addLineMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { description: string; quantity: number; unitPrice: number };
    }) => addPurchaseOrderItem(id, body),
    onSuccess: async () => {
      setAddDesc("");
      setAddQty("1");
      setAddPrice("");
      await invalidate();
    },
    onError: () => setActionError("Could not add line item."),
  });

  const submitMutation = useMutation({
    mutationFn: submitPurchaseOrder,
    onSuccess: invalidate,
    onError: () => setActionError("Could not submit PO."),
  });
  const approveMutation = useMutation({
    mutationFn: approvePurchaseOrder,
    onSuccess: invalidate,
    onError: () => setActionError("Could not approve PO."),
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectPurchaseOrder(id, { reason }),
    onSuccess: invalidate,
    onError: () => setActionError("Could not reject PO."),
  });
  const sendMutation = useMutation({
    mutationFn: sendPurchaseOrder,
    onSuccess: invalidate,
    onError: () => setActionError("Could not send PO."),
  });
  const closeMutation = useMutation({
    mutationFn: closePurchaseOrder,
    onSuccess: invalidate,
    onError: () => setActionError("Could not close PO."),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updatePurchaseOrder>[1] }) => updatePurchaseOrder(id, body),
    onSuccess: async () => {
      setShowEditDetails(false);
      setActionError(null);
      await invalidate();
    },
    onError: () => setActionError("Could not update purchase order. Only draft purchase orders can be edited."),
  });

  const rows = posQuery.data ?? [];
  const selectedRow = rows.find((row) => row.id === selectedId) ?? null;
  const recordNav = useRecordNavigation(rows, selectedRow, (item) => {
    setSelectedId(item?.id ?? null);
    setActionError(null);
    setRejectReason("");
  });
  const selected: PurchaseOrder | undefined = detailQuery.data;
  const selectedVendorQuery = useQuery({
    queryKey: ["vendors", selected?.vendorId, "detail"],
    queryFn: () => getVendor(selected!.vendorId),
    enabled: !!selected && canViewVendors && !vendorsQuery.isLoading && !vendorsQuery.data?.some((vendor) => vendor.id === selected.vendorId),
  });
  const vendorName = (id: string) =>
    vendorsQuery.data?.find((vendor) => vendor.id === id)?.name
      ?? (selectedVendorQuery.data?.id === id ? selectedVendorQuery.data.name : null)
      ?? id.slice(0, 8);
  const projectName = (id: string | null) =>
    id ? (projectsQuery.data?.find((p) => p.id === id)?.name ?? id.slice(0, 8)) : "—";
  const activeFilterCount = [search, statusFilter, vendorFilter, projectFilter].filter(Boolean).length;

  const regionOptions = useMemo(
    () => optionsFromPairs((regionsQuery.data ?? []).map((r) => ({ value: r.id, label: r.name }))),
    [regionsQuery.data],
  );
  const vendorOptions = useMemo(
    () => optionsFromPairs((vendorsQuery.data ?? []).map((v) => ({ value: v.id, label: v.name }))),
    [vendorsQuery.data],
  );
  const projectOptions = useMemo(
    () => optionsFromPairs((projectsQuery.data ?? []).map((p) => ({ value: p.id, label: p.name }))),
    [projectsQuery.data],
  );
  const taxRateOptions = useMemo(
    () =>
      optionsFromPairs(
        (taxQuery.data ?? []).map((t) => ({
          value: t.id,
          label: `${t.code} (${t.ratePercent}%)`,
        })),
      ),
    [taxQuery.data],
  );

  return (
    <>
      {showForm && canCreate ? (
        <TechEarnestFormKitCreateView
          title="Create Purchase Order"
          tableCode="purchase_order"
          entityLabel="Purchase Order"
          pending={isSubmitting || createMutation.isPending}
          isDirty={isDirty}
          formError={formError}
          onCancel={() => cancelCreate(isDirty)}
          onSave={() => void handleSubmit(onCreateSubmit)()}
          onSubmit={() => void handleSubmit(onCreateSubmit)()}
          photo={photo}
        >
          <TechEarnestCreateSection title="Purchase Order Information">
            <TechEarnestCreateGrid>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Vendor Name" required error={errors.vendorId?.message}>
                  <TechEarnestFormSelect
                    control={control}
                    name="vendorId"
                    options={vendorOptions}
                    searchPlaceholder="Search Vendors"
                    lookupIcon="building"
                    allowEmpty={false}
                    placeholder="Select vendor"
                    invalid={!!errors.vendorId}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="PO Number" error={errors.poNumber?.message}>
                  <input
                    type="text"
                    maxLength={64}
                    placeholder="Generated automatically"
                    className="form-control form-control-sm"
                    {...register("poNumber")}
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
                <TechEarnestCreateField label="Requester">
                  <TechEarnestFormUserSelect
                    control={control}
                    name="requesterId"
                    users={usersQuery.data ?? []}
                    searchPlaceholder="Search Users"
                    placeholder={usersQuery.isError ? "Users are not available" : "You (default)"}
                  />
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
              <TechEarnestCreateColumn>
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
                <TechEarnestCreateField label="Needed By" error={errors.neededBy?.message}>
                  <input type="date" className="form-control form-control-sm" {...register("neededBy")} />
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
          <TechEarnestCreateSection title="Line Items">
            <div className="table-responsive">
              <table className="table table-sm align-top techearnest-create-lines">
                <thead>
                  <tr>
                    <th className="required">Description</th>
                    <th style={{ width: "7rem" }} className="required">Quantity</th>
                    <th style={{ width: "9rem" }} className="required">Unit price</th>
                    <th style={{ width: "12rem" }}>Tax rate</th>
                    <th style={{ width: "3rem" }} aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => (
                    <tr key={field.id}>
                      <td>
                        <input
                          type="text"
                          maxLength={500}
                          aria-label={`Line ${index + 1} description`}
                          className={`form-control form-control-sm${errors.items?.[index]?.description ? " is-invalid" : ""}`}
                          {...register(`items.${index}.description`)}
                        />
                        {errors.items?.[index]?.description ? (
                          <div className="invalid-feedback d-block">{errors.items[index]?.description?.message}</div>
                        ) : null}
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0.01}
                          step="0.01"
                          aria-label={`Line ${index + 1} quantity`}
                          className={`form-control form-control-sm${errors.items?.[index]?.quantity ? " is-invalid" : ""}`}
                          {...register(`items.${index}.quantity`)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          aria-label={`Line ${index + 1} unit price`}
                          className={`form-control form-control-sm${errors.items?.[index]?.unitPrice ? " is-invalid" : ""}`}
                          {...register(`items.${index}.unitPrice`)}
                        />
                      </td>
                      <td>
                        <TechEarnestFormSelect
                          control={control}
                          name={`items.${index}.taxRateId`}
                          options={taxRateOptions}
                          searchPlaceholder="Search Tax Rates"
                          placeholder="None"
                        />
                      </td>
                      <td className="text-end">
                        {fields.length > 1 ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-light"
                            aria-label={`Remove line ${index + 1}`}
                            title="Remove line"
                            onClick={() => remove(index)}
                          >
                            ×
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {errors.items?.root ? <div className="invalid-feedback d-block">{errors.items.root.message}</div> : null}
            <button
              type="button"
              className="btn btn-sm btn-light techearnest-create-btn"
              onClick={() => append({ description: "", quantity: "1", unitPrice: "", taxRateId: "" })}
            >
              + Add line
            </button>
          </TechEarnestCreateSection>
          <TechEarnestCreateSection title="Description Information">
            <TechEarnestCreateField label="Notes" wide error={errors.notes?.message}>
              <textarea rows={4} className="form-control form-control-sm" {...register("notes")} />
            </TechEarnestCreateField>
          </TechEarnestCreateSection>
        </TechEarnestFormKitCreateView>
      ) : selectedId ? (
        detailQuery.isLoading ? (
          <LoadingState label="Loading purchase order…" />
        ) : selected ? (
        <RecordShell
            title={selected.poNumber ?? "Draft PO"}
            subtitle={`${selected.currencyCode} ${selected.total}`}
            meta={vendorName(selected.vendorId)}
            status={<StatusBadge status={selected.status} />}
            recordKey={selected.id}
            layout="page"
            avatarLabel={selected.poNumber ?? "Draft PO"}
            onBack={recordNav.goBack}
            onPrev={recordNav.goPrev}
            onNext={recordNav.goNext}
            hasPrev={recordNav.hasPrev}
            hasNext={recordNav.hasNext}
            relatedLinks={[...DEFAULT_RELATED_LINKS]}
            primaryAction={
              <>
                {canUpdate && selected.status === "DRAFT" ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      setEditProjectId(selected.projectId ?? "");
                      setEditNeededBy(selected.neededBy ?? "");
                      setEditCurrencyCode(selected.currencyCode);
                      setEditPoNumber(selected.poNumber ?? "");
                      setEditNotes(selected.notes ?? "");
                      setActionError(null);
                      setShowEditDetails(true);
                    }}
                  >
                    Edit details
                  </button>
                ) : null}
                {canCreate && (selected.status === "DRAFT" || selected.status === "REJECTED") ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={submitMutation.isPending}
                    onClick={() => submitMutation.mutate(selected.id)}
                  >
                    Submit
                  </button>
                ) : null}
                {canApprove && selected.status === "PENDING_APPROVAL" ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(selected.id)}
                  >
                    Approve
                  </button>
                ) : null}
                {canUpdate && selected.status === "APPROVED" ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    disabled={sendMutation.isPending}
                    onClick={() => sendMutation.mutate(selected.id)}
                  >
                    Send
                  </button>
                ) : null}
              </>
            }
            secondaryActions={
              <>
                {canApprove && selected.status === "PENDING_APPROVAL" ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    disabled={rejectMutation.isPending || !rejectReason.trim()}
                    onClick={() => rejectMutation.mutate({ id: selected.id, reason: rejectReason.trim() })}
                  >
                    Reject
                  </button>
                ) : null}
                {canUpdate && (selected.status === "SENT" || selected.status === "APPROVED") ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={closeMutation.isPending}
                    onClick={() => closeMutation.mutate(selected.id)}
                  >
                    Close
                  </button>
                ) : null}
              </>
            }
            tabs={[
              {
                id: "overview",
                label: "Overview",
                content: (
                  <>
                    {actionError ? <div className="alert alert-danger py-2 small">{actionError}</div> : null}
                    {canApprove && selected.status === "PENDING_APPROVAL" ? (
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
                    <p className="small mb-1">Vendor: {vendorName(selected.vendorId)}</p>
                    <p className="small mb-1">Project: {projectName(selected.projectId)}</p>
                    <p className="small mb-1">Needed: {selected.neededBy ?? "—"}</p>
                    <p className="small mb-3">
                      Subtotal {selected.subtotal} · Tax {selected.taxTotal}
                    </p>
                    <h3 className="h6">Lines</h3>
                    <ul className="small mb-3">
                      {(selected.items ?? []).map((line) => (
                        <li key={line.id}>
                          {line.description} — {line.quantity} × {line.unitPrice} = {line.amount}
                        </li>
                      ))}
                      {!selected.items?.length ? <li className="text-muted">No lines</li> : null}
                    </ul>
                    {canCreate && (selected.status === "DRAFT" || selected.status === "REJECTED") ? (
                      <>
                        <h3 className="h6">Add line</h3>
                        <div className="mb-2">
                          <input
                            className="form-control form-control-sm mb-1"
                            placeholder="Description"
                            value={addDesc}
                            onChange={(e) => setAddDesc(e.target.value)}
                          />
                          <div className="input-group input-group-sm">
                            <input
                              className="form-control"
                              type="number"
                              placeholder="Qty"
                              value={addQty}
                              onChange={(e) => setAddQty(e.target.value)}
                            />
                            <input
                              className="form-control"
                              type="number"
                              placeholder="Price"
                              value={addPrice}
                              onChange={(e) => setAddPrice(e.target.value)}
                            />
                            <button
                              type="button"
                              className="btn btn-outline-primary"
                              disabled={!addDesc || !addPrice || addLineMutation.isPending}
                              onClick={() =>
                                addLineMutation.mutate({
                                  id: selected.id,
                                  body: {
                                    description: addDesc,
                                    quantity: Number(addQty) || 1,
                                    unitPrice: Number(addPrice),
                                  },
                                })
                              }
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </>
                ),
              },
            ]}
                />

        ) : null
      ) : (
    <ModuleListShell
      title="Purchase Orders"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All POs</span>}
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
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreatePurchaseOrder}>
            Create PO
          </button>
        ) : null
      }
      createMenuItems={bulkImport.menuItems}
      moreMenuItems={bulkImport.menuItems}
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Purchase Orders by</p>
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
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={poStatusFilterOptions} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search purchase order statuses" />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Vendor" value={vendorFilter} onChange={setVendorFilter} options={vendorOptions} placeholder="All vendors" emptyLabel="All vendors" searchPlaceholder="Search vendors" />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Project" value={projectFilter} onChange={setProjectFilter} options={projectOptions} placeholder="All projects" emptyLabel="All projects" searchPlaceholder="Search projects" />
          </div>
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {posQuery.isLoading ? <LoadingState label="Loading purchase orders..." /> : null}
      {posQuery.error ? <ErrorState title="Unable to load purchase orders" message="Try again." /> : null}

      {!posQuery.isLoading && !posQuery.error && !rows.length && !activeFilterCount
        ? bulkImport.renderEmptyState({ canCreate, createLabel: "Create PO", onCreate: openCreatePurchaseOrder })
        : null}

      {!posQuery.isLoading && !posQuery.error && (rows.length || activeFilterCount) ? (
        <ModuleListTable
          tableCode="purchase_order"
          defaultColumns={[
            { field: "poNumber", label: "Number" },
            { field: "vendorId", label: "Vendor" },
            { field: "projectId", label: "Project" },
            { field: "status", label: "Status" },
            { field: "neededBy", label: "Needed" },
            { field: "total", label: "Total" },
          ]}
          rows={rows}
          rowKey={(row) => row.id}
          selectedRowKey={selectedId}
          onRowClick={(row) => {
            setSelectedId(row.id);
            setActionError(null);
          }}
          renderCell={(row, field) => {
            if (field === "poNumber") return row.poNumber ?? "Draft";
            if (field === "vendorId") return vendorName(row.vendorId);
            if (field === "projectId") return projectName(row.projectId);
            if (field === "status") return <StatusBadge status={row.status} />;
            if (field === "total") return `${row.currencyCode} ${row.total}`;
            const value = (row as unknown as Record<string, unknown>)[field];
            return value == null || value === "" ? "—" : String(value);
          }}
          nameFields={["poNumber"]}
          emptyMessage="No purchase orders"
        />
      ) : null}
    </ModuleListShell>
      )}
      {showEditDetails && selected ? (
        <div className="module-modal-backdrop" role="presentation" onClick={() => updateMutation.isPending ? null : setShowEditDetails(false)}>
          <section className="module-modal" role="dialog" aria-modal="true" aria-labelledby="edit-po-title" onClick={(event) => event.stopPropagation()}>
            <header className="d-flex align-items-center justify-content-between gap-3 mb-3">
              <h2 id="edit-po-title" className="h5 mb-0">Edit purchase order</h2>
              <button type="button" className="btn-close" aria-label="Close" disabled={updateMutation.isPending} onClick={() => setShowEditDetails(false)} />
            </header>
            <div className="mb-3">
              <label className="form-label" htmlFor="edit-po-number">PO number</label>
              <input id="edit-po-number" className="form-control" maxLength={80} value={editPoNumber} onChange={(event) => setEditPoNumber(event.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="edit-po-project">Project</label>
              <TechEarnestPicker value={editProjectId} onChange={setEditProjectId} options={projectOptions} searchPlaceholder="Search Projects" placeholder="No project" lookupIcon="apps" />
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label" htmlFor="edit-po-needed-by">Needed by</label>
                <input id="edit-po-needed-by" className="form-control" type="date" value={editNeededBy} onChange={(event) => setEditNeededBy(event.target.value)} />
              </div>
              <div className="col-6">
                <label className="form-label" htmlFor="edit-po-currency">Currency code</label>
                <input id="edit-po-currency" className="form-control" maxLength={3} value={editCurrencyCode} onChange={(event) => setEditCurrencyCode(event.target.value.toUpperCase())} />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="edit-po-notes">Notes</label>
              <textarea id="edit-po-notes" className="form-control" rows={3} maxLength={2000} value={editNotes} onChange={(event) => setEditNotes(event.target.value)} />
            </div>
            <footer className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={updateMutation.isPending} onClick={() => setShowEditDetails(false)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={!editCurrencyCode.trim() || updateMutation.isPending} onClick={() => updateMutation.mutate({ id: selected.id, body: { projectId: editProjectId || null, poNumber: editPoNumber.trim() || undefined, currencyCode: editCurrencyCode.trim(), neededBy: editNeededBy || null, notes: editNotes || null } })}>
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {bulkImport.dialog}
    </>
  );
}
