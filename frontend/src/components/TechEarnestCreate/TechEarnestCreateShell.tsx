import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { UnsavedGuard } from "@/components/FormKit";
import { useCustomFieldsForm } from "@/features/customFields/useCustomFieldsForm";
import { FormLayoutEditorModal } from "./FormLayoutEditorModal";

export interface TechEarnestCreateShellProps {
  title: string;
  tableCode?: string;
  /** Id of the record being edited; leave empty when creating. Used to load its custom field values. */
  recordId?: string | null;
  /** Renders the table's Metadata Studio custom fields and saves them with the record. Default true. */
  customFields?: boolean;
  entityLabel?: string;
  layoutKey?: "CREATE" | "EDIT";
  pending?: boolean;
  isDirty?: boolean;
  formError?: string | null;
  alert?: ReactNode;
  showRecordImage?: boolean;
  recordImage?: ReactNode;
  onCancel: () => void;
  onSave: () => void;
  onSaveAndNew?: () => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  /** Label for the Save button. Default "Save". */
  saveLabel?: string;
  /** Extra primary action shown after Save, e.g. "Submit for Approval". */
  extraAction?: TechEarnestCreateExtraAction;
  children: ReactNode;
}

export interface TechEarnestCreateExtraAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

export function TechEarnestCreateShell({
  title,
  tableCode,
  recordId,
  customFields: customFieldsEnabled = true,
  entityLabel,
  layoutKey,
  pending = false,
  isDirty: formDirty = false,
  formError,
  alert,
  showRecordImage = true,
  recordImage,
  onCancel,
  onSave: onSaveForm,
  onSaveAndNew: onSaveAndNewForm,
  onSubmit,
  saveLabel = "Save",
  extraAction,
  children,
}: TechEarnestCreateShellProps) {
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const queryClient = useQueryClient();
  const customFields = useCustomFieldsForm(customFieldsEnabled ? tableCode : undefined, recordId);
  const isDirty = formDirty || customFields.dirty;
  const resolvedLayoutKey = layoutKey ?? (recordId ? "EDIT" : "CREATE");

  const onSave = () => {
    if (customFields.prepareSave()) onSaveForm();
  };
  const onSaveAndNew = onSaveAndNewForm
    ? () => {
        if (customFields.prepareSave()) onSaveAndNewForm();
      }
    : undefined;

  function requestCancel() {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    onCancel();
  }

  return (
    <div className="techearnest-create-page">
      <div className="techearnest-create-topbar">
        <div className="techearnest-create-topbar-left">
          <h1 className="techearnest-create-title">{title}</h1>
          {tableCode ? (
            <button
              type="button"
              className="techearnest-create-layout-link"
              onClick={() => setLayoutEditorOpen(true)}
            >
              Edit Page Layout
            </button>
          ) : null}
        </div>
        <div className="techearnest-create-topbar-actions">
          <button type="button" className="btn btn-light btn-sm techearnest-create-btn" onClick={requestCancel}>
            Cancel
          </button>
          {onSaveAndNew ? (
            <button type="button" className="btn btn-light btn-sm techearnest-create-btn" disabled={pending} onClick={onSaveAndNew}>
              Save and New
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${extraAction ? "btn-outline-primary" : "btn-primary"} btn-sm techearnest-create-btn techearnest-create-btn--save`}
            disabled={pending}
            onClick={onSave}
          >
            {pending ? "Saving…" : saveLabel}
          </button>
          {extraAction ? (
            <button
              type="button"
              className="btn btn-primary btn-sm techearnest-create-btn"
              disabled={pending || extraAction.disabled}
              title={extraAction.title}
              onClick={() => {
                if (customFields.prepareSave()) extraAction.onClick();
              }}
            >
              {extraAction.label}
            </button>
          ) : null}
        </div>
      </div>

      <form
        className="techearnest-create-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!customFields.prepareSave()) return;
          if (onSubmit) {
            onSubmit(event);
            return;
          }
          onSaveForm();
        }}
      >
        <UnsavedGuard when={isDirty} />

        {formError ? <div className="alert alert-danger py-2 mx-4 mt-3 mb-0">{formError}</div> : null}
        {alert}

        <div className="techearnest-create-layout" key={layoutVersion}>
          <div className="techearnest-create-fields">
            {showRecordImage ? recordImage : null}
            {children}
            {customFields.section}
          </div>
        </div>
      </form>

      {tableCode ? (
        <FormLayoutEditorModal
          open={layoutEditorOpen}
          tableCode={tableCode}
          entityLabel={entityLabel ?? title.replace(/^Create\s+/i, "")}
          layoutKey={resolvedLayoutKey}
          onClose={() => setLayoutEditorOpen(false)}
          onPublished={() => {
            setLayoutVersion((value) => value + 1);
            void queryClient.invalidateQueries({ queryKey: ["custom-fields", "schema", tableCode] });
          }}
        />
      ) : null}
    </div>
  );
}
