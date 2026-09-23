import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormActions, FormMoreDetails, FormSection, UnsavedGuard } from "@/components/FormKit";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listRegions } from "@/features/admin/adminApi";
import { getMyFieldAcls } from "@/features/admin/studio/metadataApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import {
  createResource,
  getUtilization,
  listResourceSkills,
  listResources,
  listSkills,
  putResourceSkills,
  type Resource,
  type ResourceSkillItem,
} from "./resourceApi";

const RESOURCE_TYPES = ["EMPLOYEE", "CONTRACTOR", "FREELANCER", "CONSULTANT"] as const;
const PROFICIENCIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;
const RESOURCE_STATUSES = ["AVAILABLE", "ALLOCATED", "ON_LEAVE", "INACTIVE"] as const;

const resourceSchema = z.object({
  regionId: z.string().min(1, "Region is required"),
  resourceType: z.string().min(1, "Type is required"),
  designation: z.string().optional(),
  employeeCode: z.string().optional(),
  capacityHoursPerWeek: z.string().optional(),
  costRate: z.string().optional(),
  billingRate: z.string().optional(),
  status: z.string().optional(),
  joiningDate: z.string().optional(),
});

type ResourceFormValues = z.infer<typeof resourceSchema>;

const RESOURCE_DEFAULTS: ResourceFormValues = {
  regionId: "",
  resourceType: "EMPLOYEE",
  designation: "",
  employeeCode: "",
  capacityHoursPerWeek: "40",
  costRate: "",
  billingRate: "",
  status: "AVAILABLE",
  joiningDate: "",
};

function currentMonthRange(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const periodStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const periodEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { periodStart, periodEnd };
}

function parseOptionalNumber(value?: string): number | undefined {
  if (!value?.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function ResourcesPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("RESOURCE_MANAGE");
  const rateAclQuery = useQuery({
    queryKey: ["metadata", "field-acls", "me", "resource"],
    queryFn: () => getMyFieldAcls("resource"),
    staleTime: 60_000,
    retry: false,
  });
  const canViewRates =
    useHasPermission("RATE_VIEW") ||
    rateAclQuery.data?.costRate === "READ" ||
    rateAclQuery.data?.costRate === "WRITE" ||
    rateAclQuery.data?.billingRate === "READ" ||
    rateAclQuery.data?.billingRate === "WRITE";
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [selected, setSelected] = useState<Resource | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [draftSkills, setDraftSkills] = useState<ResourceSkillItem[]>([]);
  const [newSkillId, setNewSkillId] = useState("");
  const [newProficiency, setNewProficiency] = useState<string>("INTERMEDIATE");
  const [showMore, setShowMore] = useState(false);
  const [saveAndNew, setSaveAndNew] = useState(false);
  const monthRange = useMemo(() => currentMonthRange(), []);

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter || undefined,
      regionId: regionFilter || undefined,
      skillId: skillFilter || undefined,
    }),
    [search, statusFilter, regionFilter, skillFilter],
  );

  const resourcesQuery = useQuery({
    queryKey: ["resources", listParams],
    queryFn: () => listResources(listParams),
  });
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const skillsCatalogQuery = useQuery({
    queryKey: ["skills"],
    queryFn: () => listSkills(),
  });
  const resourceSkillsQuery = useQuery({
    queryKey: ["resources", selected?.id, "skills"],
    queryFn: () => listResourceSkills(selected!.id),
    enabled: !!selected,
  });
  const utilizationQuery = useQuery({
    queryKey: ["resources", selected?.id, "utilization", monthRange.periodStart, monthRange.periodEnd],
    queryFn: () =>
      getUtilization(selected!.id, monthRange.periodStart, monthRange.periodEnd),
    enabled: !!selected,
  });

  useEffect(() => {
    if (resourceSkillsQuery.data) {
      setDraftSkills(
        resourceSkillsQuery.data.map((s) => ({
          skillId: s.skillId,
          proficiency: s.proficiency,
          yearsOfExperience: s.yearsOfExperience,
        })),
      );
    }
  }, [resourceSkillsQuery.data]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceSchema),
    defaultValues: RESOURCE_DEFAULTS,
  });

  const buildResourceBody = (values: ResourceFormValues) => ({
    regionId: values.regionId,
    resourceType: values.resourceType,
    designation: values.designation || undefined,
    employeeCode: values.employeeCode || undefined,
    capacityHoursPerWeek: parseOptionalNumber(values.capacityHoursPerWeek) ?? null,
    costRate: canViewRates ? parseOptionalNumber(values.costRate) ?? null : undefined,
    billingRate: canViewRates ? parseOptionalNumber(values.billingRate) ?? null : undefined,
    status: values.status || "AVAILABLE",
    joiningDate: values.joiningDate || undefined,
  });

  const createMutation = useMutation({
    mutationFn: createResource,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resources"] });
      setFormError(null);
      if (saveAndNew) {
        reset(RESOURCE_DEFAULTS);
        setSaveAndNew(false);
        setShowMore(false);
      } else {
        reset(RESOURCE_DEFAULTS);
        setShowForm(false);
        setShowMore(false);
      }
    },
    onError: () => setFormError("Could not create resource. Check required fields."),
  });

  const skillsMutation = useMutation({
    mutationFn: () => putResourceSkills(selected!.id, { skills: draftSkills }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resources", selected!.id, "skills"] });
      setSkillsError(null);
    },
    onError: () => setSkillsError("Could not update skills."),
  });

  const skillName = (id: string) =>
    skillsCatalogQuery.data?.find((s) => s.id === id)?.name ?? id.slice(0, 8);

  const regionName = (id: string) =>
    regionsQuery.data?.find((r) => r.id === id)?.name ?? id.slice(0, 8);

  const rows = resourcesQuery.data ?? [];
  const activeFilterCount = [search, statusFilter, regionFilter, skillFilter].filter(Boolean).length;

  return (
    <ModuleListShell
      title="Resources"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Resources</span>}
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
            {showForm ? "Cancel" : "Create Resource"}
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Resources by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Code or designation"
            />
          </div>
          <div className="module-filter-section">
            <h3>Filter by fields</h3>
            <label className="form-label small mb-1">Availability</label>
            <select
              className="form-select form-select-sm mb-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              {RESOURCE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <label className="form-label small mb-1">Region</label>
            <select
              className="form-select form-select-sm mb-2"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
            >
              <option value="">All</option>
              {(regionsQuery.data ?? []).map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
            <label className="form-label small mb-1">Skill</label>
            <select
              className="form-select form-select-sm"
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
            >
              <option value="">All</option>
              {(skillsCatalogQuery.data ?? []).map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
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
          onSubmit={handleSubmit((values) => createMutation.mutate(buildResourceBody(values)))}
        >
          <UnsavedGuard when={isDirty && showForm} />
          {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
          <FormSection title="Primary details" description="Region, type, and identity">
            <div className="col-md-3">
              <label className="form-label required">Region</label>
              <select className="form-select" {...register("regionId")}>
                <option value="">Select region</option>
                {(regionsQuery.data ?? []).map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
              {errors.regionId ? (
                <div className="invalid-feedback d-block">{errors.regionId.message}</div>
              ) : null}
            </div>
            <div className="col-md-2">
              <label className="form-label required">Type</label>
              <select className="form-select" {...register("resourceType")}>
                {RESOURCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <FormField label="Designation" error={errors.designation} {...register("designation")} />
            </div>
            <div className="col-md-2">
              <FormField
                label="Employee code"
                error={errors.employeeCode}
                {...register("employeeCode")}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Status</label>
              <select className="form-select" {...register("status")}>
                {RESOURCE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </FormSection>
          <FormMoreDetails open={showMore} onToggle={() => setShowMore((v) => !v)}>
            <FormSection title="Capacity & rates">
              <div className="col-md-3">
                <FormField
                  label="Capacity hrs/week"
                  type="number"
                  error={errors.capacityHoursPerWeek}
                  {...register("capacityHoursPerWeek")}
                />
              </div>
              <div className="col-md-3">
                <FormField label="Joining date" type="date" {...register("joiningDate")} />
              </div>
              {canViewRates ? (
                <>
                  <div className="col-md-3">
                    <FormField
                      label="Cost rate"
                      type="number"
                      error={errors.costRate}
                      {...register("costRate")}
                    />
                  </div>
                  <div className="col-md-3">
                    <FormField
                      label="Billing rate"
                      type="number"
                      error={errors.billingRate}
                      {...register("billingRate")}
                    />
                  </div>
                </>
              ) : null}
            </FormSection>
          </FormMoreDetails>
          <FormActions
            submitLabel="Save"
            showSaveAndNew
            submitting={isSubmitting || createMutation.isPending}
            onSaveAndNew={() => {
              setSaveAndNew(true);
              void handleSubmit((values) => createMutation.mutate(buildResourceBody(values)))();
            }}
            onCancel={() => {
              if (isDirty && !window.confirm("Discard unsaved changes?")) return;
              setShowForm(false);
              setShowMore(false);
              reset(RESOURCE_DEFAULTS);
            }}
          />
        </form>
      ) : null}

      {resourcesQuery.isLoading ? <LoadingState label="Loading resources..." /> : null}
      {resourcesQuery.error ? <ErrorState title="Unable to load resources" message="Try again." /> : null}

      {!resourcesQuery.isLoading && !resourcesQuery.error ? (
        <div
          className={selected ? "module-list-split" : undefined}
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
        >
          {viewMode === "list" ? (
            <div className="module-list-table-wrap">
              <table className="table module-list-table align-middle">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Designation</th>
                    <th>Type</th>
                    <th>Region</th>
                    <th>Capacity</th>
                    <th>Status</th>
                    {canViewRates ? <th>Rates</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((resource) => (
                    <tr
                      key={resource.id}
                      className={selected?.id === resource.id ? "is-selected" : undefined}
                      onClick={() => {
                        setSelected(resource);
                        setSkillsError(null);
                      }}
                    >
                      <td className="lead-name">{resource.employeeCode ?? "—"}</td>
                      <td>{resource.designation ?? "—"}</td>
                      <td>{resource.resourceType}</td>
                      <td>{regionName(resource.regionId)}</td>
                      <td>
                        {resource.capacityHoursPerWeek != null
                          ? `${resource.capacityHoursPerWeek}h`
                          : "—"}
                      </td>
                      <td>
                        <StatusBadge status={resource.status} />
                      </td>
                      {canViewRates ? (
                        <td className="small">
                          {resource.costRate != null || resource.billingRate != null
                            ? `C ${resource.costRate ?? "—"} / B ${resource.billingRate ?? "—"}`
                            : "—"}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={canViewRates ? 7 : 6} className="text-center text-muted py-5">
                        No resources match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="module-tile-grid">
              {rows.map((resource) => (
                <button
                  key={resource.id}
                  type="button"
                  className={`module-tile text-start${selected?.id === resource.id ? " is-selected" : ""}`}
                  onClick={() => {
                    setSelected(resource);
                    setSkillsError(null);
                  }}
                >
                  <div className="tile-title">
                    {resource.designation ?? resource.employeeCode ?? "Resource"}
                  </div>
                  <div className="small text-muted">
                    {resource.resourceType} · {resource.status}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selected ? (
            <aside className="module-detail-drawer">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <div className="fw-semibold">
                    {selected.designation ?? selected.employeeCode ?? "Resource"}
                  </div>
                  <div className="text-muted small">
                    {selected.employeeCode ?? selected.id.slice(0, 8)} · {selected.resourceType}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
              <p className="small mb-3">
                Status: <StatusBadge status={selected.status} />
              </p>

              <div className="border rounded p-2 mb-3 bg-light">
                <h2 className="h6 mb-2">
                  Utilization ({monthRange.periodStart} → {monthRange.periodEnd})
                </h2>
                {utilizationQuery.isLoading ? (
                  <p className="small text-muted mb-0">Loading utilization…</p>
                ) : utilizationQuery.data ? (
                  <dl className="row small mb-0">
                    <dt className="col-6">Capacity</dt>
                    <dd className="col-6 mb-1">{utilizationQuery.data.capacityHours ?? "—"}h</dd>
                    <dt className="col-6">Allocated</dt>
                    <dd className="col-6 mb-1">{utilizationQuery.data.allocatedHours ?? "—"}h</dd>
                    <dt className="col-6">Available</dt>
                    <dd className="col-6 mb-1">{utilizationQuery.data.availableHours ?? "—"}h</dd>
                    <dt className="col-6">Utilization</dt>
                    <dd className="col-6 mb-1">
                      {utilizationQuery.data.utilizationPercent != null
                        ? `${utilizationQuery.data.utilizationPercent}%`
                        : "—"}
                      {utilizationQuery.data.overAllocated ? (
                        <span className="badge bg-danger ms-1">OVER ALLOCATED</span>
                      ) : null}
                    </dd>
                    {utilizationQuery.data.warning ? (
                      <>
                        <dt className="col-6">Warning</dt>
                        <dd className="col-6 mb-0">{utilizationQuery.data.warning}</dd>
                      </>
                    ) : null}
                  </dl>
                ) : (
                  <p className="small text-muted mb-0">No utilization data</p>
                )}
              </div>

              <h2 className="h6">Skills</h2>
              {skillsError ? <div className="alert alert-danger py-2">{skillsError}</div> : null}
              <ul className="list-unstyled small mb-2">
                {draftSkills.map((item) => (
                  <li key={item.skillId} className="d-flex justify-content-between align-items-center mb-1">
                    <span>
                      {skillName(item.skillId)} — {item.proficiency}
                    </span>
                    {canManage ? (
                      <button
                        type="button"
                        className="btn btn-link btn-sm text-danger p-0"
                        onClick={() =>
                          setDraftSkills((prev) => prev.filter((s) => s.skillId !== item.skillId))
                        }
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                ))}
                {!draftSkills.length ? <li className="text-muted">No skills assigned</li> : null}
              </ul>

              {canManage ? (
                <>
                  <div className="row g-2 mb-2">
                    <div className="col-7">
                      <select
                        className="form-select form-select-sm"
                        value={newSkillId}
                        onChange={(e) => setNewSkillId(e.target.value)}
                      >
                        <option value="">Add skill…</option>
                        {(skillsCatalogQuery.data ?? [])
                          .filter((s) => !draftSkills.some((d) => d.skillId === s.id))
                          .map((skill) => (
                            <option key={skill.id} value={skill.id}>
                              {skill.name}
                              {skill.category ? ` (${skill.category})` : ""}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="col-5">
                      <select
                        className="form-select form-select-sm"
                        value={newProficiency}
                        onChange={(e) => setNewProficiency(e.target.value)}
                      >
                        {PROFICIENCIES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      disabled={!newSkillId}
                      onClick={() => {
                        if (!newSkillId) return;
                        setDraftSkills((prev) => [
                          ...prev,
                          { skillId: newSkillId, proficiency: newProficiency },
                        ]);
                        setNewSkillId("");
                      }}
                    >
                      Add to list
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={skillsMutation.isPending}
                      onClick={() => skillsMutation.mutate()}
                    >
                      Save skills
                    </button>
                  </div>
                </>
              ) : null}
            </aside>
          ) : null}
        </div>
      ) : null}
    </ModuleListShell>
  );
}
