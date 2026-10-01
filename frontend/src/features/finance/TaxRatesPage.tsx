import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  enumPickerOptions,
  TechEarnestCreateColumn,
  TechEarnestCreateField,
  TechEarnestCreateGrid,
  TechEarnestCreateSection,
  TechEarnestFormKitCreateView,
  TechEarnestFormSelect,
  useTechEarnestCreateFlow,
} from "@/components/TechEarnestCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { deleteRecord } from "@/components/BulkActions/bulkActions";
import { TechEarnestFilterSelect } from "@/components/TechEarnestCreate/TechEarnestFilterSelect";
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

const TAX_TYPES = ["CGST", "SGST", "IGST", "OTHER"] as const;
const taxTypeOptions = enumPickerOptions(TAX_TYPES);

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
    cancelCreate,
    afterCreateSuccess,
  } = useTechEarnestCreateFlow({
    defaults: DEFAULTS,
    reset,
    setShowForm,
    setFormError,
  });

  const buildBody = (values: FormValues) => ({
    code: values.code,
    name: values.name,
    ratePercent: Number(values.ratePercent),
    jurisdiction: values.jurisdiction || undefined,
    taxType: values.taxType || undefined,
    description: values.description || undefined,
  });

  const createMutation = useMutation({
    mutationFn: createTaxRate,
    onSuccess: async (taxRate) => {
      await queryClient.invalidateQueries({ queryKey: ["tax-rates"] });
      setFormError(null);
      await afterCreateSuccess(taxRate, "TAX_RATE");
    },
    onError: () => setFormError("Could not create tax rate. Check code is unique."),
  });

  const onCreateSubmit = (values: FormValues) => {
    createMutation.mutate(buildBody(values));
  };

  function openCreate() {
    reset(DEFAULTS);
    setShowForm(true);
  }

  const rows = query.data ?? [];
  const activeFilterCount = [search, taxTypeFilter].filter(Boolean).length;

  const taxRateFormFields = (
    <>
      <TechEarnestCreateSection title="Tax Rate Information">
        <TechEarnestCreateGrid>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Tax Code" required error={errors.code?.message}>
              <input
                type="text"
                className={`form-control form-control-sm${errors.code ? " is-invalid" : ""}`}
                {...register("code")}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Tax Name" required error={errors.name?.message}>
              <input
                type="text"
                className={`form-control form-control-sm${errors.name ? " is-invalid" : ""}`}
                {...register("name")}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Jurisdiction" error={errors.jurisdiction?.message}>
              <input
                type="text"
                className={`form-control form-control-sm${errors.jurisdiction ? " is-invalid" : ""}`}
                {...register("jurisdiction")}
              />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Rate %" required error={errors.ratePercent?.message}>
              <input
                type="number"
                className={`form-control form-control-sm${errors.ratePercent ? " is-invalid" : ""}`}
                {...register("ratePercent")}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Tax Type" error={errors.taxType?.message}>
              <TechEarnestFormSelect
                control={control}
                name="taxType"
                options={taxTypeOptions}
                searchPlaceholder="Search Types"
                allowEmpty={false}
              />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
        </TechEarnestCreateGrid>
      </TechEarnestCreateSection>
      <TechEarnestCreateSection title="Description Information">
        <TechEarnestCreateField label="Description" wide error={errors.description?.message}>
          <textarea rows={4} className="form-control form-control-sm" {...register("description")} />
        </TechEarnestCreateField>
      </TechEarnestCreateSection>
    </>
  );

  return (
    <>
      {showForm && canManage ? (
        <TechEarnestFormKitCreateView
          title="Create Tax Rate"
          tableCode="tax_rate"
          entityLabel="Tax Rate"
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
          showRecordImage={false}
        >
          {taxRateFormFields}
        </TechEarnestFormKitCreateView>
      ) : (
    <ModuleListShell
      title="Tax Rates"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Rates</span>}
      filterToggle={{ onToggle: () => setFilterOpen((open) => !open) }}
      primaryAction={
        canManage ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openCreate()}>
            Create Tax Rate
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
            <TechEarnestFilterSelect label="Type" value={taxTypeFilter} onChange={setTaxTypeFilter} options={["CGST", "SGST", "IGST", "OTHER"].map((value) => ({ value, label: value }))} placeholder="All tax types" emptyLabel="All tax types" searchPlaceholder="Search tax types" />
          </div>
        </>
      }
      activeFilterCount={activeFilterCount}
      onClearFilters={() => {
        setSearch("");
        setTaxTypeFilter("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {query.isLoading ? <LoadingState label="Loading tax rates..." /> : null}
      {query.error ? <ErrorState title="Unable to load tax rates" message="Try again." /> : null}
      {!query.isLoading && !query.error ? (
        <ModuleListTable
          tableCode="tax_rate"
          defaultColumns={[
            { field: "code", label: "Code" },
            { field: "name", label: "Name" },
            { field: "ratePercent", label: "Rate %" },
            { field: "taxType", label: "Type" },
            { field: "jurisdiction", label: "Jurisdiction" },
            { field: "active", label: "Status" },
          ]}
          rows={rows}
          rowKey={(rate) => rate.id}
          bulk={{
            noun: "tax rates",
            exportFileName: "tax-rates",
            onComplete: () => void queryClient.invalidateQueries({ queryKey: ["tax-rates"] }),
            actions: [
              {
                id: "delete",
                label: "Delete",
                tone: "danger",
                visible: canManage,
                doneLabel: "deleted",
                confirm: "Deleted tax rates can no longer be applied to new invoice lines.",
                run: (rate) => deleteRecord(`/tax-rates/${rate.id}`),
              },
            ],
          }}
          renderCell={(rate, field) => {
            if (field === "active") return <StatusBadge status={rate.active ? "ACTIVE" : "INACTIVE"} />;
            const value = (rate as unknown as Record<string, unknown>)[field];
            return value == null || value === "" ? "—" : String(value);
          }}
          nameFields={["code", "name"]}
          emptyMessage="No tax rates yet"
        />
      ) : null}
    </ModuleListShell>
      )}
    </>
  );
}
