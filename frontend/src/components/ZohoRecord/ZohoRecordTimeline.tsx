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
      <div className="zoho-record-timeline-change">
        <strong>{label}</strong> was updated from {from} to {to}
      </div>
    );
  }
  if (to) {
    return (
      <div className="zoho-record-timeline-change">
        <strong>{label}</strong> was updated to {to}
      </div>
    );
  }
  return (
    <div className="zoho-record-timeline-change">
      <strong>{label}</strong> was updated
    </div>
  );
}

export function ZohoRecordTimeline({
  entries,
  emptyLabel = "No timeline entries yet.",
  loading = false,
}: {
  entries: TimelineEntry[];
  emptyLabel?: string;
  loading?: boolean;
}) {
  if (loading) {
    return <p className="zoho-record-empty">Loading timeline…</p>;
  }

  if (!entries.length) {
    return (
      <div className="zoho-record-timeline">
        <div className="zoho-record-timeline-subnav">
          <span className="zoho-record-timeline-subnav-item is-active">History</span>
        </div>
        <div className="zoho-record-timeline-header">
          <h3 className="zoho-record-timeline-title">Timeline History</h3>
        </div>
        <p className="zoho-record-empty">{emptyLabel}</p>
      </div>
    );
  }

  const groups = groupTimelineByDate(entries);

  return (
    <div className="zoho-record-timeline">
      <div className="zoho-record-timeline-subnav">
        <span className="zoho-record-timeline-subnav-item is-active">History</span>
      </div>
      <div className="zoho-record-timeline-header">
        <h3 className="zoho-record-timeline-title">Timeline History</h3>
        <button type="button" className="zoho-record-timeline-filter-btn" aria-label="Filter timeline">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path
              d="M2 3.5h12M4.5 8h7M6.5 12.5h3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      {groups.map(([date, items]) => (
        <div key={date} className="zoho-record-timeline-day">
          <div className="zoho-record-timeline-date">{date}</div>
          <div className="zoho-record-timeline-day-items">
            {items.map((entry) => (
              <div key={entry.id} className="zoho-record-timeline-item">
                <div className="zoho-record-timeline-time">
                  {formatTimelineTime(entry.at)}
                  <span className="zoho-record-timeline-edit-icon" aria-hidden="true">
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
                <div className="zoho-record-timeline-marker" aria-hidden="true" />
                <div className="zoho-record-timeline-body">
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
                    <div className="zoho-record-timeline-change">{entry.title}</div>
                  )}
                  {entry.subtitle ? <div className="text-muted small">{entry.subtitle}</div> : null}
                  <div className="zoho-record-timeline-meta">
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
