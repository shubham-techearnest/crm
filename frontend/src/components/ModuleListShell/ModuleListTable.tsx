import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ListLayoutColumn } from "@/features/admin/studio/metadataApi";
import {
  customFieldKeys,
  formatCustomFieldValue,
  getCustomFieldSchema,
  isRecordId,
  queryCustomFieldValues,
} from "@/features/customFields/customFieldsApi";
import { useModuleListColumns } from "@/hooks/useModuleListColumns";
import { BulkActionBar } from "@/components/BulkActions/BulkActionBar";
import { downloadCsv, nodeText, type BulkConfig, type BulkOutcome } from "@/components/BulkActions/bulkActions";
import { ManageColumnsModal } from "./ManageColumnsModal";
import { TableViewOptionsMenu } from "./TableViewOptionsMenu";
import type { ModuleMenuItem } from "./ModuleMenuDropdown";
import { useRegisterBulkMenu } from "./moduleBulkMenu";
import { compareSortValues, useModuleSort, useRegisterSortFields } from "./moduleSort";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";

export interface ModuleListColumnsState {
  availableColumns: ListLayoutColumn[];
  visibleColumns: ListLayoutColumn[];
  mandatoryFields: Set<string>;
  columnChooserOpen: boolean;
  setColumnChooserOpen: (open: boolean) => void;
  saveColumns: (columns: ListLayoutColumn[]) => void;
  resetColumns?: () => void;
  isSaving: boolean;
}

export interface ModuleListTableProps<T> {
  tableCode: string;
  defaultColumns: ListLayoutColumn[];
  /** Extra fields offered in Manage Columns but not shown by default. */
  optionalColumns?: ListLayoutColumn[];
  rows: T[];
  rowKey: (row: T) => string;
  renderCell: (row: T, field: string) => ReactNode;
  onRowClick?: (row: T) => void;
  selectedRowKey?: string | null;
  emptyMessage?: string;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  nameFields?: string[];
  enabled?: boolean;
  excludedFields?: string[];
  columnsState?: ModuleListColumnsState;
  trailingColumn?: {
    header?: ReactNode;
    render: (row: T) => ReactNode;
    stopPropagation?: boolean;
  };
  /** Enables row selection with a bulk action bar and CSV export of the selection. */
  bulk?: BulkConfig<T>;
}

export function ModuleListTable<T>({
  tableCode,
  defaultColumns,
  optionalColumns,
  rows,
  rowKey,
  renderCell,
  onRowClick,
  selectedRowKey,
  emptyMessage = "No records match the current filters.",
  selectable: selectableProp = false,
  selectedIds: controlledSelectedIds,
  onSelectedIdsChange: controlledOnChange,
  nameFields = ["name", "firstName", "lastName", "companyName", "subject"],
  enabled = true,
  excludedFields = [],
  columnsState,
  trailingColumn,
  bulk,
}: ModuleListTableProps<T>) {
  const selectable = selectableProp || !!bulk;
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const isControlled = controlledOnChange !== undefined;
  const selectedIds = isControlled ? controlledSelectedIds ?? [] : internalSelectedIds;
  const onSelectedIdsChange = (ids: string[]) => {
    if (isControlled) controlledOnChange?.(ids);
    else setInternalSelectedIds(ids);
  };
  const internalColumns = useModuleListColumns(tableCode, defaultColumns, {
    enabled: enabled && !columnsState,
    optionalColumns,
  });
  const columns = columnsState ?? internalColumns;
  const excluded = useMemo(() => new Set(excludedFields), [excludedFields]);
  const availableColumns = useMemo(
    () => columns.availableColumns.filter((column) => !excluded.has(column.field)),
    [columns.availableColumns, excluded],
  );
  const visibleColumns = useMemo(
    () => columns.visibleColumns.filter((column) => !excluded.has(column.field)),
    [columns.visibleColumns, excluded],
  );
  const {
    mandatoryFields,
    columnChooserOpen,
    setColumnChooserOpen,
    isSaving,
  } = columns;
  const saveColumns = (selected: ListLayoutColumn[]) =>
    columns.saveColumns(selected.filter((column) => !excluded.has(column.field)));

  const customFieldSchema = useQuery({
    queryKey: customFieldKeys.schema(tableCode, "CREATE"),
    queryFn: () => getCustomFieldSchema(tableCode, "CREATE"),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
  const customFieldsByCode = useMemo(
    () => new Map((customFieldSchema.data?.fields ?? []).map((field) => [field.code, field])),
    [customFieldSchema.data],
  );
  const showsCustomColumns = visibleColumns.some((column) => customFieldsByCode.has(column.field));
  const rowIdSignature = rows.map(rowKey).join(",");
  const customValueIds = useMemo(
    () => rowIdSignature.split(",").filter(isRecordId).slice(0, 500),
    [rowIdSignature],
  );
  const customValuesQuery = useQuery({
    queryKey: customFieldKeys.batch(tableCode, customValueIds),
    queryFn: () => queryCustomFieldValues(tableCode, customValueIds),
    enabled: enabled && showsCustomColumns && customValueIds.length > 0,
    retry: false,
    placeholderData: (previous) => previous,
  });
  const cell = (row: T, field: string): ReactNode => {
    const definition = customFieldsByCode.get(field);
    if (!definition) return renderCell(row, field);
    const value = customValuesQuery.data?.[rowKey(row)]?.[field];
    return formatCustomFieldValue(definition, value) || "—";
  };

  const sortContext = useModuleSort();
  useRegisterSortFields(
    useMemo(() => availableColumns.map(({ field, label }) => ({ field, label })), [availableColumns]),
  );
  const sortableFields = useMemo(
    () => new Set((sortContext?.fields ?? []).map((field) => field.field)),
    [sortContext?.fields],
  );
  const activeSort = sortContext?.sort ?? null;
  // Numbers and ISO dates sort by their raw value; everything else (ids shown as names, enum labels) by the
  // text the cell displays.
  const sortValue = (row: T, field: string): unknown => {
    const raw = customFieldsByCode.has(field)
      ? customValuesQuery.data?.[rowKey(row)]?.[field]
      : (row as Record<string, unknown>)[field];
    if (typeof raw === "number" || typeof raw === "boolean") return raw;
    if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
    const text = nodeText(cell(row, field)).trim();
    return text === "—" ? "" : text;
  };
  const sortedRows = useMemo(() => {
    if (!activeSort || sortContext?.controlled || !availableColumns.some((c) => c.field === activeSort.field)) {
      return rows;
    }
    return rows
      .map((row, index) => ({ row, index, value: sortValue(row, activeSort.field) }))
      .sort((a, b) => compareSortValues(a.value, b.value, activeSort.direction) || a.index - b.index)
      .map((entry) => entry.row);
    // sortValue reads the latest cells; re-sorting only when rows, sort or custom values change is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, activeSort, sortContext?.controlled, availableColumns, customValuesQuery.data]);
  const toggleColumnSort = (field: string) => {
    if (!sortContext) return;
    if (activeSort?.field !== field) sortContext.setSort({ field, direction: "asc" });
    else if (activeSort.direction === "asc") sortContext.setSort({ field, direction: "desc" });
    else sortContext.setSort(null);
  };

  const [rowsPerPage, setRowsPerPage] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(`techearnest:list-view:${tableCode}:page-size`));
      return [10, 30, 50, 100].includes(saved) ? saved : 30;
    } catch {
      return 30;
    }
  });
  const [wrapText, setWrapText] = useState(() => {
    try {
      return localStorage.getItem(`techearnest:list-view:${tableCode}:wrap-text`) === "true";
    } catch {
      return false;
    }
  });
  const [page, setPage] = useState(0);

  const rowSignature = rows.map(rowKey).join("\u001f");
  useEffect(() => {
    setPage(0);
  }, [rowSignature, rowsPerPage, activeSort?.field, activeSort?.direction]);
  useEffect(() => {
    if (!bulk || !selectedIds.length) return;
    const present = new Set(rows.map(rowKey));
    const kept = selectedIds.filter((id) => present.has(id));
    if (kept.length !== selectedIds.length) onSelectedIdsChange(kept);
    // Selection is pruned only when the loaded rows change (filters, deletes, refetch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSignature]);

  const rowLabel = (row: T): string => {
    const record = row as Record<string, unknown>;
    const named = nameFields
      .map((field) => record[field])
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (named.length) return named.slice(0, 2).join(" ");
    const first = visibleColumns[0];
    return (first && nodeText(cell(row, first.field))) || rowKey(row);
  };
  const selectedRows = useMemo(() => {
    const chosen = new Set(selectedIds);
    return rows.filter((row) => chosen.has(rowKey(row)));
  }, [rows, rowKey, selectedIds]);
  const exportRows = (rowsToExport: T[], suffix: string) => {
    const columnsToExport = visibleColumns;
    const body = rowsToExport.map((row) =>
      columnsToExport.map((column) => {
        const custom = bulk?.csvValue?.(row, column.field);
        if (custom != null) return custom;
        const text = nodeText(cell(row, column.field)).trim();
        if (text) return text;
        const raw = (row as Record<string, unknown>)[column.field];
        return raw == null || typeof raw === "object" ? "" : String(raw);
      }),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`${bulk?.exportFileName ?? tableCode}-${suffix}-${stamp}`, columnsToExport.map((c) => c.label), body);
  };
  const exportSelected = () => exportRows(selectedRows, "selected");
  const openActionRef = useRef<((actionId: string) => void) | null>(null);
  const menuHandlers = useRef({
    selectAll: () => {},
    clear: () => {},
    exportSelected: () => {},
    exportAll: () => {},
  });
  menuHandlers.current = {
    selectAll: () => onSelectedIdsChange(rows.map(rowKey)),
    clear: () => onSelectedIdsChange([]),
    exportSelected,
    exportAll: () => exportRows(sortedRows, "all"),
  };
  const selectedCount = selectedRows.length;
  const bulkNoun = bulk?.noun ?? "records";
  const bulkMenuItems: ModuleMenuItem[] | null = bulk
    ? [
        {
          id: "bulk-select-all",
          label: `Select all ${rows.length} ${bulkNoun}`,
          icon: "list",
          disabled: !rows.length || selectedCount === rows.length,
          onClick: () => menuHandlers.current.selectAll(),
        },
        {
          id: "bulk-clear",
          label: `Clear selection (${selectedCount})`,
          visible: selectedCount > 0,
          onClick: () => menuHandlers.current.clear(),
        },
        {
          id: "bulk-export-selected",
          label: selectedCount ? `Export selected (${selectedCount})` : "Export selected",
          icon: "export",
          disabled: !selectedCount,
          onClick: () => menuHandlers.current.exportSelected(),
        },
        {
          id: "bulk-export-all",
          label: `Export all ${rows.length} ${bulkNoun}`,
          icon: "export",
          disabled: !rows.length,
          onClick: () => menuHandlers.current.exportAll(),
        },
        ...((bulk.actions ?? []).some((action) => action.visible !== false)
          ? [
              { id: "bulk-actions-separator", label: "", separator: true },
              {
                id: "bulk-actions-hint",
                label: `Tick ${bulkNoun} to enable bulk actions`,
                disabled: true,
                visible: selectedCount === 0,
              },
              ...(bulk.actions ?? [])
                .filter((action) => action.visible !== false)
                .map((action): ModuleMenuItem => {
                  const applicable = action.applies ? selectedRows.filter(action.applies).length : selectedCount;
                  return {
                    id: `bulk-action-${action.id}`,
                    label: selectedCount ? `${action.label} (${applicable})` : action.label,
                    danger: action.tone === "danger",
                    disabled: applicable === 0,
                    onClick: () => openActionRef.current?.(action.id),
                  };
                }),
            ]
          : []),
      ]
    : null;
  useRegisterBulkMenu(bulkMenuItems);
  const handleBulkFinished = (outcome: BulkOutcome) => {
    const failed = new Set(outcome.failures.map((failure) => failure.id));
    onSelectedIdsChange(selectedIds.filter((id) => failed.has(id)));
    if (outcome.succeeded > 0) bulk?.onComplete?.();
  };
  useEffect(() => {
    try {
      localStorage.setItem(`techearnest:list-view:${tableCode}:page-size`, String(rowsPerPage));
      localStorage.setItem(`techearnest:list-view:${tableCode}:wrap-text`, String(wrapText));
    } catch {
      // Preferences remain usable for this session when browser storage is unavailable.
    }
  }, [tableCode, rowsPerPage, wrapText]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => sortedRows.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage),
    [sortedRows, currentPage, rowsPerPage],
  );
  const pageRowIds = pageRows.map(rowKey);
  const allSelected = pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.includes(id));
  const rangeStart = rows.length ? currentPage * rowsPerPage + 1 : 0;
  const rangeEnd = Math.min(rows.length, (currentPage + 1) * rowsPerPage);

  return (
    <>
      {bulk ? (
        <BulkActionBar
          config={bulk}
          selectedRows={selectedRows}
          rowKey={rowKey}
          rowLabel={bulk.rowLabel ?? rowLabel}
          onFinished={handleBulkFinished}
          openActionRef={openActionRef}
        />
      ) : null}
      <div className="module-list-table-wrap">
        <table className="table module-list-table align-middle">
          <thead>
            <tr>
              {selectable ? (
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    aria-label="Select all records"
                    checked={allSelected}
                    onChange={(event) => {
                      onSelectedIdsChange?.(event.target.checked
                        ? [...new Set([...selectedIds, ...pageRowIds])]
                        : selectedIds.filter((id) => !pageRowIds.includes(id)));
                    }}
                  />
                </th>
              ) : null}
              {visibleColumns.map((column) => {
                if (!sortableFields.has(column.field)) return <th key={column.field}>{column.label}</th>;
                const direction = activeSort?.field === column.field ? activeSort.direction : null;
                return (
                  <th
                    key={column.field}
                    aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
                  >
                    <button
                      type="button"
                      className={`module-list-sort-header${direction ? " is-sorted" : ""}`}
                      onClick={() => toggleColumnSort(column.field)}
                      title={`Sort by ${column.label}`}
                    >
                      <span>{column.label}</span>
                      <ToolbarIcon
                        name={direction === "desc" ? "arrow-down" : "arrow-up"}
                        className="module-list-sort-icon"
                      />
                    </button>
                  </th>
                );
              })}
              {trailingColumn ? <th>{trailingColumn.header ?? ""}</th> : null}
              <th className="module-list-table-settings-cell">
                <TableViewOptionsMenu
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={setRowsPerPage}
                  wrapText={wrapText}
                  onWrapTextChange={setWrapText}
                  onManageColumns={() => setColumnChooserOpen(true)}
                />
              </th>
            </tr>
          </thead>
          <tbody className={wrapText ? "module-list-table-wrap-text" : undefined}>
            {pageRows.map((row) => {
              const id = rowKey(row);
              return (
                <tr
                  key={id}
                  className={selectedRowKey === id ? "is-selected" : undefined}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable ? (
                    <td onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedIds.includes(id)}
                        onChange={(event) => {
                          onSelectedIdsChange?.(
                            event.target.checked
                              ? [...selectedIds, id]
                              : selectedIds.filter((selectedId) => selectedId !== id),
                          );
                        }}
                      />
                    </td>
                  ) : null}
                  {visibleColumns.map((column) => (
                    <td
                      key={column.field}
                      className={nameFields.includes(column.field) ? "record-name" : undefined}
                    >
                      {cell(row, column.field)}
                    </td>
                  ))}
                  {trailingColumn ? (
                    <td onClick={trailingColumn.stopPropagation ? (event) => event.stopPropagation() : undefined}>
                      {trailingColumn.render(row)}
                    </td>
                  ) : null}
                  <td className="module-list-table-settings-cell" aria-hidden="true" />
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (selectable ? 1 : 0) + (trailingColumn ? 1 : 0) + 1}
                  className="text-muted text-center py-5"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {pageCount > 1 ? (
        <div className="module-list-table-pagination" aria-label="Table pagination">
          <span>{rangeStart}–{rangeEnd} of {rows.length}{rows.length >= 100 ? " loaded records" : " records"}</span>
          <div className="module-list-table-pagination-actions">
            <button type="button" className="btn btn-sm btn-light" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Previous page">‹</button>
            <span>Page {currentPage + 1} of {pageCount}</span>
            <button type="button" className="btn btn-sm btn-light" disabled={currentPage + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} aria-label="Next page">›</button>
          </div>
        </div>
      ) : null}

      <ManageColumnsModal
        open={columnChooserOpen}
        columns={availableColumns}
        selectedColumns={visibleColumns}
        mandatoryFields={mandatoryFields}
        saving={isSaving}
        onClose={() => setColumnChooserOpen(false)}
        onSave={saveColumns}
        onReset={columns.resetColumns}
      />
    </>
  );
}

export { useModuleListColumns };
