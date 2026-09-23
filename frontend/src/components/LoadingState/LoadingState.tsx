interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = "Loading..." }: LoadingStateProps) {
  return (
    <div className="state-panel" role="status" data-testid="loading-state">
      <div className="spinner-border text-primary mb-3" aria-hidden="true" />
      <p className="mb-0">{label}</p>
    </div>
  );
}
