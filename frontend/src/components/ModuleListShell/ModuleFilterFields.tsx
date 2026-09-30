import type { ReactNode } from "react";

/** Label + control row inside a `.module-filter-section`. */
export function ModuleFilterField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="module-filter-field">
      <label className="form-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** From / to date pair on one row; each side bounds the other. */
export function ModuleFilterDateRange({
  label,
  from,
  to,
  onFromChange,
  onToChange,
}: {
  label: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  return (
    <div className="module-filter-field">
      <span className="form-label d-block">{label}</span>
      <div className="module-filter-range">
        <input
          type="date"
          className="form-control form-control-sm"
          aria-label={`${label} from`}
          value={from}
          max={to || undefined}
          onChange={(e) => onFromChange(e.target.value)}
        />
        <span className="module-filter-range-sep" aria-hidden="true">
          –
        </span>
        <input
          type="date"
          className="form-control form-control-sm"
          aria-label={`${label} to`}
          value={to}
          min={from || undefined}
          onChange={(e) => onToChange(e.target.value)}
        />
      </div>
    </div>
  );
}

export function ModuleFilterCheckbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="form-check module-filter-field">
      <input id={id} className="form-check-input" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label className="form-check-label small" htmlFor={id}>
        {label}
      </label>
    </div>
  );
}
