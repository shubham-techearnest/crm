import type { ReactNode } from "react";

export interface TechEarnestRecordSectionProps {
  id?: string;
  title: string;
  actions?: ReactNode;
  children?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function TechEarnestRecordSection({
  id,
  title,
  actions,
  children,
  collapsible = false,
  defaultOpen = true,
}: TechEarnestRecordSectionProps) {
  return (
    <section className="techearnest-record-section" id={id}>
      <div className="techearnest-record-section-header">
        {collapsible ? (
          <details className="techearnest-record-section-details" open={defaultOpen}>
            <summary className="techearnest-record-section-title">{title}</summary>
            <div className="techearnest-record-section-body">{children}</div>
          </details>
        ) : (
          <>
            <h3 className="techearnest-record-section-title">{title}</h3>
            {actions ? <div className="techearnest-record-section-actions">{actions}</div> : null}
          </>
        )}
      </div>
      {!collapsible ? <div className="techearnest-record-section-body">{children}</div> : null}
      {collapsible && actions ? <div className="techearnest-record-section-actions techearnest-record-section-actions--float">{actions}</div> : null}
    </section>
  );
}

export function TechEarnestRecordRelatedCard({
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
  children?: ReactNode;
  emptyLabel?: string;
  isEmpty?: boolean;
}) {
  return (
    <section className="techearnest-record-related-card" id={id}>
      <div className="techearnest-record-related-card-header">
        <h3 className="techearnest-record-related-card-title">{title}</h3>
        {actions ? <div className="techearnest-record-related-card-actions">{actions}</div> : null}
      </div>
      <div className="techearnest-record-related-card-body">
        {children}
        {isEmpty ? <p className="techearnest-record-empty">{emptyLabel}</p> : null}
      </div>
    </section>
  );
}
