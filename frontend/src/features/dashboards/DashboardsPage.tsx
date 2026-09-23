import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listRegions } from "@/features/admin/adminApi";
import { CrmPage } from "@/features/crm/CrmPage";
import { getDashboard, type DashboardKind, type DashboardResponse } from "./dashboardApi";

interface TabDef {
  kind: DashboardKind;
  label: string;
  permission: string;
  needsRegion?: boolean;
}

const TABS: TabDef[] = [
  { kind: "organization", label: "Organization", permission: "DASHBOARD_ORG" },
  { kind: "region", label: "Region", permission: "DASHBOARD_REGION", needsRegion: true },
  { kind: "sales", label: "Sales", permission: "DASHBOARD_SALES" },
  { kind: "project", label: "Projects", permission: "DASHBOARD_PROJECT" },
  { kind: "employee", label: "My work", permission: "DASHBOARD_EMPLOYEE" },
];

function formatCardValue(name: string, value: number): string {
  if (
    name.toLowerCase().includes("revenue")
    || name.toLowerCase().includes("budget")
    || name.toLowerCase().includes("forecast")
  ) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function SeriesChart({ title, data }: { title: string; data: { name: string; count: number }[] }) {
  if (!data.length) {
    return (
      <div className="border rounded p-3 h-100">
        <h3 className="h6">{title}</h3>
        <p className="text-muted small mb-0">No series data yet.</p>
      </div>
    );
  }
  return (
    <div className="border rounded p-3 h-100">
      <h3 className="h6 mb-3">{title}</h3>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#1f7a6b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DashboardBody({ data }: { data: DashboardResponse }) {
  return (
    <>
      <div className="row g-3 mb-3">
        {data.cards.map((card) => (
          <div key={card.name} className="col-6 col-md-4 col-xl-3">
            <div className="border rounded p-3 h-100 bg-light">
              <div className="text-muted small">{card.name}</div>
              <div className="fs-4 fw-semibold">{formatCardValue(card.name, Number(card.value))}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="row g-3">
        <div className="col-lg-6">
          <SeriesChart title="Primary breakdown" data={data.seriesPrimary ?? []} />
        </div>
        <div className="col-lg-6">
          <SeriesChart title="Secondary breakdown" data={data.seriesSecondary ?? []} />
        </div>
      </div>
    </>
  );
}

export function DashboardsPage() {
  const canOrg = useHasPermission("DASHBOARD_ORG");
  const canRegion = useHasPermission("DASHBOARD_REGION");
  const canSales = useHasPermission("DASHBOARD_SALES");
  const canProject = useHasPermission("DASHBOARD_PROJECT");
  const canEmployee = useHasPermission("DASHBOARD_EMPLOYEE");

  const tabs = useMemo(
    () =>
      TABS.filter((tab) => {
        switch (tab.permission) {
          case "DASHBOARD_ORG":
            return canOrg;
          case "DASHBOARD_REGION":
            return canRegion;
          case "DASHBOARD_SALES":
            return canSales;
          case "DASHBOARD_PROJECT":
            return canProject;
          case "DASHBOARD_EMPLOYEE":
            return canEmployee;
          default:
            return false;
        }
      }),
    [canOrg, canRegion, canSales, canProject, canEmployee],
  );

  const [activeKind, setActiveKind] = useState<DashboardKind | null>(null);
  const [regionId, setRegionId] = useState("");

  const selectedKind = activeKind && tabs.some((t) => t.kind === activeKind) ? activeKind : tabs[0]?.kind;
  const selectedTab = tabs.find((t) => t.kind === selectedKind);

  const regionsQuery = useQuery({
    queryKey: ["admin", "regions"],
    queryFn: listRegions,
    enabled: !!selectedTab?.needsRegion,
  });

  const effectiveRegionId = regionId || regionsQuery.data?.[0]?.id || "";

  const dashboardQuery = useQuery({
    queryKey: ["dashboards", selectedKind, effectiveRegionId],
    queryFn: () =>
      getDashboard(selectedKind!, {
        regionId: selectedTab?.needsRegion ? effectiveRegionId : undefined,
      }),
    enabled: !!selectedKind && (!selectedTab?.needsRegion || !!effectiveRegionId),
  });

  if (tabs.length === 0) {
    return (
      <CrmPage title="Dashboards" description="You do not have dashboard permissions.">
        <p className="text-muted mb-0">Ask an administrator to grant a DASHBOARD_* permission.</p>
      </CrmPage>
    );
  }

  return (
    <CrmPage
      title={`${selectedTab?.label ?? "Dashboard"} overview`}
      description="Live aggregations from PostgreSQL, scoped to your access."
      loading={dashboardQuery.isLoading || (selectedTab?.needsRegion && regionsQuery.isLoading)}
      error={dashboardQuery.error}
      empty={false}
      actions={
        <div className="d-flex flex-wrap gap-2 align-items-center">
          {selectedTab?.needsRegion ? (
            <select
              className="form-select form-select-sm"
              style={{ width: "auto" }}
              value={effectiveRegionId}
              onChange={(e) => setRegionId(e.target.value)}
            >
              {(regionsQuery.data ?? []).map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          ) : null}
          <div className="btn-group btn-group-sm" role="group" aria-label="Dashboard type">
            {tabs.map((tab) => (
              <button
                key={tab.kind}
                type="button"
                className={`btn ${selectedKind === tab.kind ? "btn-primary" : "btn-outline-primary"}`}
                onClick={() => setActiveKind(tab.kind)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {dashboardQuery.data ? <DashboardBody data={dashboardQuery.data} /> : null}
    </CrmPage>
  );
}
