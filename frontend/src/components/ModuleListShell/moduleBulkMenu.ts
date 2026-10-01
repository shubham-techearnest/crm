import { createContext, useContext, useEffect, useId, useRef } from "react";
import type { ModuleMenuItem } from "./ModuleMenuDropdown";

type RegisterBulkMenu = (ownerId: string, items: ModuleMenuItem[] | null) => void;

export const ModuleBulkMenuContext = createContext<RegisterBulkMenu | null>(null);

/**
 * Publishes a table's bulk options into the enclosing ModuleListShell ⋯ menu.
 * Items are re-published only when their visible shape changes; click handlers should read live state through refs.
 */
export function useRegisterBulkMenu(items: ModuleMenuItem[] | null) {
  const register = useContext(ModuleBulkMenuContext);
  const ownerId = useId();
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const signature = items
    ? JSON.stringify(items.map(({ id, label, disabled, danger, separator, visible }) => [id, label, disabled, danger, separator, visible]))
    : "";

  useEffect(() => {
    if (!register) return;
    register(ownerId, itemsRef.current);
  }, [register, ownerId, signature]);

  useEffect(() => {
    if (!register) return;
    return () => register(ownerId, null);
  }, [register, ownerId]);
}
