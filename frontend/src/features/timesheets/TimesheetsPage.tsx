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
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listProjects } from "@/features/projects/projectApi";
import { listResources } from "@/features/resources/resourceApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import {
  addTimeEntry,
  approveTimesheet,
  createTimesheet,
  deleteTimeEntry,
  exportTimesheetsCsv,
  getTimesheet,
  listTimesheets,
  mondayOf,
  rejectTimesheet,
  submitTimesheet,
  type Timesheet,
} from "./timesheetApi";

const createSchema = z.object({
  weekStartDate: z.string().min(1, "Week start is required"),
});

type CreateFormValues = z.infer<typeof createSchema>;

const entrySchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  workDate: z.string().min(1, "Work date is required"),
  hours: z.string().min(1, "Hours are required"),
  description: z.string().optional(),
  billable: z.boolean().optional(),
});

type EntryFormValues = z.infer<typeof entrySchema>;

const ENTRY_DEFAULTS: EntryFormValues = {
  projectId: "",
  workDate: "",
  hours: "8",
  description: "",
  billable: true,
};

function isEditable(status: string) {
  return status === "DRAFT" || status === "REJECTED";
}

export function TimesheetsPage() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const canCreate = useHasPermission("TIMESHEET_CREATE");
  const canSubmit = useHasPermission("TIMESHEET_SUBMIT");
  const canApprove = useHasPermission("TIMESHEET_APPROVE");
  const canExport = useHasPermission("TIMESHEET_EXPORT");
  const canViewRates = useHasPermission("RATE_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [weekStartFilter, setWeekStartFilter] = useState("");
  const [billableOnly, setBillableOnly] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showEntryMore, setShowEntryMore] = useState(false);

  const listParams = useMemo(
    () => ({
      status: statusFilter || undefined,
      resourceId: resourceFilter || undefined,
      weekStart: weekStartFilter || undefined,
      billableOnly: billableOnly || undefined,
    }),
    [statusFilter, resourceFilter, weekStartFilter, billableOnly],
  );

  const listQuery = useQuery({
    queryKey: ["timesheets", listParams],
    queryFn: () => listTimesheets(listParams),
  });
  const resourcesQuery = useQuery({
    queryKey: ["resources"],
    queryFn: () => listResources(),
  });
  const detailQuery = useQuery({
    queryKey: ["timesheets", selectedId],
    queryFn: () => getTimesheet(selectedId!),
    enabled: !!selectedId,
  });
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
    enabled: !!selectedId && canCreate,
  });

  const selected: Timesheet | undefined = detailQuery.data;

  useEffect(() => {
    setActionError(null);
    setRejectReason("");
  }, [selectedId]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { weekStartDate: mondayOf() },
  });

  const entryForm = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: ENTRY_DEFAULTS,
  });

  const createMutation = useMutation({
    mutationFn: createTimesheet,
    onSuccess: (sheet) => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      setShowForm(false);
      reset({ weekStartDate: mondayOf() });
      setSelectedId(sheet.id);
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const entryMutation = useMutation({
    mutationFn: (values: EntryFormValues) =>
      addTimeEntry(selectedId!, {
        projectId: values.projectId,
        workDate: values.workDate,
        hours: Number(values.hours),
        description: values.description,
        billable: values.billable ?? true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      entryForm.reset({
        ...ENTRY_DEFAULTS,
        workDate: selected?.weekStartDate ?? "",
      });
      setShowEntryMore(false);
      setActionError(null);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitTimesheet(selectedId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["timesheets", selectedId] });
      setActionError(null);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveTimesheet(selectedId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["timesheets", selectedId] });
      setActionError(null);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectTimesheet(selectedId!, rejectReason.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["timesheets", selectedId] });
      setRejectReason("");
      setActionError(null);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: string) => deleteTimeEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const onCreate = handleSubmit((values) => {
    if (!auth.resourceId) {
      setFormError("Your user is not linked to a resource. Ask an admin to link one.");
      return;
    }
    createMutation.mutate({ weekStartDate: values.weekStartDate });
  });

  async function onExport() {
    try {
      const blob = await exportTimesheetsCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "timesheets.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Export failed");
    }
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (listQuery.data ?? []).filter((sheet) => {
      if (!q) return true;
      return (
        sheet.weekStartDate.toLowerCase().includes(q) ||
        sheet.status.toLowerCase().includes(q)
      );
    });
  }, [listQuery.data, search]);

  const activeFilterCount = [
    search,
    statusFilter,
    resourceFilter,
    weekStartFilter,
    billableOnly ? "1" : "",
  ].filter(Boolean).length;

  const ownSheet = selected && auth.resourceId && selected.resourceId === auth.resourceId;

  return (
    <ModuleListShell
      title="Timesheets"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Timesheets</span>}
      toolbarActions={
        <>
          <button
            type="button"
            className={`btn btn-sm ${filterOpen ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setFilterOpen((o) => !o)}
          >
            Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </button>
          {canExport ? (
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void onExport()}>
              Export CSV
            </button>
          ) : null}
        </>
      }
      primaryAction={
        canCreate ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setShowForm((v) => !v);
              setFormError(null);
            }}
          >
            {showForm ? "Cancel" : "Create Timesheet"}
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Timesheets by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Week start or status"
            />
          </div>
          <div className="module-filter-section">
            <h3>Filter by fields</h3>
            <label className="form-label small mb-1">Status</label>
            <select
              className="form-select form-select-sm mb-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="DRAFT">DRAFT</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
            <label className="form-label small mb-1">Week start</label>
            <input
              className="form-control form-control-sm mb-2"
              type="date"
              value={weekStartFilter}
              onChange={(e) => setWeekStartFilter(e.target.value)}
            />
            <label className="form-label small mb-1">Resource</label>
            <select
              className="form-select form-select-sm mb-2"
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
            >
              <option value="">All</option>
              {(resourcesQuery.data ?? []).map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.employeeCode ?? resource.designation ?? resource.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <div className="form-check">
              <input
                id="billableOnly"
                className="form-check-input"
                type="checkbox"
                checked={billableOnly}
                onChange={(e) => setBillableOnly(e.target.checked)}
              />
              <label className="form-check-label small" htmlFor="billableOnly">
                Has billable entries
              </label>
            </div>
          </div>
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {showForm ? (
        <form className="border-bottom p-3 bg-white" onSubmit={onCreate}>
          <UnsavedGuard when={isDirty && showForm} />
          {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
          <FormSection title="Primary details" description="Start a weekly timesheet">
            <div className="col-md-3">
              <FormField
                label="Week start (Monday)"
                type="date"
                required
                error={errors.weekStartDate}
                {...register("weekStartDate")}
              />
            </div>
          </FormSection>
          <FormActions
            submitLabel="Save"
            submitting={isSubmitting || createMutation.isPending}
            onCancel={() => {
              if (isDirty && !window.confirm("Discard unsaved changes?")) return;
              setShowForm(false);
              reset({ weekStartDate: mondayOf() });
            }}
          />
        </form>
      ) : null}

      {listQuery.isLoading ? <LoadingState label="Loading timesheets..." /> : null}
      {listQuery.error ? <ErrorState title="Unable to load timesheets" message="Try again." /> : null}

      {!listQuery.isLoading && !listQuery.error ? (
        <div
          className={selectedId ? "module-list-split" : undefined}
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
        >
          {viewMode === "list" ? (
            <div className="module-list-table-wrap">
              <table className="table module-list-table align-middle">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Status</th>
                    <th>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((sheet) => (
                    <tr
                      key={sheet.id}
                      className={selectedId === sheet.id ? "is-selected" : undefined}
                      onClick={() => setSelectedId(sheet.id)}
                    >
                      <td className="lead-name">{sheet.weekStartDate}</td>
                      <td>
                        <StatusBadge status={sheet.status} />
                      </td>
                      <td>{sheet.totalHours ?? 0}</td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={3} className="text-center text-muted py-5">
                        No timesheets match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="module-tile-grid">
              {rows.map((sheet) => (
                <button
                  key={sheet.id}
                  type="button"
                  className={`module-tile text-start${selectedId === sheet.id ? " is-selected" : ""}`}
                  onClick={() => setSelectedId(sheet.id)}
                >
                  <div className="tile-title">Week of {sheet.weekStartDate}</div>
                  <div className="small text-muted">
                    {sheet.status} · {sheet.totalHours ?? 0} h
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedId ? (
            <aside className="module-detail-drawer">
              {detailQuery.isLoading ? <p className="text-muted">Loading detail…</p> : null}
              {detailQuery.error ? (
                <div className="alert alert-danger">Unable to load timesheet detail.</div>
              ) : null}
              {selected ? (
                <>
                  <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                    <div>
                      <h2 className="h6 mb-1">Week of {selected.weekStartDate}</h2>
                      <StatusBadge status={selected.status} />
                      {selected.warning ? (
                        <span className="badge text-bg-warning ms-2">{selected.warning}</span>
                      ) : null}
                    </div>
                    <div className="d-flex align-items-start gap-2">
                      <div className="text-muted small">Total {selected.totalHours ?? 0} h</div>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => setSelectedId(null)}
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  {selected.rejectionReason ? (
                    <div className="alert alert-warning py-2">Rejected: {selected.rejectionReason}</div>
                  ) : null}
                  {actionError ? <div className="alert alert-danger py-2">{actionError}</div> : null}

                  <div className="table-responsive mb-3">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Project</th>
                          <th>Hours</th>
                          <th>Billable</th>
                          {canViewRates ? <th>Rate</th> : null}
                          <th>Notes</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {(selected.entries ?? []).map((entry) => (
                          <tr key={entry.id}>
                            <td>{entry.workDate}</td>
                            <td className="small text-muted">{entry.projectId.slice(0, 8)}…</td>
                            <td>{entry.hours}</td>
                            <td>{entry.billable ? "Yes" : "No"}</td>
                            {canViewRates ? (
                              <td>{entry.billingRate != null ? entry.billingRate : "—"}</td>
                            ) : null}
                            <td>{entry.description ?? "—"}</td>
                            <td>
                              {canCreate && ownSheet && isEditable(selected.status) ? (
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm text-danger p-0"
                                  onClick={() => deleteEntryMutation.mutate(entry.id)}
                                >
                                  Remove
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                        {(selected.entries ?? []).length === 0 ? (
                          <tr>
                            <td colSpan={canViewRates ? 7 : 6} className="text-muted">
                              No entries yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  {canCreate && ownSheet && isEditable(selected.status) ? (
                    <form
                      className="border-top pt-3 mb-3"
                      onSubmit={entryForm.handleSubmit((values) => entryMutation.mutate(values))}
                    >
                      <UnsavedGuard when={entryForm.formState.isDirty} />
                      <FormSection title="Add time entry" description="Project, date, and hours">
                        <div className="col-md-5">
                          <label className="form-label required">Project</label>
                          <select className="form-select form-select-sm" {...entryForm.register("projectId")}>
                            <option value="">Select project</option>
                            {(projectsQuery.data ?? []).map((project) => (
                              <option key={project.id} value={project.id}>
                                {project.name}
                              </option>
                            ))}
                          </select>
                          {entryForm.formState.errors.projectId ? (
                            <div className="invalid-feedback d-block">
                              {entryForm.formState.errors.projectId.message}
                            </div>
                          ) : null}
                        </div>
                        <div className="col-md-4">
                          <FormField
                            label="Work date"
                            type="date"
                            required
                            error={entryForm.formState.errors.workDate}
                            {...entryForm.register("workDate")}
                          />
                        </div>
                        <div className="col-md-3">
                          <FormField
                            label="Hours"
                            type="number"
                            required
                            error={entryForm.formState.errors.hours}
                            {...entryForm.register("hours")}
                          />
                        </div>
                      </FormSection>
                      <FormMoreDetails
                        open={showEntryMore}
                        onToggle={() => setShowEntryMore((v) => !v)}
                      >
                        <FormSection title="Notes">
                          <div className="col-md-8">
                            <FormField
                              label="Description"
                              error={entryForm.formState.errors.description}
                              {...entryForm.register("description")}
                            />
                          </div>
                          <div className="col-12">
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="billable"
                                {...entryForm.register("billable")}
                              />
                              <label className="form-check-label" htmlFor="billable">
                                Billable
                              </label>
                            </div>
                          </div>
                        </FormSection>
                      </FormMoreDetails>
                      <FormActions
                        submitLabel="Add entry"
                        submitting={entryMutation.isPending}
                        onCancel={() => {
                          if (
                            entryForm.formState.isDirty &&
                            !window.confirm("Discard unsaved changes?")
                          ) {
                            return;
                          }
                          entryForm.reset({
                            ...ENTRY_DEFAULTS,
                            workDate: selected.weekStartDate ?? "",
                          });
                          setShowEntryMore(false);
                        }}
                      />
                    </form>
                  ) : null}

                  <div className="d-flex flex-wrap gap-2 align-items-end">
                    {canSubmit && ownSheet && isEditable(selected.status) ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={submitMutation.isPending}
                        onClick={() => submitMutation.mutate()}
                      >
                        Submit week
                      </button>
                    ) : null}
                    {canApprove && selected.status === "SUBMITTED" ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          disabled={approveMutation.isPending}
                          onClick={() => approveMutation.mutate()}
                        >
                          Approve
                        </button>
                        <div className="d-flex gap-2 align-items-end flex-grow-1">
                          <div className="flex-grow-1">
                            <label className="form-label small mb-1">Reject reason</label>
                            <input
                              className="form-control form-control-sm"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Required to reject"
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            disabled={rejectMutation.isPending || !rejectReason.trim()}
                            onClick={() => rejectMutation.mutate()}
                          >
                            Reject
                          </button>
                        </div>
                      </>
                    ) : null}
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
