import type { ReactNode } from "react";

export interface ZohoRecordField {
  label: string;
  value: ReactNode;
}

export function ZohoRecordFieldGrid({ fields }: { fields: ZohoRecordField[] }) {
  return (
    <dl className="zoho-record-field-grid">
      {fields.map((field) => (
        <div className="zoho-record-field" key={field.label}>
          <dt className="zoho-record-field-label">{field.label}</dt>
          <dd className="zoho-record-field-value">{field.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ZohoRecordSummaryStrip({ fields }: { fields: ZohoRecordField[] }) {
  return (
    <div className="zoho-record-summary-strip">
      {fields.map((field) => (
        <div className="zoho-record-summary-item" key={field.label}>
          <span className="zoho-record-summary-label">{field.label}</span>
          <span className="zoho-record-summary-value">{field.value ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}
