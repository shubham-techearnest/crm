import type { ReactNode } from "react";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { RecordLink } from "./RecordLink";
import type { RecordModule } from "./recordRoutes";

export interface RelatedRecordItem {
  id: string;
  label: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
}

/** Compact list of related records; each label opens the record and back returns here. */
export function RelatedRecordList({
  module,
  items,
  loading = false,
  loadingLabel = "Loading…",
}: {
  module: RecordModule;
  items: RelatedRecordItem[];
  loading?: boolean;
  loadingLabel?: string;
}) {
  if (loading) return <LoadingState label={loadingLabel} workspace />;
  if (!items.length) return null;
  return (
    <ul className="related-record-list">
      {items.map((item) => (
        <li key={item.id}>
          <span className="related-record-primary">
            <RecordLink module={module} id={item.id} className="fw-semibold">
              {item.label}
            </RecordLink>
            {item.secondary ? <span className="related-record-secondary"> · {item.secondary}</span> : null}
          </span>
          {item.trailing ? <span className="related-record-trailing">{item.trailing}</span> : null}
        </li>
      ))}
    </ul>
  );
}
