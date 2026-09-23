import type { ReactNode } from "react";

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** Labeled section wrapper for create/edit forms (progressive disclosure friendly). */
export function FormSection({ title, description, children, className = "" }: FormSectionProps) {
  return (
    <section className={`form-section mb-3 ${className}`.trim()}>
      <div className="mb-2">
        <h3 className="h6 mb-0">{title}</h3>
        {description ? <p className="text-muted small mb-0">{description}</p> : null}
      </div>
      <div className="row g-2">{children}</div>
    </section>
  );
}

interface FormMoreDetailsProps {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  labelOpen?: string;
  labelClosed?: string;
}

export function FormMoreDetails({
  open,
  onToggle,
  children,
  labelOpen = "Hide additional details",
  labelClosed = "Additional details",
}: FormMoreDetailsProps) {
  return (
    <div className="mb-2">
      <button type="button" className="btn btn-link btn-sm px-0" onClick={onToggle}>
        {open ? labelOpen : labelClosed}
      </button>
      {open ? <div className="mt-1">{children}</div> : null}
    </div>
  );
}
