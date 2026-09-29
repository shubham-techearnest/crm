import type { ReactNode } from "react";

export function TechEarnestCreateSection({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`techearnest-create-section ${className}`.trim()}>
      <h2 className="techearnest-create-section-title">{title}</h2>
      {children}
    </section>
  );
}
