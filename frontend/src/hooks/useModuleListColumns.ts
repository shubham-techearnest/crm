import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  getPublishedFormBundle,
  getPublishedListLayout,
  getUserListPref,
  saveUserListPref,
  type ListLayoutColumn,
  type SysField,
} from "@/features/admin/studio/metadataApi";

function mergeAvailableColumns(
  fields: SysField[] | undefined,
  published: ListLayoutColumn[],
  defaults: ListLayoutColumn[],
  optional: ListLayoutColumn[],
): ListLayoutColumn[] {
  const map = new Map<string, ListLayoutColumn>();
  const sortedFields = [...(fields ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const field of sortedFields) {
    if (!field.active) continue;
    map.set(field.code, { field: field.code, label: field.label });
  }
  for (const column of published) {
    const existing = map.get(column.field);
    map.set(column.field, existing ? { ...existing, ...column, label: column.label || existing.label } : column);
  }
  for (const column of [...defaults, ...optional]) {
    if (!map.has(column.field)) {
      map.set(column.field, column);
    }
  }
  return Array.from(map.values());
}

const NO_COLUMNS: ListLayoutColumn[] = [];

export interface UseModuleListColumnsOptions {
  enabled?: boolean;
  /** Columns users can add in Manage Columns but that are hidden by default. */
  optionalColumns?: ListLayoutColumn[];
}

export function useModuleListColumns(
  tableCode: string,
  defaultColumns: ListLayoutColumn[],
  options?: UseModuleListColumnsOptions,
) {
  const queryClient = useQueryClient();
  const enabled = options?.enabled !== false;
  const [columnChooserOpen, setColumnChooserOpen] = useState(false);

  const listLayoutQuery = useQuery({
    queryKey: ["metadata", "list-layout", tableCode],
    queryFn: () => getPublishedListLayout(tableCode),
    enabled,
    retry: false,
  });

  const listPrefQuery = useQuery({
    queryKey: ["metadata", "list-prefs", tableCode],
    queryFn: () => getUserListPref(tableCode),
    enabled,
    retry: false,
  });

  const fieldCatalogQuery = useQuery({
    queryKey: ["metadata", "form-bundle", tableCode, "list-columns"],
    queryFn: () => getPublishedFormBundle(tableCode),
    enabled,
    retry: false,
  });

  const publishedColumns = useMemo(() => {
    const columns = listLayoutQuery.data?.layout?.columns;
    if (columns?.length) return columns;
    return defaultColumns;
  }, [listLayoutQuery.data, defaultColumns]);

  const optionalColumns = options?.optionalColumns ?? NO_COLUMNS;
  const availableColumns = useMemo(
    () => mergeAvailableColumns(fieldCatalogQuery.data?.fields, publishedColumns, defaultColumns, optionalColumns),
    [fieldCatalogQuery.data?.fields, publishedColumns, defaultColumns, optionalColumns],
  );

  const mandatoryFields = useMemo(() => {
    const mandatory = new Set<string>();
    for (const field of fieldCatalogQuery.data?.fields ?? []) {
      if (field.mandatory) mandatory.add(field.code);
    }
    for (const column of publishedColumns) {
      if (column.field === "name" || column.field === "firstName" || column.field === "lastName") {
        mandatory.add(column.field);
      }
    }
    return mandatory;
  }, [fieldCatalogQuery.data?.fields, publishedColumns]);

  const visibleColumns = useMemo(() => {
    const pref = listPrefQuery.data?.columns;
    if (pref?.length) {
      const available = new Set(availableColumns.map((column) => column.field));
      const filtered = pref.filter((column) => available.has(column.field));
      if (filtered.length) return filtered;
    }
    return publishedColumns;
  }, [listPrefQuery.data?.columns, publishedColumns, availableColumns]);

  const saveColumnsMutation = useMutation({
    mutationFn: (columns: ListLayoutColumn[]) => saveUserListPref(tableCode, columns),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["metadata", "list-prefs", tableCode] });
      setColumnChooserOpen(false);
    },
  });

  function saveColumns(columns: ListLayoutColumn[]) {
    const next = columns.length ? columns : publishedColumns;
    saveColumnsMutation.mutate(next);
  }

  function resetColumns() {
    saveColumnsMutation.mutate(publishedColumns);
  }

  return {
    availableColumns,
    visibleColumns,
    publishedColumns,
    mandatoryFields,
    columnChooserOpen,
    setColumnChooserOpen,
    saveColumns,
    resetColumns,
    isSaving: saveColumnsMutation.isPending,
    isLoading: listLayoutQuery.isLoading || listPrefQuery.isLoading || fieldCatalogQuery.isLoading,
  };
}
