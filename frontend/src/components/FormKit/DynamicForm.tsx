import { useMemo, useState } from "react";
import type { Control, FieldError, FieldErrors, FieldValues, Path, UseFormRegister } from "react-hook-form";
import { FormField } from "@/components/FormField/FormField";
import { FormMoreDetails, FormSection } from "@/components/FormKit";
import { ZohoFormSelect } from "@/components/ZohoCreate";
import type { FormLayoutJson, SysField } from "@/features/admin/studio/metadataApi";

export interface DynamicFormOption {
  value: string;
  label: string;
  subtitle?: string;
}

export interface DynamicFormFieldConfig {
  options?: DynamicFormOption[];
  typeOverride?: string;
  colClass?: string;
  pickerMode?: "standard" | "user";
  searchPlaceholder?: string;
  lookupIcon?: "users" | "building" | "apps";
}

interface DynamicFormProps<T extends FieldValues> {
  layout: FormLayoutJson;
  fields: SysField[];
  register: UseFormRegister<T>;
  control: Control<T>;
  errors: FieldErrors<T>;
  fieldConfig?: Partial<Record<string, DynamicFormFieldConfig>>;
  moreOpen?: boolean;
  onMoreToggle?: () => void;
}

function fieldByCode(fields: SysField[], code: string): SysField | undefined {
  return fields.find((f) => f.code === code);
}

function defaultCol(fieldType: string, code: string): string {
  if (fieldType === "TEXT" || code === "description" || code === "notes") return "col-12";
  return "col-md-3";
}

export function DynamicForm<T extends FieldValues>({
  layout,
  fields,
  register,
  control,
  errors,
  fieldConfig = {},
  moreOpen,
  onMoreToggle,
}: DynamicFormProps<T>) {
  const [internalMore, setInternalMore] = useState(false);
  const open = moreOpen ?? internalMore;
  const toggle = onMoreToggle ?? (() => setInternalMore((v) => !v));

  const alwaysSections = useMemo(
    () => (layout.sections ?? []).filter((s) => s.disclosure !== "MORE"),
    [layout.sections],
  );
  const moreSections = useMemo(
    () => (layout.sections ?? []).filter((s) => s.disclosure === "MORE"),
    [layout.sections],
  );

  const renderField = (code: string) => {
    const meta = fieldByCode(fields, code);
    if (!meta || !meta.active) return null;
    const cfg = fieldConfig[code] ?? {};
    const col = cfg.colClass ?? defaultCol(meta.fieldType, code);
    const path = code as Path<T>;
    const error = errors[path] as FieldError | undefined;
    const options = cfg.options;
    const inputType =
      cfg.typeOverride ??
      (meta.fieldType === "NUMBER"
        ? "number"
        : meta.fieldType === "DATE"
          ? "date"
          : meta.fieldType === "DATETIME"
            ? "datetime-local"
            : meta.code.toLowerCase().includes("email")
              ? "email"
              : "text");

    if (options) {
      const pickerOptions = options.map((opt) => ({
        value: opt.value,
        label: opt.label,
        subtitle: opt.subtitle,
      }));

      return (
        <div className={col} key={code}>
          <label className={`form-label${meta.mandatory ? " required" : ""}`}>{meta.label}</label>
          <ZohoFormSelect
            control={control}
            name={path}
            options={pickerOptions}
            mode={cfg.pickerMode}
            searchPlaceholder={cfg.searchPlaceholder ?? `Search ${meta.label}`}
            lookupIcon={cfg.lookupIcon}
            allowEmpty={!meta.mandatory}
            placeholder="Select"
            invalid={!!error}
          />
          {meta.helpText && !error ? <div className="form-text">{meta.helpText}</div> : null}
          {error ? <div className="invalid-feedback d-block">{error.message}</div> : null}
        </div>
      );
    }

    if (meta.fieldType === "TEXT") {
      return (
        <div className={col} key={code}>
          <label className={`form-label${meta.mandatory ? " required" : ""}`}>{meta.label}</label>
          <textarea
            className={`form-control${error ? " is-invalid" : ""}`}
            rows={3}
            {...register(path)}
          />
          {meta.helpText && !error ? <div className="form-text">{meta.helpText}</div> : null}
          {error ? <div className="invalid-feedback d-block">{error.message}</div> : null}
        </div>
      );
    }

    return (
      <div className={col} key={code}>
        <FormField
          label={meta.label}
          required={meta.mandatory}
          type={inputType}
          hint={meta.helpText ?? undefined}
          error={error}
          {...register(path)}
        />
      </div>
    );
  };

  return (
    <>
      {alwaysSections.map((section) => (
        <FormSection key={section.id} title={section.title}>
          {section.fields.map((code) => renderField(code))}
        </FormSection>
      ))}
      {moreSections.length > 0 ? (
        <FormMoreDetails open={open} onToggle={toggle}>
          {moreSections.map((section) => (
            <FormSection key={section.id} title={section.title}>
              {section.fields.map((code) => renderField(code))}
            </FormSection>
          ))}
        </FormMoreDetails>
      ) : null}
    </>
  );
}
