import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { TechEarnestPickerOption } from "./TechEarnestPicker";

export interface TechEarnestLookupQuickCreateField {
  name: string;
  label: string;
  required?: boolean;
  type?: "text" | "email" | "select";
  options?: TechEarnestPickerOption[];
}

export interface TechEarnestLookupQuickCreate {
  title: string;
  fields: TechEarnestLookupQuickCreateField[];
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => Promise<{ value: string; label: string; subtitle?: string }>;
}

export interface TechEarnestLookupModalProps {
  open: boolean;
  title: string;
  options: TechEarnestPickerOption[];
  onClose: () => void;
  onSelect: (value: string) => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  quickCreate?: TechEarnestLookupQuickCreate;
}

export function TechEarnestLookupModal({
  open,
  title,
  options,
  onClose,
  onSelect,
  onAddNew,
  addNewLabel = "Add New",
  searchPlaceholder = "Search records",
  emptyLabel = "No records found",
  quickCreate,
}: TechEarnestLookupModalProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"list" | "create">("list");
  const [createValues, setCreateValues] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setMode("list");
      setCreateValues({});
      setCreateError(null);
      setSubmitting(false);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        (option.subtitle?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  if (!open) return null;

  function handleClose() {
    onClose();
  }

  function openCreate() {
    if (quickCreate) {
      setMode("create");
      setCreateError(null);
      setCreateValues(Object.fromEntries(quickCreate.fields.map((field) => [field.name, ""])));
      return;
    }
    onAddNew?.();
  }

  async function submitCreate() {
    if (!quickCreate || submitting) return;

    for (const field of quickCreate.fields) {
      if (field.required && !createValues[field.name]?.trim()) {
        setCreateError(`${field.label} is required.`);
        return;
      }
    }

    setSubmitting(true);
    setCreateError(null);
    try {
      const created = await quickCreate.onSubmit(createValues);
      onSelect(created.value);
      handleClose();
    } catch {
      setCreateError("Could not create record. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Portalled and form-less: this modal opens from fields inside record forms, and a nested <form>
  // would submit (and reset) the host record form along with the quick-create.
  return createPortal(
    <div className="techearnest-lookup-backdrop" role="presentation" onClick={handleClose}>
      <div
        className="techearnest-lookup-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") handleClose();
        }}
      >
        <div className="techearnest-lookup-modal-header">
          <h2 className="techearnest-lookup-modal-title">{mode === "create" && quickCreate ? quickCreate.title : title}</h2>
          <button type="button" className="btn-close" aria-label="Close" onClick={handleClose} />
        </div>

        {mode === "create" && quickCreate ? (
          <div
            className="techearnest-lookup-create-form"
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
                event.preventDefault();
                void submitCreate();
              }
            }}
          >
            {createError ? <div className="alert alert-danger py-2 mx-3 mt-3 mb-0">{createError}</div> : null}
            <div className="techearnest-lookup-create-fields">
              {quickCreate.fields.map((field) => (
                <label key={field.name} className="techearnest-lookup-create-field">
                  <span className="form-label">
                    {field.label}
                    {field.required ? " *" : ""}
                  </span>
                  {field.type === "select" ? (
                    <select
                      className="form-select form-select-sm"
                      value={createValues[field.name] ?? ""}
                      onChange={(event) =>
                        setCreateValues((current) => ({ ...current, [field.name]: event.target.value }))
                      }
                      autoFocus={field === quickCreate.fields[0]}
                    >
                      <option value="">Select {field.label}</option>
                      {(field.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type ?? "text"}
                      className="form-control form-control-sm"
                      value={createValues[field.name] ?? ""}
                      onChange={(event) =>
                        setCreateValues((current) => ({ ...current, [field.name]: event.target.value }))
                      }
                      autoFocus={field === quickCreate.fields[0]}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="techearnest-lookup-create-actions">
              <button type="button" className="btn btn-light btn-sm" onClick={() => setMode("list")}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={submitting}
                onClick={() => void submitCreate()}
              >
                {submitting ? "Saving…" : quickCreate.submitLabel ?? "Save and Select"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="techearnest-lookup-modal-toolbar">
              {onAddNew || quickCreate ? (
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={openCreate}>
                  {addNewLabel}
                </button>
              ) : null}
              <input
                type="search"
                className="form-control form-control-sm techearnest-lookup-modal-search"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
              />
            </div>
            <ul className="techearnest-lookup-modal-list">
              {filtered.length === 0 ? (
                <li className="techearnest-lookup-modal-empty">{emptyLabel}</li>
              ) : (
                filtered.map((option) => (
                  <li key={option.value}>
                    <button
                      type="button"
                      className="techearnest-lookup-modal-item"
                      onClick={() => {
                        onSelect(option.value);
                        handleClose();
                      }}
                    >
                      <span className="techearnest-lookup-modal-item-label">{option.label}</span>
                      {option.subtitle ? (
                        <span className="techearnest-lookup-modal-item-subtitle">{option.subtitle}</span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
