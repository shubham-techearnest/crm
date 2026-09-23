interface StatusBadgeProps {
  status: string;
}

const TONE: Record<string, string> = {
  PARTIALLY_ALLOCATED: "bg-warning text-dark",
  FULLY_ALLOCATED: "bg-info text-dark",
  AVAILABLE: "bg-success",
  ON_LEAVE: "bg-secondary",
  INACTIVE: "bg-secondary",
  PLANNED: "bg-secondary",
  ACTIVE: "bg-success",
  APPROVED: "bg-success",
  WON: "bg-success",
  COMPLETED: "bg-success",
  DRAFT: "bg-secondary",
  NEW: "bg-primary",
  SUBMITTED: "bg-info text-dark",
  REJECTED: "bg-danger",
  LOST: "bg-danger",
  DELAYED: "bg-danger",
  ON_TRACK: "bg-success",
  BLOCKED: "bg-warning text-dark",
  ON_HOLD: "bg-warning text-dark",
  ISSUED: "bg-info text-dark",
  PARTIALLY_PAID: "bg-warning text-dark",
  PAID: "bg-success",
  VOID: "bg-secondary",
  OVERDUE: "bg-danger",
  EXPIRED: "bg-danger",
  TERMINATED: "bg-secondary",
  RENEWED: "bg-info text-dark",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const tone = TONE[status] ?? "bg-secondary";
  return <span className={`badge ${tone}`}>{status.replaceAll("_", " ")}</span>;
}
