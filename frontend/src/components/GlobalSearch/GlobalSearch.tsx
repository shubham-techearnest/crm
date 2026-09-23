import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { globalSearch, type SearchHit } from "@/features/dashboards/dashboardApi";

const TYPE_ROUTES: Record<string, string> = {
  LEAD: "/leads",
  CONTACT: "/contacts",
  ACCOUNT: "/accounts",
  DEAL: "/deals",
  PROJECT: "/projects",
};

export function GlobalSearch() {
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
    <div className="position-relative" ref={wrapRef} style={{ minWidth: 220, maxWidth: 320 }}>
      <input
        type="search"
        className="form-control form-control-sm"
        placeholder="Search CRM…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        aria-label="Global search"
      />
      {open && debounced.length >= 2 ? (
        <div
          className="position-absolute top-100 start-0 end-0 mt-1 border rounded bg-white shadow-sm"
          style={{ zIndex: 40, maxHeight: 280, overflowY: "auto" }}
        >
          {searchQuery.isFetching ? (
            <div className="p-2 small text-muted">Searching…</div>
          ) : null}
          {searchQuery.isError ? (
            <div className="p-2 small text-danger">Search failed</div>
          ) : null}
          {!searchQuery.isFetching && !searchQuery.isError && results.length === 0 ? (
            <div className="p-2 small text-muted">No matches</div>
          ) : null}
          {results.map((hit) => (
            <Link
              key={`${hit.type}-${hit.id}`}
              to={TYPE_ROUTES[hit.type] ?? "/"}
              className="d-block px-2 py-2 text-decoration-none border-bottom"
              onClick={() => {
                setOpen(false);
                setQuery("");
              }}
            >
              <div className="small fw-semibold text-dark">{hit.title}</div>
              <div className="small text-muted">
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
