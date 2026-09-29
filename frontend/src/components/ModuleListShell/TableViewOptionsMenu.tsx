import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";

interface TableViewOptionsMenuProps {
  rowsPerPage: number;
  onRowsPerPageChange: (value: number) => void;
  wrapText: boolean;
  onWrapTextChange: (value: boolean) => void;
  onManageColumns: () => void;
}

export function TableViewOptionsMenu({
  rowsPerPage,
  onRowsPerPageChange,
  wrapText,
  onWrapTextChange,
  onManageColumns,
}: TableViewOptionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<"page-size" | "view-mode" | null>(null);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function toggleMenu() {
    if (open) {
      setOpen(false);
      return;
    }
    setSubmenu(null);
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current.getBoundingClientRect().height;
    const below = trigger.bottom + 6;
    setPosition({
      top: below + menuHeight <= window.innerHeight ? below : Math.max(8, trigger.top - menuHeight - 6),
      right: Math.max(8, window.innerWidth - trigger.right),
    });
  }, [open, submenu]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onViewportChange() {
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open]);

  const menu = open ? createPortal(
    <div
      ref={menuRef}
      className="module-table-options-menu"
      role="menu"
      style={{ top: position.top, right: position.right }}
    >
      <button type="button" role="menuitem" className="module-table-options-item" onClick={() => { setOpen(false); onManageColumns(); }}>
        <ToolbarIcon name="settings" className="module-menu-item-icon" />
        <span>Manage Columns</span>
      </button>
      <button type="button" role="menuitem" className="module-table-options-item is-disabled" disabled title="Column widths are managed automatically">
        <ToolbarIcon name="columns" className="module-menu-item-icon" />
        <span>Reset Column Size</span>
      </button>
      <div className="module-menu-separator" role="separator" />
      <button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={submenu === "page-size"} className="module-table-options-item" onClick={() => setSubmenu((value) => value === "page-size" ? null : "page-size")}>
        <ToolbarIcon name="list" className="module-menu-item-icon" />
        <span>Records Per Page</span><strong>{rowsPerPage}</strong><span className="module-table-options-chevron">›</span>
      </button>
      {submenu === "page-size" ? (
        <div className="module-table-options-submenu" role="group" aria-label="Records per page">
          {[10, 30, 50, 100].map((size) => (
            <button key={size} type="button" role="menuitemradio" aria-checked={rowsPerPage === size} className="module-table-options-item" onClick={() => { onRowsPerPageChange(size); setOpen(false); }}>
              <span>{size} records</span>{rowsPerPage === size ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      <button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={submenu === "view-mode"} className="module-table-options-item" onClick={() => setSubmenu((value) => value === "view-mode" ? null : "view-mode")}>
        <ToolbarIcon name="eye" className="module-menu-item-icon" />
        <span>View Mode</span><strong>{wrapText ? "Wrap Text" : "Clip Text"}</strong><span className="module-table-options-chevron">›</span>
      </button>
      {submenu === "view-mode" ? (
        <div className="module-table-options-submenu" role="group" aria-label="View mode">
          {[{ value: false, label: "Clip Text" }, { value: true, label: "Wrap Text" }].map((mode) => (
            <button key={mode.label} type="button" role="menuitemradio" aria-checked={wrapText === mode.value} className="module-table-options-item" onClick={() => { onWrapTextChange(mode.value); setOpen(false); }}>
              <span>{mode.label}</span>{wrapText === mode.value ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`module-list-columns-btn${open ? " is-open" : ""}`}
        aria-label="Table options"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Table options"
        onClick={toggleMenu}
      >
        <ToolbarIcon name="settings" className="module-toolbar-icon" />
      </button>
      {menu}
    </>
  );
}
