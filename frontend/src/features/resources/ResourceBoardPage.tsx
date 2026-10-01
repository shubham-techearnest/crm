import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listRegions } from "@/features/admin/adminApi";
import { RecordLink } from "@/components/RecordLink/RecordLink";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { errorMessage } from "./ResourcePortalPanel";
import { RESOURCE_TYPES, resourceTypeLabel } from "./resourceApi";
import {
  getResourceBoard,
  getResourceWorkload,
  updateBoardSettings,
  type BoardFilters,
  type BoardProject,
  type BoardResource,
  type BoardSettings,
  type GroupMetrics,
  type ResourceBoard,
} from "./resourceBoardApi";

type Tab = "people" | "timeline" | "projects" | "skills" | "capacity" | "settings";

const STATUS_LABELS: Record<string, string> = {
  BENCH: "Bench",
  PARTIALLY_ALLOCATED: "Partial",
  FULLY_ALLOCATED: "Fully allocated",
  OVERALLOCATED: "Over-allocated",
  ENDING_SOON: "Ending soon",
  ON_LEAVE: "On leave",
  UNAVAILABLE: "Unavailable",
  NOT_STARTED: "Not started",
  INACTIVE: "Inactive",
  CONTRACT_EXPIRED: "Contract expired",
  TERMINATED: "Terminated",
};

const FILTERABLE_STATUSES = [
  "BENCH",
  "PARTIALLY_ALLOCATED",
  "FULLY_ALLOCATED",
  "OVERALLOCATED",
  "ENDING_SOON",
  "ON_LEAVE",
  "UNAVAILABLE",
  "NOT_STARTED",
];

const SIGNAL_LABELS: Record<string, string> = {
  OK: "Healthy",
  UNSTAFFED: "Unstaffed",
  OVERDUE: "Past end date",
  UNDER_RESOURCED: "Under-resourced",
  OVERLOADED: "Team over-allocated",
  ROLL_OFF_RISK: "Roll-off risk",
  OVER_RESOURCED: "Over-resourced",
};

function statusLabel(status: string | null | undefined): string {
  return (status && STATUS_LABELS[status]) || status || "—";
}

function num(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function money(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : num(value, 0);
}

function pct(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${num(value, 0)}%`;
}

function date(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function shortWeek(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function loadClass(value: number, settings: BoardSettings): string {
  if (value <= settings.benchMaxAllocationPct) return "rb-cell--bench";
  if (value > settings.overallocationPct || value > settings.fullAllocationPct) return "rb-cell--over";
  if (value >= settings.fullAllocationPct) return "rb-cell--full";
  return "rb-cell--partial";
}

function barClass(value: number, settings: BoardSettings): string {
  if (value > settings.fullAllocationPct) return "is-over";
  if (value >= settings.fullAllocationPct) return "is-full";
  if (value <= settings.benchMaxAllocationPct) return "is-low";
  return "";
}

function StatusPill({ status }: { status: string }) {
  return <span className={`rb-status rb-status--${status}`}>{statusLabel(status)}</span>;
}

function AllocationBar({ value, settings }: { value: number; settings: BoardSettings }) {
  const width = Math.min(100, Math.max(0, value));
  return (
    <div className="d-flex align-items-center gap-2">
      <div className={`rb-bar ${barClass(value, settings)}`}>
        <span style={{ width: `${width}%` }} />
      </div>
      <span className="text-nowrap">{pct(value)}</span>
    </div>
  );
}

export function ResourceBoardPage() {
  const canConfigure = useHasPermission("RESOURCE_BOARD_CONFIGURE");
  const [tab, setTab] = useState<Tab>("people");
  const [filters, setFilters] = useState<BoardFilters>({});
  const [searchInput, setSearchInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setFilters((current) => (current.search === (searchInput.trim() || undefined) ? current : { ...current, search: searchInput.trim() || undefined }));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const boardQuery = useQuery({
    queryKey: ["resource-board", filters],
    queryFn: () => getResourceBoard(filters),
    placeholderData: (previous) => previous,
  });

  const board = boardQuery.data;

  const canViewRegions = useHasPermission("REGION_VIEW");
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions, enabled: canViewRegions });
  const regions = useMemo(
    () => [...(regionsQuery.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [regionsQuery.data],
  );

  const [knownDepartments, setKnownDepartments] = useState<Record<string, string>>({});
  const [knownSkills, setKnownSkills] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!board) return;
    setKnownDepartments((current) => {
      const next = { ...current };
      board.byDepartment.filter((g) => g.key !== "NONE").forEach((g) => { next[g.key] = g.label; });
      return next;
    });
    setKnownSkills((current) => {
      const next = { ...current };
      board.skills.forEach((s) => { next[s.skillId] = s.name ?? s.skillId; });
      return next;
    });
  }, [board]);

  const update = (patch: Partial<BoardFilters>) => setFilters((current) => ({ ...current, ...patch }));

  const toggleStatus = (status: string) => {
    const current = filters.status ?? [];
    update({ status: current.length === 1 && current[0] === status ? undefined : [status] });
    setTab("people");
  };

  const resetFilters = () => {
    setSearchInput("");
    setFilters((current) => ({ periodStart: current.periodStart, periodEnd: current.periodEnd }));
  };

  return (
    <div className="rb-page" data-testid="resource-board-page">
      <div className="rb-header">
        <div>
          <h1>Resource Board</h1>
          <div className="rb-subtitle">
            {board
              ? `Allocation as of ${date(board.asOf)} · actuals from ${date(board.periodStart)} to ${date(board.periodEnd)} · ending soon within ${board.settings.endingSoonDays} days`
              : "Who is working on what, who is free, and who is overloaded."}
          </div>
        </div>
        <div className="d-flex align-items-end gap-2">
          <div>
            <label className="form-label small mb-0" htmlFor="rb-period-start">Period from</label>
            <input
              id="rb-period-start"
              type="date"
              className="form-control form-control-sm"
              value={filters.periodStart ?? ""}
              onChange={(e) => update({ periodStart: e.target.value || undefined })}
            />
          </div>
          <div>
            <label className="form-label small mb-0" htmlFor="rb-period-end">to</label>
            <input
              id="rb-period-end"
              type="date"
              className="form-control form-control-sm"
              value={filters.periodEnd ?? ""}
              onChange={(e) => update({ periodEnd: e.target.value || undefined })}
            />
          </div>
        </div>
      </div>

      {boardQuery.isLoading && !board ? <LoadingState label="Loading resource board..." /> : null}
      {boardQuery.isError && !board ? (
        <ErrorState message={errorMessage(boardQuery.error, "Could not load the resource board")} onRetry={() => void boardQuery.refetch()} />
      ) : null}

      {board ? (
        <>
          <SummaryTiles board={board} activeStatus={filters.status?.length === 1 ? filters.status[0] : null} onStatus={toggleStatus} />

          <div className="rb-panel">
            <div className="rb-filters">
              <div>
                <label htmlFor="rb-search">Search</label>
                <input
                  id="rb-search"
                  className="form-control form-control-sm"
                  placeholder="Name, code, skill, project..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="rb-type">Type</label>
                <select
                  id="rb-type"
                  className="form-select form-select-sm"
                  value={filters.resourceType?.[0] ?? ""}
                  onChange={(e) => update({ resourceType: e.target.value ? [e.target.value] : undefined })}
                >
                  <option value="">All types</option>
                  {RESOURCE_TYPES.map((type) => (
                    <option key={type} value={type}>{resourceTypeLabel(type)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="rb-category">Category</label>
                <select
                  id="rb-category"
                  className="form-select form-select-sm"
                  value={filters.category ?? ""}
                  onChange={(e) => update({ category: e.target.value || undefined })}
                >
                  <option value="">Internal & external</option>
                  <option value="INTERNAL">Internal</option>
                  <option value="EXTERNAL">External</option>
                </select>
              </div>
              {regions.length > 1 ? (
                <div>
                  <label htmlFor="rb-region">Region</label>
                  <select
                    id="rb-region"
                    className="form-select form-select-sm"
                    value={filters.regionId ?? ""}
                    onChange={(e) => update({ regionId: e.target.value || undefined })}
                  >
                    <option value="">All regions</option>
                    {regions.map((region) => (
                      <option key={region.id} value={region.id}>{region.name}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <label htmlFor="rb-department">Department</label>
                <select
                  id="rb-department"
                  className="form-select form-select-sm"
                  value={filters.departmentId ?? ""}
                  onChange={(e) => update({ departmentId: e.target.value || undefined })}
                >
                  <option value="">All departments</option>
                  {Object.entries(knownDepartments)
                    .sort((a, b) => a[1].localeCompare(b[1]))
                    .map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                </select>
              </div>
              <div>
                <label htmlFor="rb-skill">Skill</label>
                <select
                  id="rb-skill"
                  className="form-select form-select-sm"
                  value={filters.skillId?.[0] ?? ""}
                  onChange={(e) => update({ skillId: e.target.value ? [e.target.value] : undefined })}
                >
                  <option value="">Any skill</option>
                  {Object.entries(knownSkills)
                    .sort((a, b) => a[1].localeCompare(b[1]))
                    .map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                </select>
              </div>
              <div>
                <label htmlFor="rb-status">Status</label>
                <select
                  id="rb-status"
                  className="form-select form-select-sm"
                  value={filters.status?.[0] ?? ""}
                  onChange={(e) => update({ status: e.target.value ? [e.target.value] : undefined })}
                >
                  <option value="">Any status</option>
                  {FILTERABLE_STATUSES.map((status) => (
                    <option key={status} value={status}>{statusLabel(status)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="rb-exp">Min. experience (yrs)</label>
                <input
                  id="rb-exp"
                  type="number"
                  min={0}
                  className="form-control form-control-sm"
                  style={{ width: 110 }}
                  value={filters.minExperienceYears ?? ""}
                  onChange={(e) => update({ minExperienceYears: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
              </div>
              <div>
                <label htmlFor="rb-within">Free within (days)</label>
                <input
                  id="rb-within"
                  type="number"
                  min={0}
                  className="form-control form-control-sm"
                  style={{ width: 110 }}
                  value={filters.availableWithinDays ?? ""}
                  onChange={(e) => update({ availableWithinDays: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
              </div>
              <div>
                <label htmlFor="rb-max">Max. allocation %</label>
                <input
                  id="rb-max"
                  type="number"
                  min={0}
                  className="form-control form-control-sm"
                  style={{ width: 110 }}
                  value={filters.maxAllocationPct ?? ""}
                  onChange={(e) => update({ maxAllocationPct: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
              </div>
              <div className="form-check mb-1">
                <input
                  id="rb-inactive"
                  type="checkbox"
                  className="form-check-input"
                  checked={Boolean(filters.includeInactive)}
                  onChange={(e) => update({ includeInactive: e.target.checked || undefined })}
                />
                <label className="form-check-label" htmlFor="rb-inactive" style={{ fontSize: "0.8rem" }}>
                  Include inactive
                </label>
              </div>
              <button type="button" className="btn btn-link btn-sm" onClick={resetFilters}>
                Clear filters
              </button>
              {boardQuery.isFetching ? <span className="small text-muted">Refreshing…</span> : null}
            </div>

            <div className="rb-tabs" role="tablist">
              {(
                [
                  ["people", `People (${board.resources.length})`],
                  ["timeline", "Timeline"],
                  ["projects", `Projects (${board.projects.length})`],
                  ["skills", "Skills"],
                  ["capacity", "Capacity"],
                  ...(canConfigure ? [["settings", "Settings"]] : []),
                ] as [Tab, string][]
              ).map(([key, label]) => (
                <button key={key} type="button" role="tab" className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>
                  {label}
                </button>
              ))}
            </div>

            {tab === "people" ? <PeopleTab board={board} onSelect={setSelectedId} /> : null}
            {tab === "timeline" ? <TimelineTab board={board} onSelect={setSelectedId} /> : null}
            {tab === "projects" ? <ProjectsTab board={board} /> : null}
            {tab === "skills" ? <SkillsTab board={board} onSkill={(skillId) => { update({ skillId: [skillId] }); setTab("people"); }} /> : null}
            {tab === "capacity" ? <CapacityTab board={board} /> : null}
            {tab === "settings" && canConfigure ? <SettingsTab settings={board.settings} /> : null}
          </div>
        </>
      ) : null}

      {selectedId ? (
        <WorkloadDrawer
          resourceId={selectedId}
          periodStart={filters.periodStart}
          periodEnd={filters.periodEnd}
          settings={board?.settings}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

function SummaryTiles({
  board,
  activeStatus,
  onStatus,
}: {
  board: ResourceBoard;
  activeStatus: string | null;
  onStatus: (status: string) => void;
}) {
  const { summary } = board;
  const totals = summary.totals;
  const tile = (label: string, value: string | number, status: string | null, modifier = "", hint?: string) => (
    <button
      key={label}
      type="button"
      className={`rb-tile ${modifier} ${status ? "" : "is-static"} ${status && activeStatus === status ? "is-active" : ""}`}
      onClick={status ? () => onStatus(status) : undefined}
      disabled={!status}
    >
      <div className="rb-tile__label">{label}</div>
      <div className="rb-tile__value">{value}</div>
      {hint ? <div className="rb-tile__hint">{hint}</div> : null}
    </button>
  );
  return (
    <div className="rb-tiles">
      {tile("Resources", summary.totalResources, null, "", `${summary.employees} internal · ${summary.externals} external`)}
      {tile("Bench", summary.bench, "BENCH", "rb-tile--bench")}
      {tile("Partially allocated", summary.partiallyAllocated, "PARTIALLY_ALLOCATED")}
      {tile("Fully allocated", summary.fullyAllocated, "FULLY_ALLOCATED")}
      {tile("Over-allocated", summary.overallocated, "OVERALLOCATED", "rb-tile--over")}
      {tile("Ending soon", summary.endingSoon, "ENDING_SOON", "rb-tile--ending")}
      {tile("On leave", summary.onLeave, "ON_LEAVE")}
      {tile("Utilization", pct(totals.utilizationPct), null, "", `${num(totals.allocatedHours)} of ${num(totals.capacityHours)} h`)}
      {tile("Billable utilization", pct(totals.billableUtilizationPct), null, "", `${num(totals.billableHours)} billable h approved`)}
      {board.financialsVisible
        ? tile("Margin", pct(totals.marginPct), null, "", `Revenue ${money(totals.revenue)} · cost ${money(totals.cost)}`)
        : null}
    </div>
  );
}

function PeopleTab({ board, onSelect }: { board: ResourceBoard; onSelect: (id: string) => void }) {
  const { settings, financialsVisible } = board;
  if (board.resources.length === 0) {
    return <div className="p-4 text-muted small">No resources match these filters.</div>;
  }
  return (
    <div className="table-responsive">
      <table className="rb-table">
        <thead>
          <tr>
            <th>Resource</th>
            <th>Type</th>
            <th>Status</th>
            <th>Allocation</th>
            <th>Projects</th>
            <th>Free from</th>
            <th>Skills</th>
            <th className="text-end">Capacity h</th>
            <th className="text-end">Actual h</th>
            {financialsVisible ? <th className="text-end">Cost</th> : null}
            {financialsVisible ? <th className="text-end">Revenue</th> : null}
            {financialsVisible ? <th className="text-end">Margin</th> : null}
          </tr>
        </thead>
        <tbody>
          {board.resources.map((resource) => {
            const current = resource.allocations.filter((a) => a.phase === "CURRENT");
            return (
              <tr key={resource.id} className="is-clickable" onClick={() => onSelect(resource.id)}>
                <td>
                  <div className="fw-semibold">{resource.name ?? "—"}</div>
                  <div className="small text-muted">
                    {[resource.code, resource.designation, resource.departmentName].filter(Boolean).join(" · ") || "—"}
                  </div>
                </td>
                <td>
                  <div>{resourceTypeLabel(resource.resourceType)}</div>
                  <div className="small text-muted">{resource.category === "EXTERNAL" ? "External" : "Internal"}</div>
                </td>
                <td>
                  <StatusPill status={resource.status} />
                  {resource.engagementEndingSoon ? (
                    <div className="small text-warning mt-1">Engagement ends {date(resource.engagementEndDate)}</div>
                  ) : null}
                </td>
                <td>
                  <AllocationBar value={resource.currentAllocationPct} settings={settings} />
                  {resource.futureAllocationPct !== resource.currentAllocationPct ? (
                    <div className="small text-muted">Next: {pct(resource.futureAllocationPct)}</div>
                  ) : null}
                </td>
                <td>
                  {current.length === 0 ? (
                    <span className="text-muted">—</span>
                  ) : (
                    current.map((a) => (
                      <div key={a.allocationId} className="small text-nowrap">
                        <RecordLink module="project" id={a.projectId}>{a.projectName ?? a.projectCode ?? "Project"}</RecordLink>
                        <span className="text-muted"> · {pct(a.allocationPct)} · to {date(a.endDate)}</span>
                      </div>
                    ))
                  )}
                </td>
                <td className="text-nowrap">
                  {resource.available ? <span className="text-success">Now</span> : date(resource.availableFrom)}
                  {resource.availableCapacityPct !== null && resource.availableCapacityPct > 0 && !resource.available ? (
                    <div className="small text-muted">{pct(resource.availableCapacityPct)} free</div>
                  ) : null}
                </td>
                <td style={{ maxWidth: 220 }}>
                  {resource.skills.slice(0, 4).map((skill) => (
                    <span key={skill.skillId} className={`rb-chip ${skill.primary ? "is-primary" : ""}`} title={[skill.proficiency, skill.yearsOfExperience ? `${skill.yearsOfExperience} yrs` : null].filter(Boolean).join(" · ")}>
                      {skill.name}
                    </span>
                  ))}
                  {resource.skills.length > 4 ? <span className="small text-muted">+{resource.skills.length - 4}</span> : null}
                </td>
                <td className="text-end">{num(resource.capacityHours)}</td>
                <td className="text-end">
                  {num(resource.actualHours, 1)}
                  {resource.pendingHours > 0 ? <div className="small text-muted">{num(resource.pendingHours, 1)} pending</div> : null}
                </td>
                {financialsVisible ? <td className="text-end">{money(resource.cost)}</td> : null}
                {financialsVisible ? <td className="text-end">{money(resource.revenue)}</td> : null}
                {financialsVisible ? (
                  <td className="text-end">
                    {money(resource.margin)}
                    {resource.marginPct !== null && resource.marginPct !== undefined ? <div className="small text-muted">{pct(resource.marginPct)}</div> : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TimelineTab({ board, onSelect }: { board: ResourceBoard; onSelect: (id: string) => void }) {
  const { settings } = board;
  return (
    <>
      <div className="rb-legend">
        <span style={{ ["--rb-legend-color" as string]: "#ccfbf1" }}>Bench (≤ {settings.benchMaxAllocationPct}%)</span>
        <span style={{ ["--rb-legend-color" as string]: "#bfdbfe" }}>Partial</span>
        <span style={{ ["--rb-legend-color" as string]: "#a5b4fc" }}>Full ({settings.fullAllocationPct}%)</span>
        <span style={{ ["--rb-legend-color" as string]: "#fca5a5" }}>Over-allocated</span>
      </div>
      <div className="rb-timeline px-3 pb-3">
        <table>
          <thead>
            <tr>
              <th />
              {board.weeks.map((week) => (
                <th key={week}>{shortWeek(week)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {board.resources.map((resource) => (
              <tr key={resource.id} style={{ cursor: "pointer" }} onClick={() => onSelect(resource.id)}>
                <td className="rb-timeline__name">
                  <div className="fw-semibold small">{resource.name}</div>
                  <div className="small text-muted">{resource.code}</div>
                </td>
                {board.weeks.map((week, index) => {
                  const value = resource.weeklyLoad[index] ?? 0;
                  return (
                    <td key={week}>
                      <div className={`rb-cell ${loadClass(value, settings)}`} title={`Week of ${date(week)}: ${pct(value)}`}>
                        {value > 0 ? Math.round(value) : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProjectsTab({ board }: { board: ResourceBoard }) {
  const { financialsVisible } = board;
  if (board.projects.length === 0) {
    return <div className="p-4 text-muted small">No active or planned project allocations for these resources.</div>;
  }
  return (
    <div className="table-responsive">
      <table className="rb-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Status</th>
            <th>Manager</th>
            <th>End date</th>
            <th className="text-end">Team</th>
            <th className="text-end">FTE</th>
            <th className="text-end">Allocated h</th>
            <th className="text-end">Actual h</th>
            {financialsVisible ? <th className="text-end">Cost</th> : null}
            {financialsVisible ? <th className="text-end">Revenue</th> : null}
            {financialsVisible ? <th className="text-end">Profit</th> : null}
            <th>Staffing</th>
          </tr>
        </thead>
        <tbody>
          {board.projects.map((project: BoardProject) => (
            <tr key={project.projectId}>
              <td>
                <RecordLink module="project" id={project.projectId}>{project.name}</RecordLink>
                <div className="small text-muted">{[project.projectCode, project.billingType].filter(Boolean).join(" · ")}</div>
              </td>
              <td>{project.status}</td>
              <td>{project.managerName ?? "—"}</td>
              <td className="text-nowrap">{date(project.endDate)}</td>
              <td className="text-end">{project.teamSize}</td>
              <td className="text-end">{num(project.fte, 2)}</td>
              <td className="text-end">{num(project.allocatedHours)}</td>
              <td className="text-end">{num(project.actualHours, 1)}</td>
              {financialsVisible ? <td className="text-end">{money(project.cost)}</td> : null}
              {financialsVisible ? <td className="text-end">{money(project.revenue)}</td> : null}
              {financialsVisible ? (
                <td className="text-end">
                  {money(project.profit)}
                  {project.marginPct !== null && project.marginPct !== undefined ? <div className="small text-muted">{pct(project.marginPct)}</div> : null}
                </td>
              ) : null}
              <td>
                <span className={`rb-signal rb-signal--${project.staffingSignal}`}>
                  {SIGNAL_LABELS[project.staffingSignal] ?? project.staffingSignal}
                </span>
                {project.membersEndingSoon > 0 ? <div className="small text-muted">{project.membersEndingSoon} rolling off</div> : null}
                {project.membersOverallocated > 0 ? <div className="small text-muted">{project.membersOverallocated} over-allocated</div> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SkillsTab({ board, onSkill }: { board: ResourceBoard; onSkill: (skillId: string) => void }) {
  if (board.skills.length === 0) {
    return <div className="p-4 text-muted small">No skills are recorded for these resources yet.</div>;
  }
  return (
    <div className="table-responsive">
      <table className="rb-table">
        <thead>
          <tr>
            <th>Skill</th>
            <th>Category</th>
            <th className="text-end">People</th>
            <th className="text-end">Primary skill for</th>
            <th className="text-end">Available now</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {board.skills.map((skill) => (
            <tr key={skill.skillId}>
              <td className="fw-semibold">{skill.name ?? "—"}</td>
              <td>{skill.category ?? "—"}</td>
              <td className="text-end">{skill.resources}</td>
              <td className="text-end">{skill.primary}</td>
              <td className={`text-end ${skill.available === 0 ? "text-danger" : "text-success"}`}>{skill.available}</td>
              <td className="text-end">
                <button type="button" className="btn btn-link btn-sm p-0" onClick={() => onSkill(skill.skillId)}>
                  Show people
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupTable({ title, groups, financialsVisible }: { title: string; groups: GroupMetrics[]; financialsVisible: boolean }) {
  return (
    <div className="mb-4">
      <h6 className="px-3 pt-3 mb-2">{title}</h6>
      <div className="table-responsive">
        <table className="rb-table">
          <thead>
            <tr>
              <th>{title.replace("By ", "")}</th>
              <th className="text-end">People</th>
              <th className="text-end">Capacity h</th>
              <th className="text-end">Allocated h</th>
              <th className="text-end">Free h</th>
              <th>Utilization</th>
              <th className="text-end">Actual h</th>
              <th className="text-end">Billable %</th>
              {financialsVisible ? <th className="text-end">Cost</th> : null}
              {financialsVisible ? <th className="text-end">Revenue</th> : null}
              {financialsVisible ? <th className="text-end">Margin</th> : null}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.key}>
                <td className="fw-semibold">{group.label}</td>
                <td className="text-end">{group.resources}</td>
                <td className="text-end">{num(group.capacityHours)}</td>
                <td className="text-end">{num(group.allocatedHours)}</td>
                <td className="text-end">{num(group.availableHours)}</td>
                <td>
                  <div className="d-flex align-items-center gap-2">
                    <div className={`rb-bar ${group.utilizationPct > 100 ? "is-over" : ""}`}>
                      <span style={{ width: `${Math.min(100, group.utilizationPct)}%` }} />
                    </div>
                    {pct(group.utilizationPct)}
                  </div>
                </td>
                <td className="text-end">{num(group.actualHours, 1)}</td>
                <td className="text-end">{pct(group.billableUtilizationPct)}</td>
                {financialsVisible ? <td className="text-end">{money(group.cost)}</td> : null}
                {financialsVisible ? <td className="text-end">{money(group.revenue)}</td> : null}
                {financialsVisible ? <td className="text-end">{pct(group.marginPct)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CapacityTab({ board }: { board: ResourceBoard }) {
  return (
    <div>
      <GroupTable title="Organization" groups={[board.summary.totals]} financialsVisible={board.financialsVisible} />
      <GroupTable title="By department" groups={board.byDepartment} financialsVisible={board.financialsVisible} />
      <GroupTable title="By resource type" groups={board.byType.map((g) => ({ ...g, label: resourceTypeLabel(g.key) }))} financialsVisible={board.financialsVisible} />
      <p className="small text-muted px-3 pb-3 mb-0">
        Capacity is working hours in the period minus leave. Allocated hours come from active allocations; actual and
        billable hours come from approved timesheets only.
      </p>
    </div>
  );
}

function SettingsTab({ settings }: { settings: BoardSettings }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BoardSettings>(settings);
  useEffect(() => setForm(settings), [settings]);

  const mutation = useMutation({
    mutationFn: () =>
      updateBoardSettings({
        endingSoonDays: form.endingSoonDays,
        benchMaxAllocationPct: form.benchMaxAllocationPct,
        fullAllocationPct: form.fullAllocationPct,
        overallocationPct: form.overallocationPct,
        forecastWeeks: form.forecastWeeks,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["resource-board"] }),
  });

  const field = (key: keyof BoardSettings, label: string, hint: string, min: number, max: number) => (
    <div className="col-md-4" key={key}>
      <label className="form-label small" htmlFor={`rb-set-${key}`}>{label}</label>
      <input
        id={`rb-set-${key}`}
        type="number"
        className="form-control form-control-sm"
        min={min}
        max={max}
        value={(form[key] as number | undefined) ?? ""}
        onChange={(e) => setForm((current) => ({ ...current, [key]: Number(e.target.value) }))}
        required
      />
      <div className="form-text">{hint}</div>
    </div>
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <form className="p-4" onSubmit={submit}>
      <div className="row g-3">
        {field("endingSoonDays", "Ending soon (days)", "Flag allocations and engagements ending within this many days.", 1, 180)}
        {field("benchMaxAllocationPct", "Bench up to (%)", "At or below this allocation a resource counts as bench.", 0, 99)}
        {field("fullAllocationPct", "Fully allocated at (%)", "Allocation that counts as a full load.", 1, 200)}
        {field("overallocationPct", "Over-allocated above (%)", "Allocation above this is flagged as over-allocated.", 1, 300)}
        {field("forecastWeeks", "Timeline weeks", "How many weeks the timeline looks ahead.", 1, 52)}
      </div>
      {mutation.isError ? <div className="alert alert-danger mt-3 mb-0 py-2">{errorMessage(mutation.error, "Could not save settings")}</div> : null}
      {mutation.isSuccess ? <div className="alert alert-success mt-3 mb-0 py-2">Settings saved.</div> : null}
      <div className="mt-3">
        <button type="submit" className="btn btn-primary btn-sm" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}

function WorkloadDrawer({
  resourceId,
  periodStart,
  periodEnd,
  settings,
  onClose,
}: {
  resourceId: string;
  periodStart?: string;
  periodEnd?: string;
  settings?: BoardSettings;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ["resource-workload", resourceId, periodStart, periodEnd],
    queryFn: () => getResourceWorkload(resourceId, periodStart, periodEnd),
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const data = query.data;
  const resource: BoardResource | undefined = data?.resource;
  const allocations = useMemo(
    () => [...(data?.allocations ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [data?.allocations],
  );

  return (
    <>
      <div className="module-modal-backdrop" style={{ zIndex: 1055 }} onClick={onClose} />
      <aside className="rb-drawer" role="dialog" aria-label="Resource workload">
        <div className="rb-drawer__header">
          <div>
            <div className="fw-semibold">
              {resource ? <RecordLink module="resource" id={resource.id}>{resource.name}</RecordLink> : "Resource"}
            </div>
            {resource ? (
              <div className="small text-muted">
                {[resource.code, resourceTypeLabel(resource.resourceType), resource.designation, resource.departmentName].filter(Boolean).join(" · ")}
              </div>
            ) : null}
          </div>
          <div className="d-flex align-items-start gap-2">
            {resource ? <StatusPill status={resource.status} /> : null}
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
        </div>
        <div className="rb-drawer__body">
          {query.isLoading ? <LoadingState label="Loading workload..." /> : null}
          {query.isError ? <ErrorState message={errorMessage(query.error, "Could not load workload")} onRetry={() => void query.refetch()} /> : null}
          {data && resource ? (
            <>
              <dl className="rb-facts">
                <div><dt>Current allocation</dt><dd>{pct(resource.currentAllocationPct)}</dd></div>
                <div><dt>Free from</dt><dd>{resource.available ? "Now" : date(resource.availableFrom)}</dd></div>
                <div><dt>Current work ends</dt><dd>{date(resource.currentAllocationEndsOn)}</dd></div>
                <div><dt>Next start</dt><dd>{date(resource.nextAllocationStartsOn)}</dd></div>
                <div><dt>Capacity (period)</dt><dd>{num(resource.capacityHours)} h</dd></div>
                <div><dt>Utilization</dt><dd>{pct(resource.utilizationPct)}</dd></div>
                <div><dt>Approved hours</dt><dd>{num(resource.actualHours, 1)} h</dd></div>
                <div><dt>Pending approval</dt><dd>{num(resource.pendingHours, 1)} h</dd></div>
                <div><dt>Manager</dt><dd>{resource.managerName ?? "—"}</dd></div>
                <div><dt>Location</dt><dd>{resource.location ?? "—"}</dd></div>
                <div><dt>Experience</dt><dd>{resource.experienceYears !== null ? `${num(resource.experienceYears, 1)} yrs` : "—"}</dd></div>
                {resource.category === "EXTERNAL" ? (
                  <div><dt>Engagement</dt><dd>{date(resource.engagementStartDate)} – {date(resource.engagementEndDate)}</dd></div>
                ) : null}
                {data.financialsVisible ? (
                  <>
                    <div><dt>Cost rate</dt><dd>{money(resource.costRate)} {resource.rateUnit ? `/ ${resource.rateUnit.toLowerCase()}` : ""}</dd></div>
                    <div><dt>Billing rate</dt><dd>{money(resource.billingRate)} {resource.rateUnit ? `/ ${resource.rateUnit.toLowerCase()}` : ""}</dd></div>
                  </>
                ) : null}
              </dl>

              {resource.skills.length > 0 ? (
                <>
                  <h3>Skills</h3>
                  {resource.skills.map((skill) => (
                    <span key={skill.skillId} className={`rb-chip ${skill.primary ? "is-primary" : ""}`}>
                      {skill.name}
                      {skill.proficiency ? ` · ${skill.proficiency.toLowerCase()}` : ""}
                      {skill.yearsOfExperience ? ` · ${skill.yearsOfExperience} yrs` : ""}
                    </span>
                  ))}
                </>
              ) : null}

              {settings && data.weeks.length > 0 ? (
                <>
                  <h3>Upcoming load</h3>
                  <div className="rb-timeline">
                    <table>
                      <thead>
                        <tr>{data.weeks.map((week) => <th key={week}>{shortWeek(week)}</th>)}</tr>
                      </thead>
                      <tbody>
                        <tr>
                          {data.weeks.map((week, index) => {
                            const value = resource.weeklyLoad[index] ?? 0;
                            return (
                              <td key={week}>
                                <div className={`rb-cell ${loadClass(value, settings)}`} title={pct(value)}>{value > 0 ? Math.round(value) : ""}</div>
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              <h3>Allocations</h3>
              {allocations.length === 0 ? (
                <div className="small text-muted">No allocations yet.</div>
              ) : (
                <table className="rb-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Role</th>
                      <th className="text-end">%</th>
                      <th>Dates</th>
                      <th>Status</th>
                      {data.financialsVisible ? <th className="text-end">Cost / bill rate</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((a) => (
                      <tr key={a.allocationId} className={a.phase === "PAST" || a.phase === "CANCELLED" ? "text-muted" : ""}>
                        <td><RecordLink module="project" id={a.projectId}>{a.projectName ?? a.projectCode ?? "Project"}</RecordLink></td>
                        <td>{a.role ?? "—"}</td>
                        <td className="text-end">{pct(a.allocationPct)}</td>
                        <td className="text-nowrap">{date(a.startDate)} – {date(a.endDate)}</td>
                        <td>
                          {a.status}
                          <div className="small text-muted">{a.phase.toLowerCase()}{a.billable ? "" : " · non-billable"}</div>
                        </td>
                        {data.financialsVisible ? (
                          <td className="text-end">{money(a.costRate)} / {money(a.billingRate)}</td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <h3>Open tasks</h3>
              {data.tasks.length === 0 ? (
                <div className="small text-muted">No open tasks assigned.</div>
              ) : (
                <table className="rb-table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Project</th>
                      <th>Status</th>
                      <th>Due</th>
                      <th className="text-end">Est. / actual h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tasks.map((task) => (
                      <tr key={task.id}>
                        <td><RecordLink module="task" id={task.id}>{task.name}</RecordLink></td>
                        <td><RecordLink module="project" id={task.projectId}>{task.projectName ?? "Project"}</RecordLink></td>
                        <td>{task.status ?? "—"}</td>
                        <td className="text-nowrap">{date(task.dueDate)}</td>
                        <td className="text-end">{num(task.estimatedHours, 1)} / {num(task.actualHours, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <h3>Recent timesheets</h3>
              {data.timesheets.length === 0 ? (
                <div className="small text-muted">No timesheets yet.</div>
              ) : (
                <table className="rb-table">
                  <thead>
                    <tr>
                      <th>Week of</th>
                      <th>Status</th>
                      <th className="text-end">Hours</th>
                      <th className="text-end">Billable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.timesheets.map((sheet) => (
                      <tr key={sheet.id}>
                        <td><RecordLink module="timesheet" id={sheet.id}>{date(sheet.weekStartDate)}</RecordLink></td>
                        <td>{sheet.status}</td>
                        <td className="text-end">{num(sheet.hours, 1)}</td>
                        <td className="text-end">{num(sheet.billableHours, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <h3>Approved time by project</h3>
              {data.costs.length === 0 ? (
                <div className="small text-muted">No approved time yet.</div>
              ) : (
                <table className="rb-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th className="text-end">Hours</th>
                      <th className="text-end">Billable</th>
                      {data.financialsVisible ? <th className="text-end">Cost</th> : null}
                      {data.financialsVisible ? <th className="text-end">Revenue</th> : null}
                      {data.financialsVisible ? <th className="text-end">Margin</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {data.costs.map((row) => (
                      <tr key={row.projectId ?? "none"}>
                        <td>
                          {row.projectId ? (
                            <RecordLink module="project" id={row.projectId}>{row.projectName ?? "Project"}</RecordLink>
                          ) : (
                            "Internal / no project"
                          )}
                        </td>
                        <td className="text-end">{num(row.hours, 1)}</td>
                        <td className="text-end">{num(row.billableHours, 1)}</td>
                        {data.financialsVisible ? <td className="text-end">{money(row.cost)}</td> : null}
                        {data.financialsVisible ? <td className="text-end">{money(row.revenue)}</td> : null}
                        {data.financialsVisible ? (
                          <td className="text-end">{money(row.margin)}{row.marginPct !== null && row.marginPct !== undefined ? ` (${pct(row.marginPct)})` : ""}</td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <h3>Leave & unavailability</h3>
              {data.leave.length === 0 ? (
                <div className="small text-muted">None recorded.</div>
              ) : (
                <ul className="small mb-0 ps-3">
                  {data.leave.map((leave) => (
                    <li key={leave.id}>
                      {leave.kind.toLowerCase()} · {date(leave.startDate)} – {date(leave.endDate)}
                      {leave.hoursPerDay ? ` · ${leave.hoursPerDay} h/day` : " · full day"}
                      {leave.reason ? ` · ${leave.reason}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}
