import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";
import { RecordLinkSource } from "@/components/RecordLink/RecordLinkSource";
import { readRecordNavState } from "@/hooks/useUrlRecord";
import { TechEarnestRecordAvatar } from "./TechEarnestRecordAvatar";

export interface TechEarnestRecordRelatedLink {
  id: string;
  label: string;
}

export interface TechEarnestRecordTab {
  id: string;
  label: string;
  visible?: boolean;
  content: ReactNode;
}

export interface TechEarnestRecordViewProps {
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
  relatedLinks?: TechEarnestRecordRelatedLink[];
  activeRelatedId?: string;
  onRelatedClick?: (id: string) => void;
  tabs: TechEarnestRecordTab[];
  defaultTab?: string;
  recordKey?: string;
  className?: string;
}

export function TechEarnestRecordView({
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
}: TechEarnestRecordViewProps) {
  const location = useLocation();
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
    const target = document.getElementById(`techearnest-record-section-${id}`);
    if (target) {
      setActiveTab("overview");
      window.setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
  }

  const [relatedQuery, setRelatedQuery] = useState("");
  const visibleRelatedLinks = useMemo(() => {
    const q = relatedQuery.trim().toLowerCase();
    return q ? relatedLinks.filter((link) => link.label.toLowerCase().includes(q)) : relatedLinks;
  }, [relatedLinks, relatedQuery]);

  const displayTitle = subtitle ? `${title} - ${subtitle}` : title;
  const cameFrom = readRecordNavState(location.state)?.from;
  const backLabel = cameFrom ? `Back to ${cameFrom.label ?? "previous page"}` : "Back to list";

  return (
      <RecordLinkSource label={title}>
      <div className={`techearnest-record-page ${className}`.trim()}>
        {onBack && cameFrom ? (
          <button type="button" className="btn btn-link techearnest-record-return" onClick={onBack}>
            <ToolbarIcon name="chevron-left" />
            <span className="text-truncate">{backLabel}</span>
          </button>
        ) : null}
        <header className="techearnest-record-topbar">
          <div className="techearnest-record-topbar-left">
            {onBack ? (
              <button
                type="button"
                className="btn btn-link techearnest-record-back"
                onClick={onBack}
                aria-label={backLabel}
                title={backLabel}
              >
                <ToolbarIcon name="chevron-left" />
              </button>
            ) : null}
            <TechEarnestRecordAvatar
              label={avatarLabel ?? title}
              imageUrl={avatarUrl}
              variant={avatarVariant}
            />
            <div className="techearnest-record-identity min-w-0">
              <h1 className="techearnest-record-title">{displayTitle}</h1>
              {status ? <div className="techearnest-record-status">{status}</div> : null}
              {meta ? <div className="techearnest-record-meta">{meta}</div> : null}
            </div>
          </div>
  
          <div className="techearnest-record-topbar-right">
            {primaryAction ? <div className="techearnest-record-primary-action">{primaryAction}</div> : null}
            {secondaryActions ? <div className="techearnest-record-secondary-actions">{secondaryActions}</div> : null}
            {(onPrev || onNext) ? (
              <div className="techearnest-record-nav-arrows">
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
  
        <div className="techearnest-record-layout">
          {relatedLinks.length > 0 ? (
            <aside className="techearnest-record-related-sidebar" aria-label="Related List">
              <div className="techearnest-record-related-sidebar-title">Related List</div>
              {relatedLinks.length > 6 ? (
                <div className="techearnest-record-related-search">
                  <ToolbarIcon name="search" className="techearnest-record-related-search-icon" />
                  <input
                    type="search"
                    className="form-control form-control-sm"
                    placeholder="Search"
                    aria-label="Search related lists"
                    value={relatedQuery}
                    onChange={(event) => setRelatedQuery(event.target.value)}
                  />
                </div>
              ) : null}
              <ul className="techearnest-record-related-links">
                {!visibleRelatedLinks.length ? (
                  <li className="techearnest-record-related-empty">No matching lists</li>
                ) : null}
                {visibleRelatedLinks.map((link) => (
                  <li key={link.id}>
                    <button
                      type="button"
                      className={`techearnest-record-related-link${activeRelatedId === link.id ? " is-active" : ""}`}
                      onClick={() => handleRelatedClick(link.id)}
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
  
          <div className="techearnest-record-main">
            {visibleTabs.length > 1 ? (
              <nav className="techearnest-record-tabs" aria-label="Record views">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`techearnest-record-tab${active?.id === tab.id ? " is-active" : ""}`}
                    onClick={() => setActiveTab(tab.id)}
                    aria-current={active?.id === tab.id ? "page" : undefined}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            ) : null}
            <div className="techearnest-record-body">{active?.content ?? null}</div>
          </div>
        </div>
    </div>
    </RecordLinkSource>
  );
}
