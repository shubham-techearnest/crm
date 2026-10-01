import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { ModuleFilterField, ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { deleteRecord } from "@/components/BulkActions/bulkActions";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listRegions } from "@/features/admin/adminApi";
import { listAccounts } from "@/features/crm/crmApi";
import { listProjects } from "@/features/projects/projectApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { useLocation } from "react-router-dom";
import { RecordLink } from "@/components/RecordLink";
import { readRecordNavState, useUrlRecordId } from "@/hooks/useUrlRecord";
import { createContract, getContract, listContracts, queryContracts } from "./contractApi";
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
  const [selectedId, setSelectedId] = useUrlRecordId();
  const location = useLocation();
  const cameFrom = readRecordNavState(location.state)?.from;
  const selectedFromRows = (contractsQuery.data ?? []).find((contract) => contract.id === selectedId) ?? null;
  const selectedFetchQuery = useQuery({
    queryKey: ["contracts", "record", selectedId],
    queryFn: () => getContract(selectedId!),
    enabled: !!selectedId && !!contractsQuery.data && !selectedFromRows,
    retry: false,
  });
  const selected = selectedFromRows ?? (selectedFetchQuery.data?.id === selectedId ? selectedFetchQuery.data : null);

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
    setSelected: (contract) => setSelectedId(contract.id),
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
          tableCode="contract"
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
          showRecordImage={false}
        >
          <TechEarnestCreateSection title="Contract Information">
            <TechEarnestCreateGrid>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Contract Name" required error={errors.name?.message}>
                  <input
                    type="text"
                    className={`form-control form-control-sm${errors.name ? " is-invalid" : ""}`}
                    {...register("name")}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Contract Number" error={errors.contractNumber?.message}>
                  <input
                    type="text"
                    className={`form-control form-control-sm${errors.contractNumber ? " is-invalid" : ""}`}
                    {...register("contractNumber")}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Account Name" required error={errors.accountId?.message}>
                  <TechEarnestFormSelect
                    control={control}
                    name="accountId"
                    options={accountOptions}
                    searchPlaceholder="Search Accounts"
                    lookupIcon="building"
                    allowEmpty={false}
                    placeholder="Select account"
                    invalid={!!errors.accountId}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Project" error={errors.projectId?.message}>
                  <TechEarnestFormSelect
                    control={control}
                    name="projectId"
                    options={projectOptions}
                    searchPlaceholder="Search Projects"
                    lookupIcon="apps"
                    placeholder="Optional"
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
              </TechEarnestCreateColumn>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Status" error={errors.status?.message}>
                  <TechEarnestFormSelect
                    control={control}
                    name="status"
                    options={contractStatusOptions}
                    searchPlaceholder="Search Statuses"
                    allowEmpty={false}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Start Date" error={errors.startDate?.message}>
                  <input
                    type="date"
                    className={`form-control form-control-sm${errors.startDate ? " is-invalid" : ""}`}
                    {...register("startDate")}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="End Date" error={errors.endDate?.message}>
                  <input
                    type="date"
                    className={`form-control form-control-sm${errors.endDate ? " is-invalid" : ""}`}
                    {...register("endDate")}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Contract Value" error={errors.valueAmount?.message}>
                  <input
                    type="number"
                    className={`form-control form-control-sm${errors.valueAmount ? " is-invalid" : ""}`}
                    {...register("valueAmount")}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Notice Period (Days)" error={errors.renewalNoticeDays?.message}>
                  <input
                    type="number"
                    className={`form-control form-control-sm${errors.renewalNoticeDays ? " is-invalid" : ""}`}
                    {...register("renewalNoticeDays")}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Auto Renew">
                  <div className="form-check techearnest-checkbox-field">
                    <input type="checkbox" className="form-check-input" id="autoRenew" {...register("autoRenew")} />
                  </div>
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
            </TechEarnestCreateGrid>
          </TechEarnestCreateSection>
          <TechEarnestCreateSection title="Description Information">
            <TechEarnestCreateField label="Terms" wide error={errors.terms?.message}>
              <textarea rows={4} className="form-control form-control-sm" {...register("terms")} />
            </TechEarnestCreateField>
          </TechEarnestCreateSection>
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
            <h3>Filter by fields</h3>
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={contractFilterStatusOptions} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search contract statuses" />
            <TechEarnestFilterSelect label="Account" value={accountFilter} onChange={setAccountFilter} options={accountOptions} placeholder="All accounts" emptyLabel="All accounts" searchPlaceholder="Search accounts" />
            <TechEarnestFilterSelect label="Auto renew" value={autoRenewFilter} onChange={(value) => setAutoRenewFilter(value as "" | "true" | "false")} options={autoRenewFilterOptions} placeholder="All" emptyLabel="All" searchPlaceholder="Search options" />
            <ModuleFilterField label="Expiry within (days)" htmlFor="contractExpiryWithinFilter">
              <input
                id="contractExpiryWithinFilter"
                className="form-control form-control-sm"
                type="number"
                value={expiryWithinDays}
                onChange={(e) => setExpiryWithinDays(e.target.value)}
                placeholder="e.g. 30"
              />
            </ModuleFilterField>
          </div>
        </>
      }
      activeFilterCount={activeFilterCount}
      onClearFilters={() => {
        setSearch("");
        setStatusFilter("");
        setAccountFilter("");
        setAutoRenewFilter("");
        setExpiryWithinDays("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {selected ? (
        <div className="border-bottom bg-white p-3">
          {cameFrom ? (
            <button type="button" className="techearnest-record-return mb-2" onClick={() => setSelectedId(null)}>
              <span aria-hidden="true">‹</span> Back to {cameFrom.label || "previous page"}
            </button>
          ) : null}
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
              <h2 className="h6 mb-1">
                {selected.contractNumber ? `${selected.contractNumber} · ` : ""}
                {selected.name}
              </h2>
              <div className="small text-muted d-flex flex-wrap gap-2 align-items-center">
                <StatusBadge status={selected.status} />
                <span>
                  Account{" "}
                  <RecordLink module="account" id={selected.accountId}>
                    {accountName(selected.accountId)}
                  </RecordLink>
                </span>
                {selected.projectId ? (
                  <span>
                    Project{" "}
                    <RecordLink module="project" id={selected.projectId}>
                      {projectsQuery.data?.find((project) => project.id === selected.projectId)?.name ?? "Open project"}
                    </RecordLink>
                  </span>
                ) : null}
                <span>
                  {selected.startDate ?? "—"} – {selected.endDate ?? "—"}
                </span>
                {selected.valueAmount != null ? (
                  <span>
                    {selected.currencyCode} {selected.valueAmount.toLocaleString()}
                  </span>
                ) : null}
                <span>{selected.autoRenew ? `Auto-renews (${selected.renewalNoticeDays}d notice)` : "No auto-renew"}</span>
              </div>
              {selected.terms ? <p className="small mb-0 mt-2">{selected.terms}</p> : null}
            </div>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedId(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
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
          bulk={{
            noun: "contracts",
            exportFileName: "contracts",
            onComplete: () => void queryClient.invalidateQueries({ queryKey: ["contracts"] }),
            actions: [
              {
                id: "delete",
                label: "Delete",
                tone: "danger",
                visible: canManage,
                doneLabel: "deleted",
                confirm: "Deleted contracts disappear from account and project records.",
                run: (contract) => deleteRecord(`/contracts/${contract.id}`),
              },
            ],
          }}
          selectedRowKey={selectedId}
          onRowClick={(contract) => setSelectedId(contract.id)}
          renderCell={(contract, field) => {
            if (field === "accountId")
              return (
                <RecordLink module="account" id={contract.accountId}>
                  {accountName(contract.accountId)}
                </RecordLink>
              );
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
