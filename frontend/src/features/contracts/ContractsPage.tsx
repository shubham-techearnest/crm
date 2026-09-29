import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormSection } from "@/components/FormKit";
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
import { listProjects } from "@/features/projects/projectApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { createContract, listContracts, queryContracts } from "./contractApi";
import { buildContractFilterConditions, needsContractQuery } from "./contractFilterCatalog";

const schema = z.object({
  regionId: z.string().min(1, "Region is required"),
  accountId: z.string().min(1, "Account is required"),
  projectId: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  contractNumber: z.string().optional(),
  valueAmount: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  autoRenew: z.boolean().optional(),
  renewalNoticeDays: z.string().optional(),
  status: z.string().optional(),
  terms: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const CONTRACT_STATUSES = ["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED"] as const;
const contractStatusOptions = enumPickerOptions(CONTRACT_STATUSES);
const contractFilterStatusOptions = enumPickerOptions(["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED", "RENEWED"]);
const autoRenewFilterOptions = optionsFromPairs([{ value: "true", label: "Yes" }, { value: "false", label: "No" }]);

const DEFAULTS: FormValues = {
  regionId: "",
  accountId: "",
  projectId: "",
  name: "",
  contractNumber: "",
  valueAmount: "",
  startDate: "",
  endDate: "",
  autoRenew: false,
  renewalNoticeDays: "30",
  status: "ACTIVE",
  terms: "",
};

export function ContractsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("CONTRACT_MANAGE");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [autoRenewFilter, setAutoRenewFilter] = useState<"" | "true" | "false">("");
  const [expiryWithinDays, setExpiryWithinDays] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const autoRenewBool =
    autoRenewFilter === "true" ? true : autoRenewFilter === "false" ? false : ("" as const);
  const advanced = needsContractQuery({
    expiryWithinDays,
    autoRenew: autoRenewBool,
  });

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter || undefined,
      accountId: accountFilter || undefined,
      autoRenew: typeof autoRenewBool === "boolean" ? autoRenewBool : undefined,
    }),
    [search, statusFilter, accountFilter, autoRenewBool],
  );

  const queryBody = useMemo(() => {
    const conditions = buildContractFilterConditions({
      status: statusFilter || undefined,
      accountId: accountFilter || undefined,
      autoRenew: autoRenewBool,
      expiryWithinDays: expiryWithinDays || undefined,
    });
    return {
      search: search || undefined,
      filter: conditions.length ? { op: "AND" as const, conditions } : undefined,
    };
  }, [search, statusFilter, accountFilter, autoRenewBool, expiryWithinDays]);

  const contractsQuery = useQuery({
    queryKey: ["contracts", advanced ? "query" : "list", advanced ? queryBody : listParams],
    queryFn: () => (advanced ? queryContracts(queryBody) : listContracts(listParams)),
  });
  const accountsQuery = useQuery({ queryKey: ["crm", "accounts"], queryFn: () => listAccounts() });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => listProjects() });
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });

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

  const regionOptions = useMemo(
    () => optionsFromPairs((regionsQuery.data ?? []).map((r) => ({ value: r.id, label: r.name }))),
    [regionsQuery.data],
  );
  const accountOptions = useMemo(
    () => optionsFromPairs((accountsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name }))),
    [accountsQuery.data],
  );
  const projectOptions = useMemo(
    () => optionsFromPairs((projectsQuery.data ?? []).map((p) => ({ value: p.id, label: p.name }))),
    [projectsQuery.data],
  );

  const buildContractBody = (values: FormValues) => ({
    regionId: values.regionId,
    accountId: values.accountId,
    projectId: values.projectId || undefined,
    name: values.name,
    contractNumber: values.contractNumber || undefined,
    valueAmount: values.valueAmount ? Number(values.valueAmount) : undefined,
    startDate: values.startDate || undefined,
    endDate: values.endDate || undefined,
    autoRenew: values.autoRenew,
    renewalNoticeDays: values.renewalNoticeDays ? Number(values.renewalNoticeDays) : 30,
    terms: values.terms || undefined,
    status: values.status || "ACTIVE",
  });

  const createMutation = useMutation({
    mutationFn: createContract,
    onSuccess: async (contract) => {
      await queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setFormError(null);
      await afterCreateSuccess(contract, "CONTRACT");
    },
    onError: () => setFormError("Could not create contract."),
  });

  const onCreateSubmit = (values: FormValues) => {
    createMutation.mutate(buildContractBody(values));
  };

  const rows = contractsQuery.data ?? [];
  const accountName = (id: string) =>
    accountsQuery.data?.find((a) => a.id === id)?.name ?? id.slice(0, 8);
  const activeFilterCount = [
    search,
    statusFilter,
    accountFilter,
    autoRenewFilter,
    expiryWithinDays,
  ].filter(Boolean).length;

  return (
    <>
      {showForm && canManage ? (
        <TechEarnestFormKitCreateView
          title="Create Contract"
          entityLabel="Contract"
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
          <FormSection title="Contract" description="Account, dates, value, renewal">
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
              <label className="form-label required">Account</label>
              <TechEarnestFormSelect
                control={control}
                name="accountId"
                options={accountOptions}
                searchPlaceholder="Search Accounts"
                lookupIcon="building"
                allowEmpty={false}
                placeholder="Select"
                invalid={!!errors.accountId}
              />
              {errors.accountId ? <div className="invalid-feedback d-block">{errors.accountId.message}</div> : null}
            </div>
            <div className="col-md-3">
              <FormField label="Name" required error={errors.name} {...register("name")} />
            </div>
            <div className="col-md-3">
              <FormField label="Number" error={errors.contractNumber} {...register("contractNumber")} />
            </div>
            <div className="col-md-2">
              <FormField label="Value" type="number" error={errors.valueAmount} {...register("valueAmount")} />
            </div>
            <div className="col-md-2">
              <FormField label="Start" type="date" error={errors.startDate} {...register("startDate")} />
            </div>
            <div className="col-md-2">
              <FormField label="End" type="date" error={errors.endDate} {...register("endDate")} />
            </div>
            <div className="col-md-2">
              <FormField
                label="Notice days"
                type="number"
                error={errors.renewalNoticeDays}
                {...register("renewalNoticeDays")}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Status</label>
              <TechEarnestFormSelect
                control={control}
                name="status"
                options={contractStatusOptions}
                searchPlaceholder="Search Statuses"
                allowEmpty={false}
              />
            </div>
            <div className="col-md-2 form-check mt-4">
              <input className="form-check-input" type="checkbox" id="autoRenew" {...register("autoRenew")} />
              <label className="form-check-label" htmlFor="autoRenew">
                Auto renew
              </label>
            </div>
            <div className="col-md-4">
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
          </FormSection>
        </TechEarnestFormKitCreateView>
      ) : (
    <ModuleListShell
      title="Contracts"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Contracts</span>}
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
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
            Create Contract
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Contracts by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or number"
            />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={contractFilterStatusOptions} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search contract statuses" />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Account" value={accountFilter} onChange={setAccountFilter} options={accountOptions} placeholder="All accounts" emptyLabel="All accounts" searchPlaceholder="Search accounts" />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Auto renew" value={autoRenewFilter} onChange={(value) => setAutoRenewFilter(value as "" | "true" | "false")} options={autoRenewFilterOptions} placeholder="All" emptyLabel="All" searchPlaceholder="Search options" />
          </div>
          <div className="module-filter-section">
            <h3>Expiry within (days)</h3>
            <input
              className="form-control form-control-sm"
              type="number"
              value={expiryWithinDays}
              onChange={(e) => setExpiryWithinDays(e.target.value)}
              placeholder="e.g. 30"
            />
          </div>
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {contractsQuery.isLoading ? <LoadingState label="Loading contracts..." /> : null}
      {contractsQuery.error ? <ErrorState title="Unable to load contracts" message="Try again." /> : null}
      {!contractsQuery.isLoading && !contractsQuery.error ? (
        <ModuleListTable
          tableCode="contract"
          defaultColumns={[
            { field: "name", label: "Name" },
            { field: "accountId", label: "Account" },
            { field: "status", label: "Status" },
            { field: "endDate", label: "End" },
            { field: "valueAmount", label: "Value" },
            { field: "autoRenew", label: "Auto renew" },
          ]}
          rows={rows}
          rowKey={(contract) => contract.id}
          renderCell={(contract, field) => {
            if (field === "accountId") return accountName(contract.accountId);
            if (field === "status") return <StatusBadge status={contract.status} />;
            if (field === "valueAmount") return contract.valueAmount != null ? `${contract.currencyCode} ${contract.valueAmount}` : "—";
            if (field === "autoRenew") return contract.autoRenew ? "Yes" : "No";
            const value = (contract as unknown as Record<string, unknown>)[field];
            return value == null || value === "" ? "—" : String(value);
          }}
          nameFields={["name"]}
          emptyMessage="No contracts match the current filters."
        />
      ) : null}
    </ModuleListShell>
      )}
    </>
  );
}
