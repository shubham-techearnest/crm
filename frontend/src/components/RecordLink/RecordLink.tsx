import { useCallback, type MouseEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useHasPermission } from "@/features/auth/AuthContext";
import type { RecordNavState } from "@/hooks/useUrlRecord";
import { RECORD_ROUTES, recordHref, recordModuleForEntityType, type RecordModule } from "./recordRoutes";
import { useRecordLinkSource } from "./RecordLinkSource";

export interface RecordLinkProps {
  module: RecordModule | null | undefined;
  id: string | null | undefined;
  children?: ReactNode;
  /** Shown when there is no id to link to. */
  fallback?: ReactNode;
  className?: string;
  title?: string;
}

/**
 * Clickable reference to another record. Opens the record in its module and remembers where the
 * user came from, so the record's back arrow (or browser back) returns to the same place.
 * Renders plain text when the id is missing or the user can't view the target module.
 */
export function RecordLink({ module, id, children, fallback = "—", className = "", title }: RecordLinkProps) {
  const location = useLocation();
  const sourceLabel = useRecordLinkSource();
  const canView = useHasPermission(module ? RECORD_ROUTES[module].permission : undefined);
  const content = children ?? fallback;

  if (!id) return <>{fallback}</>;
  if (!module || !canView) return <span className={className}>{content}</span>;

  const state: RecordNavState = {
    from: { label: sourceLabel, href: `${location.pathname}${location.search}` },
  };

  return (
    <Link
      to={recordHref(module, id)}
      state={state}
      className={`record-link ${className}`.trim()}
      title={title ?? `Open ${RECORD_ROUTES[module].label.toLowerCase()}`}
      onClick={(event: MouseEvent) => event.stopPropagation()}
    >
      {content}
    </Link>
  );
}

/** Programmatic counterpart of RecordLink, for opening a record after an action or from a menu. */
export function useOpenRecord() {
  const location = useLocation();
  const navigate = useNavigate();
  const sourceLabel = useRecordLinkSource();
  return useCallback(
    (module: RecordModule, id: string, fromLabel?: string) => {
      const state: RecordNavState = {
        from: { label: fromLabel ?? sourceLabel, href: `${location.pathname}${location.search}` },
      };
      navigate(recordHref(module, id), { state });
    },
    [location.pathname, location.search, navigate, sourceLabel],
  );
}

/** Link to a record identified by a backend entity type such as "ACCOUNT" or "TIMESHEET". */
export function EntityRecordLink({
  entityType,
  ...rest
}: Omit<RecordLinkProps, "module"> & { entityType: string | null | undefined }) {
  return <RecordLink module={recordModuleForEntityType(entityType)} {...rest} />;
}
