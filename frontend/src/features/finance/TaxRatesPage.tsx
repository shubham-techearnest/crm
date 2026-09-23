import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormActions, FormSection, UnsavedGuard } from "@/components/FormKit";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { createTaxRate, listTaxRates } from "./taxApi";

const schema = z.object({
  code: z.string().min(1, "Code is required").max(32),
  name: z.string().min(1, "Name is required").max(128),
  ratePercent: z.string().min(1, "Rate is required"),
  jurisdiction: z.string().optional(),
  taxType: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  code: "",
  name: "",
  ratePercent: "18",
  jurisdiction: "IN",
  taxType: "CGST",
  description: "",
};

export function TaxRatesPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("TAX_MANAGE");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [taxTypeFilter, setTaxTypeFilter] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      taxType: taxTypeFilter || undefined,
    }),
    [search, taxTypeFilter],
  );

  const query = useQuery({
    queryKey: ["tax-rates", listParams],
    queryFn: () => listTaxRates(listParams),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  const createMutation = useMutation({
    mutationFn: createTaxRate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tax-rates"] });
      setFormError(null);
      reset(DEFAULTS);
      setShowForm(false);
    },
    onError: () => setFormError("Could not create tax rate. Check code is unique."),
  });

  const rows = query.data ?? [];
  const activeFilterCount = [search, taxTypeFilter].filter(Boolean).length;

  return (
    <ModuleListShell
      title="Tax Rates"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Rates</span>}
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
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Create Tax Rate"}
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Tax Rates by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Code or name"
            />
          </div>
          <div className="module-filter-section">
            <h3>Type</h3>
            <select
              className="form-select form-select-sm"
              value={taxTypeFilter}
              onChange={(e) => setTaxTypeFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="CGST">CGST</option>
              <option value="SGST">SGST</option>
              <option value="IGST">IGST</option>
              <option value="OTHER">OTHER</option>
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
              code: values.code,
              name: values.name,
              ratePercent: Number(values.ratePercent),
              jurisdiction: values.jurisdiction || undefined,
              taxType: values.taxType || undefined,
              description: values.description || undefined,
            }),
          )}
        >
          <UnsavedGuard when={isDirty && showForm} />
          {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
          <FormSection title="Tax rate" description="GST-ready code, rate, and jurisdiction">
            <div className="col-md-2">
              <FormField label="Code" required error={errors.code} {...register("code")} />
            </div>
            <div className="col-md-3">
              <FormField label="Name" required error={errors.name} {...register("name")} />
            </div>
            <div className="col-md-2">
              <FormField
                label="Rate %"
                type="number"
                required
                error={errors.ratePercent}
                {...register("ratePercent")}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Type</label>
              <select className="form-select" {...register("taxType")}>
                <option value="CGST">CGST</option>
                <option value="SGST">SGST</option>
                <option value="IGST">IGST</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
            <div className="col-md-3">
              <FormField label="Jurisdiction" error={errors.jurisdiction} {...register("jurisdiction")} />
            </div>
          </FormSection>
          <FormActions
            submitLabel="Save"
            submitting={isSubmitting || createMutation.isPending}
            onCancel={() => {
              setShowForm(false);
              reset(DEFAULTS);
            }}
          />
        </form>
      ) : null}

      {query.isLoading ? <LoadingState label="Loading tax rates..." /> : null}
      {query.error ? <ErrorState title="Unable to load tax rates" message="Try again." /> : null}
      {!query.isLoading && !query.error ? (
        <div className="module-list-table-wrap">
          <table className="table module-list-table align-middle">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Rate %</th>
                <th>Type</th>
                <th>Jurisdiction</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="lead-name">{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.ratePercent}</td>
                  <td>{row.taxType}</td>
                  <td>{row.jurisdiction ?? "—"}</td>
                  <td>
                    <StatusBadge status={row.active ? "ACTIVE" : "INACTIVE"} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-5">
                    No tax rates yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </ModuleListShell>
  );
}
