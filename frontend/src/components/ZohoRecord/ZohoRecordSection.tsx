import type { ReactNode } from "react";

export interface ZohoRecordSectionProps {
  id?: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function ZohoRecordSection({
  id,
  title,
  actions,
  children,
  collapsible = false,
  defaultOpen = true,
}: ZohoRecordSectionProps) {
  return (
    <section className="zoho-record-section" id={id}>
      <div className="zoho-record-section-header">
        {collapsible ? (
          <details className="zoho-record-section-details" open={defaultOpen}>
            <summary className="zoho-record-section-title">{title}</summary>
            <div className="zoho-record-section-body">{children}</div>
          </details>
        ) : (
          <>
            <h3 className="zoho-record-section-title">{title}</h3>
            {actions ? <div className="zoho-record-section-actions">{actions}</div> : null}
          </>
        )}
      </div>
      {!collapsible ? <div className="zoho-record-section-body">{children}</div> : null}
      {collapsible && actions ? <div className="zoho-record-section-actions zoho-record-section-actions--float">{actions}</div> : null}
    </section>
  );
}

export function ZohoRecordRelatedCard({
  id,
  title,
  actions,
  children,
  emptyLabel = "No records found",
  isEmpty = false,
}: {
  id?: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  emptyLabel?: string;
  isEmpty?: boolean;
}) {
  return (
    <section className="zoho-record-related-card" id={id}>
      <div className="zoho-record-related-card-header">
        <h3 className="zoho-record-related-card-title">{title}</h3>
        {actions ? <div className="zoho-record-related-card-actions">{actions}</div> : null}
      </div>
      <div className="zoho-record-related-card-body">
        {children}
        {isEmpty ? <p className="zoho-record-empty">{emptyLabel}</p> : null}
      </div>
    </section>
  );
}
