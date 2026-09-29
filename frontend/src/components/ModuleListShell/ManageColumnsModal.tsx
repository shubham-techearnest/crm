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

function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
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
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

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

  function move(from: number, to: number) {
    setDraftSelected((current) => moveItem(current, from, to));
  }

  function handleSave() {
    onSave(draftSelected.length ? draftSelected : selectedColumns);
  }

  function endDrag() {
    setDragIndex(null);
    setDropIndex(null);
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
          <span className="manage-columns-hint">
            {draftSelected.length} of {columns.length} fields shown
          </span>
        </div>

        <div className="manage-columns-body">
          <div className="manage-columns-pane">
            <div className="manage-columns-pane-title">Available fields</div>
            <div className="manage-columns-search">
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Search fields"
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
              {!filteredColumns.length ? <div className="text-muted small px-1 py-2">No fields match your search.</div> : null}
            </div>
          </div>

          <div className="manage-columns-pane manage-columns-pane--order">
            <div className="manage-columns-pane-title">Column order</div>
            <p className="manage-columns-pane-help">Drag a column, or use the arrows, to change its position in the list.</p>
            <ol className="manage-columns-order" aria-label="Selected columns in display order">
              {draftSelected.map((column, index) => {
                const mandatory = mandatoryFields.has(column.field);
                const classes = [
                  "manage-columns-order-item",
                  dragIndex === index ? "is-dragging" : "",
                  dropIndex === index && dragIndex !== null && dragIndex !== index ? "is-drop-target" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <li
                    key={column.field}
                    className={classes}
                    draggable
                    onDragStart={(event) => {
                      setDragIndex(index);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", column.field);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      if (dropIndex !== index) setDropIndex(index);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragIndex !== null) move(dragIndex, index);
                      endDrag();
                    }}
                    onDragEnd={endDrag}
                  >
                    <span className="manage-columns-grip" aria-hidden="true">⋮⋮</span>
                    <span className="manage-columns-order-position">{index + 1}</span>
                    <span className="manage-columns-order-label">
                      {column.label}
                      {mandatory ? <span className="text-danger">*</span> : null}
                    </span>
                    <span className="manage-columns-order-actions">
                      <button
                        type="button"
                        className="manage-columns-icon-btn"
                        aria-label={`Move ${column.label} up`}
                        title="Move up"
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="manage-columns-icon-btn"
                        aria-label={`Move ${column.label} down`}
                        title="Move down"
                        disabled={index === draftSelected.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="manage-columns-icon-btn"
                        aria-label={`Hide ${column.label}`}
                        title={mandatory ? "This column is required" : "Hide column"}
                        disabled={mandatory}
                        onClick={() => toggleColumn(column)}
                      >
                        ×
                      </button>
                    </span>
                  </li>
                );
              })}
              {!draftSelected.length ? <li className="text-muted small px-1 py-2">Select at least one field.</li> : null}
            </ol>
          </div>
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
