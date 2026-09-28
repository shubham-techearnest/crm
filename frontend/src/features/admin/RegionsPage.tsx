import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormMoreDetails, FormSection } from "@/components/FormKit";
import {
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
  const [showMore, setShowMore] = useState(false);

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
    photo,
    cancelCreate,
    afterCreateSuccess,
  } = useZohoCreateFlow({
    defaults: REGION_DEFAULTS,
    reset,
    setShowForm,
    setFormError,
    onResetExtras: () => setShowMore(false),
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
    <>
      <FormSection title="Primary details" description="Region identity">
        <div className="col-md-5">
          <FormField label="Name" required error={errors.name} {...register("name")} />
        </div>
        <div className="col-md-3">
          <FormField label="Code" required error={errors.code} {...register("code")} />
        </div>
      </FormSection>
      <FormMoreDetails open={showMore} onToggle={() => setShowMore((v) => !v)}>
        <FormSection title="Hierarchy">
          <div className="col-md-4">
            <label className="form-label">Parent region</label>
            <ZohoFormSelect
              control={control}
              name="parentId"
              options={parentRegionOptions}
              searchPlaceholder="Search Regions"
              placeholder="None"
            />
          </div>
        </FormSection>
      </FormMoreDetails>
    </>
  );

  return (
    <>
      {showForm && canManage ? (
        <ZohoFormKitCreateView
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
          photo={photo}
        >
          {regionFormFields}
        </ZohoFormKitCreateView>
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
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {regionsQuery.isLoading ? <LoadingState label="Loading regions..." /> : null}
      {regionsQuery.error ? <ErrorState title="Unable to load regions" message="Try again." /> : null}

      {!regionsQuery.isLoading && !regionsQuery.error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <div className="module-list-table-wrap">
              <table className="table module-list-table align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Parent</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((region) => (
                    <tr key={region.id}>
                      <td className="lead-name">{region.name}</td>
                      <td>
                        <code>{region.code}</code>
                      </td>
                      <td>
                        <StatusBadge status={region.status} />
                      </td>
                      <td>{parentName(region.parentId)}</td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-5">
                        No regions match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
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
