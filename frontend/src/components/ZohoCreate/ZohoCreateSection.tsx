import type { ReactNode } from "react";

export function ZohoCreateSection({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`zoho-create-section ${className}`.trim()}>
      <h2 className="zoho-create-section-title">{title}</h2>
      {children}
    </section>
  );
}
