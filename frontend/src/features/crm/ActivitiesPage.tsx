import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormMoreDetails, FormSection } from "@/components/FormKit";
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
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listUsers } from "@/features/admin/adminApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { completeActivity, createActivity, listActivities, updateActivity } from "./crmApi";

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
  const [showMore, setShowMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    photo,
    cancelCreate,
    afterCreateSuccess,
  } = useTechEarnestCreateFlow({
    defaults: activityDefaults(typeFilter),
    reset,
    setShowForm,
    setFormError,
    setSelected: (entity) => setSelectedId(entity.id),
    onResetExtras: () => setShowMore(false),
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

  const selected = useMemo(
    () => (activitiesQuery.data ?? []).find((activity) => activity.id === selectedId) ?? null,
    [activitiesQuery.data, selectedId],
  );

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
          photo={photo}
        >
          <FormSection title="Primary details">
            <div className="col-md-2">
              <label className="form-label">Type</label>
              <TechEarnestFormSelect
                control={control}
                name="type"
                options={activityTypeOptions}
                searchPlaceholder="Search Types"
                allowEmpty={false}
              />
            </div>
            <div className="col-md-4">
              <FormField label="Subject" required error={errors.subject} {...register("subject")} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Related to</label>
              <TechEarnestFormSelect
                control={control}
                name="relatedEntityType"
                options={entityTypeOptions}
                searchPlaceholder="Search Entity Types"
                allowEmpty={false}
              />
            </div>
            <div className="col-md-4">
              <FormField label="Related record ID" required error={errors.relatedEntityId} {...register("relatedEntityId")} />
            </div>
          </FormSection>
          <FormMoreDetails open={showMore} onToggle={() => setShowMore((v) => !v)}>
            <FormSection title="Additional details">
              <div className="col-md-3">
                <label className="form-label">Priority</label>
                <TechEarnestFormSelect
                  control={control}
                  name="priority"
                  options={activityPriorityOptions}
                  searchPlaceholder="Search Priorities"
                  allowEmpty={false}
                />
              </div>
              <div className="col-md-3">
                <FormField label="Due date" type="date" error={errors.dueDate} {...register("dueDate")} />
              </div>
              <div className="col-12">
                <FormField label="Description" error={errors.description} {...register("description")} />
              </div>
            </FormSection>
            {watchedType === "MEETING" ? (
              <FormSection title="Meeting details">
                <div className="col-md-4">
                  <FormField label="Location" error={errors.location} {...register("location")} />
                </div>
                <div className="col-md-4">
                  <FormField label="Attendees" error={errors.attendees} {...register("attendees")} />
                </div>
                <div className="col-md-4">
                  <FormField label="Outcome" error={errors.outcome} {...register("outcome")} />
                </div>
              </FormSection>
            ) : null}
            {watchedType === "CALL" ? (
              <FormSection title="Call details">
                <div className="col-md-3">
                  <label className="form-label">Direction</label>
                  <TechEarnestFormSelect
                    control={control}
                    name="callDirection"
                    options={callDirectionOptions}
                    searchPlaceholder="Search Directions"
                  />
                </div>
                <div className="col-md-3">
                  <FormField
                    label="Duration (seconds)"
                    type="number"
                    error={errors.durationSeconds}
                    {...register("durationSeconds")}
                  />
                </div>
                <div className="col-md-3">
                  <FormField label="Outcome" error={errors.outcome} {...register("outcome")} />
                </div>
              </FormSection>
            ) : null}
          </FormMoreDetails>
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
              setShowMore(false);
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
            <label className="form-label small mb-1">Outcome</label>
            <input
              className="form-control form-control-sm mb-2"
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              placeholder="e.g. INTERESTED"
            />
            <div className="mb-2"><TechEarnestFilterSelect label="Call direction" value={directionFilter} onChange={setDirectionFilter} options={callDirectionOptions.filter((option) => option.value)} placeholder="All directions" emptyLabel="All directions" searchPlaceholder="Search directions" /></div>
            <label className="form-label small mb-1">Due from</label>
            <input
              className="form-control form-control-sm mb-2"
              type="date"
              value={dueFrom}
              onChange={(e) => setDueFrom(e.target.value)}
            />
            <label className="form-label small mb-1">Due to</label>
            <input
              className="form-control form-control-sm"
              type="date"
              value={dueTo}
              onChange={(e) => setDueTo(e.target.value)}
            />
          </div>
        </>
      }
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
                return `${activity.relatedEntityType} · ${activity.relatedEntityId.slice(0, 8)}`;
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

      {selected && canUpdate ? (
        <div className="border-top bg-white p-3">
          <h2 className="h6 mb-3">Manage {selected.type.toLowerCase()}</h2>
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
        </div>
      ) : null}

      {!activitiesQuery.isLoading && !activitiesQuery.error && viewMode === "tile" ? (
        <div className="module-tile-grid">
          {rows.map((activity) => (
            <div key={activity.id} className="module-tile">
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
