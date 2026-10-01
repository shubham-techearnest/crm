import { useEffect, useMemo, useRef, useState } from "react";

const NOTE_MAX = 500;

export interface TimesheetNotesModalProps {
  /** Project (and task) the notes belong to. */
  title: string;
  /** Used in the textarea labels, e.g. "Horizon note 2026-09-28". */
  labelPrefix: string;
  dates: string[];
  hours: string[];
  notes: string[];
  today: string;
  editable: boolean;
  onClose: () => void;
  onSave: (notes: string[]) => void;
}

function hasHours(value: string | undefined) {
  const n = Number(value || "0");
  return Number.isFinite(n) && n > 0;
}

function formatDay(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
    day: d.toLocaleDateString(undefined, { day: "numeric" }),
    month: d.toLocaleDateString(undefined, { month: "short" }),
  };
}

export function TimesheetNotesModal({
  title,
  labelPrefix,
  dates,
  hours,
  notes,
  today,
  editable,
  onClose,
  onSave,
}: TimesheetNotesModalProps) {
  const [draft, setDraft] = useState<string[]>(() => [...notes]);
  const firstField = useRef<HTMLInputElement | null>(null);

  const loggedDays = useMemo(() => dates.map((_, i) => hasHours(hours[i])), [dates, hours]);
  const loggedCount = loggedDays.filter(Boolean).length;
  const notedCount = draft.filter((note, i) => loggedDays[i] && note.trim()).length;
  const totalHours = hours.reduce((sum, h) => sum + (hasHours(h) ? Number(h) : 0), 0);
  const changed = draft.some((note, i) => note.trim() !== (notes[i] ?? "").trim());
  const firstEditable = loggedDays.findIndex((logged, i) => logged && !draft[i]?.trim());
  const focusIndex = firstEditable >= 0 ? firstEditable : loggedDays.indexOf(true);

  useEffect(() => {
    firstField.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (editable && event.key === "Enter" && (event.ctrlKey || event.metaKey)) onSave(draft);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [draft, editable, onClose, onSave]);

  function setNote(index: number, value: string) {
    setDraft((current) => current.map((note, i) => (i === index ? value : note)));
  }

  function applyToAllLogged(index: number) {
    const value = draft[index];
    setDraft((current) => current.map((note, i) => (loggedDays[i] ? value : note)));
  }

  const weekRange = dates.length
    ? `${formatDay(dates[0]).day} ${formatDay(dates[0]).month} – ${formatDay(dates[dates.length - 1]).day} ${formatDay(dates[dates.length - 1]).month}`
    : "";

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div
        className="modal fade show d-block ts-notes"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tsNotesTitle"
        onClick={onClose}
      >
        <style>{NOTES_CSS}</style>
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content border-0 shadow">
            <div className="modal-header ts-notes-header">
              <div className="min-w-0">
                <div className="text-uppercase small text-muted fw-semibold ts-notes-eyebrow">Work notes</div>
                <h5 id="tsNotesTitle" className="modal-title fs-5 mb-1 text-truncate">{title}</h5>
                <div className="d-flex flex-wrap gap-2 small text-muted">
                  <span>Week of {weekRange}</span>
                  <span aria-hidden="true">·</span>
                  <span>{totalHours} h logged</span>
                  {editable && loggedCount ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className={notedCount === loggedCount ? "text-success fw-semibold" : undefined}>
                        {notedCount} of {loggedCount} days described
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body ts-notes-body">
              {editable && loggedCount === 0 ? (
                <div className="ts-notes-empty">
                  Enter hours in the grid first; then you can describe what you worked on each day.
                </div>
              ) : null}

              <ul className="list-unstyled mb-0">
                {dates.map((date, i) => {
                  const { weekday, day, month } = formatDay(date);
                  const logged = loggedDays[i];
                  const note = draft[i] ?? "";
                  if (!editable && !note.trim()) return null;
                  const isToday = date === today;

                  if (editable && !logged) {
                    return (
                      <li key={date} className="ts-notes-day is-idle">
                        <div className="ts-notes-date">
                          <span className="ts-notes-weekday">{weekday}</span>
                          <span className="ts-notes-daynum">{day}</span>
                          <span className="ts-notes-month">{month}</span>
                        </div>
                        <div className="ts-notes-idle-text">No hours logged{isToday ? " today" : ""}</div>
                      </li>
                    );
                  }

                  return (
                    <li key={date} className={`ts-notes-day${isToday ? " is-today" : ""}`}>
                      <div className="ts-notes-date">
                        <span className="ts-notes-weekday">{weekday}</span>
                        <span className="ts-notes-daynum">{day}</span>
                        <span className="ts-notes-month">{month}</span>
                        {logged ? <span className="badge rounded-pill ts-notes-hours">{hours[i]} h</span> : null}
                      </div>
                      <div className="flex-grow-1 min-w-0">
                        {editable ? (
                          <>
                            <input
                              type="text"
                              ref={i === focusIndex ? firstField : undefined}
                              maxLength={NOTE_MAX}
                              aria-label={`${labelPrefix} note ${date}`}
                              className="form-control ts-notes-input"
                              placeholder="What did you work on? e.g. Built checkout API, fixed login bug"
                              value={note}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                              }}
                              onChange={(e) => setNote(i, e.target.value)}
                            />
                            <div className="d-flex justify-content-between align-items-center mt-1 small">
                              {note.trim() && loggedCount > 1 ? (
                                <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => applyToAllLogged(i)}>
                                  Use this note for all {loggedCount} days
                                </button>
                              ) : (
                                <span />
                              )}
                              <span className={`text-muted${note.length > NOTE_MAX - 50 ? " text-warning" : ""}`}>
                                {note.length}/{NOTE_MAX}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="ts-notes-readonly">{note}</div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="modal-footer ts-notes-footer">
              {editable ? <span className="small text-muted me-auto d-none d-sm-inline">Ctrl + Enter to save · Esc to close</span> : null}
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
                {editable ? "Cancel" : "Close"}
              </button>
              {editable ? (
                <button type="button" className="btn btn-primary btn-sm px-3" disabled={!changed} onClick={() => onSave(draft)}>
                  Save Notes
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const NOTES_CSS = `
.ts-notes .min-w-0 { min-width: 0; }
.ts-notes-header { align-items: flex-start; padding: 1rem 1.25rem 0.75rem; border-bottom: 1px solid var(--bs-border-color, #dee2e6); }
.ts-notes-eyebrow { letter-spacing: 0.06em; font-size: 0.7rem; }
.ts-notes-body { padding: 0.75rem 1.25rem; background: var(--bs-tertiary-bg, #f8f9fa); }
.ts-notes-empty { padding: 0.75rem 1rem; margin-bottom: 0.75rem; border-radius: 0.5rem; background: #fff; border: 1px dashed var(--bs-border-color, #dee2e6); color: var(--bs-secondary-color, #6c757d); font-size: 0.875rem; }
.ts-notes-day { display: flex; gap: 1rem; align-items: flex-start; padding: 0.75rem; margin-bottom: 0.5rem; background: #fff; border: 1px solid var(--bs-border-color, #dee2e6); border-radius: 0.5rem; transition: border-color .15s, box-shadow .15s; }
.ts-notes-day:focus-within { border-color: var(--bs-primary, #0d6efd); box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.12); }
.ts-notes-day.is-today { border-left: 3px solid var(--bs-warning, #ffc107); }
.ts-notes-day.is-idle { align-items: center; padding: 0.4rem 0.75rem; background: transparent; border-style: dashed; }
.ts-notes-date { display: flex; flex-direction: column; align-items: center; width: 3.5rem; flex-shrink: 0; line-height: 1.1; }
.ts-notes-day.is-idle .ts-notes-date { flex-direction: row; gap: 0.3rem; width: 7rem; justify-content: flex-start; color: var(--bs-secondary-color, #6c757d); }
.ts-notes-weekday { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--bs-secondary-color, #6c757d); }
.ts-notes-daynum { font-size: 1.35rem; font-weight: 600; }
.ts-notes-day.is-idle .ts-notes-daynum { font-size: 0.85rem; font-weight: 500; }
.ts-notes-month { font-size: 0.7rem; color: var(--bs-secondary-color, #6c757d); }
.ts-notes-hours { margin-top: 0.35rem; background: rgba(13, 110, 253, 0.1); color: var(--bs-primary, #0d6efd); font-weight: 600; }
.ts-notes-idle-text { font-size: 0.8rem; color: var(--bs-secondary-color, #6c757d); }
.ts-notes-day { align-items: center; }
.ts-notes-input { font-size: 0.875rem; border-color: transparent; background: var(--bs-tertiary-bg, #f8f9fa); }
.ts-notes-input:focus { background: #fff; }
.ts-notes-readonly { white-space: pre-wrap; font-size: 0.875rem; padding-top: 0.25rem; }
.ts-notes-footer { padding: 0.6rem 1.25rem; }
`;
