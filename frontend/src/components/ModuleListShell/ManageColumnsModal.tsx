import { useEffect, useMemo, useState } from "react";
import type { ListLayoutColumn } from "@/features/admin/studio/metadataApi";

export interface ManageColumnsModalProps {
  open: boolean;
  columns: ListLayoutColumn[];
  selectedColumns: ListLayoutColumn[];
  mandatoryFields?: Set<string>;
  saving?: boolean;
  onClose: () => void;
  onSave: (columns: ListLayoutColumn[]) => void;
  onReset?: () => void;
}

export function ManageColumnsModal({
  open,
  columns,
  selectedColumns,
  mandatoryFields = new Set<string>(),
  saving = false,
  onClose,
  onSave,
  onReset,
}: ManageColumnsModalProps) {
  const [search, setSearch] = useState("");
  const [draftSelected, setDraftSelected] = useState<ListLayoutColumn[]>(selectedColumns);

  useEffect(() => {
    if (open) {
      setDraftSelected(selectedColumns);
      setSearch("");
    }
  }, [open, selectedColumns]);

  const filteredColumns = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = query
      ? columns.filter(
          (column) =>
            column.label.toLowerCase().includes(query) || column.field.toLowerCase().includes(query),
        )
      : columns;
    return [...list].sort((a, b) => a.label.localeCompare(b.label));
  }, [columns, search]);

  if (!open) return null;

  function isChecked(field: string) {
    return draftSelected.some((column) => column.field === field);
  }

  function toggleColumn(column: ListLayoutColumn) {
    if (mandatoryFields.has(column.field) && isChecked(column.field)) return;
    setDraftSelected((current) => {
      if (current.some((item) => item.field === column.field)) {
        return current.filter((item) => item.field !== column.field);
      }
      return [...current, column];
    });
  }

  function handleSave() {
    onSave(draftSelected.length ? draftSelected : selectedColumns);
  }

  return (
    <div className="manage-columns-backdrop" role="presentation" onClick={onClose}>
      <div
        className="manage-columns-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-columns-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="manage-columns-header">
          <h2 id="manage-columns-title" className="manage-columns-title">
            Manage Columns
          </h2>
        </div>

        <div className="manage-columns-search">
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />
        </div>

        <div className="manage-columns-list">
          {filteredColumns.map((column) => {
            const checked = isChecked(column.field);
            const mandatory = mandatoryFields.has(column.field);
            return (
              <label key={column.field} className="manage-columns-item">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={checked}
                  disabled={mandatory && checked}
                  onChange={() => toggleColumn(column)}
                />
                <span>
                  {column.label}
                  {mandatory ? <span className="text-danger">*</span> : null}
                </span>
              </label>
            );
          })}
          {!filteredColumns.length ? <div className="text-muted small px-3 py-2">No fields match your search.</div> : null}
        </div>

        <div className="manage-columns-footer">
          {onReset ? (
            <button type="button" className="btn btn-link btn-sm me-auto" disabled={saving} onClick={onReset}>
              Reset to default
            </button>
          ) : null}
          <button type="button" className="btn btn-outline-primary btn-sm" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
