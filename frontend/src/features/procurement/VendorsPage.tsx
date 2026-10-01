import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormActions, UnsavedGuard } from "@/components/FormKit";
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
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listRegions } from "@/features/admin/adminApi";
import { listAccounts } from "@/features/crm/crmApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { useLocation } from "react-router-dom";
import { RecordLink, RelatedRecordList } from "@/components/RecordLink";
import { readRecordNavState, useUrlRecordId } from "@/hooks/useUrlRecord";
import { listPurchaseOrders } from "./purchaseOrdersApi";
import { createVendor, deleteVendor, getVendor, queryVendors, updateVendor } from "./vendorsApi";

const schema = z.object({
  regionId: z.string().min(1, "Region is required"),
  name: z.string().min(1, "Name is required"),
  taxNumber: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  accountId: z.string().optional(),
  paymentTermsDays: z.string().optional(),
  status: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const VENDOR_STATUSES = ["ACTIVE", "INACTIVE"] as const;
const vendorStatusOptions = enumPickerOptions(VENDOR_STATUSES);

const DEFAULTS: FormValues = {
  regionId: "",
  name: "",
  taxNumber: "",
  email: "",
  phone: "",
  accountId: "",
  paymentTermsDays: "30",
  status: "ACTIVE",
};

export function VendorsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("VENDOR_MANAGE");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [vendorToDelete, setVendorToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter || undefined,
      regionId: regionFilter || undefined,
    }),
    [search, statusFilter, regionFilter],
  );

  const vendorsQuery = useQuery({
    queryKey: ["vendors", listParams],
    queryFn: () => queryVendors({
      search: listParams.search,
      status: listParams.status,
      filter: listParams.regionId
        ? { op: "AND", conditions: [{ field: "regionId", operator: "EQ", value: listParams.regionId }] }
        : undefined,
    }),
  });
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const accountsQuery = useQuery({ queryKey: ["crm", "accounts"], queryFn: () => listAccounts() });
  const canViewPurchaseOrders = useHasPermission("PO_VIEW");
  const [selectedId, setSelectedId] = useUrlRecordId();
  const location = useLocation();
  const cameFrom = readRecordNavState(location.state)?.from;
  const selectedFromRows = (vendorsQuery.data ?? []).find((vendor) => vendor.id === selectedId) ?? null;
  const selectedFetchQuery = useQuery({
    queryKey: ["vendors", "record", selectedId],
    queryFn: () => getVendor(selectedId!),
    enabled: !!selectedId && !!vendorsQuery.data && !selectedFromRows,
    retry: false,
  });
  const selected = selectedFromRows ?? (selectedFetchQuery.data?.id === selectedId ? selectedFetchQuery.data : null);
  const vendorOrdersQuery = useQuery({
    queryKey: ["purchase-orders", "vendor", selected?.id],
    queryFn: () => listPurchaseOrders({ vendorId: selected!.id }),
    enabled: !!selected && canViewPurchaseOrders,
  });
  const accountName = (id: string) => accountsQuery.data?.find((account) => account.id === id)?.name ?? "Open account";

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

  const {
    setSaveAndNew,
    photo,
    cancelCreate,
    afterCreateSuccess,
  } = useTechEarnestCreateFlow({
    defaults: DEFAULTS,
    reset,
    setShowForm,
    setFormError,
    setSelected: (vendor) => setSelectedId(vendor.id),
  });

  const buildVendorBody = (values: FormValues) => ({
    regionId: values.regionId,
    name: values.name,
    taxNumber: values.taxNumber || undefined,
    email: values.email || undefined,
    phone: values.phone || undefined,
    accountId: values.accountId || undefined,
    paymentTermsDays: values.paymentTermsDays ? Number(values.paymentTermsDays) : undefined,
    status: values.status || "ACTIVE",
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["vendors"] });
  };

  const createMutation = useMutation({
    mutationFn: createVendor,
    onSuccess: async (vendor) => {
      await invalidate();
      setFormError(null);
      await afterCreateSuccess(vendor, "VENDOR");
    },
    onError: () => setFormError("Could not create vendor."),
  });

  const onCreateSubmit = (values: FormValues) => {
    createMutation.mutate(buildVendorBody(values));
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateVendor>[1] }) =>
      updateVendor(id, body),
    onSuccess: async () => {
      await invalidate();
      setFormError(null);
      reset(DEFAULTS);
      setShowForm(false);
      setEditingId(null);
    },
    onError: () => setFormError("Could not update vendor."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVendor,
    onSuccess: async () => {
      await invalidate();
      setVendorToDelete(null);
      setDeleteError(null);
    },
    onError: () => setDeleteError("Could not delete this vendor. It may still be linked to purchase orders."),
  });

  const rows = vendorsQuery.data ?? [];
  const regionName = (id: string) => regionsQuery.data?.find((r) => r.id === id)?.name ?? id.slice(0, 8);

  const regionOptions = useMemo(
    () => optionsFromPairs((regionsQuery.data ?? []).map((r) => ({ value: r.id, label: r.name }))),
    [regionsQuery.data],
  );
  const accountOptions = useMemo(
    () => optionsFromPairs((accountsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name }))),
    [accountsQuery.data],
  );
  const activeFilterCount = [search, statusFilter, regionFilter].filter(Boolean).length;

  function openCreate() {
    setEditingId(null);
    reset(DEFAULTS);
    setShowForm(true);
  }

  function openEdit(id: string) {
    const row = rows.find((v) => v.id === id);
    if (!row) return;
    setEditingId(id);
    reset({
      regionId: row.regionId,
      name: row.name,
      taxNumber: row.taxNumber ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      accountId: row.accountId ?? "",
      paymentTermsDays: row.paymentTermsDays != null ? String(row.paymentTermsDays) : "30",
      status: row.status,
    });
    setShowForm(true);
  }

  const vendorFormFields = (
    <TechEarnestCreateSection title="Vendor Information">
      <TechEarnestCreateGrid>
        <TechEarnestCreateColumn>
          <TechEarnestCreateField label="Vendor Name" required error={errors.name?.message}>
            <input
              type="text"
              className={`form-control form-control-sm${errors.name ? " is-invalid" : ""}`}
              {...register("name")}
            />
          </TechEarnestCreateField>
          <TechEarnestCreateField label="Region" required error={errors.regionId?.message}>
            <TechEarnestFormSelect
              control={control}
              name="regionId"
              options={regionOptions}
              searchPlaceholder="Search Regions"
              allowEmpty={false}
              placeholder="Select region"
              invalid={!!errors.regionId}
            />
          </TechEarnestCreateField>
          <TechEarnestCreateField label="Tax Number" error={errors.taxNumber?.message}>
            <input
              type="text"
              className={`form-control form-control-sm${errors.taxNumber ? " is-invalid" : ""}`}
              {...register("taxNumber")}
            />
          </TechEarnestCreateField>
          <TechEarnestCreateField label="CRM Account" error={errors.accountId?.message}>
            <TechEarnestFormSelect
              control={control}
              name="accountId"
              options={accountOptions}
              searchPlaceholder="Search Accounts"
              lookupIcon="building"
              placeholder="Optional"
            />
          </TechEarnestCreateField>
        </TechEarnestCreateColumn>
        <TechEarnestCreateColumn>
          <TechEarnestCreateField label="Email" error={errors.email?.message}>
            <input
              type="email"
              className={`form-control form-control-sm${errors.email ? " is-invalid" : ""}`}
              {...register("email")}
            />
          </TechEarnestCreateField>
          <TechEarnestCreateField label="Phone" error={errors.phone?.message}>
            <input
              type="text"
              className={`form-control form-control-sm${errors.phone ? " is-invalid" : ""}`}
              {...register("phone")}
            />
          </TechEarnestCreateField>
          <TechEarnestCreateField label="Payment Terms (Days)" error={errors.paymentTermsDays?.message}>
            <input
              type="number"
              className={`form-control form-control-sm${errors.paymentTermsDays ? " is-invalid" : ""}`}
              {...register("paymentTermsDays")}
            />
          </TechEarnestCreateField>
          <TechEarnestCreateField label="Status">
            <TechEarnestFormSelect
              control={control}
              name="status"
              options={vendorStatusOptions}
              searchPlaceholder="Search Statuses"
              allowEmpty={false}
            />
          </TechEarnestCreateField>
        </TechEarnestCreateColumn>
      </TechEarnestCreateGrid>
    </TechEarnestCreateSection>
  );

  return (
    <>
      {showForm && canManage && !editingId ? (
        <TechEarnestFormKitCreateView
          title="Create Vendor"
          tableCode="vendor"
          entityLabel="Vendor"
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
          photo={photo}
        >
          {vendorFormFields}
        </TechEarnestFormKitCreateView>
      ) : (
    <ModuleListShell
      title="Vendors"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Vendors</span>}
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
        canManage ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openCreate()}>
            Create Vendor
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Vendors by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, tax #"
            />
          </div>
          <div className="module-filter-section">
            <h3>Filter by fields</h3>
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={vendorStatusOptions} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search vendor statuses" />
            <TechEarnestFilterSelect label="Region" value={regionFilter} onChange={setRegionFilter} options={regionOptions} placeholder="All regions" emptyLabel="All regions" searchPlaceholder="Search regions" />
          </div>
        </>
      }
      activeFilterCount={activeFilterCount}
      onClearFilters={() => {
        setSearch("");
        setStatusFilter("");
        setRegionFilter("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {showForm && editingId ? (
        <form
          className="border-bottom p-3 bg-white"
          onSubmit={handleSubmit((values) =>
            updateMutation.mutate({ id: editingId, body: buildVendorBody(values) }),
          )}
        >
          <UnsavedGuard when={isDirty && showForm} />
          {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
          {vendorFormFields}
          <FormActions
            submitLabel="Update"
            submitting={isSubmitting || updateMutation.isPending}
            onCancel={() => {
              setShowForm(false);
              setEditingId(null);
              reset(DEFAULTS);
            }}
          />
        </form>
      ) : null}

      {selected ? (
        <div className="border-bottom bg-white p-3">
          {cameFrom ? (
            <button type="button" className="techearnest-record-return mb-2" onClick={() => setSelectedId(null)}>
              <span aria-hidden="true">‹</span> Back to {cameFrom.label || "previous page"}
            </button>
          ) : null}
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
              <h2 className="h6 mb-1">{selected.name}</h2>
              <div className="small text-muted d-flex flex-wrap gap-2 align-items-center">
                <StatusBadge status={selected.status} />
                {selected.accountId ? (
                  <span>
                    CRM account{" "}
                    <RecordLink module="account" id={selected.accountId}>
                      {accountName(selected.accountId)}
                    </RecordLink>
                  </span>
                ) : null}
                {selected.email ? <a href={`mailto:${selected.email}`}>{selected.email}</a> : null}
                {selected.phone ? <span>{selected.phone}</span> : null}
                {selected.paymentTermsDays != null ? <span>{selected.paymentTermsDays}-day terms</span> : null}
                {selected.taxNumber ? <span>Tax no. {selected.taxNumber}</span> : null}
              </div>
            </div>
            <div className="d-flex gap-2">
              {canManage ? (
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => openEdit(selected.id)}>
                  Edit
                </button>
              ) : null}
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>
          </div>
          {canViewPurchaseOrders ? (
            <div className="mt-3">
              <div className="form-label mb-1">Purchase Orders ({vendorOrdersQuery.data?.length ?? 0})</div>
              {vendorOrdersQuery.isLoading || vendorOrdersQuery.data?.length ? (
                <RelatedRecordList
                  module="purchaseOrder"
                  loading={vendorOrdersQuery.isLoading}
                  items={(vendorOrdersQuery.data ?? []).map((order) => ({
                    id: order.id,
                    label: order.poNumber ?? "Draft PO",
                    secondary: `${order.currencyCode} ${order.total.toLocaleString()}${order.neededBy ? ` · needed by ${order.neededBy}` : ""}`,
                    trailing: <StatusBadge status={order.status} />,
                  }))}
                />
              ) : (
                <div className="small text-muted">No purchase orders for this vendor</div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
      {vendorsQuery.isLoading ? <LoadingState label="Loading vendors..." /> : null}
      {vendorsQuery.error ? <ErrorState title="Unable to load vendors" message="Try again." /> : null}
      {!vendorsQuery.isLoading && !vendorsQuery.error ? (
        <ModuleListTable
          tableCode="vendor"
          defaultColumns={[
            { field: "name", label: "Name" },
            { field: "regionId", label: "Region" },
            { field: "email", label: "Email" },
            { field: "accountId", label: "CRM Account" },
            { field: "paymentTermsDays", label: "Terms" },
            { field: "status", label: "Status" },
          ]}
          rows={rows}
          rowKey={(vendor) => vendor.id}
          bulk={{
            noun: "vendors",
            exportFileName: "vendors",
            onComplete: () => void queryClient.invalidateQueries({ queryKey: ["vendors"] }),
            actions: [
              {
                id: "delete",
                label: "Delete",
                tone: "danger",
                visible: canManage,
                doneLabel: "deleted",
                confirm: "Deleted vendors can no longer be picked on purchase orders.",
                run: (vendor) => deleteVendor(vendor.id),
              },
            ],
          }}
          selectedRowKey={selectedId}
          onRowClick={(vendor) => setSelectedId(vendor.id)}
          renderCell={(vendor, field) => {
            if (field === "accountId")
              return (
                <RecordLink module="account" id={vendor.accountId}>
                  {vendor.accountId ? accountName(vendor.accountId) : null}
                </RecordLink>
              );
            if (field === "regionId") return regionName(vendor.regionId);
            if (field === "paymentTermsDays") return vendor.paymentTermsDays != null ? `${vendor.paymentTermsDays} days` : "—";
            if (field === "status") return <StatusBadge status={vendor.status} />;
            const value = (vendor as unknown as Record<string, unknown>)[field];
            return value == null || value === "" ? "—" : String(value);
          }}
          nameFields={["name"]}
          trailingColumn={canManage ? {
            header: "Actions",
            stopPropagation: true,
            render: (vendor) => (
              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(vendor.id)}>Edit</button>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => { setDeleteError(null); setVendorToDelete({ id: vendor.id, name: vendor.name }); }}>Delete</button>
              </div>
            ),
          } : undefined}
          emptyMessage="No vendors match the current filters."
        />
      ) : null}
    </ModuleListShell>
      )}
      {vendorToDelete ? (
        <div className="module-modal-backdrop" role="presentation" onClick={() => deleteMutation.isPending ? null : setVendorToDelete(null)}>
          <section className="module-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-vendor-title" onClick={(event) => event.stopPropagation()}>
            <header className="d-flex align-items-center justify-content-between gap-3 mb-3">
              <h2 id="delete-vendor-title" className="h5 mb-0">Delete vendor?</h2>
              <button type="button" className="btn-close" aria-label="Close" disabled={deleteMutation.isPending} onClick={() => setVendorToDelete(null)} />
            </header>
            <p>Delete <strong>{vendorToDelete.name}</strong>? This action may be blocked while purchase orders reference this vendor.</p>
            {deleteError ? <div className="alert alert-danger py-2" role="alert">{deleteError}</div> : null}
            <footer className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={deleteMutation.isPending} onClick={() => setVendorToDelete(null)}>Cancel</button>
              <button type="button" className="btn btn-danger btn-sm" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(vendorToDelete.id)}>
                {deleteMutation.isPending ? "Deleting…" : "Delete vendor"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
