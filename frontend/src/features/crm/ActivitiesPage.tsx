import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useSearchParams } from "react-router-dom";
import { EntityRecordLink, useEntityNames } from "@/components/RecordLink";
import { readRecordNavState, useUrlRecordId } from "@/hooks/useUrlRecord";
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
import {
  ModuleFilterDateRange,
  ModuleFilterField,
  ModuleListShell,
} from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listUsers } from "@/features/admin/adminApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { completeActivity, createActivity, getActivity, listActivities, updateActivity } from "./crmApi";

const ENTITY_TYPES = ["LEAD", "ACCOUNT", "CONTACT", "DEAL"] as const;
const ACTIVITY_TYPES = ["TASK", "CALL", "MEETING", "NOTE", "FOLLOW_UP"] as const;

const activityTypeOptions = enumPickerOptions(ACTIVITY_TYPES);
const entityTypeOptions = enumPickerOptions(ENTITY_TYPES);
const activityFilterStatusOptions = enumPickerOptions(["OPEN", "COMPLETED"]);
const activityPriorityOptions = enumPickerOptions(["LOW", "MEDIUM", "HIGH"] as const);
const ACTIVITY_LIST_COLUMNS = [
  { field: "subject", label: "Subject" },
  { field: "type", label: "Type" },
  { field: "relatedEntityId", label: "Related" },
  { field: "dueDate", label: "Due" },
  { field: "status", label: "Status" },
];
const callDirectionOptions = optionsFromPairs([
  { value: "", label: "—" },
  { value: "INBOUND", label: "INBOUND" },
  { value: "OUTBOUND", label: "OUTBOUND" },
]);

const schema = z.object({
  type: z.string().min(1, "Required"),
  subject: z.string().min(1, "Required"),
  description: z.string().optional(),
  priority: z.string().optional(),
  relatedEntityType: z.string().min(1, "Required"),
  relatedEntityId: z.string().uuid("Enter a valid UUID"),
  dueDate: z.string().optional(),
  location: z.string().optional(),
  attendees: z.string().optional(),
  outcome: z.string().optional(),
  callDirection: z.string().optional(),
  durationSeconds: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function activityDefaults(typeFilter: string): FormValues {
  return {
    type:
      typeFilter && ACTIVITY_TYPES.includes(typeFilter as (typeof ACTIVITY_TYPES)[number]) ? typeFilter : "TASK",
    subject: "",
    description: "",
    priority: "MEDIUM",
    relatedEntityType: "LEAD",
    relatedEntityId: "",
    dueDate: "",
    location: "",
    attendees: "",
    outcome: "",
    callDirection: "",
    durationSeconds: "",
  };
}

export function ActivitiesPage() {
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const typeFromUrl = params.get("type")?.toUpperCase() ?? "";
  const auth = useAuth();
  const canCreate = useHasPermission("ACTIVITY_CREATE");
  const canUpdate = useHasPermission("ACTIVITY_UPDATE");
  const canComplete = useHasPermission("ACTIVITY_COMPLETE");
  const canViewUsers = useHasPermission("USER_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [typeFilter, setTypeFilter] = useState(typeFromUrl);
  const [statusFilter, setStatusFilter] = useState("");
  const [relatedTypeFilter, setRelatedTypeFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useUrlRecordId();
  const location = useLocation();
  const [editSubject, setEditSubject] = useState("");
  const [editPriority, setEditPriority] = useState("MEDIUM");
  const [editDueDate, setEditDueDate] = useState("");
  const [editOutcome, setEditOutcome] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editAttendees, setEditAttendees] = useState("");
  const [editDirection, setEditDirection] = useState("");
  const [manageError, setManageError] = useState<string | null>(null);

  useEffect(() => {
    setTypeFilter(typeFromUrl);
  }, [typeFromUrl]);

  useEffect(() => {
    if (params.get("create") === "1") setShowForm(true);
  }, [params, setShowForm]);

  const title =
    typeFilter === "TASK"
      ? "Tasks"
      : typeFilter === "MEETING"
        ? "Meetings"
        : typeFilter === "CALL"
          ? "Calls"
          : "Activities";

  const listParams = useMemo(
    () => ({
      type: typeFilter || undefined,
      status: statusFilter || undefined,
      relatedEntityType: relatedTypeFilter || undefined,
      assignedTo: assigneeFilter || undefined,
      outcome: outcomeFilter || undefined,
      callDirection: directionFilter || undefined,
      dueFrom: dueFrom ? new Date(dueFrom).toISOString() : undefined,
      dueTo: dueTo ? new Date(`${dueTo}T23:59:59.999Z`).toISOString() : undefined,
    }),
    [typeFilter, statusFilter, relatedTypeFilter, assigneeFilter, outcomeFilter, directionFilter, dueFrom, dueTo],
  );

  const activitiesQuery = useQuery({
    queryKey: ["crm", "activities", listParams],
    queryFn: () => listActivities(listParams),
  });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: canViewUsers,
  });
  const relatedRefs = useMemo(
    () =>
      (activitiesQuery.data ?? []).map((activity) => ({
        entityType: activity.relatedEntityType,
        entityId: activity.relatedEntityId,
      })),
    [activitiesQuery.data],
  );
  const entityName = useEntityNames(relatedRefs);
  const relatedLabel = (activity: { relatedEntityType: string; relatedEntityId: string }) =>
    entityName(activity.relatedEntityType, activity.relatedEntityId);
  const assigneeFilterOptions = useMemo(
    () => optionsFromPairs([
      ...(auth.userId ? [{ value: auth.userId, label: "Current user" }] : []),
      ...(usersQuery.data ?? []).map((user) => ({ value: user.id, label: `${user.firstName} ${user.lastName}`.trim(), subtitle: user.email })),
    ]),
    [auth.userId, usersQuery.data],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (activitiesQuery.data ?? []).filter((a) => !q || a.subject.toLowerCase().includes(q));
  }, [activitiesQuery.data, search]);

  const activeFilterCount = [
    search,
    typeFilter,
    statusFilter,
    relatedTypeFilter,
    assigneeFilter,
    outcomeFilter,
    directionFilter,
    dueFrom,
    dueTo,
  ].filter(Boolean).length;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: activityDefaults(typeFilter),
  });

  const {
    setSaveAndNew,
    cancelCreate,
    afterCreateSuccess,
  } = useTechEarnestCreateFlow({
    defaults: activityDefaults(typeFilter),
    reset,
    setShowForm,
    setFormError,
    setSelected: (entity) => setSelectedId(entity.id),
  });

  const watchedType = useWatch({ control, name: "type" });

  function buildActivityBody(values: FormValues) {
    return {
      type: values.type,
      subject: values.subject,
      description: values.description || undefined,
      priority: values.priority || undefined,
      relatedEntityType: values.relatedEntityType,
      relatedEntityId: values.relatedEntityId,
      dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
      location: values.location || undefined,
      attendees: values.attendees || undefined,
      outcome: values.outcome || undefined,
      callDirection: values.callDirection || undefined,
      durationSeconds: values.durationSeconds ? Number(values.durationSeconds) : undefined,
    };
  }

  const createMutation = useMutation({
    mutationFn: createActivity,
    onSuccess: async (activity) => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "activities"] });
      setFormError(null);
      await afterCreateSuccess(activity, "ACTIVITY");
    },
    onError: () => setFormError("Could not create activity. Check the related entity id."),
  });

  const onCreateSubmit = (values: FormValues) => {
    createMutation.mutate(buildActivityBody(values));
  };

  const completeMutation = useMutation({
    mutationFn: completeActivity,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "activities"] });
    },
  });

  const selectedFromRows = useMemo(
    () => (activitiesQuery.data ?? []).find((activity) => activity.id === selectedId) ?? null,
    [activitiesQuery.data, selectedId],
  );
  const selectedFetchQuery = useQuery({
    queryKey: ["crm", "activities", "record", selectedId],
    queryFn: () => getActivity(selectedId!),
    enabled: !!selectedId && !!activitiesQuery.data && !selectedFromRows,
    retry: false,
  });
  const selected = selectedFromRows ?? (selectedFetchQuery.data?.id === selectedId ? selectedFetchQuery.data : null);
  const cameFrom = readRecordNavState(location.state)?.from;
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected?.id) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) {
      return;
    }
    setEditSubject(selected.subject);
    setEditPriority(selected.priority ?? "MEDIUM");
    setEditDueDate(selected.dueDate ? selected.dueDate.slice(0, 10) : "");
    setEditOutcome(selected.outcome ?? "");
    setEditLocation(selected.location ?? "");
    setEditAttendees(selected.attendees ?? "");
    setEditDirection(selected.callDirection ?? "");
    setManageError(null);
  }, [selected]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateActivity(selectedId!, {
        type: selected!.type,
        subject: editSubject.trim(),
        description: selected!.description ?? undefined,
        status: selected!.status,
        priority: editPriority,
        dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
        assignedTo: selected!.assignedTo,
        location: editLocation || undefined,
        attendees: editAttendees || undefined,
        outcome: editOutcome || undefined,
        callDirection: editDirection || undefined,
        durationSeconds: selected!.durationSeconds ?? undefined,
      }),
    onSuccess: async () => {
      setManageError(null);
      await queryClient.invalidateQueries({ queryKey: ["crm", "activities"] });
    },
    onError: () => setManageError("Could not update activity."),
  });

  const createLabel = title.replace(/s$/, "");

  return (
    <>
      {showForm && canCreate ? (
        <TechEarnestFormKitCreateView
          title={`Create ${createLabel}`}
          tableCode="activity"
          entityLabel={createLabel}
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
          <TechEarnestCreateSection title={`${createLabel} Information`}>
            <TechEarnestCreateGrid>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Subject" required error={errors.subject?.message}>
                  <input
                    type="text"
                    className={`form-control form-control-sm${errors.subject ? " is-invalid" : ""}`}
                    {...register("subject")}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Type" required error={errors.type?.message}>
                  <TechEarnestFormSelect
                    control={control}
                    name="type"
                    options={activityTypeOptions}
                    searchPlaceholder="Search Types"
                    allowEmpty={false}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Related To" required error={errors.relatedEntityType?.message}>
                  <TechEarnestFormSelect
                    control={control}
                    name="relatedEntityType"
                    options={entityTypeOptions}
                    searchPlaceholder="Search Entity Types"
                    allowEmpty={false}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Related Record ID" required error={errors.relatedEntityId?.message}>
                  <input
                    type="text"
                    className={`form-control form-control-sm${errors.relatedEntityId ? " is-invalid" : ""}`}
                    {...register("relatedEntityId")}
                  />
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
              <TechEarnestCreateColumn>
                <TechEarnestCreateField label="Priority" error={errors.priority?.message}>
                  <TechEarnestFormSelect
                    control={control}
                    name="priority"
                    options={activityPriorityOptions}
                    searchPlaceholder="Search Priorities"
                    allowEmpty={false}
                  />
                </TechEarnestCreateField>
                <TechEarnestCreateField label="Due Date" error={errors.dueDate?.message}>
                  <input
                    type="date"
                    className={`form-control form-control-sm${errors.dueDate ? " is-invalid" : ""}`}
                    {...register("dueDate")}
                  />
                </TechEarnestCreateField>
              </TechEarnestCreateColumn>
            </TechEarnestCreateGrid>
          </TechEarnestCreateSection>
          {watchedType === "MEETING" ? (
            <TechEarnestCreateSection title="Meeting Details">
              <TechEarnestCreateGrid>
                <TechEarnestCreateColumn>
                  <TechEarnestCreateField label="Location" error={errors.location?.message}>
                    <input type="text" className="form-control form-control-sm" {...register("location")} />
                  </TechEarnestCreateField>
                  <TechEarnestCreateField label="Attendees" error={errors.attendees?.message}>
                    <input type="text" className="form-control form-control-sm" {...register("attendees")} />
                  </TechEarnestCreateField>
                </TechEarnestCreateColumn>
                <TechEarnestCreateColumn>
                  <TechEarnestCreateField label="Outcome" error={errors.outcome?.message}>
                    <input type="text" className="form-control form-control-sm" {...register("outcome")} />
                  </TechEarnestCreateField>
                </TechEarnestCreateColumn>
              </TechEarnestCreateGrid>
            </TechEarnestCreateSection>
          ) : null}
          {watchedType === "CALL" ? (
            <TechEarnestCreateSection title="Call Details">
              <TechEarnestCreateGrid>
                <TechEarnestCreateColumn>
                  <TechEarnestCreateField label="Call Direction" error={errors.callDirection?.message}>
                    <TechEarnestFormSelect
                      control={control}
                      name="callDirection"
                      options={callDirectionOptions.filter((option) => option.value)}
                      searchPlaceholder="Search Directions"
                    />
                  </TechEarnestCreateField>
                  <TechEarnestCreateField label="Outcome" error={errors.outcome?.message}>
                    <input type="text" className="form-control form-control-sm" {...register("outcome")} />
                  </TechEarnestCreateField>
                </TechEarnestCreateColumn>
                <TechEarnestCreateColumn>
                  <TechEarnestCreateField label="Duration (Seconds)" error={errors.durationSeconds?.message}>
                    <input
                      type="number"
                      min={0}
                      className={`form-control form-control-sm${errors.durationSeconds ? " is-invalid" : ""}`}
                      {...register("durationSeconds")}
                    />
                  </TechEarnestCreateField>
                </TechEarnestCreateColumn>
              </TechEarnestCreateGrid>
            </TechEarnestCreateSection>
          ) : null}
          <TechEarnestCreateSection title="Description Information">
            <TechEarnestCreateField label="Description" wide error={errors.description?.message}>
              <textarea rows={4} className="form-control form-control-sm" {...register("description")} />
            </TechEarnestCreateField>
          </TechEarnestCreateSection>
        </TechEarnestFormKitCreateView>
      ) : (
    <ModuleListShell
      title={title}
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All {title}</span>}
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
        canCreate ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              reset(activityDefaults(typeFilter));
              setShowForm(true);
            }}
          >
            Create {createLabel}
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter {title} by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Subject"
            />
          </div>
          <div className="module-filter-section">
            <h3>Filter by fields</h3>
            <div className="mb-2"><TechEarnestFilterSelect label="Type" value={typeFilter} onChange={setTypeFilter} options={activityTypeOptions} placeholder="All types" emptyLabel="All types" searchPlaceholder="Search activity types" /></div>
            <div className="mb-2"><TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={activityFilterStatusOptions} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search activity statuses" /></div>
            <div className="mb-2"><TechEarnestFilterSelect label="Related type" value={relatedTypeFilter} onChange={setRelatedTypeFilter} options={entityTypeOptions} placeholder="All record types" emptyLabel="All record types" searchPlaceholder="Search record types" /></div>
            {canViewUsers ? (
              <div className="mb-2"><TechEarnestFilterSelect label="Assignee" value={assigneeFilter} onChange={setAssigneeFilter} options={assigneeFilterOptions} placeholder="All assignees" emptyLabel="All assignees" searchPlaceholder="Search users" /></div>
            ) : null}
            <ModuleFilterField label="Outcome" htmlFor="activityOutcomeFilter">
              <input
                id="activityOutcomeFilter"
                className="form-control form-control-sm"
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value)}
                placeholder="e.g. INTERESTED"
              />
            </ModuleFilterField>
            <div className="mb-2"><TechEarnestFilterSelect label="Call direction" value={directionFilter} onChange={setDirectionFilter} options={callDirectionOptions.filter((option) => option.value)} placeholder="All directions" emptyLabel="All directions" searchPlaceholder="Search directions" /></div>
            <ModuleFilterDateRange
              label="Due"
              from={dueFrom}
              to={dueTo}
              onFromChange={setDueFrom}
              onToChange={setDueTo}
            />
          </div>
        </>
      }
      activeFilterCount={activeFilterCount}
      onClearFilters={() => {
        setSearch("");
        setTypeFilter(typeFromUrl);
        setStatusFilter("");
        setRelatedTypeFilter("");
        setAssigneeFilter("");
        setOutcomeFilter("");
        setDirectionFilter("");
        setDueFrom("");
        setDueTo("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {activitiesQuery.isLoading ? <LoadingState label="Loading..." /> : null}
      {activitiesQuery.error ? <ErrorState title="Unable to load" message="Try again." /> : null}

      {!activitiesQuery.isLoading && !activitiesQuery.error && viewMode === "list" ? (
        <ModuleListTable
            tableCode="activity"
            defaultColumns={ACTIVITY_LIST_COLUMNS}
            rows={rows}
            rowKey={(activity) => activity.id}
            selectedRowKey={selectedId}
            onRowClick={(activity) => setSelectedId(activity.id)}
            renderCell={(activity, field) => {
              if (field === "relatedEntityId") {
                return (
                  <EntityRecordLink entityType={activity.relatedEntityType} id={activity.relatedEntityId}>
                    {relatedLabel(activity)}
                  </EntityRecordLink>
                );
              }
              if (field === "status") return <StatusBadge status={activity.status} />;
              const value = (activity as unknown as Record<string, unknown>)[field];
              return value == null || value === "" ? "—" : String(value);
            }}
            nameFields={["subject"]}
            emptyMessage={`No ${title.toLowerCase()} found.`}
            trailingColumn={{
              header: "",
              stopPropagation: true,
              render: (activity) =>
                canComplete && activity.status !== "COMPLETED" ? (
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => completeMutation.mutate(activity.id)}
                  >
                    Complete
                  </button>
                ) : null,
            }}
        />
      ) : null}

      {selected ? (
        <div ref={detailRef} className="border-top bg-white p-3">
          {cameFrom ? (
            <button type="button" className="techearnest-record-return mb-2" onClick={() => setSelectedId(null)}>
              <span aria-hidden="true">‹</span> Back to {cameFrom.label || "previous page"}
            </button>
          ) : null}
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
            <div>
              <h2 className="h6 mb-1">{selected.subject}</h2>
              <div className="small text-muted d-flex flex-wrap gap-2 align-items-center">
                <span>{selected.type}</span>
                <StatusBadge status={selected.status} />
                <span>
                  Related to{" "}
                  <EntityRecordLink entityType={selected.relatedEntityType} id={selected.relatedEntityId}>
                    {relatedLabel(selected)}
                  </EntityRecordLink>
                </span>
                {selected.dueDate ? <span>Due {new Date(selected.dueDate).toLocaleDateString()}</span> : null}
              </div>
              {selected.description ? <p className="small mb-0 mt-2">{selected.description}</p> : null}
            </div>
            {!canUpdate ? (
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedId(null)}>
                Close
              </button>
            ) : null}
          </div>
          {canUpdate ? (
          <>
          {manageError ? <div className="alert alert-danger py-2">{manageError}</div> : null}
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label small">Subject</label>
              <input className="form-control form-control-sm" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Priority</label>
              <select className="form-select form-select-sm" value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Due / schedule</label>
              <input
                className="form-control form-control-sm"
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
            </div>
            {selected.type === "MEETING" ? (
              <>
                <div className="col-md-2">
                  <label className="form-label small">Location</label>
                  <input className="form-control form-control-sm" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
                </div>
                <div className="col-md-2">
                  <label className="form-label small">Attendees</label>
                  <input className="form-control form-control-sm" value={editAttendees} onChange={(e) => setEditAttendees(e.target.value)} />
                </div>
              </>
            ) : null}
            {selected.type === "CALL" ? (
              <>
                <div className="col-md-2">
                  <label className="form-label small">Direction</label>
                  <select className="form-select form-select-sm" value={editDirection} onChange={(e) => setEditDirection(e.target.value)}>
                    <option value="">—</option>
                    <option value="INBOUND">INBOUND</option>
                    <option value="OUTBOUND">OUTBOUND</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label small">Outcome</label>
                  <input className="form-control form-control-sm" value={editOutcome} onChange={(e) => setEditOutcome(e.target.value)} />
                </div>
              </>
            ) : null}
            {selected.type === "TASK" ? (
              <div className="col-md-2">
                <label className="form-label small">Outcome</label>
                <input className="form-control form-control-sm" value={editOutcome} onChange={(e) => setEditOutcome(e.target.value)} />
              </div>
            ) : null}
            <div className="col-md-2 d-flex gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!editSubject.trim() || updateMutation.isPending}
                onClick={() => updateMutation.mutate()}
              >
                Save changes
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>
          </div>
          </>
          ) : null}
        </div>
      ) : null}

      {!activitiesQuery.isLoading && !activitiesQuery.error && viewMode === "tile" ? (
        <div className="module-tile-grid">
          {rows.map((activity) => (
            <div
              key={activity.id}
              role="button"
              tabIndex={0}
              className={`module-tile${activity.id === selectedId ? " is-selected" : ""}`}
              onClick={() => setSelectedId(activity.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSelectedId(activity.id);
              }}
            >
              <div className="tile-title">{activity.subject}</div>
              <div className="small text-muted">
                {activity.type} · {activity.status}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </ModuleListShell>
      )}
    </>
  );
}
