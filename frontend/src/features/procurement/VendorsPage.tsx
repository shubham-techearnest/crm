import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormActions, FormSection, UnsavedGuard } from "@/components/FormKit";
import {
  enumPickerOptions,
  optionsFromPairs,
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
import { createVendor, deleteVendor, queryVendors, updateVendor } from "./vendorsApi";

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
    <FormSection title={editingId ? "Edit vendor" : "Vendor"} description="Procurement master; optional link to CRM account">
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
        <FormField label="Name" required error={errors.name} {...register("name")} />
      </div>
      <div className="col-md-2">
        <FormField label="Tax number" error={errors.taxNumber} {...register("taxNumber")} />
      </div>
      <div className="col-md-2">
        <FormField label="Email" error={errors.email} {...register("email")} />
      </div>
      <div className="col-md-2">
        <FormField label="Phone" error={errors.phone} {...register("phone")} />
      </div>
      <div className="col-md-3">
        <label className="form-label">CRM account</label>
        <TechEarnestFormSelect
          control={control}
          name="accountId"
          options={accountOptions}
          searchPlaceholder="Search Accounts"
          lookupIcon="building"
          placeholder="Optional"
        />
      </div>
      <div className="col-md-2">
        <FormField
          label="Payment terms (days)"
          type="number"
          error={errors.paymentTermsDays}
          {...register("paymentTermsDays")}
        />
      </div>
      <div className="col-md-2">
        <label className="form-label">Status</label>
        <TechEarnestFormSelect
          control={control}
          name="status"
          options={vendorStatusOptions}
          searchPlaceholder="Search Statuses"
          allowEmpty={false}
        />
      </div>
    </FormSection>
  );

  return (
    <>
      {showForm && canManage && !editingId ? (
        <TechEarnestFormKitCreateView
          title="Create Vendor"
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
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={vendorStatusOptions} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search vendor statuses" />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Region" value={regionFilter} onChange={setRegionFilter} options={regionOptions} placeholder="All regions" emptyLabel="All regions" searchPlaceholder="Search regions" />
          </div>
        </>
      }
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

      {vendorsQuery.isLoading ? <LoadingState label="Loading vendors..." /> : null}
      {vendorsQuery.error ? <ErrorState title="Unable to load vendors" message="Try again." /> : null}
      {!vendorsQuery.isLoading && !vendorsQuery.error ? (
        <ModuleListTable
          tableCode="vendor"
          defaultColumns={[
            { field: "name", label: "Name" },
            { field: "regionId", label: "Region" },
            { field: "email", label: "Email" },
            { field: "paymentTermsDays", label: "Terms" },
            { field: "status", label: "Status" },
          ]}
          rows={rows}
          rowKey={(vendor) => vendor.id}
          renderCell={(vendor, field) => {
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
