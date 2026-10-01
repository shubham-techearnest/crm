import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { RecordLink } from "@/components/RecordLink/RecordLink";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { ModuleSearchInput, ModuleViewToggle } from "@/components/ModuleListShell/ModuleListShell";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listRegions } from "@/features/admin/adminApi";
import { errorMessage } from "@/features/resources/ResourcePortalPanel";
import { getResourceBoard, type BoardAllocation, type BoardResource } from "@/features/resources/resourceBoardApi";

type Filter = "all" | "working" | "bench";

interface TeamRow {
  person: BoardResource;
  current: BoardAllocation[];
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function ProjectList({ allocations }: { allocations: BoardAllocation[] }) {
  if (allocations.length === 0) return <span className="text-muted">—</span>;
  return (
    <>
      {allocations.map((a) => (
        <div key={a.allocationId} className="team-snapshot__project">
          <RecordLink module="project" id={a.projectId}>{a.projectName ?? a.projectCode ?? "Project"}</RecordLink>
          <span className="text-muted small"> · {Math.round(a.allocationPct)}% · until {formatDate(a.endDate)}</span>
        </div>
      ))}
    </>
  );
}

function StatusChip({ row }: { row: TeamRow }) {
  if (row.current.length > 0) return <span className="badge bg-primary-subtle text-primary">On project</span>;
  if (row.person.onLeave) return <span className="badge bg-secondary-subtle text-secondary">On leave</span>;
  return <span className="badge bg-success-subtle text-success">On bench</span>;
}

/** A light version of the Resource Board: who is on which project and who is on the bench. */
export function TeamSnapshot() {
  const [viewMode, setViewMode] = useState<"list" | "tile">("list");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const [regionId, setRegionId] = useState("");
  const canViewRegions = useHasPermission("REGION_VIEW");

  const query = useQuery({
    queryKey: ["resource-board", "team-snapshot", regionId],
    queryFn: () => getResourceBoard({ regionId: regionId || undefined }),
    placeholderData: (previous) => previous,
  });

  // Scoped by the backend: org-wide users get every region, regional admins only their own.
  const regionsQuery = useQuery({
    queryKey: ["admin", "regions"],
    queryFn: listRegions,
    enabled: canViewRegions,
  });
  const regions = useMemo(
    () => [...(regionsQuery.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [regionsQuery.data],
  );
  const regionName = useMemo(() => {
    const map = new Map(regions.map((r) => [r.id, r.name]));
    return (id: string) => map.get(id) ?? "—";
  }, [regions]);

  const rows = useMemo<TeamRow[]>(
    () =>
      (query.data?.resources ?? [])
        .map((person) => ({ person, current: person.allocations.filter((a) => a.phase === "CURRENT") }))
        .sort((a, b) => (a.person.name ?? "").localeCompare(b.person.name ?? "")),
    [query.data],
  );

  const workingCount = rows.filter((r) => r.current.length > 0).length;
  const benchCount = rows.length - workingCount;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "working" && row.current.length === 0) return false;
      if (filter === "bench" && row.current.length > 0) return false;
      if (!term) return true;
      const haystack = [
        row.person.name,
        row.person.code,
        row.person.designation,
        ...row.current.map((a) => a.projectName),
        ...row.person.skills.map((s) => s.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, filter, search]);

  if (query.isLoading) return <LoadingState label="Loading team…" />;
  if (query.isError) {
    return <ErrorState message={errorMessage(query.error, "Could not load the team")} onRetry={() => void query.refetch()} />;
  }

  const filters: [Filter, string, number][] = [
    ["all", "All", rows.length],
    ["working", "On projects", workingCount],
    ["bench", "On bench", benchCount],
  ];

  return (
    <div className="crm-dashboard-panel team-snapshot">
      <div className="team-snapshot__toolbar">
        <div className="module-view-tabs" role="tablist" aria-label="Team filter">
          {filters.map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`module-view-tab${filter === key ? " is-active" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label} ({count})
            </button>
          ))}
        </div>
        <div className="team-snapshot__tools">
          {regions.length > 1 ? (
            <select
              className="form-select form-select-sm team-snapshot__region"
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              aria-label="Filter by region"
            >
              <option value="">All regions</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>{region.name}</option>
              ))}
            </select>
          ) : null}
          <ModuleSearchInput value={search} onChange={setSearch} placeholder="Search name, project, skill" aria-label="Search team" />
          <ModuleViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="crm-dashboard-empty">No team members match.</div>
      ) : viewMode === "list" ? (
        <div className="module-list-table-wrap">
          <table className="table module-list-table align-middle mb-0 team-snapshot__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Designation</th>
                {regions.length > 0 ? <th>Region</th> : null}
                <th>Status</th>
                <th>Projects</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.person.id}>
                  <td data-label="Name">
                    <div>
                      <RecordLink module="resource" id={row.person.id}>{row.person.name ?? "—"}</RecordLink>
                      <div className="small text-muted">{row.person.code ?? ""}</div>
                    </div>
                  </td>
                  <td data-label="Designation">{row.person.designation ?? "—"}</td>
                  {regions.length > 0 ? <td data-label="Region">{regionName(row.person.regionId)}</td> : null}
                  <td data-label="Status"><StatusChip row={row} /></td>
                  <td data-label="Projects"><div><ProjectList allocations={row.current} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="module-tile-grid team-snapshot__tiles">
          {visible.map((row) => (
            <article key={row.person.id} className="module-tile text-start" style={{ cursor: "default" }}>
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div className="tile-title">
                  <RecordLink module="resource" id={row.person.id}>{row.person.name ?? "—"}</RecordLink>
                </div>
                <StatusChip row={row} />
              </div>
              <div className="small text-muted mb-2">
                {[row.person.code, row.person.designation, regions.length > 0 ? regionName(row.person.regionId) : null]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </div>
              <div className="small">
                {row.current.length > 0 ? (
                  <ProjectList allocations={row.current} />
                ) : (
                  <span className="text-muted">
                    {row.person.nextAllocationStartsOn
                      ? `Next project starts ${formatDate(row.person.nextAllocationStartsOn)}`
                      : row.person.skills.slice(0, 3).map((s) => s.name).filter(Boolean).join(", ") || "No project assigned"}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="text-end mt-3">
        <Link to="/resource-board" className="small">Open full Resource Board ›</Link>
      </div>
    </div>
  );
}
