import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormActions, FormMoreDetails, FormSection, UnsavedGuard } from "@/components/FormKit";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listUsers } from "@/features/admin/adminApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { completeActivity, createActivity, listActivities } from "./crmApi";

const ENTITY_TYPES = ["LEAD", "ACCOUNT", "CONTACT", "DEAL"] as const;
const ACTIVITY_TYPES = ["TASK", "CALL", "MEETING", "NOTE", "FOLLOW_UP"] as const;

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

export function ActivitiesPage() {
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const typeFromUrl = params.get("type")?.toUpperCase() ?? "";
  const auth = useAuth();
  const canCreate = useHasPermission("ACTIVITY_CREATE");
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
  const [saveAndNew, setSaveAndNew] = useState(false);

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
    defaultValues: {
      type: typeFilter && ACTIVITY_TYPES.includes(typeFilter as (typeof ACTIVITY_TYPES)[number]) ? typeFilter : "TASK",
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
    },
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "activities"] });
      setFormError(null);
      if (saveAndNew) {
        reset({
          type: typeFilter && ACTIVITY_TYPES.includes(typeFilter as (typeof ACTIVITY_TYPES)[number]) ? typeFilter : "TASK",
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
        });
        setSaveAndNew(false);
        setShowMore(false);
      } else {
        reset();
        setShowForm(false);
        setShowMore(false);
      }
    },
    onError: () => setFormError("Could not create activity. Check the related entity id."),
  });

  const completeMutation = useMutation({
    mutationFn: completeActivity,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "activities"] });
    },
  });

  return (
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
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : `Create ${title.replace(/s$/, "")}`}
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
            <label className="form-label small mb-1">Type</label>
            <select className="form-select form-select-sm mb-2" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All</option>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label className="form-label small mb-1">Status</label>
            <select className="form-select form-select-sm mb-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="OPEN">OPEN</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
            <label className="form-label small mb-1">Related type</label>
            <select
              className="form-select form-select-sm mb-2"
              value={relatedTypeFilter}
              onChange={(e) => setRelatedTypeFilter(e.target.value)}
            >
              <option value="">All</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {canViewUsers ? (
              <>
                <label className="form-label small mb-1">Assignee</label>
                <select
                  className="form-select form-select-sm mb-2"
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                >
                  <option value="">All</option>
                  {auth.userId ? <option value={auth.userId}>Current user</option> : null}
                  {(usersQuery.data ?? []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <label className="form-label small mb-1">Outcome</label>
            <input
              className="form-control form-control-sm mb-2"
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              placeholder="e.g. INTERESTED"
            />
            <label className="form-label small mb-1">Call direction</label>
            <select
              className="form-select form-select-sm mb-2"
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="INBOUND">INBOUND</option>
              <option value="OUTBOUND">OUTBOUND</option>
            </select>
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
      {showForm ? (
        <form
          className="border-bottom p-3 bg-white"
          onSubmit={handleSubmit((values) => createMutation.mutate(buildActivityBody(values)))}
        >
          <UnsavedGuard when={isDirty && showForm} />
          {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
          <FormSection title="Primary details">
            <div className="col-md-2">
              <label className="form-label">Type</label>
              <select className="form-select" {...register("type")}>
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <FormField label="Subject" required error={errors.subject} {...register("subject")} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Related to</label>
              <select className="form-select" {...register("relatedEntityType")}>
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <FormField label="Related record ID" required error={errors.relatedEntityId} {...register("relatedEntityId")} />
            </div>
          </FormSection>
          <FormMoreDetails open={showMore} onToggle={() => setShowMore((v) => !v)}>
            <FormSection title="Additional details">
              <div className="col-md-3">
                <label className="form-label">Priority</label>
                <select className="form-select" {...register("priority")}>
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                </select>
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
                  <select className="form-select" {...register("callDirection")}>
                    <option value="">—</option>
                    <option value="INBOUND">INBOUND</option>
                    <option value="OUTBOUND">OUTBOUND</option>
                  </select>
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
          <FormActions
            submitting={isSubmitting || createMutation.isPending}
            showSaveAndNew
            onSaveAndNew={() => {
              setSaveAndNew(true);
              void handleSubmit((values) => createMutation.mutate(buildActivityBody(values)))();
            }}
            onCancel={() => {
              if (isDirty && !window.confirm("Discard unsaved changes?")) return;
              setShowForm(false);
              setShowMore(false);
              reset();
            }}
          />
        </form>
      ) : null}

      {activitiesQuery.isLoading ? <LoadingState label="Loading..." /> : null}
      {activitiesQuery.error ? <ErrorState title="Unable to load" message="Try again." /> : null}

      {!activitiesQuery.isLoading && !activitiesQuery.error && viewMode === "list" ? (
        <div className="module-list-table-wrap">
          <table className="table module-list-table align-middle">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Type</th>
                <th>Related</th>
                <th>Due</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((activity) => (
                <tr key={activity.id}>
                  <td className="lead-name">{activity.subject}</td>
                  <td>{activity.type}</td>
                  <td>
                    {activity.relatedEntityType} · {activity.relatedEntityId.slice(0, 8)}
                  </td>
                  <td>{activity.dueDate ?? "—"}</td>
                  <td>
                    <StatusBadge status={activity.status} />
                  </td>
                  <td>
                    {canComplete && activity.status !== "COMPLETED" ? (
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => completeMutation.mutate(activity.id)}
                      >
                        Complete
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-5">
                    No {title.toLowerCase()} found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
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
  );
}
