import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { navIconForPath } from "@/constants/nav";
import { NavIcon } from "@/components/NavIcon/NavIcon";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";
import {
  ModuleFilterButton,
  ModuleMoreButton,
  ModulePagination,
  ModuleRecordCount,
  ModuleSearchInput,
  ModuleSortButton,
  ModuleToolbarDivider,
  ModuleViewTabs,
  ModuleViewToggle,
  type ModulePaginationProps,
} from "./moduleWorkspaceUi";
import { ModuleCreateSplit, ModuleMenuDropdown, type ModuleMenuItem } from "./ModuleMenuDropdown";

export {
  ModuleFilterButton,
  ModuleSearchInput,
  ModuleRecordCount,
  ModulePagination,
  ModuleWorkspaceState,
  ModuleViewToggle,
  ModuleViewTabs,
  ModuleSortButton,
  ModuleToolbarDivider,
  ModuleMoreButton,
  moduleDefaultViewTab,
  countActiveFilters,
} from "./moduleWorkspaceUi";
export { ModuleCreateSplit, ModuleMenuDropdown, type ModuleMenuItem } from "./ModuleMenuDropdown";
export type { ModulePaginationProps } from "./moduleWorkspaceUi";

interface ModuleListShellProps {
  title: string;
  /** Override route-derived module icon (nav icon name). */
  moduleIcon?: string;
  viewSelector?: ReactNode;
  toolbarActions?: ReactNode;
  primaryAction?: ReactNode;
  /** Items for the create split-button dropdown (e.g. bulk import). */
  createMenuItems?: ModuleMenuItem[];
  /** Items for the ⋯ more-actions menu. Overrides default empty more button when set. */
  moreMenuItems?: ModuleMenuItem[];
  moreActions?: ReactNode;
  filterOpen: boolean;
  filterPanel?: ReactNode;
  viewMode?: "list" | "tile";
  onViewModeChange?: (mode: "list" | "tile") => void;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  children: ReactNode;
  /** Active filter count — highlights filter UI when &gt; 0. */
  activeFilterCount?: number;
  /** Optional toolbar quick search (modules may keep search in filter panel only). */
  toolbarSearch?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  /** Standard filter toggle rendered before toolbarActions when provided. */
  filterToggle?: {
    onToggle: () => void;
    label?: string;
  };
  /** Convenience footer count; overridden by footerLeft when set. */
  recordCount?: number;
  recordCountLabel?: string;
  pagination?: ModulePaginationProps;
  /** Show standard sort button in toolbar (visual affordance; wire sort via toolbarActions). */
  showSortButton?: boolean;
}

function resolveViewLabel(children: ReactNode): string | null {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  return null;
}

function resolveViewTabs(viewSelector: ReactNode | undefined): ReactNode {
  if (!viewSelector) return null;
  if (typeof viewSelector === "object" && viewSelector !== null && "props" in viewSelector) {
    const element = viewSelector as {
      type?: string;
      props?: { children?: ReactNode; className?: string };
    };
    const props = element.props;
    const isViewSelect = props?.className?.includes("module-view-select");
    const isSelectControl = element.type === "select";

    // Saved-view dropdowns and other interactive selectors stay interactive.
    if (isViewSelect && isSelectControl) {
      return <div className="module-list-view">{viewSelector}</div>;
    }

    if (isViewSelect) {
      const label = resolveViewLabel(props?.children);
      if (label) {
        return <ModuleViewTabs tabs={[{ id: "default", label, active: true }]} />;
      }
    }
  }
  return <div className="module-list-view">{viewSelector}</div>;
}

/** Shared Zoho-like module list workspace used by every CRM/ops module. */
export function ModuleListShell({
  title,
  moduleIcon,
  viewSelector,
  toolbarActions,
  primaryAction,
  createMenuItems,
  moreMenuItems,
  moreActions,
  filterOpen,
  filterPanel,
  viewMode = "list",
  onViewModeChange,
  footerLeft,
  footerRight,
  children,
  activeFilterCount = 0,
  toolbarSearch,
  filterToggle,
  recordCount,
  recordCountLabel,
  pagination,
  showSortButton = true,
}: ModuleListShellProps) {
  const location = useLocation();
  const resolvedIcon = moduleIcon ?? navIconForPath(location.pathname);
  const resolvedFooterLeft =
    footerLeft ??
    (recordCount !== undefined ? (
      <ModuleRecordCount count={recordCount} label={recordCountLabel} />
    ) : null);
  const resolvedFooterRight = footerRight ?? (pagination ? <ModulePagination {...pagination} /> : null);
  const viewTabs = resolveViewTabs(viewSelector);
  const showToolbar =
    toolbarSearch ||
    toolbarActions ||
    filterToggle ||
    onViewModeChange ||
    primaryAction ||
    (createMenuItems && createMenuItems.length > 0) ||
    moreMenuItems ||
    moreActions ||
    showSortButton;

  return (
    <section
      className={`module-list-shell${activeFilterCount > 0 ? " has-active-filters" : ""}`}
      aria-labelledby="module-list-title"
    >
      <header className="module-list-toolbar">
        <div className="module-list-toolbar-row module-list-toolbar-row--title">
          <div className="module-list-heading">
            {resolvedIcon ? (
              <span className="module-list-icon" aria-hidden="true">
                <NavIcon name={resolvedIcon} colored className="module-list-icon-svg" />
              </span>
            ) : null}
            <div className="module-list-heading-text">
              <h1 className="module-list-title" id="module-list-title">
                {title}
              </h1>
              {viewTabs}
            </div>
          </div>
        </div>

        {showToolbar ? (
          <div className="module-list-toolbar-row module-list-toolbar-row--actions">
            <div className="module-list-toolbar-left" role="toolbar" aria-label={`${title} tools`}>
              {toolbarSearch ? (
                <ModuleSearchInput
                  variant="toolbar"
                  value={toolbarSearch.value}
                  onChange={toolbarSearch.onChange}
                  placeholder={toolbarSearch.placeholder ?? `Search ${title.toLowerCase()}…`}
                  aria-label={`Search ${title}`}
                />
              ) : null}
              {filterToggle ? (
                <ModuleFilterButton
                  open={filterOpen}
                  onToggle={filterToggle.onToggle}
                  activeCount={activeFilterCount}
                  label={filterToggle.label}
                />
              ) : null}
              {showSortButton ? <ModuleSortButton /> : null}
              {onViewModeChange ? (
                <>
                  <ModuleToolbarDivider />
                  <ModuleViewToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
                </>
              ) : null}
              {toolbarActions}
            </div>
            <div className="module-list-toolbar-right">
              {moreMenuItems?.length ? (
                <ModuleMenuDropdown
                  items={moreMenuItems}
                  align="end"
                  ariaLabel="More actions"
                  triggerClassName="module-more-btn"
                  trigger={<ToolbarIcon name="more" className="module-toolbar-icon" />}
                />
              ) : (
                moreActions ?? null
              )}
              {primaryAction ? (
                <ModuleCreateSplit primaryAction={primaryAction} menuItems={createMenuItems ?? []} />
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      <div className={`module-list-body${filterOpen ? " with-filter" : ""}`}>
        {filterOpen && filterPanel ? (
          <aside
            className={`module-filter-panel${activeFilterCount > 0 ? " has-active-filters" : ""}`}
            aria-label="Filters"
          >
            {filterPanel}
          </aside>
        ) : null}
        <div className="module-list-canvas" role="region" aria-label={`${title} records`}>
          <div className="module-list-canvas-inner">{children}</div>
        </div>
      </div>

      {resolvedFooterLeft || resolvedFooterRight ? (
        <footer className="module-list-footer">
          <div className="module-list-footer-left">{resolvedFooterLeft}</div>
          <div className="module-list-footer-right">{resolvedFooterRight}</div>
        </footer>
      ) : null}
    </section>
  );
}
