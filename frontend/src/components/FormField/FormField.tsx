import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import type { FieldError } from "react-hook-form";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: FieldError;
  hint?: ReactNode;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
    { label, error, hint, id, required, name, ...inputProps },
    ref,
) {
  const fieldId = id ?? name;
  return (
    <div className="mb-3">
      <label htmlFor={fieldId} className={`form-label${required ? " required" : ""}`}>
        {label}
      </label>
      <input
        id={fieldId}
        name={name}
        ref={ref}
        className={`form-control${error ? " is-invalid" : ""}`}
        {...inputProps}
      />
      {hint && !error ? <div className="form-text">{hint}</div> : null}
      {error ? <div className="invalid-feedback">{error.message}</div> : null}
    </div>
  );
});
