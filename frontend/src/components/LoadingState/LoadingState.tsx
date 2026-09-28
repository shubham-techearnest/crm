interface LoadingStateProps {
  label?: string;
  /** Use inside ModuleListShell canvas for compact workspace styling. */
  workspace?: boolean;
}

export function LoadingState({ label = "Loading...", workspace = false }: LoadingStateProps) {
  return (
    <div
      className={workspace ? "module-workspace-state module-workspace-state--loading" : "state-panel"}
      role="status"
      data-testid="loading-state"
    >
      <div
        className={`spinner-border text-primary${workspace ? " module-workspace-state-spinner" : " mb-3"}`}
        aria-hidden="true"
      />
      <p className={workspace ? "module-workspace-state-label" : "mb-0"}>{label}</p>
    </div>
  );
}
