import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { publicErrorMessage } from "@/api/publicClient";
import { getTimesheetLink, submitTimesheetLink, type LinkEntryBody, type TimesheetLinkView } from "./selfServiceApi";

interface GridRow {
  key: string;
  projectId: string;
  taskId: string;
  description: string;
  billable: boolean;
  hours: string[];
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

let rowSeq = 0;
function emptyRow(): GridRow {
  rowSeq += 1;
  return { key: `row-${rowSeq}`, projectId: "", taskId: "", description: "", billable: true, hours: Array(7).fill("") };
}

function rowsFromView(view: TimesheetLinkView): GridRow[] {
  const byKey = new Map<string, GridRow>();
  for (const entry of view.entries) {
    const key = `${entry.projectId}|${entry.taskId ?? ""}|${entry.description ?? ""}|${entry.billable}`;
    let row = byKey.get(key);
    if (!row) {
      row = {
        ...emptyRow(),
        projectId: entry.projectId,
        taskId: entry.taskId ?? "",
        description: entry.description ?? "",
        billable: entry.billable,
      };
      byKey.set(key, row);
    }
    const dayIndex = daysBetween(view.weekStartDate, entry.workDate);
    if (dayIndex >= 0 && dayIndex < 7) {
      const current = Number(row.hours[dayIndex] || 0);
      row.hours[dayIndex] = String(current + Number(entry.hours));
    }
  }
  const rows = [...byKey.values()];
  return rows.length ? rows : [emptyRow()];
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Public, token-authenticated weekly timesheet for resources without a CRM login. */
export function TimesheetLinkPage() {
  const { token = "" } = useParams();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<GridRow[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);

  const viewQuery = useQuery({
    queryKey: ["public", "timesheet-link", token],
    queryFn: () => getTimesheetLink(token),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const view = viewQuery.data;

  useEffect(() => {
    if (view) setRows(rowsFromView(view));
  }, [view]);

  const days = useMemo(
    () => (view ? DAY_NAMES.map((name, index) => ({ name, iso: addDays(view.weekStartDate, index) })) : []),
    [view],
  );

  const submitMutation = useMutation({
    mutationFn: (entries: LinkEntryBody[]) => submitTimesheetLink(token, entries),
    onSuccess: (result) => {
      setError(null);
      queryClient.setQueryData(["public", "timesheet-link", token], result);
    },
    onError: (e) => setError(publicErrorMessage(e, "Could not submit your timesheet.")),
  });

  const dayTotals = days.map((_, index) => rows.reduce((sum, row) => sum + (Number(row.hours[index]) || 0), 0));
  const weekTotal = dayTotals.reduce((sum, value) => sum + value, 0);
  const editable = !!view?.editable && !submitMutation.isSuccess;
  const closedProjectIds = useMemo(
    () => new Set((view?.projects ?? []).filter((p) => p.closed).map((p) => p.projectId)),
    [view],
  );
  const openProjects = (view?.projects ?? []).filter((p) => !p.closed);

  function updateRow(key: string, patch: Partial<GridRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function updateHours(key: string, dayIndex: number, value: string) {
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row;
        const hours = [...row.hours];
        hours[dayIndex] = value;
        return { ...row, hours };
      }),
    );
  }

  function onSubmit() {
    if (!view) return;
    const entries: LinkEntryBody[] = [];
    let frozenHours = false;
    for (const row of rows) {
      const hasHours = row.hours.some((h) => Number(h) > 0);
      if (!hasHours) continue;
      if (closedProjectIds.has(row.projectId)) {
        frozenHours = true;
        continue;
      }
      if (!row.projectId) {
        setError("Choose a project for every row that has hours.");
        return;
      }
      row.hours.forEach((value, index) => {
        const hours = Number(value);
        if (hours > 0) {
          entries.push({
            projectId: row.projectId,
            taskId: row.taskId || null,
            workDate: days[index].iso,
            hours,
            description: row.description.trim() || null,
            billable: row.billable,
          });
        }
      });
    }
    if (!entries.length && !frozenHours) {
      setError("Enter at least one day's hours before submitting.");
      return;
    }
    if (dayTotals.some((total) => total > 24)) {
      setError("A single day cannot have more than 24 hours.");
      return;
    }
    submitMutation.mutate(entries);
  }

  return (
    <div className="auth-card auth-card-wide">
      <div className="d-flex align-items-center gap-2 mb-3">
        <span className="app-brand-mark">TE</span>
        <div>
          <div className="fw-semibold">{view?.organizationName ?? "TechEarnest CRM"}</div>
          <div className="text-muted small">Weekly timesheet</div>
        </div>
      </div>

      {viewQuery.isLoading ? <p className="text-muted">Loading your timesheet…</p> : null}
      {viewQuery.isError ? (
        <div className="alert alert-warning py-2 mb-0">
          {publicErrorMessage(viewQuery.error, "This timesheet link is invalid or has expired.")} Ask your project
          manager for a new link.
        </div>
      ) : null}

      {view ? (
        <>
          <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
            <div>
              <h1 className="h5 mb-1">{view.resourceName}</h1>
              <div className="small text-muted">
                Week of {formatDay(view.weekStartDate)} – {formatDay(view.weekEndDate)}
                {view.capacityHoursPerWeek != null ? ` · capacity ${view.capacityHoursPerWeek} h` : ""}
              </div>
            </div>
            <div className="small text-muted">Link valid until {new Date(view.expiresAt).toLocaleDateString()}</div>
          </div>

          {submitMutation.isSuccess || (view.status && !view.editable) ? (
            <div className="alert alert-success py-2">
              {submitMutation.isSuccess
                ? "Thank you — your timesheet was submitted for approval. You can close this page."
                : `This week is already ${view.status?.toLowerCase()}.`}
            </div>
          ) : null}
          {view.rejectionReason && view.editable && !submitMutation.isSuccess ? (
            <div className="alert alert-warning py-2">Returned for changes: {view.rejectionReason}</div>
          ) : null}
          {error ? <div className="alert alert-danger py-2">{error}</div> : null}
          {!openProjects.length && editable ? (
            <div className="alert alert-info py-2">
              You are not allocated to any open project for this week, so there is nothing to log. Contact your project
              manager if this is wrong.
            </div>
          ) : null}
          {closedProjectIds.size && editable ? (
            <div className="small text-muted mb-2">
              Projects marked as ended are closed for time entry; hours already logged on them stay as they are.
            </div>
          ) : null}

          <div className="table-responsive">
            <table className="table table-sm timesheet-link-grid">
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Project / task</th>
                  {days.map((day) => (
                    <th key={day.iso} className="text-end">
                      <div>{day.name}</div>
                      <div className="small text-muted fw-normal">{formatDay(day.iso)}</div>
                    </th>
                  ))}
                  <th className="text-end">Total</th>
                  {editable ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const project = view.projects.find((p) => p.projectId === row.projectId);
                  const rowTotal = row.hours.reduce((sum, h) => sum + (Number(h) || 0), 0);
                  const rowEditable = editable && !closedProjectIds.has(row.projectId);
                  return (
                    <tr key={row.key}>
                      <td>
                        <select
                          className="form-select form-select-sm mb-1"
                          value={row.projectId}
                          disabled={!rowEditable}
                          onChange={(e) => updateRow(row.key, { projectId: e.target.value, taskId: "" })}
                        >
                          <option value="">Select project…</option>
                          {view.projects.map((p) => (
                            <option key={p.projectId} value={p.projectId} disabled={p.closed}>
                              {p.name}
                              {p.projectCode ? ` (${p.projectCode})` : ""}
                              {p.closed ? " — ended" : ""}
                            </option>
                          ))}
                        </select>
                        {project?.tasks.length ? (
                          <select
                            className="form-select form-select-sm mb-1"
                            value={row.taskId}
                            disabled={!rowEditable}
                            onChange={(e) => updateRow(row.key, { taskId: e.target.value })}
                          >
                            <option value="">No specific task</option>
                            {project.tasks.map((task) => (
                              <option key={task.taskId} value={task.taskId}>
                                {task.name}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <input
                          className="form-control form-control-sm"
                          placeholder="What did you work on? (optional)"
                          maxLength={500}
                          value={row.description}
                          disabled={!rowEditable}
                          onChange={(e) => updateRow(row.key, { description: e.target.value })}
                        />
                      </td>
                      {row.hours.map((value, index) => (
                        <td key={index} className="text-end">
                          <input
                            type="number"
                            min={0}
                            max={24}
                            step="0.25"
                            inputMode="decimal"
                            aria-label={`${DAY_NAMES[index]} hours`}
                            className="form-control form-control-sm hours-input ms-auto"
                            value={value}
                            disabled={!rowEditable}
                            onChange={(e) => updateHours(row.key, index, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="text-end fw-semibold">{rowTotal || "—"}</td>
                      {editable ? (
                        <td>
                          <button
                            type="button"
                            className="btn btn-link btn-sm text-danger p-0"
                            disabled={rows.length === 1 || !rowEditable}
                            onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                          >
                            Remove
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th>Daily total</th>
                  {dayTotals.map((total, index) => (
                    <th key={index} className={`text-end${total > 24 ? " text-danger" : ""}`}>
                      {total || "—"}
                    </th>
                  ))}
                  <th className="text-end">{weekTotal}</th>
                  {editable ? <th /> : null}
                </tr>
              </tfoot>
            </table>
          </div>

          {editable ? (
            <div className="d-flex flex-wrap justify-content-between gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={!openProjects.length}
                onClick={() => setRows((current) => [...current, emptyRow()])}
              >
                Add row
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitMutation.isPending || !view.projects.length}                onClick={onSubmit}
              >
                {submitMutation.isPending ? "Submitting…" : "Submit for approval"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
