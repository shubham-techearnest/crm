import type { ReactNode } from "react";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";

export function countActiveFilters(...values: unknown[]): number {
  return values.filter((value) => {
    if (value === null || value === undefined || value === false) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return true;
    return Boolean(value);
  }).length;
}

interface ModuleFilterButtonProps {
  open: boolean;
  onToggle: () => void;
  activeCount?: number;
  label?: string;
}

/** Standard filter panel toggle for ModuleListShell toolbars. */
export function ModuleFilterButton({
  open,
  onToggle,
  activeCount = 0,
  label = "Filter",
}: ModuleFilterButtonProps) {
  return (
    <button
      type="button"
      className={`module-filter-btn${open ? " is-open" : ""}${activeCount > 0 ? " has-active-filters" : ""}`}
      onClick={onToggle}
      aria-expanded={open}
    >
      <ToolbarIcon name="filter" className="module-toolbar-icon" />
      <span>{label}</span>
      {activeCount > 0 ? <span className="module-filter-count">{activeCount}</span> : null}
    </button>
  );
}

interface ModuleSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Toolbar inline search vs filter-panel search styling */
  variant?: "toolbar" | "filter";
  "aria-label"?: string;
}

export function ModuleSearchInput({
  value,
  onChange,
  placeholder = "Search…",
  variant = "toolbar",
  "aria-label": ariaLabel = "Search records",
}: ModuleSearchInputProps) {
  return (
    <div className={`module-search-field module-search-field--${variant}`}>
      {variant === "toolbar" ? <ToolbarIcon name="search" className="module-toolbar-icon" /> : null}
      <input
        type="search"
        className="form-control form-control-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </div>
  );
}

/** Icon-only sort control — wire module-specific sort in toolbarActions when needed. */
export function ModuleSortButton({ label = "Sort", onClick }: { label?: string; onClick?: () => void }) {
  return (
    <button type="button" className="btn btn-sm module-toolbar-btn" onClick={onClick} title={label}>
      <ToolbarIcon name="sort" className="module-toolbar-icon" />
      <span className="d-none d-xl-inline">{label}</span>
    </button>
  );
}

interface ModuleViewToggleProps {
  viewMode: "list" | "tile";
  onViewModeChange: (mode: "list" | "tile") => void;
}

/** Zoho-style list / tile view switcher with icons. */
export function ModuleViewToggle({ viewMode, onViewModeChange }: ModuleViewToggleProps) {
  return (
    <div className="module-view-toggle" role="group" aria-label="View layout">
      <button
        type="button"
        className={`module-view-toggle-btn${viewMode === "list" ? " is-active" : ""}`}
        onClick={() => onViewModeChange("list")}
        title="List view"
        aria-pressed={viewMode === "list"}
      >
        <ToolbarIcon name="list" className="module-toolbar-icon" />
      </button>
      <button
        type="button"
        className={`module-view-toggle-btn${viewMode === "tile" ? " is-active" : ""}`}
        onClick={() => onViewModeChange("tile")}
        title="Tile view"
        aria-pressed={viewMode === "tile"}
      >
        <ToolbarIcon name="grid" className="module-toolbar-icon" />
      </button>
    </div>
  );
}

interface ModuleViewTab {
  id: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function ModuleViewTabs({ tabs }: { tabs: ModuleViewTab[] }) {
  return (
    <div className="module-view-tabs" role="tablist" aria-label="Record views">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          className={`module-view-tab${tab.active ? " is-active" : ""}`}
          aria-selected={tab.active ?? false}
          onClick={tab.onClick}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** Wrap a single default view label as a Zoho-style pill tab. */
export function moduleDefaultViewTab(label: string) {
  return <ModuleViewTabs tabs={[{ id: "default", label, active: true }]} />;
}

export function ModuleToolbarDivider() {
  return <span className="module-toolbar-divider" aria-hidden="true" />;
}

export function ModuleMoreButton({ onClick, label = "More actions" }: { onClick?: () => void; label?: string }) {
  return (
    <button type="button" className="module-more-btn" onClick={onClick} title={label} aria-label={label}>
      <ToolbarIcon name="more" className="module-toolbar-icon" />
    </button>
  );
}

interface ModuleRecordCountProps {
  count: number;
  label?: string;
}

export function ModuleRecordCount({ count, label = "Total Records" }: ModuleRecordCountProps) {
  return (
    <span className="module-record-count">
      {label}: <strong>{count}</strong>
    </span>
  );
}

export interface ModulePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function ModulePagination({ page, pageSize, total, onPageChange }: ModulePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <nav className="module-pagination" aria-label="Record pagination">
      <span className="module-pagination-summary">
        {from}–{to} of {total}
      </span>
      <div className="module-pagination-controls">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          Previous
        </button>
        <span className="module-pagination-page">
          Page {safePage} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

interface ModuleWorkspaceStateProps {
  variant: "loading" | "error" | "empty";
  title?: string;
  message?: string;
  description?: string;
  action?: ReactNode;
  onRetry?: () => void;
}

/** Standard in-canvas state panel for module list workspaces. */
export function ModuleWorkspaceState({
  variant,
  title,
  message,
  description,
  action,
  onRetry,
}: ModuleWorkspaceStateProps) {
  if (variant === "loading") {
    return (
      <div className="module-workspace-state module-workspace-state--loading" role="status">
        <div className="spinner-border text-primary module-workspace-state-spinner" aria-hidden="true" />
        <p className="module-workspace-state-label">{message ?? "Loading…"}</p>
      </div>
    );
  }

  if (variant === "error") {
    return (
      <div className="module-workspace-state module-workspace-state--error" data-testid="error-state">
        <h3 className="module-workspace-state-title">{title ?? "Something went wrong"}</h3>
        <p className="module-workspace-state-message">{message ?? "Try again."}</p>
        {onRetry ? (
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="module-workspace-state module-workspace-state--empty" data-testid="empty-state">
      <h3 className="module-workspace-state-title">{title ?? "No records"}</h3>
      <p className="module-workspace-state-message">{description ?? "Adjust filters or create a record."}</p>
      {action}
    </div>
  );
}
