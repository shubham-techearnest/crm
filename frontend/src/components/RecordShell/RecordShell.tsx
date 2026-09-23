import { useState, type ReactNode } from "react";

export type RecordShellTabId =
  | "overview"
  | "related"
  | "activities"
  | "notes"
  | "documents"
  | "audit"
  | (string & {});

export interface RecordShellTab {
  id: RecordShellTabId;
  label: string;
  /** When false, tab is omitted (permission-aware). Default true. */
  visible?: boolean;
  content: ReactNode;
}

export interface RecordShellProps {
  title: string;
  subtitle?: string;
  badges?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  tabs: RecordShellTab[];
  defaultTab?: RecordShellTabId;
  className?: string;
}

/**
 * Reusable record detail shell: header + permission-aware tabs
 * (Overview / Related / Activities / Notes / Documents / Audit).
 */
export function RecordShell({
  title,
  subtitle,
  badges,
  actions,
  onClose,
  tabs,
  defaultTab,
  className = "",
}: RecordShellProps) {
  const visibleTabs = tabs.filter((tab) => tab.visible !== false);
  const initial =
    (defaultTab && visibleTabs.some((t) => t.id === defaultTab) ? defaultTab : undefined) ??
    visibleTabs[0]?.id ??
    "overview";
  const [activeTab, setActiveTab] = useState<RecordShellTabId>(initial);
  const active = visibleTabs.find((t) => t.id === activeTab) ?? visibleTabs[0];

  return (
    <aside className={`module-detail-drawer record-shell ${className}`.trim()}>
      <header className="record-shell-header">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <div className="min-w-0">
            <div className="fw-semibold text-truncate">{title}</div>
            {subtitle ? <div className="text-muted small text-truncate">{subtitle}</div> : null}
            {badges ? <div className="mt-1 d-flex flex-wrap gap-1">{badges}</div> : null}
          </div>
          {onClose ? (
            <button type="button" className="btn btn-outline-secondary btn-sm flex-shrink-0" onClick={onClose}>
              Close
            </button>
          ) : null}
        </div>
        {actions ? <div className="record-shell-actions mb-2">{actions}</div> : null}
        {visibleTabs.length > 1 ? (
          <nav className="record-shell-tabs" aria-label="Record sections">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`record-shell-tab${active?.id === tab.id ? " is-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        ) : null}
      </header>
      <div className="record-shell-body">{active?.content ?? null}</div>
    </aside>
  );
}
