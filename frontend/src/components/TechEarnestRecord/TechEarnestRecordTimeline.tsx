import { useState } from "react";
import {
  formatTimelineDate,
  formatTimelineTime,
  groupTimelineByDate,
  type TimelineEntry,
} from "./buildTimelineEntries";

function TimelineChangeLine({
  label,
  from,
  to,
}: {
  label: string;
  from?: string | null;
  to?: string | null;
}) {
  if (from && to) {
    return (
      <div className="techearnest-record-timeline-change">
        <strong>{label}</strong> was updated from {from} to {to}
      </div>
    );
  }
  if (to) {
    return (
      <div className="techearnest-record-timeline-change">
        <strong>{label}</strong> was updated to {to}
      </div>
    );
  }
  return (
    <div className="techearnest-record-timeline-change">
      <strong>{label}</strong> was updated
    </div>
  );
}

export function TechEarnestRecordTimeline({
  entries,
  emptyLabel = "No timeline entries yet.",
  loading = false,
}: {
  entries: TimelineEntry[];
  emptyLabel?: string;
  loading?: boolean;
}) {
  const [filter, setFilter] = useState<"all" | "history" | "activity" | "note">("all");
  const visibleEntries = entries.filter((entry) => filter === "all" || (entry.kind ?? "history") === filter);
  const filterTitle = filter === "activity" ? "Activities" : filter === "note" ? "Notes" : "History";

  if (loading) {
    return <p className="techearnest-record-empty">Loading timeline…</p>;
  }

  if (!visibleEntries.length) {
    return (
      <div className="techearnest-record-timeline">
        <div className="techearnest-record-timeline-subnav">
          <span className="techearnest-record-timeline-subnav-item is-active">History</span>
        </div>
        <div className="techearnest-record-timeline-header">
          <h3 className="techearnest-record-timeline-title">Timeline {filterTitle}</h3>
          <select className="form-select form-select-sm techearnest-record-timeline-filter" aria-label="Filter timeline entries" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            <option value="all">All entries</option>
            <option value="history">History</option>
            <option value="activity">Activities</option>
            <option value="note">Notes</option>
          </select>
        </div>
        <p className="techearnest-record-empty">{entries.length ? `No ${filterTitle.toLowerCase()} entries to show.` : emptyLabel}</p>
      </div>
    );
  }

  const groups = groupTimelineByDate(visibleEntries);

  return (
    <div className="techearnest-record-timeline">
      <div className="techearnest-record-timeline-subnav">
        <span className="techearnest-record-timeline-subnav-item is-active">History</span>
      </div>
      <div className="techearnest-record-timeline-header">
        <h3 className="techearnest-record-timeline-title">Timeline History</h3>
        <select className="form-select form-select-sm techearnest-record-timeline-filter" aria-label="Filter timeline entries" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
          <option value="all">All entries</option>
          <option value="history">History</option>
          <option value="activity">Activities</option>
          <option value="note">Notes</option>
        </select>
      </div>
      {groups.map(([date, items]) => (
        <div key={date} className="techearnest-record-timeline-day">
          <div className="techearnest-record-timeline-date">{date}</div>
          <div className="techearnest-record-timeline-day-items">
            {items.map((entry) => (
              <div key={entry.id} className="techearnest-record-timeline-item">
                <div className="techearnest-record-timeline-time">
                  {formatTimelineTime(entry.at)}
                  <span className="techearnest-record-timeline-edit-icon" aria-hidden="true">
                    <svg viewBox="0 0 16 16" width="12" height="12">
                      <path
                        d="M11.5 2.5l2 2-8.5 8.5H3v-2L11.5 2.5z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
                <div className="techearnest-record-timeline-marker" aria-hidden="true" />
                <div className="techearnest-record-timeline-body">
                  {entry.changes?.length ? (
                    entry.changes.map((change) => (
                      <TimelineChangeLine
                        key={`${entry.id}-${change.label}`}
                        label={change.label}
                        from={change.from}
                        to={change.to}
                      />
                    ))
                  ) : (
                    <div className="techearnest-record-timeline-change">{entry.title}</div>
                  )}
                  {entry.subtitle ? <div className="text-muted small">{entry.subtitle}</div> : null}
                  <div className="techearnest-record-timeline-meta">
                    {entry.actor ? `by ${entry.actor} ` : ""}
                    {formatTimelineDate(entry.at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
