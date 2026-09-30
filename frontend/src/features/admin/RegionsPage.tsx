import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  optionsFromPairs,
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
import { TechEarnestFilterSelect } from "@/components/TechEarnestCreate/TechEarnestFilterSelect";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { createRegion, listRegions } from "./adminApi";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").max(32),
  parentId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const REGION_DEFAULTS: FormValues = { name: "", code: "", parentId: "" };

export function RegionsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("REGION_MANAGE");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: REGION_DEFAULTS,
  });

  const {
    setSaveAndNew,
    cancelCreate,
    afterCreateSuccess,
  } = useTechEarnestCreateFlow({
    defaults: REGION_DEFAULTS,
    reset,
    setShowForm,
    setFormError,
  });

  const buildBody = (values: FormValues) => ({
    name: values.name,
    code: values.code,
    parentId: values.parentId || null,
  });

  const createMutation = useMutation({
    mutationFn: createRegion,
    onSuccess: async (region) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "regions"] });
      setFormError(null);
      await afterCreateSuccess(region, "REGION");
    },
    onError: () => setFormError("Could not create region. Check the code is unique."),
  });

  const onCreateSubmit = (values: FormValues) => {
    createMutation.mutate(buildBody(values));
  };

  function openCreate() {
    reset(REGION_DEFAULTS);
    setShowForm(true);
  }

  const parentName = useMemo(() => {
    const map = new Map((regionsQuery.data ?? []).map((r) => [r.id, r.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "—");
  }, [regionsQuery.data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (regionsQuery.data ?? []).filter((region) => {
      if (statusFilter && region.status !== statusFilter) return false;
      if (!q) return true;
      return (
        region.name.toLowerCase().includes(q) ||
        region.code.toLowerCase().includes(q) ||
        parentName(region.parentId).toLowerCase().includes(q)
      );
    });
  }, [regionsQuery.data, search, statusFilter, parentName]);

  const parentRegionOptions = useMemo(
    () => optionsFromPairs((regionsQuery.data ?? []).map((r) => ({ value: r.id, label: r.name }))),
    [regionsQuery.data],
  );

  const regionFormFields = (
    <TechEarnestCreateSection title="Region Information">
      <TechEarnestCreateGrid>
        <TechEarnestCreateColumn>
          <TechEarnestCreateField label="Region Name" required error={errors.name?.message}>
            <input
              type="text"
              className={`form-control form-control-sm${errors.name ? " is-invalid" : ""}`}
              {...register("name")}
            />
          </TechEarnestCreateField>
          <TechEarnestCreateField label="Region Code" required error={errors.code?.message}>
            <input
              type="text"
              className={`form-control form-control-sm${errors.code ? " is-invalid" : ""}`}
              {...register("code")}
            />
          </TechEarnestCreateField>
        </TechEarnestCreateColumn>
        <TechEarnestCreateColumn>
          <TechEarnestCreateField label="Parent Region" error={errors.parentId?.message}>
            <TechEarnestFormSelect
              control={control}
              name="parentId"
              options={parentRegionOptions}
              searchPlaceholder="Search Regions"
              placeholder="None"
            />
          </TechEarnestCreateField>
        </TechEarnestCreateColumn>
      </TechEarnestCreateGrid>
    </TechEarnestCreateSection>
  );

  return (
    <>
      {showForm && canManage ? (
        <TechEarnestFormKitCreateView
          title="Create Region"
          entityLabel="Region"
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
          {regionFormFields}
        </TechEarnestFormKitCreateView>
      ) : (
    <ModuleListShell
      title="Regions"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Regions</span>}
      toolbarActions={
        <button
          type="button"
          className={`btn btn-sm ${filterOpen ? "btn-primary" : "btn-outline-secondary"}`}
          onClick={() => setFilterOpen((o) => !o)}
        >
          Filter
        </button>
      }
      primaryAction={
        canManage ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openCreate()}>
            Add region
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Regions by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, code, or parent"
            />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search region statuses" />
          </div>
        </>
      }
      activeFilterCount={[search.trim(), statusFilter].filter(Boolean).length}
      onClearFilters={() => {
        setSearch("");
        setStatusFilter("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {regionsQuery.isLoading ? <LoadingState label="Loading regions..." /> : null}
      {regionsQuery.error ? <ErrorState title="Unable to load regions" message="Try again." /> : null}

      {!regionsQuery.isLoading && !regionsQuery.error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <ModuleListTable
              tableCode="region"
              defaultColumns={[
                { field: "name", label: "Name" },
                { field: "code", label: "Code" },
                { field: "status", label: "Status" },
                { field: "parentId", label: "Parent" },
              ]}
              rows={rows}
              rowKey={(region) => region.id}
              renderCell={(region, field) => {
                if (field === "code") return <code>{region.code}</code>;
                if (field === "status") return <StatusBadge status={region.status} />;
                if (field === "parentId") return parentName(region.parentId);
                const value = (region as unknown as Record<string, unknown>)[field];
                return value == null || value === "" ? "—" : String(value);
              }}
              nameFields={["name"]}
              emptyMessage="No regions match the current filters."
            />
          ) : (
            <div className="module-tile-grid">
              {rows.map((region) => (
                <div key={region.id} className="module-tile text-start">
                  <div className="tile-title">{region.name}</div>
                  <div className="small text-muted">
                    {region.code} · {region.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </ModuleListShell>
      )}
    </>
  );
}
