import { useState, type ReactNode } from "react";

export interface TechEarnestRecordInfoSectionProps {
  id?: string;
  title: string;
  fields: { label: string; value: ReactNode }[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function TechEarnestRecordInfoSection({
  id,
  title,
  fields,
  collapsible = true,
  defaultOpen = true,
}: TechEarnestRecordInfoSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const left = fields.filter((_, index) => index % 2 === 0);
  const right = fields.filter((_, index) => index % 2 === 1);

  return (
    <section className="techearnest-record-info-section" id={id}>
      <div className="techearnest-record-info-section-header">
        {collapsible ? (
          <button type="button" className="btn btn-link btn-sm techearnest-record-hide-details" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide Details" : "Show Details"}
          </button>
        ) : null}
        <h3 className="techearnest-record-info-section-title">{title}</h3>
      </div>
      {open ? (
        <div className="techearnest-record-info-grid">
          <dl className="techearnest-record-field-grid">
            {left.map((field) => (
              <div className="techearnest-record-field" key={field.label}>
                <dt className="techearnest-record-field-label">{field.label}</dt>
                <dd className="techearnest-record-field-value">{field.value ?? "—"}</dd>
              </div>
            ))}
          </dl>
          <dl className="techearnest-record-field-grid">
            {right.map((field) => (
              <div className="techearnest-record-field" key={field.label}>
                <dt className="techearnest-record-field-label">{field.label}</dt>
                <dd className="techearnest-record-field-value">{field.value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </section>
  );
}
