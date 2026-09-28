import type { ReactNode } from "react";

export interface RecordHeaderProps {
  title: string;
  subtitle?: string;
  /** Optional identity meta line (e.g. record number, amount). */
  meta?: ReactNode;
  /** Status badges or chips — typically `<StatusBadge />`. */
  status?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  onClose?: () => void;
}

export function RecordHeader({
  title,
  subtitle,
  meta,
  status,
  primaryAction,
  secondaryActions,
  onClose,
}: RecordHeaderProps) {
  const hasActions = primaryAction || secondaryActions;

  return (
    <div className="record-header">
      <div className="record-header-top">
        <div className="record-header-identity min-w-0">
          <h2 className="record-header-title">{title}</h2>
          {subtitle ? <p className="record-header-subtitle">{subtitle}</p> : null}
          {meta ? <div className="record-header-meta">{meta}</div> : null}
        </div>
        {onClose ? (
          <button type="button" className="btn btn-outline-secondary btn-sm record-header-close" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>

      {status ? <div className="record-header-status">{status}</div> : null}

      {hasActions ? (
        <div className="record-header-actions">
          {primaryAction ? <div className="record-header-primary">{primaryAction}</div> : null}
          {secondaryActions ? <div className="record-header-secondary">{secondaryActions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
