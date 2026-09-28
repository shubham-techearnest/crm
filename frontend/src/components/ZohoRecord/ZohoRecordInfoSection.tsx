import { useState, type ReactNode } from "react";

export interface ZohoRecordInfoSectionProps {
  id?: string;
  title: string;
  fields: { label: string; value: ReactNode }[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function ZohoRecordInfoSection({
  id,
  title,
  fields,
  collapsible = true,
  defaultOpen = true,
}: ZohoRecordInfoSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const left = fields.filter((_, index) => index % 2 === 0);
  const right = fields.filter((_, index) => index % 2 === 1);

  return (
    <section className="zoho-record-info-section" id={id}>
      <div className="zoho-record-info-section-header">
        {collapsible ? (
          <button type="button" className="btn btn-link btn-sm zoho-record-hide-details" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide Details" : "Show Details"}
          </button>
        ) : null}
        <h3 className="zoho-record-info-section-title">{title}</h3>
      </div>
      {open ? (
        <div className="zoho-record-info-grid">
          <dl className="zoho-record-field-grid">
            {left.map((field) => (
              <div className="zoho-record-field" key={field.label}>
                <dt className="zoho-record-field-label">{field.label}</dt>
                <dd className="zoho-record-field-value">{field.value ?? "—"}</dd>
              </div>
            ))}
          </dl>
          <dl className="zoho-record-field-grid">
            {right.map((field) => (
              <div className="zoho-record-field" key={field.label}>
                <dt className="zoho-record-field-label">{field.label}</dt>
                <dd className="zoho-record-field-value">{field.value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </section>
  );
}
