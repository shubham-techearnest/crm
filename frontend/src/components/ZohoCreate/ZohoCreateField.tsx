import type { ReactNode } from "react";

export interface ZohoCreateFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
  wide?: boolean;
}

export function ZohoCreateField({
  label,
  required,
  error,
  children,
  className = "",
  wide,
}: ZohoCreateFieldProps) {
  return (
    <div
      className={`zoho-field${required ? " zoho-field--required" : ""}${wide ? " zoho-field--wide" : ""} ${className}`.trim()}
    >
      <label className={`zoho-field-label${required ? " required" : ""}`}>{label}</label>
      <div className="zoho-field-control">
        {children}
        {error ? <div className="invalid-feedback d-block">{error}</div> : null}
      </div>
    </div>
  );
}

export function ZohoCreateGrid({ children }: { children: ReactNode }) {
  return <div className="zoho-create-grid">{children}</div>;
}

export function ZohoCreateColumn({ children }: { children: ReactNode }) {
  return <div className="zoho-create-col">{children}</div>;
}
