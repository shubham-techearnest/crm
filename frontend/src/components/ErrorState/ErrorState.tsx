interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: ErrorStateProps) {
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
