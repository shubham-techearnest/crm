import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

export const RECORD_ID_PARAM = "id";

/** History state attached when a record is opened, so "back" can return to where the user came from. */
export interface RecordNavState {
  /** Set by RecordLink when jumping from another record or page. */
  from?: { label?: string; href: string };
  /** Set when a record is opened from its own module list. */
  inPage?: boolean;
}

export function readRecordNavState(state: unknown): RecordNavState | null {
  return state && typeof state === "object" ? (state as RecordNavState) : null;
}

/**
 * Keeps the open record's id in the `?id=` query param so records can be deep-linked,
 * opened from other records, and closed with browser or in-app back returning to the same place.
 *
 * - Opening from the list pushes a history entry; switching records (prev/next) replaces it.
 * - Closing goes back in history when the record was opened in-app, otherwise just drops the param.
 */
export function useUrlRecordId(param: string = RECORD_ID_PARAM) {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const id = params.get(param);

  const latest = useRef({ location, navigate });
  latest.current = { location, navigate };

  const setId = useCallback(
    (next: string | null) => {
      const { location: loc, navigate: nav } = latest.current;
      const nextParams = new URLSearchParams(loc.search);
      const current = nextParams.get(param);
      const state = readRecordNavState(loc.state);
      nextParams.delete("create");

      if (next) {
        if (current === next) return;
        nextParams.set(param, next);
        const search = `?${nextParams.toString()}`;
        if (current) {
          nav({ pathname: loc.pathname, search }, { replace: true, state });
        } else {
          nav({ pathname: loc.pathname, search }, { state: { inPage: true } satisfies RecordNavState });
        }
        return;
      }

      if (!current) return;
      if (state?.inPage || state?.from) {
        nav(-1);
        return;
      }
      nextParams.delete(param);
      const search = nextParams.toString();
      nav({ pathname: loc.pathname, search: search ? `?${search}` : "" }, { replace: true });
    },
    [param],
  );

  return [id, setId] as const;
}

type Updater<T> = T | null | ((current: T | null) => T | null);

function updatedAtOf(record: unknown): number {
  const value = (record as { updatedAt?: unknown } | null)?.updatedAt;
  if (typeof value !== "string") return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Drop-in replacement for `useState<T | null>` holding the open record, backed by `?id=`.
 * The record is resolved from the loaded rows, or fetched by id when it isn't in the current list
 * (e.g. filtered out or opened from another module).
 */
export function useUrlSelection<T extends { id: string }>(
  rows: T[] | undefined,
  options: { fetchById?: (id: string) => Promise<T>; param?: string } = {},
) {
  const { fetchById, param } = options;
  const [id, setId] = useUrlRecordId(param);
  const { pathname } = useLocation();
  const [pinned, setPinned] = useState<T | null>(null);

  const fromRows = useMemo(() => (id && rows ? (rows.find((row) => row.id === id) ?? null) : null), [id, rows]);
  const pinnedMatch = pinned && pinned.id === id ? pinned : null;

  const fetched = useQuery({
    queryKey: ["url-record", pathname, id],
    queryFn: () => fetchById!(id!),
    enabled: !!id && !!fetchById && rows !== undefined && !fromRows && !pinnedMatch,
    retry: false,
  });

  const selected = useMemo<T | null>(() => {
    if (!id) return null;
    if (pinnedMatch && fromRows) {
      return updatedAtOf(pinnedMatch) > updatedAtOf(fromRows) ? pinnedMatch : fromRows;
    }
    return pinnedMatch ?? fromRows ?? (fetched.data?.id === id ? fetched.data : null);
  }, [id, pinnedMatch, fromRows, fetched.data]);

  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const setSelected = useCallback(
    (next: Updater<T>) => {
      const current = selectedRef.current;
      const value = typeof next === "function" ? (next as (current: T | null) => T | null)(current) : next;
      if (typeof next === "function" && value === current) return;
      setPinned(value);
      setId(value ? value.id : null);
    },
    [setId],
  );

  return [selected, setSelected, { id, loading: !!id && !selected && fetched.isFetching }] as const;
}
