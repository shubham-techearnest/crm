import type { ReactNode } from "react";
import type { RecordShellTab, RecordShellTabId } from "./RecordShell";

/** Standard record drawer tab labels. */
export const RECORD_TAB_LABELS = {
  overview: "Overview",
  related: "Related",
  timeline: "Timeline",
  notes: "Notes",
  documents: "Documents",
  audit: "Audit",
} as const;

export function recordOverviewTab(content: ReactNode, options?: { visible?: boolean }): RecordShellTab {
  return { id: "overview", label: RECORD_TAB_LABELS.overview, content, visible: options?.visible };
}

export function recordRelatedTab(content: ReactNode, options?: { visible?: boolean }): RecordShellTab {
  return { id: "related", label: RECORD_TAB_LABELS.related, content, visible: options?.visible };
}

/** Activities / audit events presented as a timeline. Uses legacy `activities` id for compatibility. */
export function recordTimelineTab(content: ReactNode, options?: { visible?: boolean; id?: RecordShellTabId }): RecordShellTab {
  return {
    id: options?.id ?? "activities",
    label: RECORD_TAB_LABELS.timeline,
    content,
    visible: options?.visible,
  };
}

export function recordNotesTab(content: ReactNode, options?: { visible?: boolean }): RecordShellTab {
  return { id: "notes", label: RECORD_TAB_LABELS.notes, content, visible: options?.visible };
}

export function recordDocumentsTab(content: ReactNode, options?: { visible?: boolean }): RecordShellTab {
  return { id: "documents", label: RECORD_TAB_LABELS.documents, content, visible: options?.visible };
}

export function recordAuditTab(content: ReactNode, options?: { visible?: boolean }): RecordShellTab {
  return { id: "audit", label: RECORD_TAB_LABELS.audit, content, visible: options?.visible };
}

export function recordCustomTab(
  id: RecordShellTabId,
  label: string,
  content: ReactNode,
  options?: { visible?: boolean },
): RecordShellTab {
  return { id, label, content, visible: options?.visible };
}

export function RecordOverviewField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="record-overview-field">
      <dt className="record-overview-label">{label}</dt>
      <dd className="record-overview-value">{value ?? "—"}</dd>
    </div>
  );
}

export function RecordOverviewGrid({ children }: { children: ReactNode }) {
  return <dl className="record-overview-grid">{children}</dl>;
}

export function RecordSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="record-section">
      <h3 className="record-section-title">{title}</h3>
      {children}
    </section>
  );
}

export function RecordTimelineList({
  items,
  emptyLabel = "No timeline entries",
}: {
  items: ReactNode[];
  emptyLabel?: string;
}) {
  if (!items.length) {
    return <p className="record-empty-hint">{emptyLabel}</p>;
  }
  return <ul className="record-timeline-list">{items}</ul>;
}

export function RecordRelatedList({
  items,
  emptyLabel = "None",
}: {
  items: ReactNode[];
  emptyLabel?: string;
}) {
  if (!items.length) {
    return <li className="text-muted">{emptyLabel}</li>;
  }
  return <>{items}</>;
}

export function RecordEmptyHint({ children }: { children: ReactNode }) {
  return <p className="record-empty-hint">{children}</p>;
}
