import { useState, type FormEvent, type ReactNode } from "react";
import { UnsavedGuard } from "@/components/FormKit";
import { FormLayoutEditorModal } from "./FormLayoutEditorModal";

export interface ZohoCreateShellProps {
  title: string;
  tableCode?: string;
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
  children: ReactNode;
}

export function ZohoCreateShell({
  title,
  tableCode,
  entityLabel,
  layoutKey = "CREATE",
  pending = false,
  isDirty = false,
  formError,
  alert,
  showRecordImage = true,
  recordImage,
  onCancel,
  onSave,
  onSaveAndNew,
  onSubmit,
  children,
}: ZohoCreateShellProps) {
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);

  function requestCancel() {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    onCancel();
  }

  return (
    <div className="zoho-create-page">
      <div className="zoho-create-topbar">
        <div className="zoho-create-topbar-left">
          <h1 className="zoho-create-title">{title}</h1>
          {tableCode ? (
            <button
              type="button"
              className="zoho-create-layout-link"
              onClick={() => setLayoutEditorOpen(true)}
            >
              Edit Page Layout
            </button>
          ) : null}
        </div>
        <div className="zoho-create-topbar-actions">
          <button type="button" className="btn btn-light btn-sm zoho-create-btn" onClick={requestCancel}>
            Cancel
          </button>
          {onSaveAndNew ? (
            <button type="button" className="btn btn-light btn-sm zoho-create-btn" disabled={pending} onClick={onSaveAndNew}>
              Save and New
            </button>
          ) : null}
          <button type="button" className="btn btn-primary btn-sm zoho-create-btn zoho-create-btn--save" disabled={pending} onClick={onSave}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <form
        className="zoho-create-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (onSubmit) {
            onSubmit(event);
            return;
          }
          onSave();
        }}
      >
        <UnsavedGuard when={isDirty} />

        {formError ? <div className="alert alert-danger py-2 mx-4 mt-3 mb-0">{formError}</div> : null}
        {alert}

        <div className="zoho-create-layout" key={layoutVersion}>
          <div className="zoho-create-fields">
            {showRecordImage ? recordImage : null}
            {children}
          </div>
        </div>
      </form>

      {tableCode ? (
        <FormLayoutEditorModal
          open={layoutEditorOpen}
          tableCode={tableCode}
          entityLabel={entityLabel ?? title.replace(/^Create\s+/i, "")}
          layoutKey={layoutKey}
          onClose={() => setLayoutEditorOpen(false)}
          onPublished={() => setLayoutVersion((value) => value + 1)}
        />
      ) : null}
    </div>
  );
}
