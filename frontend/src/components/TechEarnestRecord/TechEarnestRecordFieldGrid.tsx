import type { ReactNode } from "react";

export interface TechEarnestRecordField {
  label: string;
  value: ReactNode;
}

export function TechEarnestRecordFieldGrid({ fields }: { fields: TechEarnestRecordField[] }) {
  return (
    <dl className="techearnest-record-field-grid">
      {fields.map((field) => (
        <div className="techearnest-record-field" key={field.label}>
          <dt className="techearnest-record-field-label">{field.label}</dt>
          <dd className="techearnest-record-field-value">{field.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TechEarnestRecordSummaryStrip({ fields }: { fields: TechEarnestRecordField[] }) {
  return (
    <div className="techearnest-record-summary-strip">
      {fields.map((field) => (
        <div className="techearnest-record-summary-item" key={field.label}>
          <span className="techearnest-record-summary-label">{field.label}</span>
          <span className="techearnest-record-summary-value">{field.value ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}
