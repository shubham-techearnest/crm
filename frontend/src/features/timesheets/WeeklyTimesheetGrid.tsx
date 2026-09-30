import { useEffect, useMemo, useState } from "react";
import { closedProjectLabel, type EntryProjectOption, type GridEntryBody, type TimeEntry } from "./timesheetApi";

const DAY_COUNT = 7;
const MAX_HOURS_PER_DAY = 24;

interface GridRow {
  key: string;
  projectId: string;
  taskId: string | null;
  billable: boolean;
  description: string;
  hours: string[];
}

interface ProjectChoice {
  projectId: string;
  name: string;
  closed: boolean;
  status: string | null;
  tasks: { taskId: string; name: string }[];
}

export interface WeeklyTimesheetGridProps {
  weekStart: string;
  entries: TimeEntry[];
  projectChoices: EntryProjectOption[];
  fallbackProjects: { id: string; name: string }[];
  projectLabel: (id: string) => string;
  taskLabel: (id: string | null) => string | null;
  editable: boolean;
  saving: boolean;
  copying: boolean;
  onSave: (entries: GridEntryBody[]) => void;
  onCopyLastWeek: () => void;
}

function weekDates(weekStart: string): string[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStart);
  if (!match) return [];
  return Array.from({ length: DAY_COUNT }, (_, i) =>
    new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + i)).toISOString().slice(0, 10),
  );
}

function parseHours(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function formatHours(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "");
}

function rowKey(projectId: string, taskId: string | null, billable: boolean) {
  return `${projectId}|${taskId ?? ""}|${billable ? "B" : "N"}`;
}

function buildRows(entries: TimeEntry[], dates: string[]): GridRow[] {
  const rows = new Map<string, GridRow & { notes: Set<string> }>();
  entries.forEach((entry) => {
    const dayIndex = dates.indexOf(entry.workDate);
    if (dayIndex < 0) return;
    const key = rowKey(entry.projectId, entry.taskId, entry.billable);
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        projectId: entry.projectId,
        taskId: entry.taskId,
        billable: entry.billable,
        description: "",
        hours: Array(DAY_COUNT).fill(""),
        notes: new Set<string>(),
      };
      rows.set(key, row);
    }
    const current = row.hours[dayIndex] ? Number(row.hours[dayIndex]) : 0;
    row.hours[dayIndex] = formatHours(current + Number(entry.hours));
    if (entry.description?.trim()) row.notes.add(entry.description.trim());
  });
  return [...rows.values()].map(({ notes, ...row }) => ({ ...row, description: [...notes].join("; ").slice(0, 500) }));
}

export function WeeklyTimesheetGrid({
  weekStart,
  entries,
  projectChoices,
  fallbackProjects,
  projectLabel,
  taskLabel,
  editable,
  saving,
  copying,
  onSave,
  onCopyLastWeek,
}: WeeklyTimesheetGridProps) {
  const dates = useMemo(() => weekDates(weekStart), [weekStart]);
  const [rows, setRows] = useState<GridRow[]>(() => buildRows(entries, dates));
  const [dirty, setDirty] = useState(false);
  const [newProjectId, setNewProjectId] = useState("");
  const [newTaskId, setNewTaskId] = useState("");

  useEffect(() => {
    setRows(buildRows(entries, dates));
    setDirty(false);
  }, [entries, dates]);

  const choices: ProjectChoice[] = useMemo(
    () =>
      projectChoices.length
        ? projectChoices.map((p) => ({
            projectId: p.projectId,
            name: p.projectCode ? `${p.name} (${p.projectCode})` : p.name,
            closed: !!p.closed,
            status: p.status ?? null,
            tasks: p.tasks.map((t) => ({ taskId: t.taskId, name: t.name })),
          }))
        : fallbackProjects.map((p) => ({ projectId: p.id, name: p.name, closed: false, status: null, tasks: [] })),
    [projectChoices, fallbackProjects],
  );
  const newProjectTasks = choices.find((c) => c.projectId === newProjectId)?.tasks ?? [];
  const closedProjects = useMemo(
    () => new Map(choices.filter((c) => c.closed).map((c) => [c.projectId, c.status])),
    [choices],
  );
  const hasOpenChoice = choices.some((c) => !c.closed);

  const dayTotals = useMemo(
    () =>
      Array.from({ length: DAY_COUNT }, (_, i) =>
        rows.reduce((sum, row) => {
          const n = parseHours(row.hours[i] || "0");
          return sum + (Number.isNaN(n) ? 0 : n);
        }, 0),
      ),
    [rows],
  );
  const grandTotal = dayTotals.reduce((a, b) => a + b, 0);
  const billableTotal = rows
    .filter((row) => row.billable)
    .reduce((sum, row) => sum + row.hours.reduce((s, h) => s + (parseHours(h || "0") || 0), 0), 0);

  const invalidCell = rows.some((row) =>
    row.hours.some((h) => {
      if (!h) return false;
      const n = parseHours(h);
      return Number.isNaN(n) || n < 0 || n > MAX_HOURS_PER_DAY;
    }),
  );
  const overDay = dayTotals.some((total) => total > MAX_HOURS_PER_DAY);

  function updateRow(key: string, patch: Partial<GridRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setDirty(true);
  }

  function updateCell(key: string, dayIndex: number, value: string) {
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row;
        const hours = [...row.hours];
        hours[dayIndex] = value;
        return { ...row, hours };
      }),
    );
    setDirty(true);
  }

  function toggleBillable(row: GridRow) {
    const nextKey = rowKey(row.projectId, row.taskId, !row.billable);
    if (rows.some((r) => r.key === nextKey)) return;
    updateRow(row.key, { billable: !row.billable, key: nextKey });
  }

  function addRow() {
    if (!newProjectId) return;
    const taskId = newTaskId || null;
    const key = rowKey(newProjectId, taskId, true);
    if (rows.some((row) => row.key === key)) {
      setNewProjectId("");
      setNewTaskId("");
      return;
    }
    setRows((current) => [
      ...current,
      { key, projectId: newProjectId, taskId, billable: true, description: "", hours: Array(DAY_COUNT).fill("") },
    ]);
    setNewProjectId("");
    setNewTaskId("");
    setDirty(true);
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
    setDirty(true);
  }

  function save() {
    const payload: GridEntryBody[] = [];
    rows.forEach((row) => {
      // Entries on ended projects are frozen server-side and kept as they are.
      if (closedProjects.has(row.projectId)) return;
      row.hours.forEach((value, i) => {
        const n = parseHours(value || "0");
        if (!n || Number.isNaN(n)) return;
        payload.push({
          projectId: row.projectId,
          taskId: row.taskId,
          workDate: dates[i],
          hours: n,
          description: row.description.trim() || null,
          billable: row.billable,
        });
      });
    });
    onSave(payload);
  }

  function discard() {
    setRows(buildRows(entries, dates));
    setDirty(false);
  }

  return (
    <div>
      {editable ? (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={copying || entries.length > 0 || dirty}
            title={entries.length > 0 ? "Only available while this week is empty" : "Copy projects and hours from last week"}
            onClick={onCopyLastWeek}
          >
            {copying ? "Copying…" : "Copy Last Week"}
          </button>
          <span className="small text-muted ms-auto">
            Total {formatHours(grandTotal)} h · Billable {formatHours(billableTotal)} h
          </span>
        </div>
      ) : null}

      <div className="table-responsive">
        <table className="table table-sm small align-middle mb-2">
          <thead>
            <tr>
              <th style={{ minWidth: "14rem" }}>Project / Task</th>
              {dates.map((date) => (
                <th key={date} className="text-center" style={{ minWidth: "4.5rem" }}>
                  <div>{new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</div>
                  <div className="text-muted fw-normal">{date.slice(5)}</div>
                </th>
              ))}
              <th className="text-end">Total</th>
              <th>Billable</th>
              <th style={{ minWidth: "10rem" }}>Notes</th>
              {editable ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={DAY_COUNT + (editable ? 5 : 4)} className="text-muted text-center py-3">
                  {editable ? "No time logged yet. Add a project row below or copy last week." : "No time logged."}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const rowTotal = row.hours.reduce((s, h) => s + (parseHours(h || "0") || 0), 0);
              const task = taskLabel(row.taskId);
              const closed = closedProjects.has(row.projectId);
              const rowEditable = editable && !closed;
              return (
                <tr key={row.key} className={closed ? "table-light text-muted" : undefined}>
                  <td>
                    <div className="fw-semibold">
                      {projectLabel(row.projectId)}
                      {closed ? (
                        <span
                          className="badge bg-secondary ms-2"
                          title="The project has ended; these hours can no longer be changed"
                        >
                          {closedProjectLabel(closedProjects.get(row.projectId))}
                        </span>
                      ) : null}
                    </div>
                    {task ? <div className="text-muted">{task}</div> : null}
                  </td>
                  {row.hours.map((value, i) => {
                    const n = value ? parseHours(value) : 0;
                    const invalid = Number.isNaN(n) || n < 0 || n > MAX_HOURS_PER_DAY;
                    return (
                      <td key={dates[i]} className="text-center">
                        {rowEditable ? (
                          <input
                            type="number"
                            min={0}
                            max={MAX_HOURS_PER_DAY}
                            step={0.25}
                            inputMode="decimal"
                            aria-label={`${projectLabel(row.projectId)} ${dates[i]}`}
                            className={`form-control form-control-sm text-center px-1${invalid ? " is-invalid" : ""}`}
                            value={value}
                            onChange={(e) => updateCell(row.key, i, e.target.value)}
                          />
                        ) : (
                          <span>{value || "—"}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-end fw-semibold">{formatHours(rowTotal)}</td>
                  <td>
                    {rowEditable ? (
                      <input
                        type="checkbox"
                        className="form-check-input"
                        aria-label="Billable"
                        checked={row.billable}
                        onChange={() => toggleBillable(row)}
                      />
                    ) : row.billable ? (
                      "Yes"
                    ) : (
                      "No"
                    )}
                  </td>
                  <td>
                    {rowEditable ? (
                      <input
                        type="text"
                        maxLength={500}
                        className="form-control form-control-sm"
                        placeholder="What did you work on?"
                        value={row.description}
                        onChange={(e) => updateRow(row.key, { description: e.target.value })}
                      />
                    ) : (
                      row.description || "—"
                    )}
                  </td>
                  {editable ? (
                    <td className="text-end">
                      {rowEditable ? (
                        <button
                          type="button"
                          className="btn btn-link btn-sm text-danger p-0"
                          onClick={() => removeRow(row.key)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="fw-semibold">
              <td>Daily total</td>
              {dayTotals.map((total, i) => (
                <td key={dates[i]} className={`text-center${total > MAX_HOURS_PER_DAY ? " text-danger" : ""}`}>
                  {formatHours(total)}
                </td>
              ))}
              <td className="text-end">{formatHours(grandTotal)}</td>
              <td colSpan={editable ? 3 : 2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {editable ? (
        <>
          <div className="d-flex flex-wrap align-items-end gap-2 mb-2">
            <div style={{ minWidth: "16rem" }}>
              <label className="form-label small mb-1">Add project row</label>
              <select
                className="form-select form-select-sm"
                value={newProjectId}
                onChange={(e) => {
                  setNewProjectId(e.target.value);
                  setNewTaskId("");
                }}
              >
                <option value="">{hasOpenChoice ? "Select project" : "No open allocated projects"}</option>
                {choices.map((choice) => (
                  <option key={choice.projectId} value={choice.projectId} disabled={choice.closed}>
                    {choice.closed ? `${choice.name} — ${closedProjectLabel(choice.status)}` : choice.name}
                  </option>
                ))}
              </select>
            </div>
            {newProjectTasks.length ? (
              <div style={{ minWidth: "14rem" }}>
                <label className="form-label small mb-1">Task</label>
                <select
                  className="form-select form-select-sm"
                  value={newTaskId}
                  onChange={(e) => setNewTaskId(e.target.value)}
                >
                  <option value="">No specific task</option>
                  {newProjectTasks.map((task) => (
                    <option key={task.taskId} value={task.taskId}>
                      {task.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <button type="button" className="btn btn-outline-primary btn-sm" disabled={!newProjectId} onClick={addRow}>
              Add Row
            </button>
          </div>

          {overDay ? (
            <div className="alert alert-danger py-2 small mb-2">A day cannot have more than 24 hours logged.</div>
          ) : null}

          <div className="d-flex gap-2 justify-content-end">
            <button type="button" className="btn btn-outline-secondary btn-sm" disabled={!dirty || saving} onClick={discard}>
              Discard
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!dirty || saving || invalidCell || overDay}
              onClick={save}
            >
              {saving ? "Saving…" : "Save Week"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
