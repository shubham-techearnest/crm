import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import { listProjects } from "@/features/projects/projectApi";
import { listTaxRates } from "@/features/finance/taxApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { listVendors } from "./vendorsApi";
import {
  addPurchaseOrderItem,
  approvePurchaseOrder,
  closePurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  rejectPurchaseOrder,
  sendPurchaseOrder,
  submitPurchaseOrder,
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
    queryFn: () => listPurchaseOrders(listParams),
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

  const { photo, cancelCreate, afterCreateSuccess } = useZohoCreateFlow({
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

  const rows = posQuery.data ?? [];
  const selectedRow = rows.find((row) => row.id === selectedId) ?? null;
  const recordNav = useRecordNavigation(rows, selectedRow, (item) => {
    setSelectedId(item?.id ?? null);
    setActionError(null);
    setRejectReason("");
  });
  const selected: PurchaseOrder | undefined = detailQuery.data;
  const vendorName = (id: string) => vendorsQuery.data?.find((v) => v.id === id)?.name ?? id.slice(0, 8);
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
        <ZohoFormKitCreateView
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
              <label className="form-label required">Vendor</label>
              <ZohoFormSelect
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
                  <ZohoFormSelect
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
        </ZohoFormKitCreateView>
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
            <h3>Status</h3>
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              {PO_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="module-filter-section">
            <h3>Vendor</h3>
            <select
              className="form-select form-select-sm"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
            >
              <option value="">All</option>
              {(vendorsQuery.data ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
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
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {posQuery.isLoading ? <LoadingState label="Loading purchase orders..." /> : null}
      {posQuery.error ? <ErrorState title="Unable to load purchase orders" message="Try again." /> : null}

      {!posQuery.isLoading && !posQuery.error ? (
        <div className="module-list-table-wrap">
            <table className="table module-list-table align-middle">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Vendor</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Needed</th>
                  <th>Total</th>
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
                    <td className="lead-name">{row.poNumber ?? "Draft"}</td>
                    <td>{vendorName(row.vendorId)}</td>
                    <td>{projectName(row.projectId)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>{row.neededBy ?? "—"}</td>
                    <td>
                      {row.currencyCode} {row.total}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-5">
                      No purchase orders
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
