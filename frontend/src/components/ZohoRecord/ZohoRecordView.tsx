import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";
import { ZohoRecordAvatar } from "./ZohoRecordAvatar";

export interface ZohoRecordRelatedLink {
  id: string;
  label: string;
}

export interface ZohoRecordTab {
  id: string;
  label: string;
  visible?: boolean;
  content: ReactNode;
}

export interface ZohoRecordViewProps {
  title: string;
  subtitle?: string;
  avatarLabel?: string;
  avatarUrl?: string | null;
  avatarVariant?: "person" | "building";
  status?: ReactNode;
  meta?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  onBack?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  relatedLinks?: ZohoRecordRelatedLink[];
  activeRelatedId?: string;
  onRelatedClick?: (id: string) => void;
  tabs: ZohoRecordTab[];
  defaultTab?: string;
  recordKey?: string;
  className?: string;
}

export function ZohoRecordView({
  title,
  subtitle,
  avatarLabel,
  avatarUrl,
  avatarVariant = "person",
  status,
  meta,
  primaryAction,
  secondaryActions,
  onBack,
  onPrev,
  onNext,
  hasPrev = !!onPrev,
  hasNext = !!onNext,
  relatedLinks = [],
  activeRelatedId,
  onRelatedClick,
  tabs,
  defaultTab,
  recordKey,
  className = "",
}: ZohoRecordViewProps) {
  const visibleTabs = tabs.filter((tab) => tab.visible !== false);
  const initialTab = useMemo(() => {
    if (defaultTab && visibleTabs.some((tab) => tab.id === defaultTab)) return defaultTab;
    return visibleTabs[0]?.id ?? "overview";
  }, [defaultTab, visibleTabs]);

  const [activeTab, setActiveTab] = useState(initialTab);
  const active = visibleTabs.find((tab) => tab.id === activeTab) ?? visibleTabs[0];

  useEffect(() => {
    setActiveTab(initialTab);
  }, [recordKey, initialTab]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id ?? "overview");
    }
  }, [activeTab, visibleTabs]);

  function handleRelatedClick(id: string) {
    onRelatedClick?.(id);
    const target = document.getElementById(`zoho-record-section-${id}`);
    if (target) {
      setActiveTab("overview");
      window.setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
  }

  const displayTitle = subtitle ? `${title} - ${subtitle}` : title;

  return (
    <div className={`zoho-record-page ${className}`.trim()}>
      <header className="zoho-record-topbar">
        <div className="zoho-record-topbar-left">
          {onBack ? (
            <button type="button" className="btn btn-link zoho-record-back" onClick={onBack} aria-label="Back to list">
              <ToolbarIcon name="chevron-left" />
            </button>
          ) : null}
          <ZohoRecordAvatar
            label={avatarLabel ?? title}
            imageUrl={avatarUrl}
            variant={avatarVariant}
          />
          <div className="zoho-record-identity min-w-0">
            <h1 className="zoho-record-title">{displayTitle}</h1>
            {status ? <div className="zoho-record-status">{status}</div> : null}
            {meta ? <div className="zoho-record-meta">{meta}</div> : null}
          </div>
        </div>

        <div className="zoho-record-topbar-right">
          {primaryAction ? <div className="zoho-record-primary-action">{primaryAction}</div> : null}
          {secondaryActions ? <div className="zoho-record-secondary-actions">{secondaryActions}</div> : null}
          {(onPrev || onNext) ? (
            <div className="zoho-record-nav-arrows">
              <button type="button" className="btn btn-light btn-sm" disabled={!hasPrev} onClick={onPrev} aria-label="Previous record">
                <ToolbarIcon name="chevron-left" />
              </button>
              <button type="button" className="btn btn-light btn-sm" disabled={!hasNext} onClick={onNext} aria-label="Next record">
                <ToolbarIcon name="chevron-right" />
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="zoho-record-layout">
        {relatedLinks.length > 0 ? (
          <aside className="zoho-record-related-sidebar" aria-label="Related List">
            <div className="zoho-record-related-sidebar-title">Related List</div>
            <ul className="zoho-record-related-links">
              {relatedLinks.map((link) => (
                <li key={link.id}>
                  <button
                    type="button"
                    className={`zoho-record-related-link${activeRelatedId === link.id ? " is-active" : ""}`}
                    onClick={() => handleRelatedClick(link.id)}
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}

        <div className="zoho-record-main">
          {visibleTabs.length > 1 ? (
            <nav className="zoho-record-tabs" aria-label="Record views">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`zoho-record-tab${active?.id === tab.id ? " is-active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={active?.id === tab.id ? "page" : undefined}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          ) : null}
          <div className="zoho-record-body">{active?.content ?? null}</div>
        </div>
      </div>
    </div>
  );
}
