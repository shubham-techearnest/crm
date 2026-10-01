import { createContext, useContext, useEffect, useId, useRef } from "react";

export type ModuleSortDirection = "asc" | "desc";

export interface ModuleSortField {
  field: string;
  label: string;
}

export interface ModuleSortValue {
  field: string;
  direction: ModuleSortDirection;
}

/** Page-owned (server-side) sort passed to ModuleListShell; the table then shows rows as given. */
export interface ModuleSortConfig {
  fields: ModuleSortField[];
  value: ModuleSortValue | null;
  onChange: (value: ModuleSortValue | null) => void;
}

interface ModuleSortContextValue {
  sort: ModuleSortValue | null;
  setSort: (value: ModuleSortValue | null) => void;
  fields: ModuleSortField[];
  /** True when the page sorts the data itself, so tables must not re-order rows. */
  controlled: boolean;
  registerFields: (ownerId: string, fields: ModuleSortField[] | null) => void;
}

export const ModuleSortContext = createContext<ModuleSortContextValue | null>(null);

export function useModuleSort() {
  return useContext(ModuleSortContext);
}

/** Offers a table's columns as sort fields for as long as the table is mounted. */
export function useRegisterSortFields(fields: ModuleSortField[]) {
  const context = useContext(ModuleSortContext);
  const ownerId = useId();
  const register = context?.registerFields;
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const signature = fields.map((field) => `${field.field}:${field.label}`).join("|");
  useEffect(() => {
    register?.(ownerId, fieldsRef.current.length ? fieldsRef.current : null);
  }, [register, ownerId, signature]);
  useEffect(() => () => register?.(ownerId, null), [register, ownerId]);
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function isBlank(value: unknown) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

/** Ascending comparison of cell values; blanks always sort last regardless of direction. */
export function compareSortValues(a: unknown, b: unknown, direction: ModuleSortDirection): number {
  const aBlank = isBlank(a);
  const bBlank = isBlank(b);
  if (aBlank || bBlank) return aBlank === bBlank ? 0 : aBlank ? 1 : -1;
  let result: number;
  if (typeof a === "number" && typeof b === "number") result = a - b;
  else if (typeof a === "boolean" && typeof b === "boolean") result = Number(a) - Number(b);
  else result = collator.compare(String(a), String(b));
  return direction === "asc" ? result : -result;
}
