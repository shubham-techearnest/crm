import type { ReactNode } from "react";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { EmptyState } from "@/components/EmptyState/EmptyState";

interface AdminPageProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children: ReactNode;
}

export function AdminPage({
  title,
  description,
  actions,
  loading,
  error,
  empty,
  emptyTitle,
  emptyDescription,
  children,
}: AdminPageProps) {
  return (
    <section className="page-card">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="h4 mb-1">{title}</h1>
          {description ? <p className="text-muted mb-0">{description}</p> : null}
        </div>
        {actions}
      </div>
      {loading ? <LoadingState label="Loading..." /> : null}
      {!loading && error ? <ErrorState title="Unable to load" message="Check your connection and try again." /> : null}
      {!loading && !error && empty ? (
        <EmptyState title={emptyTitle ?? "Nothing here yet"} description={emptyDescription ?? "Create the first record to get started."} />
      ) : null}
      {!loading && !error && !empty ? children : null}
    </section>
  );
}
