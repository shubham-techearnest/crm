import type { ReactNode } from "react";

export interface TechEarnestCreateFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
  wide?: boolean;
  hint?: ReactNode;
}

export function TechEarnestCreateField({
  label,
  required,
  error,
  children,
  className = "",
  wide,
  hint,
}: TechEarnestCreateFieldProps) {
  return (
    <div
      className={`techearnest-field${required ? " techearnest-field--required" : ""}${wide ? " techearnest-field--wide" : ""} ${className}`.trim()}
    >
      <label className={`techearnest-field-label${required ? " required" : ""}`}>{label}</label>
      <div className="techearnest-field-control">
        {children}
        {error ? <div className="invalid-feedback d-block">{error}</div> : null}
        {hint && !error ? <div className="form-text small">{hint}</div> : null}
      </div>
    </div>
  );
}

export function TechEarnestCreateGrid({ children }: { children: ReactNode }) {
  return <div className="techearnest-create-grid">{children}</div>;
}

export function TechEarnestCreateColumn({ children }: { children: ReactNode }) {
  return <div className="techearnest-create-col">{children}</div>;
}
