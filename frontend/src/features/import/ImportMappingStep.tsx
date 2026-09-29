import { Fragment, useState } from "react";
import type { Region } from "@/features/admin/adminApi";
import type { ImportFieldSpec, ImportMappingTemplate, ImportSchema } from "./bulkImportApi";
import { CONFIDENCE_LABEL, type ColumnMapping } from "./fieldMatching";
import { isEffectivelyRequired, mappingBlockers, transformFor, unrecognizedEnumValues, type MappingDecisions } from "./importPlan";
import { conversionLabel, normalizeEnumInput, transformOptions, typeLabel } from "./valueTransforms";

interface ImportMappingStepProps {
  schema: ImportSchema;
  fileName: string;
  rowCount: number;
  dataRows: string[][];
  decisions: MappingDecisions;
  onChange: (next: MappingDecisions) => void;
  regions: Region[];
  skipDuplicates: boolean;
  onSkipDuplicatesChange: (value: boolean) => void;
  templates: ImportMappingTemplate[];
  appliedTemplate: string | null;
  onApplyTemplate: (name: string | null) => void;
  onSaveTemplate: (name: string) => Promise<void>;
}

const STATUS_BADGE: Record<ColumnMapping["status"], { label: string; className: string }> = {
  matched: { label: "Matched", className: "text-bg-success" },
  suggested: { label: "Suggested", className: "text-bg-warning" },
  unmatched: { label: "Unmatched", className: "text-bg-danger" },
  ignored: { label: "Ignored", className: "text-bg-secondary" },
};

function sampleValue(dataRows: string[][], column: number): string {
  return dataRows.find((row) => row[column]?.trim())?.[column] ?? "";
}

export function ImportMappingStep({
  schema,
  fileName,
  rowCount,
  dataRows,
  decisions,
  onChange,
  regions,
  skipDuplicates,
  onSkipDuplicatesChange,
  templates,
  appliedTemplate,
  onApplyTemplate,
  onSaveTemplate,
}: ImportMappingStepProps) {
  const [templateName, setTemplateName] = useState(appliedTemplate ?? "");
  const [templateStatus, setTemplateStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [openValueMaps, setOpenValueMaps] = useState<Record<string, boolean>>({});

  const fieldsByKey = new Map(schema.fields.map((field) => [field.key, field]));
  const usedTargets = new Map<string, number>();
  decisions.mappings.forEach((mapping) => {
    if (mapping.target && mapping.status !== "ignored") usedTargets.set(mapping.target, mapping.column);
  });
  const unmatched = decisions.mappings.filter((mapping) => mapping.status === "unmatched");
  const blockers = mappingBlockers(schema, decisions);

  function updateMapping(column: number, patch: Partial<ColumnMapping>) {
    onChange({
      ...decisions,
      mappings: decisions.mappings.map((mapping) => (mapping.column === column ? { ...mapping, ...patch } : mapping)),
    });
  }

  function mapTo(column: number, target: string) {
    if (!target) {
      updateMapping(column, { target: null, status: "unmatched", confidence: "none", source: "manual" });
      return;
    }
    updateMapping(column, { target, status: "matched", source: "manual", suggestion: null });
  }

  function setTransform(field: string, value: string) {
    onChange({ ...decisions, transforms: { ...decisions.transforms, [field]: value } });
  }

  function setDefault(field: string, value: string) {
    onChange({ ...decisions, defaults: { ...decisions.defaults, [field]: value } });
  }

  function setValueMap(field: string, raw: string, code: string) {
    const current = { ...(decisions.valueMaps[field] ?? {}) };
    if (code) current[normalizeEnumInput(raw)] = code;
    else delete current[normalizeEnumInput(raw)];
    onChange({ ...decisions, valueMaps: { ...decisions.valueMaps, [field]: current } });
  }

  async function saveTemplate() {
    const name = templateName.trim();
    if (!name) return;
    setSavingTemplate(true);
    setTemplateStatus(null);
    try {
      await onSaveTemplate(name);
      setTemplateStatus({ ok: true, message: `Saved as "${name}". It will be applied automatically to similar files.` });
    } catch {
      setTemplateStatus({ ok: false, message: "Could not save the mapping template." });
    } finally {
      setSavingTemplate(false);
    }
  }

  function targetSelect(mapping: ColumnMapping, className = "form-select form-select-sm") {
    return (
      <select
        className={className}
        aria-label={`Target field for ${mapping.header || `column ${mapping.column + 1}`}`}
        value={mapping.status === "ignored" ? "" : (mapping.target ?? "")}
        onChange={(event) => mapTo(mapping.column, event.target.value)}
      >
        <option value="">— Not mapped —</option>
        {schema.fields.map((field) => {
          const usedBy = usedTargets.get(field.key);
          const taken = usedBy !== undefined && usedBy !== mapping.column;
          return (
            <option key={field.key} value={field.key} disabled={taken}>
              {field.label}
              {isEffectivelyRequired(field, schema) ? " *" : ""}
              {taken ? " (already mapped)" : ""}
            </option>
          );
        })}
      </select>
    );
  }

  function defaultInput(field: ImportFieldSpec) {
    const value = decisions.defaults[field.key] ?? "";
    const required = isEffectivelyRequired(field, schema);
    const placeholder = field.defaultValue
      ? `System default: ${field.defaultValue}`
      : required
        ? "Required: provide a default"
        : "Leave empty to skip";
    if (field.key === "region") {
      return (
        <select
          className="form-select form-select-sm"
          aria-label="Default region"
          value={decisions.defaultRegionId}
          onChange={(event) => onChange({ ...decisions, defaultRegionId: event.target.value })}
        >
          <option value="">{required ? "Select default region" : "No default"}</option>
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
      );
    }
    if (field.type === "ENUM" || field.type === "BOOLEAN") {
      const options = field.type === "BOOLEAN" ? ["true", "false"] : field.options;
      return (
        <select
          className="form-select form-select-sm"
          aria-label={`Default for ${field.label}`}
          value={value}
          onChange={(event) => setDefault(field.key, event.target.value)}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        className="form-control form-control-sm"
        type={field.type === "DATE" ? "date" : "text"}
        aria-label={`Default for ${field.label}`}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setDefault(field.key, event.target.value)}
      />
    );
  }

  return (
    <div className="module-modal-body">
      <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
        <div className="small text-muted me-auto">
          <strong className="text-body">{fileName}</strong> · {rowCount} data rows · {decisions.mappings.length} columns
        </div>
        <div>
          <label className="form-label small mb-1" htmlFor="import-template-select">
            Saved mapping
          </label>
          <select
            id="import-template-select"
            className="form-select form-select-sm"
            value={appliedTemplate ?? ""}
            onChange={(event) => {
              onApplyTemplate(event.target.value || null);
              setTemplateName(event.target.value);
            }}
          >
            <option value="">Automatic matching</option>
            {templates.map((template) => (
              <option key={template.name} value={template.name}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
        {schema.duplicateRule ? (
          <div className="form-check mb-1">
            <input
              className="form-check-input"
              type="checkbox"
              id="import-skip-duplicates"
              checked={skipDuplicates}
              onChange={(event) => onSkipDuplicatesChange(event.target.checked)}
            />
            <label className="form-check-label small" htmlFor="import-skip-duplicates">
              {schema.duplicateRule}
            </label>
          </div>
        ) : null}
      </div>

      {appliedTemplate ? (
        <div className="alert alert-info py-2 small">
          Applied saved mapping <strong>{appliedTemplate}</strong>. Review it below before continuing.
        </div>
      ) : null}
      {schema.groupKey ? (
        <div className="alert alert-light border py-2 small">
          Rows with the same <strong>{fieldsByKey.get(schema.groupKey)?.label}</strong> become one record with several
          lines. Fields marked “header” are read from the first row of each record.
        </div>
      ) : null}

      <h3 className="h6 mt-2">Field mapping</h3>
      <div className="table-responsive mb-3">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>Imported field</th>
              <th>Sample</th>
              <th style={{ minWidth: 190 }}>Target field</th>
              <th>Status</th>
              <th>Confidence</th>
              <th style={{ minWidth: 190 }}>Conversion</th>
              <th className="text-end">Action</th>
            </tr>
          </thead>
          <tbody>
            {decisions.mappings.map((mapping) => {
              const field = mapping.target ? fieldsByKey.get(mapping.target) : undefined;
              const active = field && mapping.status !== "ignored";
              const badge = STATUS_BADGE[mapping.status];
              const suggestion = mapping.suggestion ? fieldsByKey.get(mapping.suggestion) : undefined;
              const unknownValues =
                active && field.type === "ENUM"
                  ? unrecognizedEnumValues(dataRows, mapping.column, field, decisions.valueMaps[field.key])
                  : [];
              const mappedValues = active ? Object.entries(decisions.valueMaps[field.key] ?? {}) : [];
              const showValueMap = active && openValueMaps[field.key];
              return (
                <Fragment key={mapping.column}>
                  <tr className={mapping.status === "ignored" ? "text-muted" : undefined}>
                    <td className="small fw-semibold">{mapping.header || `Column ${mapping.column + 1}`}</td>
                    <td className="small text-muted text-truncate" style={{ maxWidth: 160 }}>
                      {sampleValue(dataRows, mapping.column)}
                    </td>
                    <td>
                      {targetSelect(mapping)}
                      {mapping.status === "unmatched" && suggestion ? (
                        <div className="small mt-1">
                          Did you mean <strong>{suggestion.label}</strong>?{" "}
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 align-baseline"
                            onClick={() => mapTo(mapping.column, suggestion.key)}
                          >
                            Use it
                          </button>
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span className={`badge ${badge.className}`}>{badge.label}</span>
                    </td>
                    <td className="small">
                      {mapping.source === "template"
                        ? "Saved mapping"
                        : mapping.source === "manual" && mapping.target
                          ? "Manual"
                          : CONFIDENCE_LABEL[mapping.confidence]}
                    </td>
                    <td>
                      {active ? (
                        <>
                          <div className="small text-muted mb-1">
                            {conversionLabel(field)}
                            {field.groupHeader ? " · header" : ""}
                          </div>
                          {transformOptions(field).length > 1 ? (
                            <select
                              className="form-select form-select-sm"
                              aria-label={`Transformation for ${field.label}`}
                              value={transformFor(field, decisions)}
                              onChange={(event) => setTransform(field.key, event.target.value)}
                            >
                              {transformOptions(field).map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="small">{transformOptions(field)[0].label}</div>
                          )}
                          {field.type === "ENUM" && (unknownValues.length || mappedValues.length) ? (
                            <button
                              type="button"
                              className={`btn btn-link btn-sm p-0 mt-1${unknownValues.length ? " text-danger" : ""}`}
                              onClick={() => setOpenValueMaps((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                            >
                              {unknownValues.length
                                ? `${unknownValues.length} unrecognised value${unknownValues.length === 1 ? "" : "s"}: map values`
                                : `${mappedValues.length} value mapping${mappedValues.length === 1 ? "" : "s"}`}
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <span className="small text-muted">—</span>
                      )}
                    </td>
                    <td className="text-end text-nowrap">
                      {mapping.status === "suggested" ? (
                        <button
                          type="button"
                          className="btn btn-outline-success btn-sm me-1"
                          onClick={() => updateMapping(mapping.column, { status: "matched" })}
                        >
                          Confirm
                        </button>
                      ) : null}
                      {mapping.status === "ignored" ? (
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() =>
                            updateMapping(mapping.column, { status: "unmatched", target: null, source: "manual" })
                          }
                        >
                          Undo ignore
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => updateMapping(mapping.column, { status: "ignored", target: null, source: "manual" })}
                        >
                          Ignore
                        </button>
                      )}
                    </td>
                  </tr>
                  {showValueMap ? (
                    <tr>
                      <td colSpan={7} className="bg-light">
                        <div className="small fw-semibold mb-2">
                          Map imported {field.label.toLowerCase()} values to allowed values
                        </div>
                        <div className="d-flex flex-wrap gap-3">
                          {[...unknownValues, ...mappedValues.map(([normalized]) => normalized)].map((raw) => (
                            <label key={raw} className="d-flex align-items-center gap-2 small">
                              <span className="text-nowrap">“{raw}” →</span>
                              <select
                                className="form-select form-select-sm"
                                value={decisions.valueMaps[field.key]?.[normalizeEnumInput(raw)] ?? ""}
                                onChange={(event) => setValueMap(field.key, raw, event.target.value)}
                              >
                                <option value="">Choose value</option>
                                {field.options.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {unmatched.length ? (
        <div className="border border-danger-subtle rounded p-3 mb-3">
          <h3 className="h6 mb-1">Unmatched imported fields</h3>
          <p className="small text-muted mb-2">
            These columns match no {schema.module.replace("-", " ")} field. Decide what to do with each one before
            continuing; nothing is discarded silently.
          </p>
          {unmatched.map((mapping) => (
            <div key={mapping.column} className="d-flex flex-wrap align-items-center gap-2 py-2 border-top">
              <div className="small fw-semibold me-auto" style={{ minWidth: 160 }}>
                {mapping.header || `Column ${mapping.column + 1}`}
                <div className="fw-normal text-muted text-truncate" style={{ maxWidth: 220 }}>
                  e.g. {sampleValue(dataRows, mapping.column) || "(empty)"}
                </div>
              </div>
              <div style={{ minWidth: 200 }}>{targetSelect(mapping)}</div>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={!schema.customFieldsSupported}
                title={
                  schema.customFieldsSupported
                    ? undefined
                    : "This module cannot store custom field values yet, so a new field could not receive this data."
                }
              >
                Create new field
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => updateMapping(mapping.column, { status: "ignored", target: null, source: "manual" })}
              >
                Ignore
              </button>
            </div>
          ))}
          {!schema.customFieldsSupported ? (
            <div className="small text-muted mt-2">
              Creating a new custom field is unavailable because {schema.module.replace("-", " ")} records do not store
              custom field values yet.
            </div>
          ) : null}
        </div>
      ) : null}

      <h3 className="h6">Target fields</h3>
      <p className="small text-muted mb-2">
        Required fields must come from a column or a default value. Optional fields without data are skipped.
      </p>
      <div className="table-responsive mb-3" style={{ maxHeight: 320 }}>
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>Target field</th>
              <th>Type</th>
              <th>Required</th>
              <th>Imported?</th>
              <th style={{ minWidth: 220 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {schema.fields.map((field) => {
              const column = usedTargets.get(field.key);
              const mapping = column !== undefined ? decisions.mappings[column] : undefined;
              const required = isEffectivelyRequired(field, schema);
              return (
                <tr key={field.key}>
                  <td className="small fw-semibold">
                    {field.label}
                    {field.reference ? <div className="fw-normal text-muted">Looked up by {field.reference}</div> : null}
                  </td>
                  <td className="small">
                    {typeLabel(field.type)}
                    {field.groupHeader ? " · header" : ""}
                  </td>
                  <td className="small">{required ? "Yes" : "No"}</td>
                  <td className="small">
                    {mapping ? (
                      <span className="text-success">Yes, from “{mapping.header}”</span>
                    ) : (
                      <span className={required ? "text-danger" : "text-muted"}>No</span>
                    )}
                  </td>
                  <td>
                    {mapping && field.key !== "region" ? (
                      <span className="small text-muted">Mapped</span>
                    ) : (
                      <>
                        {defaultInput(field)}
                        {mapping && field.key === "region" ? (
                          <div className="form-text">Used when the Region cell is empty.</div>
                        ) : null}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <input
          className="form-control form-control-sm"
          style={{ maxWidth: 260 }}
          placeholder="Template name, e.g. Customer CSV Import"
          aria-label="Mapping template name"
          value={templateName}
          onChange={(event) => setTemplateName(event.target.value)}
        />
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={!templateName.trim() || savingTemplate}
          onClick={() => void saveTemplate()}
        >
          {savingTemplate ? "Saving…" : "Save mapping as template"}
        </button>
        {templateStatus ? (
          <span className={`small ${templateStatus.ok ? "text-success" : "text-danger"}`}>{templateStatus.message}</span>
        ) : null}
      </div>

      {blockers.length ? (
        <div className="alert alert-warning py-2 mb-0">
          <div className="small fw-semibold mb-1">Resolve before continuing</div>
          <ul className="small mb-0 ps-3">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}