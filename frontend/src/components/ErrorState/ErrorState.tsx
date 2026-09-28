interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  workspace?: boolean;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  workspace = false,
}: ErrorStateProps) {
  if (workspace) {
    return (
      <div className="module-workspace-state module-workspace-state--error" data-testid="error-state">
        <h3 className="module-workspace-state-title">{title}</h3>
        <p className="module-workspace-state-message">{message}</p>
        {onRetry ? (
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="state-panel" data-testid="error-state">
      <h3 className="h5 mb-2">{title}</h3>
      <p className="mb-3">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-outline-primary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
