import { useEffect, useRef, useState, type ReactNode } from "react";
import { ToolbarIcon, type ToolbarIconName } from "@/components/ToolbarIcon/ToolbarIcon";

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
  const wrapRef = useRef<HTMLDivElement>(null);
  const visibleItems = items.filter((item) => item.visible !== false);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (!visibleItems.length) {
    return null;
  }

  return (
    <div className={`module-menu-dropdown${open ? " is-open" : ""}`} ref={wrapRef}>
      <button
        type="button"
        className={triggerClassName}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open ? (
        <div className={`module-menu-panel module-menu-panel--${align}`} role="menu">
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
        </div>
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
