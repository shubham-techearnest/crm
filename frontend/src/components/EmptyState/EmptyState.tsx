import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  workspace?: boolean;
}

export function EmptyState({ title, description, action, workspace = false }: EmptyStateProps) {
  if (workspace) {
    return (
      <div className="module-workspace-state module-workspace-state--empty" data-testid="empty-state">
        <h3 className="module-workspace-state-title">{title}</h3>
        <p className="module-workspace-state-message">{description}</p>
        {action}
      </div>
    );
  }

  return (
    <div className="state-panel" data-testid="empty-state">
      <h3 className="h5 mb-2">{title}</h3>
      <p className="mb-3">{description}</p>
      {action}
    </div>
  );
}
