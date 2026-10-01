import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";
import type { ModuleSortDirection, ModuleSortField, ModuleSortValue } from "./moduleSort";

const PANEL_GAP = 4;
const VIEWPORT_MARGIN = 8;

interface ModuleSortMenuProps {
  fields: ModuleSortField[];
  value: ModuleSortValue | null;
  onChange: (value: ModuleSortValue | null) => void;
}

/** Toolbar "Sort" button with a popover: searchable field list (with None) and an Ascending/Descending switch. */
export function ModuleSortMenu({ fields, value, onChange }: ModuleSortMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const activeField = value ? fields.find((field) => field.field === value.field) : undefined;
  const direction: ModuleSortDirection = value?.direction ?? "asc";

  const visibleFields = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? fields.filter((field) => field.label.toLowerCase().includes(q)) : fields;
  }, [fields, query]);

  const positionPanel = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const width = panel.offsetWidth;
    const left = Math.min(Math.max(VIEWPORT_MARGIN, rect.left), window.innerWidth - width - VIEWPORT_MARGIN);
    setPanelStyle({ top: rect.bottom + PANEL_GAP, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle({ visibility: "hidden" });
      return;
    }
    positionPanel();
    searchRef.current?.focus();
  }, [open, positionPanel]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [open, positionPanel]);

  const toggle = () => {
    setQuery("");
    setOpen((current) => !current);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`module-toolbar-btn module-sort-btn${open ? " is-open" : ""}${activeField ? " is-active" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={activeField ? `Sorted by ${activeField.label} (${direction === "asc" ? "ascending" : "descending"})` : "Sort"}
        onClick={toggle}
      >
        <ToolbarIcon name="sort" className="module-toolbar-icon" />
        <span>Sort</span>
        {activeField ? (
          <ToolbarIcon name={direction === "asc" ? "arrow-up" : "arrow-down"} className="module-sort-btn-dir" />
        ) : null}
      </button>
      {open
        ? createPortal(
            <div ref={panelRef} className="module-sort-panel" style={panelStyle} role="dialog" aria-label="Sort records">
              <div className="module-sort-panel-header">
                <span className="module-sort-panel-title">Sort by</span>
                {activeField ? (
                  <button type="button" className="module-sort-reset" onClick={() => onChange(null)}>
                    Reset
                  </button>
                ) : null}
              </div>
              <div className="module-sort-search">
                <ToolbarIcon name="search" className="module-sort-search-icon" />
                <input
                  ref={searchRef}
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="Search fields"
                  aria-label="Search sort fields"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <ul className="module-sort-options" role="listbox" aria-label="Sort field">
                {!query.trim() ? (
                  <li>
                    <button
                      type="button"
                      role="option"
                      aria-selected={!activeField}
                      className={`module-sort-option${!activeField ? " is-selected" : ""}`}
                      onClick={() => onChange(null)}
                    >
                      <span>None</span>
                      {!activeField ? <ToolbarIcon name="check" className="module-sort-check" /> : null}
                    </button>
                  </li>
                ) : null}
                {visibleFields.map((field) => {
                  const selected = activeField?.field === field.field;
                  return (
                    <li key={field.field}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`module-sort-option${selected ? " is-selected" : ""}`}
                        onClick={() => onChange({ field: field.field, direction })}
                      >
                        <span>{field.label}</span>
                        {selected ? <ToolbarIcon name="check" className="module-sort-check" /> : null}
                      </button>
                    </li>
                  );
                })}
                {!visibleFields.length ? <li className="module-sort-empty">No matching fields</li> : null}
              </ul>
              <div className="module-sort-direction" role="group" aria-label="Sort direction">
                {(["asc", "desc"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`module-sort-direction-btn${direction === option ? " is-active" : ""}`}
                    aria-pressed={direction === option}
                    disabled={!activeField}
                    onClick={() => activeField && onChange({ field: activeField.field, direction: option })}
                  >
                    <ToolbarIcon name={option === "asc" ? "arrow-up" : "arrow-down"} className="module-toolbar-icon" />
                    {option === "asc" ? "Ascending" : "Descending"}
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
