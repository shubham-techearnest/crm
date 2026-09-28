import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { useHasPermission } from "@/features/auth/AuthContext";
import {
  discardFormLayoutDraft,
  getFormLayout,
  listSysFields,
  listSysTables,
  publishFormLayout,
  saveFormLayoutDraft,
  type FormLayoutJson,
  type SysField,
} from "@/features/admin/studio/metadataApi";

const DEFAULT_EMPTY_FORM: FormLayoutJson = {
  sections: [
    { id: "primary", title: "Primary details", disclosure: "ALWAYS", fields: [] },
    { id: "additional", title: "Additional details", disclosure: "MORE", fields: [] },
  ],
};

export interface FormLayoutEditorModalProps {
  open: boolean;
  tableCode: string;
  entityLabel: string;
  layoutKey?: "CREATE" | "EDIT";
  onClose: () => void;
  onPublished?: () => void;
}

export function FormLayoutEditorModal({
  open,
  tableCode,
  entityLabel,
  layoutKey = "CREATE",
  onClose,
  onPublished,
}: FormLayoutEditorModalProps) {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("METADATA_MANAGE");
  const [formDraft, setFormDraft] = useState<FormLayoutJson>(DEFAULT_EMPTY_FORM);
  const [formDirty, setFormDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tablesQuery = useQuery({
    queryKey: ["metadata", "tables"],
    queryFn: listSysTables,
    enabled: open,
  });

  const tableId = useMemo(
    () => (tablesQuery.data ?? []).find((table) => table.code === tableCode)?.id ?? null,
    [tablesQuery.data, tableCode],
  );

  const fieldsQuery = useQuery({
    queryKey: ["metadata", "fields", tableId],
    queryFn: () => listSysFields(tableId!),
    enabled: open && !!tableId,
  });

  const formLayoutQuery = useQuery({
    queryKey: ["metadata", "form-layout", tableId, layoutKey],
    queryFn: () => getFormLayout(tableId!, layoutKey),
    enabled: open && !!tableId,
    retry: false,
  });

  useEffect(() => {
    if (formLayoutQuery.data?.layout) {
      setFormDraft(structuredClone(formLayoutQuery.data.layout));
      setFormDirty(false);
    } else if (formLayoutQuery.isError && tableId) {
      setFormDraft(structuredClone(DEFAULT_EMPTY_FORM));
      setFormDirty(false);
    }
  }, [formLayoutQuery.data, formLayoutQuery.isError, tableId, layoutKey]);

  const fields = fieldsQuery.data ?? [];
  const usedFormFields = useMemo(
    () => new Set(formDraft.sections.flatMap((section) => section.fields)),
    [formDraft],
  );
  const unusedFields = fields.filter((field) => field.active && !usedFormFields.has(field.code));

  const refreshForm = async () => {
    await queryClient.invalidateQueries({ queryKey: ["metadata", "form-layout", tableId, layoutKey] });
    await queryClient.invalidateQueries({ queryKey: ["metadata", "runtime", tableCode, "form-layout"] });
    await queryClient.invalidateQueries({ queryKey: ["metadata", "runtime", tableCode, "form-bundle"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => saveFormLayoutDraft(tableId!, { layoutKey, layout: formDraft }),
    onSuccess: async () => {
      await refreshForm();
      setFormDirty(false);
      setMessage("Draft saved.");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      await saveFormLayoutDraft(tableId!, { layoutKey, layout: formDraft });
      return publishFormLayout(tableId!, layoutKey);
    },
    onSuccess: async () => {
      await refreshForm();
      setFormDirty(false);
      setMessage("Layout published. Refresh the create form to apply changes.");
      setError(null);
      onPublished?.();
    },
    onError: (err: Error) => setError(err.message),
  });

  const discardMutation = useMutation({
    mutationFn: () => discardFormLayoutDraft(tableId!, layoutKey),
    onSuccess: async () => {
      await refreshForm();
      setMessage("Draft discarded.");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  function moveFormField(sectionIdx: number, fieldIdx: number, dir: -1 | 1) {
    setFormDraft((prev) => {
      const next = structuredClone(prev);
      const section = next.sections[sectionIdx];
      const target = fieldIdx + dir;
      if (target < 0 || target >= section.fields.length) return prev;
      const tmp = section.fields[fieldIdx];
      section.fields[fieldIdx] = section.fields[target];
      section.fields[target] = tmp;
      return next;
    });
    setFormDirty(true);
  }

  function removeFormField(sectionIdx: number, fieldIdx: number) {
    setFormDraft((prev) => {
      const next = structuredClone(prev);
      next.sections[sectionIdx].fields.splice(fieldIdx, 1);
      return next;
    });
    setFormDirty(true);
  }

  function addFormField(sectionIdx: number, code: string) {
    setFormDraft((prev) => {
      const next = structuredClone(prev);
      if (!next.sections[sectionIdx].fields.includes(code)) {
        next.sections[sectionIdx].fields.push(code);
      }
      return next;
    });
    setFormDirty(true);
  }

  function updateSectionTitle(sectionIdx: number, title: string) {
    setFormDraft((prev) => {
      const next = structuredClone(prev);
      next.sections[sectionIdx].title = title;
      return next;
    });
    setFormDirty(true);
  }

  if (!open) return null;

  return (
    <div className="module-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="module-modal module-modal--wide zoho-layout-editor"
        role="dialog"
        aria-labelledby="form-layout-editor-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="module-modal-header">
          <div>
            <h2 id="form-layout-editor-title" className="h5 mb-0">
              Edit Page Layout — {entityLabel} {layoutKey}
            </h2>
            <p className="small text-muted mb-0">Arrange fields into sections and publish to update the create form.</p>
          </div>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
        </div>

        <div className="module-modal-body">
          {!canManage ? (
            <div className="alert alert-warning py-2 mb-3">
              You need <strong>METADATA_MANAGE</strong> permission to edit layouts.{" "}
              <Link to="/admin/studio">Open Metadata Studio</Link> if you have view-only access.
            </div>
          ) : null}

          {message ? <div className="alert alert-success py-2">{message}</div> : null}
          {error ? <div className="alert alert-danger py-2">{error}</div> : null}

          {tablesQuery.isLoading || fieldsQuery.isLoading || formLayoutQuery.isLoading ? (
            <LoadingState label="Loading layout…" />
          ) : null}

          {!tablesQuery.isLoading && !tableId ? (
            <ErrorState title="Table not found" message={`Metadata dictionary is missing the ${tableCode} table.`} />
          ) : null}

          {tableId && !fieldsQuery.isLoading && !formLayoutQuery.isLoading ? (
            <>
              <div className="zoho-layout-palette mb-3">
                <div className="small text-muted mb-1">Available fields</div>
                <div className="d-flex flex-wrap gap-1">
                  {unusedFields.length === 0 ? (
                    <span className="text-muted small">All fields are placed in the layout.</span>
                  ) : (
                    unusedFields.map((field) => (
                      <button
                        key={field.id}
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        disabled={!canManage}
                        onClick={() => addFormField(0, field.code)}
                      >
                        {field.label}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {formDraft.sections.map((section, sectionIdx) => (
                <div key={section.id} className="zoho-layout-section mb-3">
                  <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                    <input
                      className="form-control form-control-sm w-auto"
                      value={section.title}
                      disabled={!canManage}
                      onChange={(event) => updateSectionTitle(sectionIdx, event.target.value)}
                    />
                    {canManage && unusedFields.length > 0 ? (
                      <select
                        className="form-select form-select-sm w-auto"
                        defaultValue=""
                        onChange={(event) => {
                          if (event.target.value) {
                            addFormField(sectionIdx, event.target.value);
                            event.target.value = "";
                          }
                        }}
                      >
                        <option value="">Add field…</option>
                        {unusedFields.map((field: SysField) => (
                          <option key={field.id} value={field.code}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                  <ul className="zoho-layout-field-list">
                    {section.fields.length === 0 ? (
                      <li className="text-muted small">No fields in this section.</li>
                    ) : (
                      section.fields.map((code, fieldIdx) => {
                        const meta = fields.find((field) => field.code === code);
                        return (
                          <li key={`${section.id}-${code}`}>
                            <span>{meta?.label ?? code}</span>
                            <code className="small">{code}</code>
                            {canManage ? (
                              <span className="zoho-layout-field-actions">
                                <button type="button" className="btn btn-link btn-sm" onClick={() => moveFormField(sectionIdx, fieldIdx, -1)}>
                                  ↑
                                </button>
                                <button type="button" className="btn btn-link btn-sm" onClick={() => moveFormField(sectionIdx, fieldIdx, 1)}>
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm text-danger"
                                  onClick={() => removeFormField(sectionIdx, fieldIdx)}
                                >
                                  Remove
                                </button>
                              </span>
                            ) : null}
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              ))}
            </>
          ) : null}
        </div>

        <div className="module-modal-footer">
          <Link to="/admin/studio" className="btn btn-link btn-sm me-auto" onClick={onClose}>
            Open full Studio
          </Link>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={!canManage || !formDirty || discardMutation.isPending}
            onClick={() => discardMutation.mutate()}
          >
            Discard draft
          </button>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            disabled={!canManage || !tableId || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Save draft
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!canManage || !tableId || publishMutation.isPending}
            onClick={() => publishMutation.mutate()}
          >
            Publish layout
          </button>
        </div>
      </div>
    </div>
  );
}
