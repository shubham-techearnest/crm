import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormMoreDetails, FormSection } from "@/components/FormKit";
import {
  enumPickerOptions,
  optionsFromPairs,
  ZohoFormKitCreateView,
  ZohoFormSelect,
  useZohoCreateFlow,
} from "@/components/ZohoCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import {
  ModuleListShell,
  countActiveFilters,
} from "@/components/ModuleListShell/ModuleListShell";
import {
  RecordShell,
  DEFAULT_RELATED_LINKS,
  RecordOverviewField,
  RecordOverviewGrid,
  RecordSection,
  recordCustomTab,
  recordOverviewTab,
  recordTimelineTab,
} from "@/components/RecordShell";
import { buildTimelineEntries, recordLifecycleInfo, useRecordNavigation, ZohoRecordTimeline } from "@/components/ZohoRecord";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listRegions } from "@/features/admin/adminApi";
import { getMyFieldAcls } from "@/features/admin/studio/metadataApi";
import { listActivities } from "@/features/crm/crmApi";
import { listProjects, listTasks } from "@/features/projects/projectApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import {
  createResource,
  getUtilization,
  listAllocations,
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

const resourceTypeOptions = enumPickerOptions(RESOURCE_TYPES);
const resourceStatusOptions = enumPickerOptions(RESOURCE_STATUSES);

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

function formatRate(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ResourcesPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("RESOURCE_MANAGE");
  const canViewAllocations = useHasPermission("ALLOCATION_VIEW");
  const canViewProjects = useHasPermission("PROJECT_VIEW");
  const canViewTasks = useHasPermission("TASK_VIEW");
  const canViewActivities = useHasPermission("ACTIVITY_VIEW");
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
  const allocationsQuery = useQuery({
    queryKey: ["allocations", "resource", selected?.id],
    queryFn: () => listAllocations({ resourceId: selected!.id }),
    enabled: !!selected && (canViewAllocations || canViewProjects),
  });
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
    enabled: !!selected && canViewProjects,
  });
  const assignedTasksQuery = useQuery({
    queryKey: ["tasks", "resource", selected?.id],
    queryFn: () => listTasks({ assignedResourceId: selected!.id }),
    enabled: !!selected && canViewTasks,
  });
  const activitiesQuery = useQuery({
    queryKey: ["crm", "activities", "RESOURCE", selected?.id],
    queryFn: () => listActivities({ relatedEntityType: "RESOURCE", relatedEntityId: selected!.id }),
    enabled: !!selected && canViewActivities,
  });

  const timelineEntries = useMemo(
    () =>
      buildTimelineEntries(
        undefined,
        activitiesQuery.data,
        undefined,
        recordLifecycleInfo("Resource", selected ? { ...selected, ownerId: selected.userId } : null),
      ),
    [activitiesQuery.data, selected],
  );

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
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceSchema),
    defaultValues: RESOURCE_DEFAULTS,
  });

  const {
    setSaveAndNew,
    photo,
    cancelCreate,
    afterCreateSuccess,
  } = useZohoCreateFlow({
    defaults: RESOURCE_DEFAULTS,
    reset,
    setShowForm,
    setFormError,
    setSelected: (entity) => setSelected(entity as Resource),
    onResetExtras: () => setShowMore(false),
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
    onSuccess: async (resource) => {
      await queryClient.invalidateQueries({ queryKey: ["resources"] });
      setFormError(null);
      await afterCreateSuccess(resource, "RESOURCE");
    },
    onError: () => setFormError("Could not create resource. Check required fields."),
  });

  const onCreateSubmit = (values: ResourceFormValues) => {
    createMutation.mutate(buildResourceBody(values));
  };

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
  const recordNav = useRecordNavigation(rows, selected, setSelected);
  const activeFilterCount = countActiveFilters(search, statusFilter, regionFilter, skillFilter);

  const projectName = useMemo(() => {
    const map = new Map((projectsQuery.data ?? []).map((project) => [project.id, project.name]));
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [projectsQuery.data]);

  const relatedProjects = useMemo(() => {
    const projectIds = new Set((allocationsQuery.data ?? []).map((allocation) => allocation.projectId));
    return (projectsQuery.data ?? []).filter((project) => projectIds.has(project.id));
  }, [allocationsQuery.data, projectsQuery.data]);

  const regionOptions = useMemo(
    () =>
      optionsFromPairs(
        (regionsQuery.data ?? []).map((region) => ({ value: region.id, label: region.name })),
      ),
    [regionsQuery.data],
  );

  return (
    <>
      {showForm && canManage ? (
        <ZohoFormKitCreateView
          title="Create Resource"
          tableCode="resource"
          entityLabel="Resource"
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
          <FormSection title="Primary details" description="Region, type, and identity">
            <div className="col-md-3">
              <label className="form-label required">Region</label>
              <ZohoFormSelect
                control={control}
                name="regionId"
                options={regionOptions}
                searchPlaceholder="Search Regions"
                allowEmpty={false}
                placeholder="Select region"
                invalid={!!errors.regionId}
              />
              {errors.regionId ? (
                <div className="invalid-feedback d-block">{errors.regionId.message}</div>
              ) : null}
            </div>
            <div className="col-md-2">
              <label className="form-label required">Type</label>
              <ZohoFormSelect
                control={control}
                name="resourceType"
                options={resourceTypeOptions}
                searchPlaceholder="Search Types"
                allowEmpty={false}
                invalid={!!errors.resourceType}
              />
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
              <ZohoFormSelect
                control={control}
                name="status"
                options={resourceStatusOptions}
                searchPlaceholder="Search Statuses"
                allowEmpty={false}
              />
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
        </ZohoFormKitCreateView>
      ) : selected ? (
        <RecordShell
              title={selected.designation ?? selected.employeeCode ?? "Resource"}
              subtitle={selected.employeeCode ?? selected.id.slice(0, 8)}
              meta={
                <span className="text-muted small">
                  {regionName(selected.regionId)} · {selected.resourceType}
                </span>
              }
              status={<StatusBadge status={selected.status} />}
              recordKey={selected.id}
              layout="page"
              avatarLabel={selected.designation ?? selected.employeeCode ?? "Resource"}
              onBack={recordNav.goBack}
              onPrev={recordNav.goPrev}
              onNext={recordNav.goNext}
              hasPrev={recordNav.hasPrev}
              hasNext={recordNav.hasNext}
              relatedLinks={[...DEFAULT_RELATED_LINKS]}
              tabs={[
                recordOverviewTab(
                  <RecordOverviewGrid>
                    <RecordOverviewField label="Status" value={<StatusBadge status={selected.status} />} />
                    <RecordOverviewField label="Type" value={selected.resourceType} />
                    <RecordOverviewField label="Region" value={regionName(selected.regionId)} />
                    <RecordOverviewField label="Employee code" value={selected.employeeCode ?? "—"} />
                    <RecordOverviewField label="Designation" value={selected.designation ?? "—"} />
                    <RecordOverviewField
                      label="Capacity"
                      value={
                        selected.capacityHoursPerWeek != null
                          ? `${selected.capacityHoursPerWeek} hrs/week`
                          : "—"
                      }
                    />
                    <RecordOverviewField label="Joining date" value={selected.joiningDate ?? "—"} />
                    {canViewRates ? (
                      <>
                        <RecordOverviewField label="Cost rate" value={formatRate(selected.costRate)} />
                        <RecordOverviewField
                          label="Billing rate"
                          value={formatRate(selected.billingRate)}
                        />
                      </>
                    ) : null}
                    <RecordOverviewField
                      label="Skills"
                      value={
                        resourceSkillsQuery.isLoading
                          ? "Loading…"
                          : `${resourceSkillsQuery.data?.length ?? draftSkills.length} assigned`
                      }
                    />
                    <RecordOverviewField
                      label="Utilization (this month)"
                      value={
                        utilizationQuery.isLoading
                          ? "Loading…"
                          : utilizationQuery.data?.utilizationPercent != null
                            ? `${utilizationQuery.data.utilizationPercent}%`
                            : "—"
                      }
                    />
                  </RecordOverviewGrid>,
                ),
                recordCustomTab(
                  "skills",
                  "Skills",
                  <>
                    {skillsError ? <div className="alert alert-danger py-2">{skillsError}</div> : null}
                    {resourceSkillsQuery.isLoading ? (
                      <LoadingState label="Loading skills…" workspace />
                    ) : null}
                    <ul className="list-unstyled small mb-2">
                      {draftSkills.map((item) => (
                        <li
                          key={item.skillId}
                          className="d-flex justify-content-between align-items-center mb-1"
                        >
                          <span>
                            {skillName(item.skillId)} — {item.proficiency}
                            {item.yearsOfExperience != null
                              ? ` · ${item.yearsOfExperience} yrs`
                              : ""}
                          </span>
                          {canManage ? (
                            <button
                              type="button"
                              className="btn btn-link btn-sm text-danger p-0"
                              onClick={() =>
                                setDraftSkills((prev) =>
                                  prev.filter((skill) => skill.skillId !== item.skillId),
                                )
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
                              onChange={(event) => setNewSkillId(event.target.value)}
                            >
                              <option value="">Add skill…</option>
                              {(skillsCatalogQuery.data ?? [])
                                .filter((skill) => !draftSkills.some((draft) => draft.skillId === skill.id))
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
                              onChange={(event) => setNewProficiency(event.target.value)}
                            >
                              {PROFICIENCIES.map((proficiency) => (
                                <option key={proficiency} value={proficiency}>
                                  {proficiency}
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
                  </>,
                ),
                recordCustomTab(
                  "utilization",
                  "Utilization",
                  <div className="border rounded p-2 bg-light">
                    <h2 className="h6 mb-2">
                      Utilization ({monthRange.periodStart} → {monthRange.periodEnd})
                    </h2>
                    {utilizationQuery.isLoading ? (
                      <LoadingState label="Loading utilization…" workspace />
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
                  </div>,
                ),
                recordCustomTab(
                  "allocations",
                  "Allocations",
                  <>
                    {allocationsQuery.isLoading ? (
                      <LoadingState label="Loading allocations…" workspace />
                    ) : null}
                    <ul className="list-unstyled small mb-0">
                      {(allocationsQuery.data ?? []).map((allocation) => (
                        <li key={allocation.id} className="mb-2">
                          <div className="fw-semibold">{projectName(allocation.projectId)}</div>
                          <div>
                            <StatusBadge status={allocation.status} />
                            {allocation.role ? (
                              <span className="text-muted"> · {allocation.role}</span>
                            ) : null}
                          </div>
                          <div className="text-muted">
                            {allocation.startDate} – {allocation.endDate}
                            {allocation.allocationPercentage != null
                              ? ` · ${allocation.allocationPercentage}%`
                              : ""}
                            {allocation.allocatedHours != null
                              ? ` · ${allocation.allocatedHours}h`
                              : ""}
                          </div>
                          {allocation.warning ? (
                            <div className="text-warning">{allocation.warning}</div>
                          ) : null}
                        </li>
                      ))}
                      {!allocationsQuery.data?.length ? (
                        <li className="text-muted">No allocations</li>
                      ) : null}
                    </ul>
                    {canViewAllocations ? (
                      <Link className="small" to="/allocations">
                        Open Allocations
                      </Link>
                    ) : null}
                  </>,
                  { visible: canViewAllocations },
                ),
                recordCustomTab(
                  "projects",
                  "Projects",
                  <>
                    {projectsQuery.isLoading || allocationsQuery.isLoading ? (
                      <LoadingState label="Loading projects…" workspace />
                    ) : null}
                    <RecordSection title={`Allocated projects (${relatedProjects.length})`}>
                      <ul className="list-unstyled small mb-0">
                        {relatedProjects.map((project) => (
                          <li key={project.id} className="mb-2">
                            <div className="fw-semibold">{project.name}</div>
                            <div>
                              <StatusBadge status={project.status} />
                              {project.health ? (
                                <span className="ms-1">
                                  <StatusBadge status={project.health} />
                                </span>
                              ) : null}
                            </div>
                            <div className="text-muted">
                              {project.projectCode}
                              {project.progressPercent != null
                                ? ` · ${project.progressPercent}% complete`
                                : ""}
                            </div>
                          </li>
                        ))}
                        {!relatedProjects.length ? (
                          <li className="text-muted">No allocated projects</li>
                        ) : null}
                      </ul>
                      {canViewProjects ? (
                        <Link className="small" to="/projects">
                          Open Projects
                        </Link>
                      ) : null}
                    </RecordSection>
                    {canViewTasks ? (
                      <RecordSection title={`Assigned tasks (${assignedTasksQuery.data?.length ?? 0})`}>
                        {assignedTasksQuery.isLoading ? (
                          <LoadingState label="Loading tasks…" workspace />
                        ) : null}
                        <ul className="list-unstyled small mb-0">
                          {(assignedTasksQuery.data ?? []).map((task) => (
                            <li key={task.id} className="mb-1">
                              {task.name} — <StatusBadge status={task.status} />
                              {task.dueDate ? ` · due ${task.dueDate}` : ""}
                            </li>
                          ))}
                          {!assignedTasksQuery.data?.length ? (
                            <li className="text-muted">No assigned tasks</li>
                          ) : null}
                        </ul>
                        <Link className="small" to="/tasks">
                          Open Tasks
                        </Link>
                      </RecordSection>
                    ) : null}
                  </>,
                  { visible: canViewProjects || canViewTasks },
                ),
                recordTimelineTab(<ZohoRecordTimeline entries={timelineEntries} />, {
                  visible: canViewActivities,
                  id: "timeline",
                }),
              ]}
            />

      ) : (
    <ModuleListShell
      title="Resources"
      filterOpen={filterOpen}
      activeFilterCount={activeFilterCount}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Resources</span>}
      filterToggle={{ onToggle: () => setFilterOpen((open) => !open) }}
      primaryAction={
        canManage ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              reset(RESOURCE_DEFAULTS);
              setShowMore(false);
              setShowForm(true);
            }}
          >
            Create Resource
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
      recordCount={rows.length}
    >
      {resourcesQuery.isLoading ? <LoadingState label="Loading resources..." /> : null}
      {resourcesQuery.error ? <ErrorState title="Unable to load resources" message="Try again." /> : null}

      {!resourcesQuery.isLoading && !resourcesQuery.error ? (
        <div
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

        </div>
      ) : null}
    </ModuleListShell>
      )}
    </>
  );
}
