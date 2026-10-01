import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ToolbarIcon, type ToolbarIconName } from "@/components/ToolbarIcon/ToolbarIcon";
import { TechEarnestLookupModal, type TechEarnestLookupQuickCreate } from "./TechEarnestLookupModal";

export interface TechEarnestPickerOption {
  value: string;
  label: string;
  subtitle?: string;
}

export interface TechEarnestPickerProps {
  value: string;
  onChange: (value: string) => void;
  options: TechEarnestPickerOption[];
  searchPlaceholder?: string;
  placeholder?: string;
  /** @deprecated The picker has a single caret trigger; kept so existing callers compile. */
  lookupIcon?: ToolbarIconName;
  mode?: "standard" | "user";
  allowEmpty?: boolean;
  emptyLabel?: string;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  lookupMode?: "menu" | "modal";
  lookupTitle?: string;
  onAddNew?: () => void;
  addNewLabel?: string;
  quickCreate?: TechEarnestLookupQuickCreate;
  /** Use portal + fixed positioning for sidebars and other overflow containers. */
  menuPlacement?: "inline" | "portal";
}

const MENU_MAX_HEIGHT = 280;

function UserAvatarPlaceholder() {
  return (
    <span className="techearnest-picker-avatar" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <circle cx="12" cy="8" r="4.25" fill="currentColor" />
        <path
          d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function TechEarnestPicker({
  value,
  onChange,
  options,
  searchPlaceholder = "Search",
  placeholder = "—None—",
  mode = "standard",
  allowEmpty = true,
  emptyLabel = "—None—",
  invalid = false,
  disabled = false,
  id,
  lookupMode = "menu",
  lookupTitle,
  onAddNew,
  addNewLabel = "Add New",
  quickCreate,
  menuPlacement = "inline",
}: TechEarnestPickerProps) {
  const generatedId = useId();
  const pickerId = id ?? generatedId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        (option.subtitle?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(MENU_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow));

    setMenuStyle({
      position: "fixed",
      top: openUp ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight,
      zIndex: 1060,
      transform: openUp ? "translateY(-100%)" : undefined,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || menuPlacement !== "portal") {
      setMenuStyle(null);
      return;
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, menuPlacement, updateMenuPosition]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  function openMenu() {
    if (disabled) return;
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
    setQuery("");
  }

  function pick(nextValue: string) {
    onChange(nextValue);
    closeMenu();
  }

  function openLookup() {
    if (disabled) return;
    if (lookupMode === "modal") {
      setLookupOpen(true);
      return;
    }
    openMenu();
  }

  const displayLabel = selected?.label || (allowEmpty && !value ? placeholder : "Select");

  const menu = open && (menuPlacement !== "portal" || menuStyle) ? (
    <div
      ref={menuRef}
      className={`techearnest-picker-menu${menuPlacement === "portal" ? " is-portal" : ""}`}
      style={menuPlacement === "portal" ? menuStyle ?? undefined : undefined}
      role="listbox"
      aria-labelledby={pickerId}
    >
      <div className="techearnest-picker-search-wrap">
        <ToolbarIcon name="search" className="techearnest-picker-search-icon" />
        <input
          ref={searchRef}
          type="search"
          className="form-control form-control-sm techearnest-picker-search"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <ul className="techearnest-picker-list">
        {allowEmpty ? (
          <li>
            <button
              type="button"
              className={`techearnest-picker-item${!value ? " is-selected" : ""}`}
              onClick={() => pick("")}
            >
              {!value ? (
                <span className="techearnest-picker-check" aria-hidden="true">
                  ✓
                </span>
              ) : (
                <span className="techearnest-picker-check-spacer" />
              )}
              <span className="techearnest-picker-item-body">
                <span className="techearnest-picker-item-label">{emptyLabel}</span>
              </span>
            </button>
          </li>
        ) : null}
        {filtered.length === 0 ? (
          <li className="techearnest-picker-empty">No matches found</li>
        ) : (
          filtered.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  className={`techearnest-picker-item${isSelected ? " is-selected" : ""}`}
                  onClick={() => pick(option.value)}
                >
                  {isSelected ? (
                    <span className="techearnest-picker-check" aria-hidden="true">
                      ✓
                    </span>
                  ) : (
                    <span className="techearnest-picker-check-spacer" />
                  )}
                  {mode === "user" ? <UserAvatarPlaceholder /> : null}
                  <span className="techearnest-picker-item-body">
                    <span className="techearnest-picker-item-label">{option.label}</span>
                    {option.subtitle ? (
                      <span className="techearnest-picker-item-subtitle">{option.subtitle}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`techearnest-picker${open ? " is-open" : ""}${invalid ? " is-invalid" : ""}${disabled ? " is-disabled" : ""}`}
    >
      <div ref={triggerRef} className="input-group input-group-sm techearnest-picker-input-group">
        <button
          type="button"
          id={pickerId}
          className={`form-select techearnest-picker-trigger${invalid ? " is-invalid" : ""}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => (open ? closeMenu() : openLookup())}
        >
          <span className={`techearnest-picker-value${selected ? "" : " is-placeholder"}`}>{displayLabel}</span>
          <ToolbarIcon name="chevron-down" className="techearnest-picker-caret" />
        </button>
      </div>

      <TechEarnestLookupModal
        open={lookupOpen}
        title={lookupTitle ?? "Select record"}
        options={options}
        onClose={() => setLookupOpen(false)}
        onSelect={pick}
        onAddNew={onAddNew}
        addNewLabel={addNewLabel}
        searchPlaceholder={searchPlaceholder}
        quickCreate={quickCreate}
      />

      {menuPlacement === "portal" && menu ? createPortal(menu, document.body) : menu}
    </div>
  );
}
