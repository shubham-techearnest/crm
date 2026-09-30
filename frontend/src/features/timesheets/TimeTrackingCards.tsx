import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { RecordLink, type RecordModule } from "@/components/RecordLink";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { TechEarnestRecordRelatedCard } from "@/components/TechEarnestRecord";
import { getProjectTimeSummary, getResourceTimeSummary, type TimeBucket } from "./timesheetApi";

function hours(value: number | null | undefined): string {
  if (value == null) return "—";
  const n = Number(value);
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, "")} h`;
}

function percent(value: number | null | undefined): string {
  return value == null ? "—" : `${Number(value).toFixed(0)}%`;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "danger" | "success" | "muted" }) {
  return (
    <div className="col-6 col-md-3 mb-2">
      <div className="text-muted small">{label}</div>
      <div className={`fw-semibold${tone ? ` text-${tone}` : ""}`}>{value}</div>
    </div>
  );
}

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const over = max > 0 && value > max;
  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between small mb-1">
        <span>{label}</span>
        <span className={over ? "text-danger fw-semibold" : "text-muted"}>
          {hours(value)} of {max > 0 ? hours(max) : "—"}
          {max > 0 ? ` (${((value / max) * 100).toFixed(0)}%)` : ""}
        </span>
      </div>
      <div className="progress" style={{ height: "0.5rem" }} role="progressbar" aria-label={label}>
        <div className={`progress-bar${over ? " bg-danger" : ""}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BucketList({
  title,
  buckets,
  empty,
  module,
}: {
  title: string;
  buckets: TimeBucket[];
  empty: string;
  module?: RecordModule;
}) {
  return (
    <div className="col-md-4 mb-3">
      <h4 className="small fw-semibold text-uppercase text-muted mb-2">{title}</h4>
      {buckets.length ? (
        <ul className="list-unstyled small mb-0">
          {buckets.map((bucket) => (
            <li key={`${bucket.id ?? bucket.label}`} className="d-flex justify-content-between gap-2 mb-1">
              <span className="text-truncate" title={bucket.label}>
                {module && bucket.id ? (
                  <RecordLink module={module} id={bucket.id}>
                    {bucket.label}
                  </RecordLink>
                ) : (
                  bucket.label
                )}
              </span>
              <span className="text-nowrap">
                <span className="fw-semibold">{hours(bucket.approvedHours)}</span>
                {Number(bucket.pendingHours) > 0 ? (
                  <span className="text-muted"> +{hours(bucket.pendingHours)} pending</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-muted small">{empty}</div>
      )}
    </div>
  );
}

export function ProjectTimeTrackingCard({ projectId, canViewTimesheets }: { projectId: string; canViewTimesheets: boolean }) {
  const summaryQuery = useQuery({
    queryKey: ["projects", projectId, "time-summary"],
    queryFn: () => getProjectTimeSummary(projectId),
  });
  const summary = summaryQuery.data;
  const estimated = Number(summary?.estimatedHours ?? 0);
  const approved = Number(summary?.approvedHours ?? 0);
  const remaining = estimated > 0 ? estimated - approved : null;

  return (
    <TechEarnestRecordRelatedCard
      id="techearnest-record-section-time-tracking"
      title="Time Tracking"
      isEmpty={!summaryQuery.isLoading && !summary}
      emptyLabel={summaryQuery.error ? "Unable to load time tracking" : "No records found"}
      actions={
        canViewTimesheets ? (
          <Link className="btn btn-outline-secondary btn-sm" to="/timesheets">
            Open Timesheets
          </Link>
        ) : undefined
      }
    >
      {summaryQuery.isLoading ? <div className="text-muted small">Loading…</div> : null}
      {summary ? (
        <>
          <ProgressBar value={approved} max={estimated} label="Approved vs estimated hours" />
          <div className="row">
            <Metric label="Estimated" value={hours(summary.estimatedHours)} />
            <Metric label="Approved (actual)" value={hours(summary.approvedHours)} />
            <Metric
              label="Remaining"
              value={remaining == null ? "—" : hours(remaining)}
              tone={remaining != null && remaining < 0 ? "danger" : undefined}
            />
            <Metric label="Pending approval" value={hours(summary.pendingHours)} tone="muted" />
            <Metric label="Draft" value={hours(summary.draftHours)} tone="muted" />
            <Metric label="Billable" value={hours(summary.billableHours)} />
            <Metric label="Non-billable" value={hours(summary.nonBillableHours)} />
            <Metric label="Unbilled (approved)" value={hours(summary.unbilledHours)} />
            {summary.billableAmount != null ? (
              <Metric label="Billable value" value={Number(summary.billableAmount).toLocaleString()} />
            ) : null}
          </div>
          <div className="row mt-2">
            <BucketList title="By resource" module="resource" buckets={summary.byResource} empty="No time logged yet" />
            <BucketList title="By task" module="task" buckets={summary.byTask} empty="No task-level time" />
            <BucketList title="By week" buckets={summary.byWeek} empty="No time logged yet" />
          </div>
        </>
      ) : null}
    </TechEarnestRecordRelatedCard>
  );
}

export function ResourceTimesheetsCard({
  resourceId,
  periodStart,
  periodEnd,
  projectName,
  canViewTimesheets,
}: {
  resourceId: string;
  periodStart: string;
  periodEnd: string;
  projectName?: (id: string) => string;
  canViewTimesheets: boolean;
}) {
  const summaryQuery = useQuery({
    queryKey: ["resources", resourceId, "time-summary", periodStart, periodEnd],
    queryFn: () => getResourceTimeSummary(resourceId, { from: periodStart, to: periodEnd }),
  });
  const summary = summaryQuery.data;
  const capacity = Number(summary?.capacityHours ?? 0);
  const approved = Number(summary?.approvedHours ?? 0);

  return (
    <TechEarnestRecordRelatedCard
      id="techearnest-record-section-timesheets"
      title="Timesheets & Actual Utilization"
      isEmpty={!summaryQuery.isLoading && !summary}
      emptyLabel={summaryQuery.error ? "Unable to load timesheet summary" : "No records found"}
      actions={
        canViewTimesheets ? (
          <Link className="btn btn-outline-secondary btn-sm" to="/timesheets">
            Open Timesheets
          </Link>
        ) : undefined
      }
    >
      {summaryQuery.isLoading ? <div className="text-muted small">Loading…</div> : null}
      {summary ? (
        <>
          <div className="small text-muted mb-2">
            {summary.periodStart} – {summary.periodEnd}
          </div>
          <ProgressBar value={approved} max={capacity} label="Approved hours vs capacity" />
          <div className="row">
            <Metric label="Capacity" value={hours(summary.capacityHours)} />
            <Metric label="Approved" value={hours(summary.approvedHours)} />
            <Metric label="Pending approval" value={hours(summary.pendingHours)} tone="muted" />
            <Metric label="Billable (approved)" value={hours(summary.billableHours)} />
            <Metric label="Actual utilization" value={percent(summary.actualUtilizationPercent)} />
            <Metric label="Billable utilization" value={percent(summary.billableUtilizationPercent)} />
          </div>
          <div className="row mt-2">
            <BucketList
              title="By project"
              module="project"
              buckets={summary.byProject.map((bucket) => ({
                ...bucket,
                label: bucket.label || (bucket.id && projectName ? projectName(bucket.id) : "—"),
              }))}
              empty="No time logged in this period"
            />
            <div className="col-md-8 mb-3">
              <h4 className="small fw-semibold text-uppercase text-muted mb-2">Recent weeks</h4>
              {summary.recentWeeks.length ? (
                <ul className="list-unstyled small mb-0">
                  {summary.recentWeeks.map((week) => (
                    <li key={week.timesheetId} className="d-flex justify-content-between align-items-center gap-2 mb-1">
                      <RecordLink module="timesheet" id={week.timesheetId}>
                        Week of {week.weekStartDate}
                      </RecordLink>
                      <span className="d-flex align-items-center gap-2">
                        <span className="fw-semibold">{hours(week.totalHours)}</span>
                        <StatusBadge status={week.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-muted small">No timesheets yet</div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </TechEarnestRecordRelatedCard>
  );
}
