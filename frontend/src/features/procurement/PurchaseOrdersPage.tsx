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
import { listTaxRates } from "@/features/finance/taxApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { listVendors } from "./vendorsApi";
import {
  addPurchaseOrderItem,
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
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

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
  };

  const createMutation = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: async (po) => {
      await invalidate();
      setFormError(null);
      reset(DEFAULTS);
      setShowForm(false);
      setSelectedId(po.id);
    },
    onError: () => setFormError("Could not create purchase order draft."),
  });

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

  const rows = posQuery.data ?? [];
  const selected: PurchaseOrder | undefined = detailQuery.data;
  const vendorName = (id: string) => vendorsQuery.data?.find((v) => v.id === id)?.name ?? id.slice(0, 8);
  const projectName = (id: string | null) =>
    id ? (projectsQuery.data?.find((p) => p.id === id)?.name ?? id.slice(0, 8)) : "—";
  const activeFilterCount = [search, statusFilter, vendorFilter, projectFilter].filter(Boolean).length;

  return (
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
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Create PO"}
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
      {showForm ? (
        <form
          className="border-bottom p-3 bg-white"
          onSubmit={handleSubmit((values) =>
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
            }),
          )}
        >
          <UnsavedGuard when={isDirty && showForm} />
          {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
          <FormSection title="Draft PO" description="Vendor, optional project, needed-by date">
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
            <div className="col-md-3">
              <label className="form-label required">Vendor</label>
              <select className="form-select" {...register("vendorId")}>
                <option value="">Select</option>
                {(vendorsQuery.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              {errors.vendorId ? <div className="invalid-feedback d-block">{errors.vendorId.message}</div> : null}
            </div>
            <div className="col-md-3">
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
                  <select className="form-select" {...register(`items.${index}.taxRateId`)}>
                    <option value="">None</option>
                    {(taxQuery.data ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} ({t.ratePercent}%)
                      </option>
                    ))}
                  </select>
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
          <FormActions
            submitLabel="Create draft"
            submitting={isSubmitting || createMutation.isPending}
            onCancel={() => {
              setShowForm(false);
              reset(DEFAULTS);
            }}
          />
        </form>
      ) : null}

      {posQuery.isLoading ? <LoadingState label="Loading purchase orders..." /> : null}
      {posQuery.error ? <ErrorState title="Unable to load purchase orders" message="Try again." /> : null}

      {!posQuery.isLoading && !posQuery.error ? (
        <div className="d-flex" style={{ flex: 1, minHeight: 0 }}>
          <div className="module-list-table-wrap" style={{ flex: 1 }}>
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

          {selectedId ? (
            <div style={{ width: 400, overflow: "auto" }}>
              {detailQuery.isLoading ? <LoadingState label="Loading…" /> : null}
              {selected ? (
                <RecordShell
                  title={selected.poNumber ?? "Draft PO"}
                  subtitle={`${selected.currencyCode} ${selected.total} · ${vendorName(selected.vendorId)}`}
                  badges={<StatusBadge status={selected.status} />}
                  onClose={() => setSelectedId(null)}
                  tabs={[
                    {
                      id: "overview",
                      label: "Overview",
                      content: (
                        <>
                          {actionError ? <div className="alert alert-danger py-2 small">{actionError}</div> : null}
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
                          {canCreate && selected.status === "DRAFT" ? (
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
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </ModuleListShell>
  );
}
