interface StatusBadgeProps {
  status: string;
}

const TONE: Record<string, string> = {
  PARTIALLY_ALLOCATED: "status-badge--warning",
  FULLY_ALLOCATED: "status-badge--info",
  AVAILABLE: "status-badge--success",
  ON_LEAVE: "status-badge--neutral",
  INACTIVE: "status-badge--neutral",
  PLANNED: "status-badge--neutral",
  ACTIVE: "status-badge--success",
  APPROVED: "status-badge--success",
  WON: "status-badge--success",
  COMPLETED: "status-badge--success",
  DRAFT: "status-badge--neutral",
  NEW: "status-badge--primary",
  SUBMITTED: "status-badge--info",
  REJECTED: "status-badge--danger",
  LOST: "status-badge--danger",
  DELAYED: "status-badge--danger",
  ON_TRACK: "status-badge--success",
  BLOCKED: "status-badge--warning",
  ON_HOLD: "status-badge--warning",
  ISSUED: "status-badge--info",
  PARTIALLY_PAID: "status-badge--warning",
  PAID: "status-badge--success",
  VOID: "status-badge--neutral",
  OVERDUE: "status-badge--danger",
  EXPIRED: "status-badge--danger",
  TERMINATED: "status-badge--neutral",
  RENEWED: "status-badge--info",
  SUSPENDED: "status-badge--danger",
  INVITED: "status-badge--info",
  LOCKED: "status-badge--warning",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const tone = TONE[status] ?? "status-badge--neutral";
  return (
    <span className={`status-badge ${tone}`} title={status}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
