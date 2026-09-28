import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ZohoPickerOption } from "./ZohoPicker";

export interface ZohoLookupQuickCreateField {
  name: string;
  label: string;
  required?: boolean;
  type?: "text" | "email";
}

export interface ZohoLookupQuickCreate {
  title: string;
  fields: ZohoLookupQuickCreateField[];
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => Promise<{ value: string; label: string; subtitle?: string }>;
}

export interface ZohoLookupModalProps {
  open: boolean;
  title: string;
  options: ZohoPickerOption[];
  onClose: () => void;
  onSelect: (value: string) => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  quickCreate?: ZohoLookupQuickCreate;
}

export function ZohoLookupModal({
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
}: ZohoLookupModalProps) {
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

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!quickCreate) return;

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

  return (
    <div className="zoho-lookup-backdrop" role="presentation" onClick={handleClose}>
      <div className="zoho-lookup-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="zoho-lookup-modal-header">
          <h2 className="zoho-lookup-modal-title">{mode === "create" && quickCreate ? quickCreate.title : title}</h2>
          <button type="button" className="btn-close" aria-label="Close" onClick={handleClose} />
        </div>

        {mode === "create" && quickCreate ? (
          <form className="zoho-lookup-create-form" onSubmit={(event) => void submitCreate(event)}>
            {createError ? <div className="alert alert-danger py-2 mx-3 mt-3 mb-0">{createError}</div> : null}
            <div className="zoho-lookup-create-fields">
              {quickCreate.fields.map((field) => (
                <label key={field.name} className="zoho-lookup-create-field">
                  <span className="form-label">
                    {field.label}
                    {field.required ? " *" : ""}
                  </span>
                  <input
                    type={field.type ?? "text"}
                    className="form-control form-control-sm"
                    value={createValues[field.name] ?? ""}
                    onChange={(event) =>
                      setCreateValues((current) => ({ ...current, [field.name]: event.target.value }))
                    }
                    autoFocus={field === quickCreate.fields[0]}
                  />
                </label>
              ))}
            </div>
            <div className="zoho-lookup-create-actions">
              <button type="button" className="btn btn-light btn-sm" onClick={() => setMode("list")}>
                Back
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                {submitting ? "Saving…" : quickCreate.submitLabel ?? "Save and Select"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="zoho-lookup-modal-toolbar">
              {onAddNew || quickCreate ? (
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={openCreate}>
                  {addNewLabel}
                </button>
              ) : null}
              <input
                type="search"
                className="form-control form-control-sm zoho-lookup-modal-search"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
              />
            </div>
            <ul className="zoho-lookup-modal-list">
              {filtered.length === 0 ? (
                <li className="zoho-lookup-modal-empty">{emptyLabel}</li>
              ) : (
                filtered.map((option) => (
                  <li key={option.value}>
                    <button
                      type="button"
                      className="zoho-lookup-modal-item"
                      onClick={() => {
                        onSelect(option.value);
                        handleClose();
                      }}
                    >
                      <span className="zoho-lookup-modal-item-label">{option.label}</span>
                      {option.subtitle ? (
                        <span className="zoho-lookup-modal-item-subtitle">{option.subtitle}</span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
