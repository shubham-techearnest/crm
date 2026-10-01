import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RecordLinkSource } from "@/components/RecordLink/RecordLinkSource";
import { TechEarnestRecordView, type TechEarnestRecordRelatedLink, type TechEarnestRecordTab } from "@/components/TechEarnestRecord";
import { CustomFieldsRecordPanel } from "@/features/customFields/CustomFieldsRecordPanel";
import { RecordHeader } from "./RecordHeader";

export type RecordShellTabId =
  | "overview"
  | "related"
  | "timeline"
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
  meta?: ReactNode;
  /** @deprecated Prefer `status` — kept for backward compatibility. */
  badges?: ReactNode;
  status?: ReactNode;
  /** Primary header action (e.g. Edit, Submit, Issue). */
  primaryAction?: ReactNode;
  /** Secondary header actions (e.g. Void, Reject, Close). */
  secondaryActions?: ReactNode;
  /** @deprecated Use `secondaryActions` — all actions render in the secondary group. */
  actions?: ReactNode;
  onClose?: () => void;
  /** Alias for onClose — TechEarnest-style back navigation. */
  onBack?: () => void;
  tabs: RecordShellTab[];
  defaultTab?: RecordShellTabId;
  /** When the selected record changes, reset the active tab. */
  recordKey?: string;
  className?: string;
  /** `page` = full TechEarnest record view; `drawer` = legacy split-pane panel. */
  layout?: "page" | "drawer";
  avatarLabel?: string;
  avatarUrl?: string | null;
  avatarVariant?: "person" | "building";
  relatedLinks?: TechEarnestRecordRelatedLink[];
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  /** Metadata table code; shows the record's custom fields at the end of the overview tab. */
  customFieldsTable?: string;
}

/**
 * Reusable record detail shell: TechEarnest full-page layout or legacy drawer.
 */
export function RecordShell({
  title,
  subtitle,
  meta,
  badges,
  status,
  primaryAction,
  secondaryActions,
  actions,
  onClose,
  onBack,
  tabs,
  defaultTab,
  recordKey,
  className = "",
  layout = "page",
  avatarLabel,
  avatarUrl,
  avatarVariant,
  relatedLinks,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  customFieldsTable,
}: RecordShellProps) {
  const shownTabs = tabs.filter((tab) => tab.visible !== false);
  const customFieldsTabId = shownTabs.some((tab) => tab.id === "overview") ? "overview" : shownTabs[0]?.id;
  const visibleTabs =
    customFieldsTable && recordKey
      ? shownTabs.map((tab) =>
          tab.id === customFieldsTabId
            ? {
                ...tab,
                content: (
                  <>
                    {tab.content}
                    <CustomFieldsRecordPanel tableCode={customFieldsTable} recordId={recordKey} />
                  </>
                ),
              }
            : tab,
        )
      : shownTabs;
  const resolvedStatus = status ?? badges;
  const resolvedSecondary = secondaryActions ?? actions;
  const resolvedBack = onBack ?? onClose;
  const initialTab = useMemo(() => {
    if (defaultTab && visibleTabs.some((tab) => tab.id === defaultTab)) {
      return defaultTab;
    }
    return visibleTabs[0]?.id ?? "overview";
  }, [defaultTab, visibleTabs]);
  const [activeTab, setActiveTab] = useState<RecordShellTabId>(initialTab);
  const active = visibleTabs.find((tab) => tab.id === activeTab) ?? visibleTabs[0];

  useEffect(() => {
    setActiveTab(initialTab);
  }, [recordKey, initialTab]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id ?? "overview");
    }
  }, [activeTab, visibleTabs]);

  if (layout === "page") {
    const techearnestTabs: TechEarnestRecordTab[] = visibleTabs.map((tab) => ({
      id: tab.id,
      label: tab.label,
      visible: tab.visible,
      content: tab.content,
    }));

    return (
      <TechEarnestRecordView
        className={className}
        title={title}
        subtitle={subtitle}
        meta={meta}
        status={resolvedStatus}
        primaryAction={primaryAction}
        secondaryActions={resolvedSecondary}
        onBack={resolvedBack}
        onPrev={onPrev}
        onNext={onNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
        relatedLinks={relatedLinks}
        tabs={techearnestTabs}
        defaultTab={defaultTab}
        recordKey={recordKey}
        avatarLabel={avatarLabel ?? title}
        avatarUrl={avatarUrl}
        avatarVariant={avatarVariant}
      />
    );
  }

  return (
    <RecordLinkSource label={title}>
      <aside className={`module-detail-drawer record-shell ${className}`.trim()}>
        <header className="record-shell-header">
          <RecordHeader
            title={title}
            subtitle={subtitle}
            meta={meta}
            status={resolvedStatus}
            primaryAction={primaryAction}
            secondaryActions={resolvedSecondary}
            onClose={onClose}
          />
          {visibleTabs.length > 1 ? (
            <nav className="record-shell-tabs" aria-label="Record sections">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`record-shell-tab${active?.id === tab.id ? " is-active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={active?.id === tab.id ? "page" : undefined}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          ) : null}
        </header>
        <div className="record-shell-body">{active?.content ?? null}</div>
      </aside>
    </RecordLinkSource>
  );
}
