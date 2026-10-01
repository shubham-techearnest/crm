import { useState, type MutableRefObject } from "react";
import { runBulkAction, type BulkAction, type BulkConfig, type BulkOutcome } from "./bulkActions";

interface BulkActionBarProps<T> {
  config: BulkConfig<T>;
  selectedRows: T[];
  rowKey: (row: T) => string;
  rowLabel: (row: T) => string;
  onFinished: (outcome: BulkOutcome) => void;
  /** Receives a function that opens an action's dialog by id (used by the toolbar ⋯ menu). */
  openActionRef?: MutableRefObject<((actionId: string) => void) | null>;
}

function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function BulkActionBar<T>({
  config,
  selectedRows,
  rowKey,
  rowLabel,
  onFinished,
  openActionRef,
}: BulkActionBarProps<T>) {
  const [pending, setPending] = useState<BulkAction<T> | null>(null);
  const [value, setValue] = useState("");
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
  const [showFailures, setShowFailures] = useState(false);

  const noun = config.noun ?? "records";
  const actions = (config.actions ?? []).filter((action) => action.visible !== false);
  const count = selectedRows.length;

  const open = (action: BulkAction<T>) => {
    setOutcome(null);
    setPending(action);
    setValue(action.input?.kind === "date" && action.input.defaultToday ? todayIso() : "");
  };
  if (openActionRef) {
    openActionRef.current = (actionId) => {
      const action = actions.find((candidate) => candidate.id === actionId);
      if (action && count && !running) open(action);
    };
  }

  const execute = async () => {
    if (!pending) return;
    setRunning(true);
    try {
      const result = await runBulkAction(pending, selectedRows, rowKey, value.trim(), rowLabel);
      setOutcome(result);
      setShowFailures(false);
      onFinished(result);
    } finally {
      setRunning(false);
      setPending(null);
    }
  };

  const eligibleCount = pending?.applies ? selectedRows.filter(pending.applies).length : count;
  const needsValue = pending?.input && !pending.input.optional;
  const canRun = !!pending && eligibleCount > 0 && (!needsValue || value.trim().length > 0) && !running;

  if (!pending && !outcome) return null;

  return (
    <div className="bulk-action-region">
      {outcome ? (
        <div
          className={`alert ${outcome.failures.length ? "alert-warning" : "alert-success"} bulk-action-result`}
          role="status"
        >
          <div className="d-flex justify-content-between align-items-start gap-2">
            <span>
              {outcome.action}: {outcome.succeeded} {outcome.doneLabel}
              {outcome.failures.length ? `, ${outcome.failures.length} failed` : ""}
              {outcome.skipped ? `, ${outcome.skipped} skipped (not applicable)` : ""}.
              {outcome.failures.length ? (
                <button type="button" className="btn btn-link btn-sm p-0 ms-2" onClick={() => setShowFailures((v) => !v)}>
                  {showFailures ? "Hide details" : "Show details"}
                </button>
              ) : null}
            </span>
            <button type="button" className="btn-close btn-sm" aria-label="Dismiss" onClick={() => setOutcome(null)} />
          </div>
          {showFailures ? (
            <ul className="bulk-action-result__failures">
              {outcome.failures.map((failure) => (
                <li key={failure.id}>
                  <strong>{failure.label}</strong> — {failure.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {pending ? (
        <div className="module-modal-backdrop" role="presentation" onClick={() => !running && setPending(null)}>
          <div className="module-modal" role="dialog" aria-label={pending.label} onClick={(event) => event.stopPropagation()}>
            <div className="module-modal-header">
              <h2 className="h5 mb-0">{pending.label}</h2>
              <button type="button" className="btn-close" aria-label="Close" disabled={running} onClick={() => setPending(null)} />
            </div>
            <div className="module-modal-body">
              <p className="small mb-2">
                This will apply to <strong>{eligibleCount}</strong> of {count} selected {noun}.
                {eligibleCount < count ? ` ${count - eligibleCount} will be skipped because the action does not apply to them.` : ""}
              </p>
              {pending.confirm ? <p className="small text-muted">{pending.confirm}</p> : null}
              {pending.input ? (
                <div className="mt-2">
                  <label className="form-label small" htmlFor="bulk-action-input">
                    {pending.input.label}
                    {pending.input.optional ? " (optional)" : ""}
                  </label>
                  {pending.input.kind === "select" ? (
                    <select
                      id="bulk-action-input"
                      className="form-select form-select-sm"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                    >
                      <option value="">{pending.input.placeholder ?? "Select…"}</option>
                      {pending.input.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : pending.input.kind === "date" ? (
                    <input
                      id="bulk-action-input"
                      type="date"
                      className="form-control form-control-sm"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                    />
                  ) : pending.input.multiline ? (
                    <textarea
                      id="bulk-action-input"
                      className="form-control form-control-sm"
                      rows={3}
                      placeholder={pending.input.placeholder}
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                    />
                  ) : (
                    <input
                      id="bulk-action-input"
                      className="form-control form-control-sm"
                      placeholder={pending.input.placeholder}
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                    />
                  )}
                </div>
              ) : null}
            </div>
            <div className="module-modal-footer">
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={running} onClick={() => setPending(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-sm ${pending.tone === "danger" ? "btn-danger" : "btn-primary"}`}
                disabled={!canRun}
                onClick={() => void execute()}
              >
                {running ? "Working…" : `${pending.label} (${eligibleCount})`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
