import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TimesheetNotesModal } from "./TimesheetNotesModal";
import {
  closedProjectLabel,
  todayIso,
  type EntryProjectOption,
  type GridEntryBody,
  type TimeEntry,
} from "./timesheetApi";

const DAY_COUNT = 7;
const MAX_HOURS_PER_DAY = 24;
const NOTE_MAX = 500;

interface GridRow {
  key: string;
  projectId: string;
  taskId: string | null;
  billable: boolean;
  hours: string[];
  notes: string[];
  /** Every saved entry in the row was approved by the project's manager. */
  approved?: boolean;
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
  onDirtyChange?: (dirty: boolean) => void;
  /** Called with the grid's current entries whenever they change (used by the create form). */
  onEntriesChange?: (entries: GridEntryBody[], valid: boolean) => void;
  /** Hide Save Week / Discard when the surrounding form saves the entries. */
  showSaveControls?: boolean;
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

function emptyDays(): string[] {
  return Array(DAY_COUNT).fill("");
}

function emptyRow(projectId: string, taskId: string | null = null): GridRow {
  return { key: rowKey(projectId, taskId, true), projectId, taskId, billable: true, hours: emptyDays(), notes: emptyDays() };
}

function buildRows(entries: TimeEntry[], dates: string[]): GridRow[] {
  const rows = new Map<string, GridRow>();
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
        hours: emptyDays(),
        notes: emptyDays(),
        approved: true,
      };
      rows.set(key, row);
    }
    if (!entry.approvedAt) row.approved = false;
    const current = row.hours[dayIndex] ? Number(row.hours[dayIndex]) : 0;
    row.hours[dayIndex] = formatHours(current + Number(entry.hours));
    const note = entry.description?.trim();
    if (note) {
      const existing = row.notes[dayIndex];
      row.notes[dayIndex] = (existing && existing !== note ? `${existing}; ${note}` : note).slice(0, NOTE_MAX);
    }
  });
  return [...rows.values()];
}

/**
 * Rows the grid starts with: the saved entries, or for an empty editable week one row per open project so the user
 * can type straight away (rows they don't use are simply removed or left blank, and blank rows are never saved).
 */
function initialRows(entries: TimeEntry[], dates: string[], openProjectIds: string[]): GridRow[] {
  const rows = buildRows(entries, dates);
  return rows.length ? rows : openProjectIds.map((id) => emptyRow(id));
}

function rowHours(row: GridRow): number {
  return row.hours.reduce((s, h) => s + (parseHours(h || "0") || 0), 0);
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
  onDirtyChange,
  onEntriesChange,
  showSaveControls = true,
}: WeeklyTimesheetGridProps) {
  const dates = useMemo(() => weekDates(weekStart), [weekStart]);
  const today = todayIso();

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
  const closedProjects = useMemo(
    () => new Map(choices.filter((c) => c.closed).map((c) => [c.projectId, c.status])),
    [choices],
  );
  const openProjectIds = useMemo(
    () => (editable ? choices.filter((c) => !c.closed).map((c) => c.projectId) : []),
    [choices, editable],
  );

  const [rows, setRows] = useState<GridRow[]>(() => initialRows(entries, dates, openProjectIds));
  const [dirty, setDirty] = useState(false);
  const [notesFor, setNotesFor] = useState<string | null>(null);
  /** Once the user adds or removes rows, late-arriving project choices must not re-add rows. */
  const rowsTouched = useRef(false);

  useEffect(() => {
    rowsTouched.current = false;
    setRows(initialRows(entries, dates, openProjectIds));
    setDirty(false);
    // Project choices arriving later are handled below so they never reset typed hours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, dates]);

  useEffect(() => {
    if (rowsTouched.current || entries.length) return;
    setRows((current) => (current.some((row) => rowHours(row) > 0) ? current : initialRows([], dates, openProjectIds)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openProjectIds]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

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
  const futureIndexes = dates.map((date) => date > today);
  const hasFutureHours = dayTotals.some((total, i) => total > 0 && futureIndexes[i]);

  const invalidCell = rows.some((row) =>
    row.hours.some((h) => {
      if (!h) return false;
      const n = parseHours(h);
      return Number.isNaN(n) || n < 0 || n > MAX_HOURS_PER_DAY;
    }),
  );
  const overDay = dayTotals.some((total) => total > MAX_HOURS_PER_DAY);

  function updateHours(key: string, dayIndex: number, value: string) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, hours: row.hours.map((h, i) => (i === dayIndex ? value : h)) } : row)),
    );
    setDirty(true);
  }

  function toggleBillable(row: GridRow) {
    const nextKey = rowKey(row.projectId, row.taskId, !row.billable);
    if (rows.some((r) => r.key === nextKey)) return;
    setRows((current) => current.map((r) => (r.key === row.key ? { ...r, billable: !r.billable, key: nextKey } : r)));
    setDirty(true);
  }

  function addRow(value: string) {
    const [projectId, task] = value.split("|");
    if (!projectId) return;
    const row = emptyRow(projectId, task || null);
    if (rows.some((r) => r.key === row.key)) return;
    rowsTouched.current = true;
    setRows((current) => [...current, row]);
  }

  function removeRow(row: GridRow) {
    rowsTouched.current = true;
    setRows((current) => current.filter((r) => r.key !== row.key));
    if (rowHours(row) > 0) setDirty(true);
  }

  function openNotes(row: GridRow) {
    setNotesFor(row.key);
  }

  const closeNotes = useCallback(() => setNotesFor(null), []);

  function saveNotes(notes: string[]) {
    const draft = notes.map((note) => note.trim().slice(0, NOTE_MAX));
    setRows((current) => current.map((row) => (row.key === notesFor ? { ...row, notes: draft } : row)));
    setNotesFor(null);
    setDirty(true);
  }

  const payload = useMemo(() => {
    const result: GridEntryBody[] = [];
    rows.forEach((row) => {
      // Entries on ended projects are frozen server-side and kept as they are.
      if (closedProjects.has(row.projectId)) return;
      row.hours.forEach((value, i) => {
        const n = parseHours(value || "0");
        if (!n || Number.isNaN(n)) return;
        result.push({
          projectId: row.projectId,
          taskId: row.taskId,
          workDate: dates[i],
          hours: n,
          description: row.notes[i]?.trim() || null,
          billable: row.billable,
        });
      });
    });
    return result;
  }, [rows, closedProjects, dates]);

  useEffect(() => {
    onEntriesChange?.(payload, !invalidCell && !overDay);
  }, [payload, invalidCell, overDay, onEntriesChange]);

  function discard() {
    rowsTouched.current = false;
    setRows(initialRows(entries, dates, openProjectIds));
    setDirty(false);
  }

  const canCopy = editable && entries.length === 0 && payload.length === 0 && !copying;
  const present = new Set(rows.map((row) => `${row.projectId}|${row.taskId ?? ""}`));
  const addOptions = choices
    .filter((c) => !c.closed)
    .map((c) => ({
      choice: c,
      projectMissing: !present.has(`${c.projectId}|`),
      tasks: c.tasks.filter((t) => !present.has(`${c.projectId}|${t.taskId}`)),
    }))
    .filter((group) => group.projectMissing || group.tasks.length);
  const columnCount = DAY_COUNT + (editable ? 4 : 3);
  const notesRow = rows.find((row) => row.key === notesFor) ?? null;
  const notesRowEditable = !!notesRow && editable && !closedProjects.has(notesRow.projectId);

  function dayClass(i: number) {
    if (dates[i] === today) return "text-center timesheet-day is-today";
    if (futureIndexes[i]) return "text-center timesheet-day is-future";
    return i >= 5 ? "text-center timesheet-day is-weekend" : "text-center timesheet-day";
  }

  function rowTitle(row: GridRow) {
    const task = taskLabel(row.taskId);
    return task ? `${projectLabel(row.projectId)} › ${task}` : projectLabel(row.projectId);
  }

  return (
    <div className="timesheet-grid">
      <style>{TIMESHEET_GRID_CSS}</style>

      {canCopy ? (
        <div className="d-flex align-items-center gap-2 mb-2 small text-muted">
          <span>Same as last week?</span>
          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={copying} onClick={onCopyLastWeek}>
            {copying ? "Copying…" : "Copy last week"}
          </button>
        </div>
      ) : null}

      <div className="table-responsive">
        <table className="table table-sm small align-middle mb-2">
          <thead>
            <tr>
              <th className="timesheet-sticky" style={{ minWidth: "13rem" }}>Project</th>
              {dates.map((date, i) => (
                <th key={date} className={dayClass(i)} style={{ minWidth: "4.5rem" }}>
                  <div>{new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</div>
                  <div className="text-muted fw-normal">{date === today ? "Today" : `${date.slice(8)}/${date.slice(5, 7)}`}</div>
                </th>
              ))}
              <th className="text-end">Total</th>
              <th className="text-center">Billable</th>
              {editable ? <th aria-label="Remove" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="text-muted text-center py-4">
                  {editable
                    ? addOptions.length
                      ? "Add the projects you worked on this week."
                      : "You are not allocated to any open project this week."
                    : "No time logged."}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const task = taskLabel(row.taskId);
              const closed = closedProjects.has(row.projectId);
              const rowEditable = editable && !closed;
              const noteCount = row.notes.filter((n) => n.trim()).length;
              const label = projectLabel(row.projectId);
              return (
                <tr key={row.key} className={closed ? "table-light text-muted" : undefined}>
                  <td className="timesheet-sticky">
                    <div className="fw-semibold">
                      {label}
                      {closed ? (
                        <span className="badge bg-secondary ms-2" title="The project has ended; these hours can no longer be changed">
                          {closedProjectLabel(closedProjects.get(row.projectId))}
                        </span>
                      ) : null}
                      {!editable && row.approved ? <span className="badge text-bg-success ms-2">Approved</span> : null}
                    </div>
                    {task ? <div className="text-muted">{task}</div> : null}
                    {rowEditable || noteCount ? (
                      <button
                        type="button"
                        className={`timesheet-note-btn${noteCount ? " has-notes" : ""}`}
                        aria-label={noteCount ? `Notes (${noteCount})` : "+ Add notes"}
                        onClick={() => openNotes(row)}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
                          <path d="M12.85.65a1.5 1.5 0 0 1 2.12 0l.38.38a1.5 1.5 0 0 1 0 2.12L6.2 12.3l-3.2.9.9-3.2L12.85.65ZM2 14h12v1.5H2V14Z" />
                        </svg>
                        <span>{noteCount ? `${noteCount} note${noteCount > 1 ? "s" : ""}` : "Add notes"}</span>
                      </button>
                    ) : null}
                  </td>
                  {row.hours.map((value, i) => {
                    const n = value ? parseHours(value) : 0;
                    const invalid = Number.isNaN(n) || n < 0 || n > MAX_HOURS_PER_DAY;
                    return (
                      <td key={dates[i]} className={`${dayClass(i)} position-relative`} title={row.notes[i] || undefined}>
                        {rowEditable ? (
                          <input
                            type="number"
                            min={0}
                            max={MAX_HOURS_PER_DAY}
                            step={0.25}
                            inputMode="decimal"
                            placeholder="0"
                            aria-label={`${label} ${dates[i]}`}
                            className={`form-control form-control-sm text-center px-1${invalid ? " is-invalid" : ""}`}
                            value={value}
                            onChange={(e) => updateHours(row.key, i, e.target.value)}
                          />
                        ) : (
                          <span>{value || "—"}</span>
                        )}
                        {row.notes[i]?.trim() ? <span className="timesheet-note-dot" aria-hidden="true" /> : null}
                      </td>
                    );
                  })}
                  <td className="text-end fw-semibold">{formatHours(rowHours(row))}</td>
                  <td className="text-center">
                    {rowEditable ? (
                      <input
                        type="checkbox"
                        className="form-check-input"
                        aria-label={`${label} billable`}
                        checked={row.billable}
                        onChange={() => toggleBillable(row)}
                      />
                    ) : row.billable ? (
                      "Yes"
                    ) : (
                      "No"
                    )}
                  </td>
                  {editable ? (
                    <td className="text-center">
                      {rowEditable ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-danger p-0 timesheet-remove"
                          aria-label={`Remove ${rowTitle(row)}`}
                          title="Remove from this timesheet"
                          onClick={() => removeRow(row)}
                        >
                          ✕
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
          {rows.length ? (
            <tfoot>
              <tr className="fw-semibold">
                <td className="timesheet-sticky">Total</td>
                {dayTotals.map((total, i) => (
                  <td key={dates[i]} className={`${dayClass(i)}${total > MAX_HOURS_PER_DAY ? " text-danger" : ""}`}>
                    {formatHours(total)}
                  </td>
                ))}
                <td className="text-end">{formatHours(grandTotal)}</td>
                <td colSpan={editable ? 2 : 1} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {overDay ? <div className="alert alert-danger py-2 small mb-2">A day cannot have more than 24 hours.</div> : null}
      {hasFutureHours ? (
        <div className="alert alert-info py-2 small mb-2">
          Some hours are on future dates, so this week can only be saved as a draft for now.
        </div>
      ) : null}

      {editable && (addOptions.length || showSaveControls) ? (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          {addOptions.length ? (
            <select
              className="form-select form-select-sm"
              style={{ maxWidth: "18rem" }}
              aria-label="Add project or task"
              value=""
              onChange={(e) => addRow(e.target.value)}
            >
              <option value="">+ Add project or task</option>
              {addOptions.map(({ choice, projectMissing, tasks }) => (
                <optgroup key={choice.projectId} label={choice.name}>
                  {projectMissing ? <option value={`${choice.projectId}|`}>{choice.name}</option> : null}
                  {tasks.map((t) => (
                    <option key={t.taskId} value={`${choice.projectId}|${t.taskId}`}>
                      {`${choice.name} › ${t.name}`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          ) : null}
          {showSaveControls ? (
            <div className="d-flex gap-2 ms-auto">
              {dirty ? (
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={saving} onClick={discard}>
                  Discard
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!dirty || saving || invalidCell || overDay}
                onClick={() => onSave(payload)}
              >
                {saving ? "Saving…" : "Save Week"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {notesRow ? (
        <TimesheetNotesModal
          title={rowTitle(notesRow)}
          labelPrefix={projectLabel(notesRow.projectId)}
          dates={dates}
          hours={notesRow.hours}
          notes={notesRow.notes}
          today={today}
          editable={notesRowEditable}
          onClose={closeNotes}
          onSave={saveNotes}
        />
      ) : null}
    </div>
  );
}

const TIMESHEET_GRID_CSS = `
.timesheet-grid .timesheet-sticky { position: sticky; left: 0; background: var(--bs-body-bg, #fff); z-index: 1; }
.timesheet-grid .timesheet-day.is-weekend { background: rgba(108, 117, 125, 0.06); }
.timesheet-grid .timesheet-day.is-future { background: rgba(13, 110, 253, 0.04); }
.timesheet-grid .timesheet-day.is-today { background: rgba(255, 193, 7, 0.14); }
.timesheet-grid .timesheet-note-dot { position: absolute; top: 4px; right: 4px; width: 6px; height: 6px; border-radius: 50%; background: var(--bs-primary, #0d6efd); }
.timesheet-grid .timesheet-note-btn { display: inline-flex; align-items: center; gap: 0.3rem; margin-top: 0.2rem; padding: 0.1rem 0.5rem; font-size: 0.75rem; border-radius: 999px; border: 1px dashed var(--bs-border-color, #ced4da); background: transparent; color: var(--bs-secondary-color, #6c757d); }
.timesheet-grid .timesheet-note-btn:hover { border-color: var(--bs-primary, #0d6efd); color: var(--bs-primary, #0d6efd); }
.timesheet-grid .timesheet-note-btn.has-notes { border-style: solid; border-color: rgba(13, 110, 253, 0.3); background: rgba(13, 110, 253, 0.08); color: var(--bs-primary, #0d6efd); font-weight: 500; }
.timesheet-grid .timesheet-remove { text-decoration: none; font-size: 0.9rem; line-height: 1; }
.timesheet-grid input[type=number]::placeholder { color: #ced4da; }
`;
