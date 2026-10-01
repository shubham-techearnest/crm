import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { navIconForPath } from "@/constants/nav";
import { NavIcon } from "@/components/NavIcon/NavIcon";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";
import {
  ModuleFilterButton,
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
import { ModuleBulkMenuContext } from "./moduleBulkMenu";

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
export { ModuleListTable, useModuleListColumns } from "./ModuleListTable";
export type { ModuleListColumnsState, ModuleListTableProps } from "./ModuleListTable";
export { ManageColumnsModal } from "./ManageColumnsModal";
export { ModuleFilterCheckbox, ModuleFilterDateRange, ModuleFilterField } from "./ModuleFilterFields";

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
  /** Resets every filter; shows "Clear all" in the filter panel header while filters are active. */
  onClearFilters?: () => void;
  /** Closes the filter panel; defaults to `filterToggle.onToggle`. */
  onCloseFilters?: () => void;
  /** Filter panel header text; defaults to "Filter <title> by". */
  filterPanelTitle?: string;
}

function sectionToggleTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  const heading = target.closest(".module-filter-section > h3");
  return heading instanceof HTMLElement ? heading : null;
}

function toggleFilterSection(heading: HTMLElement) {
  const section = heading.parentElement;
  if (!section) return;
  const collapsed = section.classList.toggle("is-collapsed");
  heading.setAttribute("aria-expanded", String(!collapsed));
}

/**
 * Filter panel frame: sticky header with active count, "Clear all" and close, a scrolling body, and collapsible
 * `.module-filter-section` blocks (click or press Enter/Space on the section's h3).
 */
function ModuleFilterPanel({
  title,
  activeFilterCount,
  onClearFilters,
  onClose,
  children,
}: {
  title: string;
  activeFilterCount: number;
  onClearFilters?: () => void;
  onClose?: () => void;
  children: ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.querySelectorAll<HTMLElement>(".module-filter-section > h3").forEach((heading) => {
      if (heading.getAttribute("role") === "button") return;
      heading.setAttribute("role", "button");
      heading.setAttribute("tabindex", "0");
      heading.setAttribute("aria-expanded", String(!heading.parentElement?.classList.contains("is-collapsed")));
    });
  });

  return (
    <aside
      className={`module-filter-panel${activeFilterCount > 0 ? " has-active-filters" : ""}`}
      aria-label="Filters"
    >
      <div className="module-filter-panel-header">
        <span className="module-filter-panel-title">
          {title}
          {activeFilterCount > 0 ? <span className="module-filter-panel-count">{activeFilterCount}</span> : null}
        </span>
        {onClearFilters && activeFilterCount > 0 ? (
          <button type="button" className="btn btn-link btn-sm p-0 module-filter-clear" onClick={onClearFilters}>
            Clear all
          </button>
        ) : null}
        {onClose ? (
          <button type="button" className="btn-close module-filter-close" aria-label="Close filters" onClick={onClose} />
        ) : null}
      </div>
      <div
        ref={bodyRef}
        className="module-filter-panel-body"
        onClick={(e) => {
          const heading = sectionToggleTarget(e.target);
          if (heading) toggleFilterSection(heading);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          const heading = sectionToggleTarget(e.target);
          if (!heading) return;
          e.preventDefault();
          toggleFilterSection(heading);
        }}
      >
        {children}
      </div>
    </aside>
  );
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

/** Shared TechEarnest-like module list workspace used by every CRM/ops module. */
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
  onClearFilters,
  onCloseFilters,
  filterPanelTitle,
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
  const [bulkMenu, setBulkMenu] = useState<{ ownerId: string; items: ModuleMenuItem[] } | null>(null);
  const registerBulkMenu = useCallback((ownerId: string, items: ModuleMenuItem[] | null) => {
    setBulkMenu((current) => {
      if (items) return { ownerId, items };
      return current?.ownerId === ownerId ? null : current;
    });
  }, []);
  const pageMenuItems = (moreMenuItems ?? []).filter((item) => item.visible !== false);
  const combinedMenuItems: ModuleMenuItem[] = bulkMenu?.items.length
    ? pageMenuItems.length
      ? [...pageMenuItems, { id: "bulk-menu-separator", label: "", separator: true }, ...bulkMenu.items]
      : bulkMenu.items
    : pageMenuItems;
  const showToolbar =
    toolbarSearch ||
    toolbarActions ||
    filterToggle ||
    onViewModeChange ||
    primaryAction ||
    (createMenuItems && createMenuItems.length > 0) ||
    combinedMenuItems.length > 0 ||
    moreActions ||
    showSortButton;

  return (
    <ModuleBulkMenuContext.Provider value={registerBulkMenu}>
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
              {combinedMenuItems.length ? (
                <ModuleMenuDropdown
                  items={combinedMenuItems}
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
          <ModuleFilterPanel
            title={filterPanelTitle ?? `Filter ${title} by`}
            activeFilterCount={activeFilterCount}
            onClearFilters={onClearFilters}
            onClose={onCloseFilters ?? filterToggle?.onToggle}
          >
            {filterPanel}
          </ModuleFilterPanel>
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
    </ModuleBulkMenuContext.Provider>
  );
}
