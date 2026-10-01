import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ModuleFilterDateRange, ModuleFilterField, ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { listRegions } from "@/features/admin/adminApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { getProfitabilityReport, getProjectTimesheetReport, getReceivablesReport, getSalesPipelineReport, getSpendReport, getUtilizationReport } from "./reportApi";

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded p-3 bg-white h-100">
      <div className="text-muted small">{label}</div>
      <div className="h4 mb-0">{value}</div>
    </div>
  );
}

function MapList({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data ?? {});
  return (
    <div className="border rounded p-3 bg-white">
      <h3 className="h6">{title}</h3>
      {entries.length ? (
        <ul className="small mb-0">
          {entries.map(([key, count]) => (
            <li key={key}>
              {key}: {count}
            </li>
          ))}
        </ul>
      ) : (
        <p className="small text-muted mb-0">No data</p>
      )}
    </div>
  );
}

export function ReportsPage() {
  const { filterOpen, setFilterOpen, viewMode, setViewMode } = useModuleWorkspace();
  const [activeReport, setActiveReport] = useState<
    "sales" | "projects" | "receivables" | "profitability" | "utilization" | "spend"
  >("sales");
  const [regionId, setRegionId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const params = useMemo(
    () => ({
      regionId: regionId || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    }),
    [regionId, fromDate, toDate],
  );

  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const salesQuery = useQuery({
    queryKey: ["reports", "sales", params],
    queryFn: () => getSalesPipelineReport(params),
    enabled: activeReport === "sales",
  });
  const projectsQuery = useQuery({
    queryKey: ["reports", "projects", params],
    queryFn: () => getProjectTimesheetReport(params),
    enabled: activeReport === "projects",
  });

  const receivablesQuery = useQuery({
    queryKey: ["reports", "receivables", params],
    queryFn: () => getReceivablesReport(params),
    enabled: activeReport === "receivables",
  });
  const profitabilityQuery = useQuery({
    queryKey: ["reports", "profitability", params],
    queryFn: () => getProfitabilityReport(params),
    enabled: activeReport === "profitability",
  });
  const utilizationQuery = useQuery({
    queryKey: ["reports", "utilization", params],
    queryFn: () => getUtilizationReport(params),
    enabled: activeReport === "utilization",
  });
  const spendQuery = useQuery({
    queryKey: ["reports", "spend", params],
    queryFn: () => getSpendReport(params),
    enabled: activeReport === "spend",
  });

  const activeFilterCount = [regionId, fromDate, toDate].filter(Boolean).length;
  const loading =
    activeReport === "sales"
      ? salesQuery.isLoading
      : activeReport === "projects"
        ? projectsQuery.isLoading
        : activeReport === "receivables"
          ? receivablesQuery.isLoading
          : activeReport === "profitability"
            ? profitabilityQuery.isLoading
            : activeReport === "utilization"
              ? utilizationQuery.isLoading
              : spendQuery.isLoading;
  const error =
    activeReport === "sales"
      ? salesQuery.error
      : activeReport === "projects"
        ? projectsQuery.error
        : activeReport === "receivables"
          ? receivablesQuery.error
          : activeReport === "profitability"
            ? profitabilityQuery.error
            : activeReport === "utilization"
              ? utilizationQuery.error
              : spendQuery.error;

  return (
    <ModuleListShell
      title="Reports"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={
        <select
          className="form-select form-select-sm module-view-select"
          value={activeReport}
          onChange={(e) =>
            setActiveReport(e.target.value as "sales" | "projects" | "receivables" | "profitability" | "utilization" | "spend")
          }
        >
          <option value="sales">Sales & pipeline</option>
          <option value="projects">Projects & timesheets</option>
          <option value="receivables">AR aging</option>
          <option value="profitability">Project profitability</option>
          <option value="utilization">Resource utilization</option>
          <option value="spend">Procurement & expense spend</option>
        </select>
      }
      filterToggle={{ onToggle: () => setFilterOpen((open) => !open) }}
      filterPanel={
        <>
          <p className="module-filter-heading">Report filters</p>
          <div className="module-filter-section">
            <h3>Filter by fields</h3>
            <ModuleFilterField label="Region" htmlFor="reportRegionFilter">
              <select
                id="reportRegionFilter"
                className="form-select form-select-sm"
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
              >
                <option value="">All</option>
                {(regionsQuery.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </ModuleFilterField>
            <ModuleFilterDateRange
              label="Date"
              from={fromDate}
              to={toDate}
              onFromChange={setFromDate}
              onToChange={setToDate}
            />
          </div>
        </>
      }
      activeFilterCount={activeFilterCount}
      onClearFilters={() => {
        setRegionId("");
        setFromDate("");
        setToDate("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
    >
      {loading ? <LoadingState label="Loading report..." /> : null}
      {error ? <ErrorState title="Unable to load report" message="Try again." /> : null}

      {!loading && !error && activeReport === "sales" && salesQuery.data ? (
        <div className="p-3">
          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <MetricCard label="Won deals" value={salesQuery.data.wonDeals} />
            </div>
            <div className="col-md-3">
              <MetricCard label="Lost deals" value={salesQuery.data.lostDeals} />
            </div>
            <div className="col-md-3">
              <MetricCard label="Pipeline value" value={salesQuery.data.pipelineValue} />
            </div>
            <div className="col-md-3">
              <MetricCard label="Won value" value={salesQuery.data.wonValue} />
            </div>
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <MapList title="Leads by status" data={salesQuery.data.leadsByStatus} />
            </div>
            <div className="col-md-6">
              <MapList title="Deals by stage" data={salesQuery.data.dealsByStage} />
            </div>
          </div>
        </div>
      ) : null}

      {!loading && !error && activeReport === "projects" && projectsQuery.data ? (
        <div className="p-3">
          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <MetricCard label="Delayed projects" value={projectsQuery.data.delayedProjects} />
            </div>
            <div className="col-md-3">
              <MetricCard label="Billable hours" value={projectsQuery.data.billableHours} />
            </div>
            <div className="col-md-3">
              <MetricCard label="Non-billable hours" value={projectsQuery.data.nonBillableHours} />
            </div>
            <div className="col-md-3">
              <MetricCard
                label="Timesheets approved / pending"
                value={`${projectsQuery.data.approvedTimesheets} / ${projectsQuery.data.pendingTimesheets}`}
              />
            </div>
          </div>
          <MapList title="Projects by status" data={projectsQuery.data.projectsByStatus} />
        </div>
      ) : null}

      {!loading && !error && activeReport === "receivables" && receivablesQuery.data ? (
        <div className="p-3">
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <MetricCard label="Total outstanding" value={receivablesQuery.data.totalOutstanding} />
            </div>
            <div className="col-md-4">
              <MetricCard label="Open invoices" value={receivablesQuery.data.openInvoiceCount} />
            </div>
          </div>
          <MapList title="Aging buckets" data={receivablesQuery.data.agingBuckets} />
        </div>
      ) : null}

      {!loading && !error && activeReport === "profitability" && profitabilityQuery.data ? (
        <div className="p-3">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Project</th>
                <th>Revenue</th>
                <th>Cost</th>
                <th>Expenses</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {profitabilityQuery.data.rows.map((row) => (
                <tr key={row.projectId}>
                  <td>{row.projectName}</td>
                  <td>{row.revenue}</td>
                  <td>{row.cost}</td>
                  <td>{row.expenses}</td>
                  <td>{row.margin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && !error && activeReport === "utilization" && utilizationQuery.data ? (
        <div className="p-3">
          <p className="small text-muted">
            Period {utilizationQuery.data.periodStart} – {utilizationQuery.data.periodEnd}
          </p>
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Designation</th>
                <th>Utilization %</th>
                <th>Over-allocated</th>
              </tr>
            </thead>
            <tbody>
              {utilizationQuery.data.rows.map((row) => (
                <tr key={row.resourceId}>
                  <td>{row.employeeCode}</td>
                  <td>{row.designation ?? "—"}</td>
                  <td>{row.utilizationPercent}</td>
                  <td>{row.overAllocated ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && !error && activeReport === "spend" && spendQuery.data ? (
        <div className="p-3">
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <MetricCard label="Purchase order total" value={spendQuery.data.purchaseOrderTotal} />
            </div>
            <div className="col-md-4">
              <MetricCard label="Approved expenses" value={spendQuery.data.expenseTotal} />
            </div>
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <MapList title="Expenses by category" data={spendQuery.data.expensesByCategory} />
            </div>
            <div className="col-md-6">
              <MapList title="PO totals by status" data={spendQuery.data.purchaseOrdersByStatus} />
            </div>
          </div>
        </div>
      ) : null}
    </ModuleListShell>
  );
}
