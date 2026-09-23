import type { ReactNode } from "react";

interface ModuleListShellProps {
  title: string;
  viewSelector?: ReactNode;
  toolbarActions?: ReactNode;
  primaryAction?: ReactNode;
  filterOpen: boolean;
  filterPanel?: ReactNode;
  viewMode?: "list" | "tile";
  onViewModeChange?: (mode: "list" | "tile") => void;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  children: ReactNode;
}

/** Shared Zoho-like module list workspace used by every CRM/ops module. */
export function ModuleListShell({
  title,
  viewSelector,
  toolbarActions,
  primaryAction,
  filterOpen,
  filterPanel,
  viewMode = "list",
  onViewModeChange,
  footerLeft,
  footerRight,
  children,
}: ModuleListShellProps) {
  return (
    <section className="module-list-shell">
      <header className="module-list-toolbar">
        <div className="module-list-toolbar-left">
          <h1 className="module-list-title">{title}</h1>
          {viewSelector}
        </div>
        <div className="module-list-toolbar-right">
          {toolbarActions}
          {onViewModeChange ? (
            <div className="btn-group btn-group-sm" role="group" aria-label="View layout">
              <button
                type="button"
                className={`btn ${viewMode === "list" ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => onViewModeChange("list")}
                title="List view"
              >
                List
              </button>
              <button
                type="button"
                className={`btn ${viewMode === "tile" ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => onViewModeChange("tile")}
                title="Tile view"
              >
                Tile
              </button>
            </div>
          ) : null}
          {primaryAction}
        </div>
      </header>

      <div className={`module-list-body${filterOpen ? " with-filter" : ""}`}>
        {filterOpen && filterPanel ? (
          <aside className="module-filter-panel" aria-label="Filters">
            {filterPanel}
          </aside>
        ) : null}
        <div className="module-list-canvas">{children}</div>
      </div>

      {footerLeft || footerRight ? (
        <footer className="module-list-footer">
          <div>{footerLeft}</div>
          <div>{footerRight}</div>
        </footer>
      ) : null}
    </section>
  );
}
