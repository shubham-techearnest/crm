interface FormActionsProps {
  submitLabel?: string;
  cancelLabel?: string;
  saveAndNewLabel?: string;
  submitting?: boolean;
  onCancel?: () => void;
  onSaveAndNew?: () => void;
  showSaveAndNew?: boolean;
}

/** Standard Cancel / Save / Save & New actions for module create forms. */
export function FormActions({
  submitLabel = "Save",
  cancelLabel = "Cancel",
  saveAndNewLabel = "Save & New",
  submitting = false,
  onCancel,
  onSaveAndNew,
  showSaveAndNew = false,
}: FormActionsProps) {
  return (
    <div className="d-flex flex-wrap gap-2 mt-2">
      <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
        {submitting ? "Saving…" : submitLabel}
      </button>
      {showSaveAndNew && onSaveAndNew ? (
        <button type="button" className="btn btn-outline-primary btn-sm" disabled={submitting} onClick={onSaveAndNew}>
          {saveAndNewLabel}
        </button>
      ) : null}
      {onCancel ? (
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={submitting} onClick={onCancel}>
          {cancelLabel}
        </button>
      ) : null}
    </div>
  );
}
