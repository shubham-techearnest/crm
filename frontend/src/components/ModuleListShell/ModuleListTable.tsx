import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ListLayoutColumn } from "@/features/admin/studio/metadataApi";
import { useModuleListColumns } from "@/hooks/useModuleListColumns";
import { ManageColumnsModal } from "./ManageColumnsModal";
import { TableViewOptionsMenu } from "./TableViewOptionsMenu";

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
}

export function ModuleListTable<T>({
  tableCode,
  defaultColumns,
  rows,
  rowKey,
  renderCell,
  onRowClick,
  selectedRowKey,
  emptyMessage = "No records match the current filters.",
  selectable = false,
  selectedIds = [],
  onSelectedIdsChange,
  nameFields = ["name", "firstName", "lastName", "companyName", "subject"],
  enabled = true,
  excludedFields = [],
  columnsState,
  trailingColumn,
}: ModuleListTableProps<T>) {
  const internalColumns = useModuleListColumns(tableCode, defaultColumns, {
    enabled: enabled && !columnsState,
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
  }, [rowSignature, rowsPerPage]);
  useEffect(() => {
    try {
      localStorage.setItem(`techearnest:list-view:${tableCode}:page-size`, String(rowsPerPage));
      localStorage.setItem(`techearnest:list-view:${tableCode}:wrap-text`, String(wrapText));
    } catch {
      // Preferences remain usable for this session when browser storage is unavailable.
    }
  }, [tableCode, rowsPerPage, wrapText]);

  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => rows.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage),
    [rows, currentPage, rowsPerPage],
  );
  const pageRowIds = pageRows.map(rowKey);
  const allSelected = pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.includes(id));
  const rangeStart = rows.length ? currentPage * rowsPerPage + 1 : 0;
  const rangeEnd = Math.min(rows.length, (currentPage + 1) * rowsPerPage);

  return (
    <>
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
              {visibleColumns.map((column) => (
                <th key={column.field}>{column.label}</th>
              ))}
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
                      {renderCell(row, column.field)}
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
      <div className="module-list-table-pagination" aria-label="Table pagination">
        <span>{rangeStart}–{rangeEnd} of {rows.length}{rows.length >= 100 ? " loaded records" : " records"}</span>
        <div className="module-list-table-pagination-actions">
          <button type="button" className="btn btn-sm btn-light" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Previous page">‹</button>
          <span>Page {currentPage + 1} of {pageCount}</span>
          <button type="button" className="btn btn-sm btn-light" disabled={currentPage + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} aria-label="Next page">›</button>
        </div>
      </div>

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
