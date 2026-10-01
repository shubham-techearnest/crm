import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ToolbarIcon, type ToolbarIconName } from "@/components/ToolbarIcon/ToolbarIcon";

const PANEL_GAP = 4;
const VIEWPORT_MARGIN = 8;

export interface ModuleMenuItem {
  id: string;
  label: string;
  icon?: ToolbarIconName;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  visible?: boolean;
  separator?: boolean;
}

interface ModuleMenuDropdownProps {
  items: ModuleMenuItem[];
  align?: "start" | "end";
  trigger: ReactNode;
  ariaLabel: string;
  triggerClassName?: string;
}

export function ModuleMenuDropdown({
  items,
  align = "end",
  trigger,
  ariaLabel,
  triggerClassName = "module-menu-trigger",
}: ModuleMenuDropdownProps) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const visibleItems = items.filter((item) => item.visible !== false);

  // The panel lives in document.body so scrolling/clipping containers (e.g. the records table) never cut it
  // off; it is placed next to the trigger and flips above it when there is no room below.
  const positionPanel = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const height = panel.offsetHeight;
    const width = panel.offsetWidth;
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const openUp = spaceBelow < height + PANEL_GAP && rect.top - VIEWPORT_MARGIN > spaceBelow;
    const top = openUp ? Math.max(VIEWPORT_MARGIN, rect.top - PANEL_GAP - height) : rect.bottom + PANEL_GAP;
    const preferredLeft = align === "end" ? rect.right - width : rect.left;
    const left = Math.min(Math.max(VIEWPORT_MARGIN, preferredLeft), window.innerWidth - width - VIEWPORT_MARGIN);
    setPanelStyle({
      top,
      left,
      maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle({ visibility: "hidden" });
      return;
    }
    positionPanel();
  }, [open, positionPanel]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return;
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

  if (!visibleItems.length) {
    return null;
  }

  return (
    <div className={`module-menu-dropdown${open ? " is-open" : ""}`} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open ? createPortal(
        <div
          ref={panelRef}
          className={`module-menu-panel module-menu-panel--${align} is-floating`}
          style={panelStyle}
          role="menu"
        >
          {visibleItems.map((item) =>
            item.separator ? (
              <div key={item.id} className="module-menu-separator" role="separator" />
            ) : (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`module-menu-item${item.danger ? " is-danger" : ""}`}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {item.icon ? <ToolbarIcon name={item.icon} className="module-menu-item-icon" /> : null}
                <span>{item.label}</span>
              </button>
            ),
          )}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

interface ModuleCreateSplitProps {
  primaryAction: ReactNode;
  menuItems: ModuleMenuItem[];
  menuAriaLabel?: string;
}

export function ModuleCreateSplit({
  primaryAction,
  menuItems,
  menuAriaLabel = "More create options",
}: ModuleCreateSplitProps) {
  const visibleItems = menuItems.filter((item) => item.visible !== false);
  if (!visibleItems.length) {
    return <div className="module-create-split module-create-split--single">{primaryAction}</div>;
  }

  return (
    <div className="module-create-split">
      <div className="module-create-split-main">{primaryAction}</div>
      <ModuleMenuDropdown
        items={menuItems}
        align="end"
        ariaLabel={menuAriaLabel}
        triggerClassName="module-create-split-caret"
        trigger={<ToolbarIcon name="chevron-down" className="module-toolbar-icon" />}
      />
    </div>
  );
}
