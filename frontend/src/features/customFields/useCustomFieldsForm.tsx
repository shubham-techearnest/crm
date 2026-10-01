import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TechEarnestCreateField } from "@/components/TechEarnestCreate/TechEarnestCreateField";
import { TechEarnestCreateSection } from "@/components/TechEarnestCreate/TechEarnestCreateSection";
import { armCustomFieldCommit, disarmCustomFieldCommit } from "./customFieldCommit";
import {
  customFieldKeys,
  getCustomFieldSchema,
  getCustomFieldValues,
  type CustomFieldDefinition,
  type CustomFieldSchema,
  type CustomFieldValue,
  type CustomFieldValues,
} from "./customFieldsApi";

function initialValue(field: CustomFieldDefinition): CustomFieldValue {
  if (field.defaultValue == null || field.defaultValue === "") {
    return field.fieldType === "BOOLEAN" ? false : null;
  }
  if (field.fieldType === "BOOLEAN") return field.defaultValue === "true";
  if (field.fieldType === "NUMBER") {
    const parsed = Number(field.defaultValue);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return field.defaultValue;
}

function isEmpty(value: CustomFieldValue | undefined) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function toInputValue(field: CustomFieldDefinition, value: CustomFieldValue | undefined): string {
  if (value === null || value === undefined) return "";
  if (field.fieldType === "DATETIME" && typeof value === "string") return value.slice(0, 16);
  return String(value);
}

function validate(fields: CustomFieldDefinition[], values: CustomFieldValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.access !== "WRITE") continue;
    const value = values[field.code];
    if (field.mandatory && field.fieldType !== "BOOLEAN" && isEmpty(value)) {
      errors[field.code] = `${field.label} is required`;
      continue;
    }
    if (field.fieldType === "NUMBER" && !isEmpty(value) && !Number.isFinite(Number(value))) {
      errors[field.code] = "Enter a number";
    }
    if (field.fieldType === "STRING" && typeof value === "string" && value.length > 512) {
      errors[field.code] = "Use at most 512 characters";
    }
  }
  return errors;
}

export interface CustomFieldsFormState {
  hasFields: boolean;
  dirty: boolean;
  /** Validates the custom fields and, when valid, queues them to be saved with the record. */
  prepareSave: () => boolean;
  section: ReactNode;
}

/** Loads a table's custom fields for a create/edit form and queues their values for saving. */
export function useCustomFieldsForm(tableCode: string | undefined, recordId?: string | null): CustomFieldsFormState {
  const layoutKey = recordId ? "EDIT" : "CREATE";
  const schemaQuery = useQuery({
    queryKey: customFieldKeys.schema(tableCode ?? "", layoutKey),
    queryFn: () => getCustomFieldSchema(tableCode!, layoutKey),
    enabled: !!tableCode,
    retry: false,
    staleTime: 60_000,
  });
  const valuesQuery = useQuery({
    queryKey: customFieldKeys.values(tableCode ?? "", recordId ?? ""),
    queryFn: () => getCustomFieldValues(tableCode!, recordId!),
    enabled: !!tableCode && !!recordId && (schemaQuery.data?.fields.length ?? 0) > 0,
    retry: false,
  });

  const fields = useMemo(() => schemaQuery.data?.fields ?? [], [schemaQuery.data]);
  const [values, setValues] = useState<CustomFieldValues>({});
  const [baseline, setBaseline] = useState<CustomFieldValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const initializedFor = useRef<string | null>(null);
  const tokenRef = useRef<number | null>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!fields.length) return;
    const key = `${tableCode}:${recordId ?? "new"}`;
    if (initializedFor.current === key) return;
    if (recordId && !valuesQuery.data) return;
    const start: CustomFieldValues = {};
    for (const field of fields) {
      start[field.code] = recordId ? valuesQuery.data?.[field.code] ?? (field.fieldType === "BOOLEAN" ? false : null) : initialValue(field);
    }
    initializedFor.current = key;
    setValues(start);
    setBaseline(start);
    setErrors({});
  }, [fields, recordId, tableCode, valuesQuery.data]);

  useEffect(
    () => () => {
      if (tokenRef.current !== null) disarmCustomFieldCommit(tokenRef.current);
    },
    [],
  );

  const dirty = useMemo(
    () => fields.some((field) => (values[field.code] ?? null) !== (baseline[field.code] ?? null)),
    [fields, values, baseline],
  );

  const setValue = useCallback((code: string, value: CustomFieldValue) => {
    setValues((current) => ({ ...current, [code]: value }));
    setErrors((current) => {
      if (!current[code]) return current;
      const next = { ...current };
      delete next[code];
      return next;
    });
  }, []);

  const prepareSave = useCallback(() => {
    if (!tableCode || !fields.length) return true;
    const nextErrors = validate(fields, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return false;
    }
    const payload: CustomFieldValues = {};
    for (const field of fields) {
      if (field.access !== "WRITE") continue;
      const value = values[field.code];
      payload[field.code] =
        field.fieldType === "NUMBER" && !isEmpty(value) ? Number(value) : isEmpty(value) ? null : value ?? null;
    }
    tokenRef.current = armCustomFieldCommit(tableCode, recordId ?? null, payload);
    return true;
  }, [fields, recordId, tableCode, values]);

  const section =
    fields.length && schemaQuery.data ? (
      <div ref={sectionRef}>
        <CustomFieldsFormSections schema={schemaQuery.data} values={values} errors={errors} onChange={setValue} />
      </div>
    ) : null;

  return { hasFields: fields.length > 0, dirty, prepareSave, section };
}

function CustomFieldsFormSections({
  schema,
  values,
  errors,
  onChange,
}: {
  schema: CustomFieldSchema;
  values: CustomFieldValues;
  errors: Record<string, string>;
  onChange: (code: string, value: CustomFieldValue) => void;
}) {
  const byCode = useMemo(() => new Map(schema.fields.map((field) => [field.code, field])), [schema.fields]);
  return (
    <>
      {schema.sections.map((section) => {
        const sectionFields = section.fields
          .map((code) => byCode.get(code))
          .filter((field): field is CustomFieldDefinition => !!field);
        if (!sectionFields.length) return null;
        const half = Math.ceil(sectionFields.length / 2);
        const columns = [sectionFields.slice(0, half), sectionFields.slice(half)];
        return (
          <TechEarnestCreateSection key={section.id} title={section.title}>
            <div className="techearnest-create-grid">
              {columns.map((column, index) => (
                <div className="techearnest-create-col" key={index}>
                  {column.map((field) => (
                    <CustomFieldInput
                      key={field.code}
                      field={field}
                      value={values[field.code]}
                      error={errors[field.code]}
                      onChange={(value) => onChange(field.code, value)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </TechEarnestCreateSection>
        );
      })}
    </>
  );
}

function CustomFieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: CustomFieldDefinition;
  value: CustomFieldValue | undefined;
  error?: string;
  onChange: (value: CustomFieldValue) => void;
}) {
  const readOnly = field.access !== "WRITE";
  const className = `form-control form-control-sm${error ? " is-invalid" : ""}`;
  const required = field.mandatory && field.fieldType !== "BOOLEAN";
  const hint = field.helpText ?? (readOnly ? "You can view but not change this field." : undefined);
  let control: ReactNode;
  switch (field.fieldType) {
    case "TEXT":
      control = (
        <textarea
          className={className}
          rows={3}
          value={toInputValue(field, value)}
          disabled={readOnly}
          onChange={(event) => onChange(event.target.value)}
        />
      );
      break;
    case "BOOLEAN":
      control = (
        <div className="form-check mt-1">
          <input
            type="checkbox"
            className="form-check-input"
            checked={value === true}
            disabled={readOnly}
            aria-label={field.label}
            onChange={(event) => onChange(event.target.checked)}
          />
        </div>
      );
      break;
    case "ENUM":
      control = (
        <select
          className={`form-select form-select-sm${error ? " is-invalid" : ""}`}
          value={toInputValue(field, value)}
          disabled={readOnly}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">{required ? "Select" : "-None-"}</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
      break;
    default: {
      const type =
        field.fieldType === "NUMBER"
          ? "number"
          : field.fieldType === "DATE"
            ? "date"
            : field.fieldType === "DATETIME"
              ? "datetime-local"
              : "text";
      control = (
        <input
          type={type}
          className={className}
          value={toInputValue(field, value)}
          disabled={readOnly}
          step={field.fieldType === "NUMBER" ? "any" : undefined}
          placeholder={field.fieldType === "REFERENCE" ? "Record ID" : undefined}
          onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
        />
      );
    }
  }
  return (
    <TechEarnestCreateField label={field.label} required={required} error={error} hint={hint} wide={field.fieldType === "TEXT"}>
      {control}
    </TechEarnestCreateField>
  );
}
