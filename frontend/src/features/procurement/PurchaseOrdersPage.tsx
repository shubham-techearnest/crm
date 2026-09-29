import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormSection } from "@/components/FormKit";
import {
  enumPickerOptions,
  optionsFromPairs,
  TechEarnestFormKitCreateView,
  TechEarnestFormSelect,
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
import { listRegions } from "@/features/admin/adminApi";
import { listProjects } from "@/features/projects/projectApi";
import { listTaxRates } from "@/features/finance/taxApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
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
  neededBy: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(lineSchema).min(1, "Add at least one line"),
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  regionId: "",
  vendorId: "",
  projectId: "",
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

  const createMutation = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: async (po) => {
      await invalidate();
      setFormError(null);
      await afterCreateSuccess(po, "PURCHASE_ORDER");
    },
    onError: () => setFormError("Could not create purchase order draft."),
  });

  const onCreateSubmit = (values: FormValues) => {
    createMutation.mutate({
      regionId: values.regionId,
      vendorId: values.vendorId,
      projectId: values.projectId || undefined,
      neededBy: values.neededBy || undefined,
      notes: values.notes || undefined,
      items: values.items.map((line) => ({
        description: line.description,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        taxRateId: line.taxRateId || undefined,
      })),
    });
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
          <FormSection title="Draft PO" description="Vendor, optional project, needed-by date">
            <div className="col-md-3">
              <label className="form-label required">Region</label>
              <TechEarnestFormSelect
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
              <label className="form-label required">Vendor</label>
              <TechEarnestFormSelect
                control={control}
                name="vendorId"
                options={vendorOptions}
                searchPlaceholder="Search Vendors"
                allowEmpty={false}
                placeholder="Select"
                invalid={!!errors.vendorId}
              />
              {errors.vendorId ? <div className="invalid-feedback d-block">{errors.vendorId.message}</div> : null}
            </div>
            <div className="col-md-3">
              <label className="form-label">Project</label>
              <TechEarnestFormSelect
                control={control}
                name="projectId"
                options={projectOptions}
                searchPlaceholder="Search Projects"
                lookupIcon="apps"
                placeholder="Optional"
              />
            </div>
            <div className="col-md-3">
              <FormField label="Needed by" type="date" error={errors.neededBy} {...register("neededBy")} />
            </div>
          </FormSection>
          <FormSection title="Line items" description="Qty × unit price; tax optional">
            {fields.map((field, index) => (
              <div key={field.id} className="row g-2 mb-2 align-items-end">
                <div className="col-md-4">
                  <FormField
                    label="Description"
                    required
                    error={errors.items?.[index]?.description}
                    {...register(`items.${index}.description`)}
                  />
                </div>
                <div className="col-md-2">
                  <FormField
                    label="Qty"
                    type="number"
                    required
                    error={errors.items?.[index]?.quantity}
                    {...register(`items.${index}.quantity`)}
                  />
                </div>
                <div className="col-md-2">
                  <FormField
                    label="Unit price"
                    type="number"
                    required
                    error={errors.items?.[index]?.unitPrice}
                    {...register(`items.${index}.unitPrice`)}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Tax rate</label>
                  <TechEarnestFormSelect
                    control={control}
                    name={`items.${index}.taxRateId`}
                    options={taxRateOptions}
                    searchPlaceholder="Search Tax Rates"
                    placeholder="None"
                  />
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
              onClick={() => append({ description: "", quantity: "1", unitPrice: "", taxRateId: "" })}
            >
              Add line
            </button>
          </FormSection>
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
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              reset(DEFAULTS);
              setShowForm(true);
            }}
          >
            Create PO
          </button>
        ) : null
      }
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

      {!posQuery.isLoading && !posQuery.error ? (
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
    </>
  );
}
