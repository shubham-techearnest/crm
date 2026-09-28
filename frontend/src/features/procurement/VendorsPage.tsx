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
  ZohoFormKitCreateView,
  ZohoFormSelect,
  useZohoCreateFlow,
} from "@/components/ZohoCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listRegions } from "@/features/admin/adminApi";
import { listAccounts } from "@/features/crm/crmApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { createVendor, listVendors, updateVendor } from "./vendorsApi";

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
    queryFn: () => listVendors(listParams),
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
  } = useZohoCreateFlow({
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
        <ZohoFormSelect
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
        <ZohoFormSelect
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
        <ZohoFormKitCreateView
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
        </ZohoFormKitCreateView>
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
            <h3>Status</h3>
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
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
        <div className="module-list-table-wrap">
          <table className="table module-list-table align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Region</th>
                <th>Email</th>
                <th>Terms</th>
                <th>Status</th>
                {canManage ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="lead-name">{row.name}</td>
                  <td>{regionName(row.regionId)}</td>
                  <td>{row.email ?? "—"}</td>
                  <td>{row.paymentTermsDays != null ? `${row.paymentTermsDays}d` : "—"}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  {canManage ? (
                    <td>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(row.id)}>
                        Edit
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="text-center text-muted py-5">
                    No vendors
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
