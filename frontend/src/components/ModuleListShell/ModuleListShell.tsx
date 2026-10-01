import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";
import {
  ModuleFilterButton,
  ModulePagination,
  ModuleRecordCount,
  ModuleSearchInput,
  ModuleToolbarDivider,
  ModuleViewToggle,
  type ModulePaginationProps,
} from "./moduleWorkspaceUi";
import { ModuleCreateSplit, ModuleMenuDropdown, type ModuleMenuItem } from "./ModuleMenuDropdown";
import { ModuleBulkMenuContext } from "./moduleBulkMenu";
import { ModuleSortMenu } from "./ModuleSortMenu";
import {
  ModuleSortContext,
  type ModuleSortConfig,
  type ModuleSortField,
  type ModuleSortValue,
} from "./moduleSort";

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
export { ModuleSortMenu } from "./ModuleSortMenu";
export type { ModuleSortConfig, ModuleSortField, ModuleSortValue } from "./moduleSort";

interface ModuleListShellProps {
  title: string;
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
  /**
   * Show the Sort control. By default it sorts the list table on the client using its columns (hidden when no
   * table is shown); pass `sort` to let the page sort on the server instead.
   */
  showSortButton?: boolean;
  sort?: ModuleSortConfig;
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

const FIND_FILTER_MIN_FIELDS = 5;

function filterFieldBlocks(body: HTMLElement): HTMLElement[] {
  return Array.from(body.querySelectorAll<HTMLElement>(".module-filter-section > :not(h3)"));
}

/** Text used to match a filter field: its label(s), not option text inside selects. */
function filterBlockLabel(block: HTMLElement): string {
  const labels = block.querySelectorAll("label, .form-label, legend");
  const text = labels.length
    ? Array.from(labels, (label) => label.textContent ?? "").join(" ")
    : (block.textContent ?? "");
  return text.toLowerCase();
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
  const [findQuery, setFindQuery] = useState("");
  const [fieldCount, setFieldCount] = useState(0);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.querySelectorAll<HTMLElement>(".module-filter-section > h3").forEach((heading) => {
      if (heading.getAttribute("role") === "button") return;
      heading.setAttribute("role", "button");
      heading.setAttribute("tabindex", "0");
      heading.setAttribute("aria-expanded", String(!heading.parentElement?.classList.contains("is-collapsed")));
    });
    const count = filterFieldBlocks(body).length;
    setFieldCount((current) => (current === count ? current : count));
  });

  // Hides filter fields whose label doesn't match; a matching section heading keeps its whole section.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const q = findQuery.trim().toLowerCase();
    body.querySelectorAll<HTMLElement>(".module-filter-section").forEach((section) => {
      const heading = section.querySelector(":scope > h3")?.textContent?.toLowerCase() ?? "";
      const headingMatches = !q || heading.includes(q);
      let anyVisible = false;
      Array.from(section.children).forEach((child) => {
        if (!(child instanceof HTMLElement) || child.tagName === "H3") return;
        const match = headingMatches || filterBlockLabel(child).includes(q);
        child.classList.toggle("is-find-hidden", !match);
        anyVisible ||= match;
      });
      section.classList.toggle("is-find-hidden", Boolean(q) && !headingMatches && !anyVisible);
      section.classList.toggle("is-find-active", Boolean(q));
    });
  }, [findQuery, children]);

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
      {fieldCount > FIND_FILTER_MIN_FIELDS || findQuery ? (
        <div className="module-filter-find">
          <ToolbarIcon name="search" className="module-filter-find-icon" />
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Find a filter"
            aria-label="Find a filter"
            value={findQuery}
            onChange={(event) => setFindQuery(event.target.value)}
          />
        </div>
      ) : null}
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

/**
 * The Views control sits after the filter/sort/layout buttons. A plain label (e.g. `<span class="module-view-select">
 * All Leads</span>`) means the module has a single view, so nothing is rendered for it.
 */
function resolveViewControl(viewSelector: ReactNode | undefined): ReactNode {
  if (!viewSelector) return null;
  if (typeof viewSelector === "object" && "props" in viewSelector) {
    const element = viewSelector as { type?: unknown; props?: { className?: string } };
    const isViewLabel = element.props?.className?.includes("module-view-select") && element.type !== "select";
    if (isViewLabel || element.type === "span") return null;
  }
  return (
    <div className="module-list-view">
      <ToolbarIcon name="views" className="module-list-view-icon" />
      {viewSelector}
    </div>
  );
}

function sortStorageKey(pathname: string) {
  return `techearnest:list-sort:${pathname}`;
}

function readStoredSort(pathname: string): ModuleSortValue | null {
  try {
    const raw = localStorage.getItem(sortStorageKey(pathname));
    const parsed = raw ? (JSON.parse(raw) as ModuleSortValue) : null;
    return parsed && typeof parsed.field === "string" && (parsed.direction === "asc" || parsed.direction === "desc")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/** Shared TechEarnest-like module list workspace used by every CRM/ops module. */
export function ModuleListShell({
  title,
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
  sort,
  onClearFilters,
  onCloseFilters,
  filterPanelTitle,
}: ModuleListShellProps) {
  const location = useLocation();
  const [localSort, setLocalSort] = useState<ModuleSortValue | null>(() => readStoredSort(location.pathname));
  const [tableSortFields, setTableSortFields] = useState<Record<string, ModuleSortField[]>>({});
  const registerSortFields = useCallback((ownerId: string, fields: ModuleSortField[] | null) => {
    setTableSortFields((current) => {
      if (!fields && !(ownerId in current)) return current;
      const next = { ...current };
      if (fields) next[ownerId] = fields;
      else delete next[ownerId];
      return next;
    });
  }, []);
  const changeLocalSort = useCallback(
    (value: ModuleSortValue | null) => {
      setLocalSort(value);
      try {
        if (value) localStorage.setItem(sortStorageKey(location.pathname), JSON.stringify(value));
        else localStorage.removeItem(sortStorageKey(location.pathname));
      } catch {
        // Sorting still applies for this session when storage is unavailable.
      }
    },
    [location.pathname],
  );
  const sortFields = useMemo(() => {
    if (sort) return sort.fields;
    const seen = new Set<string>();
    return Object.values(tableSortFields)
      .flat()
      .filter((field) => (seen.has(field.field) ? false : (seen.add(field.field), true)));
  }, [sort, tableSortFields]);
  const sortValue = sort ? sort.value : localSort;
  const setSortValue = sort ? sort.onChange : changeLocalSort;
  const sortContext = useMemo(
    () => ({
      sort: sortValue,
      setSort: setSortValue,
      fields: sortFields,
      controlled: Boolean(sort),
      registerFields: registerSortFields,
    }),
    [sortValue, setSortValue, sortFields, sort, registerSortFields],
  );
  const showSort = showSortButton && sortFields.length > 0;
  const resolvedFooterLeft =
    footerLeft ??
    (recordCount !== undefined ? (
      <ModuleRecordCount count={recordCount} label={recordCountLabel} />
    ) : null);
  const resolvedFooterRight = footerRight ?? (pagination ? <ModulePagination {...pagination} /> : null);
  const viewControl = resolveViewControl(viewSelector);
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
  // Fixed order on every list page: Filter, Sort | List/Tile | Views, then page-specific actions.
  const toolGroups: ReactNode[] = [
    filterToggle || showSort ? (
      <>
        {filterToggle ? (
          <ModuleFilterButton
            open={filterOpen}
            onToggle={filterToggle.onToggle}
            activeCount={activeFilterCount}
            label={filterToggle.label}
          />
        ) : null}
        {showSort ? <ModuleSortMenu fields={sortFields} value={sortValue} onChange={setSortValue} /> : null}
      </>
    ) : null,
    onViewModeChange ? <ModuleViewToggle viewMode={viewMode} onViewModeChange={onViewModeChange} /> : null,
    viewControl,
  ].filter(Boolean);
  const showToolbar =
    toolbarSearch ||
    toolbarActions ||
    toolGroups.length > 0 ||
    primaryAction ||
    (createMenuItems && createMenuItems.length > 0) ||
    combinedMenuItems.length > 0 ||
    moreActions;

  return (
    <ModuleBulkMenuContext.Provider value={registerBulkMenu}>
    <ModuleSortContext.Provider value={sortContext}>
    <section
      className={`module-list-shell${activeFilterCount > 0 ? " has-active-filters" : ""}`}
      aria-labelledby="module-list-title"
    >
      <header className="module-list-toolbar">
        <div className="module-list-toolbar-row module-list-toolbar-row--single">
          <h1 className="visually-hidden" id="module-list-title">
            {title}
          </h1>

          {showToolbar ? (
            <>
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
                {toolGroups.map((group, index) => (
                  <Fragment key={index}>
                    {index > 0 ? <ModuleToolbarDivider /> : null}
                    {group}
                  </Fragment>
                ))}
                {toolbarActions ? (
                  <>
                    {toolGroups.length ? <ModuleToolbarDivider /> : null}
                    {toolbarActions}
                  </>
                ) : null}
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
            </>
          ) : null}
        </div>
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
    </ModuleSortContext.Provider>
    </ModuleBulkMenuContext.Provider>
  );
}
