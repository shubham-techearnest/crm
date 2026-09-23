import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="state-panel" data-testid="empty-state">
      <h3 className="h5 mb-2">{title}</h3>
      <p className="mb-3">{description}</p>
      {action}
    </div>
  );
}
