import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";
import { recordHref, recordModuleForEntityType } from "@/components/RecordLink";
import { globalSearch, type SearchHit } from "@/features/dashboards/dashboardApi";

function hitHref(hit: SearchHit): string {
  const module = recordModuleForEntityType(hit.type);
  return module ? recordHref(module, hit.id) : "/";
}

export function GlobalSearch({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const searchQuery = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => globalSearch(debounced),
    enabled: debounced.length >= 2,
  });

  const results: SearchHit[] = searchQuery.data?.results ?? [];

  return (
    <div className={`global-search position-relative${compact ? " global-search--compact" : ""}`} ref={wrapRef}>
      <ToolbarIcon name="search" className="global-search-icon" />
      <input
        type="search"
        className="form-control form-control-sm global-search-input"
        placeholder="Search records"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        aria-label="Global search"
      />
      {open && debounced.length >= 2 ? (
        <div className="global-search-panel topbar-panel">
          {searchQuery.isFetching ? (
            <div className="topbar-panel-empty">Searching…</div>
          ) : null}
          {searchQuery.isError ? (
            <div className="topbar-panel-empty text-danger">Search failed</div>
          ) : null}
          {!searchQuery.isFetching && !searchQuery.isError && results.length === 0 ? (
            <div className="topbar-panel-empty">No matches</div>
          ) : null}
          {results.map((hit) => (
            <Link
              key={`${hit.type}-${hit.id}`}
              to={hitHref(hit)}
              className="global-search-hit"
              onClick={() => {
                setOpen(false);
                setQuery("");
              }}
            >
              <div className="global-search-hit-title">{hit.title}</div>
              <div className="global-search-hit-meta">
                {hit.type}
                {hit.subtitle ? ` · ${hit.subtitle}` : ""}
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
