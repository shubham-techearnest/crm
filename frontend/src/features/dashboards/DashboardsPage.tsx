import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listRegions } from "@/features/admin/adminApi";
import { CrmPage } from "@/features/crm/CrmPage";
import { QUICK_CREATE_ITEMS } from "@/constants/nav";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";
import { TechEarnestPicker, optionsFromPairs } from "@/components/TechEarnestCreate";
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
    return value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 });
}

function SeriesChart({ title, data }: { title: string; data: { name: string; count: number }[] }) {
  if (!data.length) {
    return (
      <div className="crm-dashboard-panel h-100">
        <h3 className="crm-dashboard-panel-title">{title}</h3>
        <div className="crm-dashboard-empty">No records are available for this chart yet.</div>
      </div>
    );
  }
  return (
    <div className="crm-dashboard-panel h-100">
      <h3 className="crm-dashboard-panel-title">{title}</h3>
      <div className="crm-dashboard-chart">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
            <CartesianGrid stroke="#E8EBF2" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} />
            <Tooltip cursor={{ fill: "#EEF1FF" }} />
            <Bar dataKey="count" fill="#3F5FF5" radius={[5, 5, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DashboardBody({ data, kind }: { data: DashboardResponse; kind: DashboardKind }) {
  const chartTitles = kind === "sales"
    ? ["Leads by status", "Deals by stage"]
    : kind === "project"
      ? ["Projects by status", "Estimated and actual hours"]
      : kind === "employee"
        ? ["Timesheets by status", "Tasks by status"]
        : ["Deals by stage", "Projects by status"];
  return (
    <>
      <div className="crm-dashboard-metrics">
        {data.cards.map((card) => (
          <div key={card.name} className="crm-dashboard-metric">
            <div className="crm-dashboard-metric-copy">
              <div className="crm-dashboard-metric-label">{card.name}</div>
              <div className="crm-dashboard-metric-value">{formatCardValue(card.name, Number(card.value))}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="crm-dashboard-charts">
        <div>
          <SeriesChart title={chartTitles[0]} data={data.seriesPrimary ?? []} />
        </div>
        <div>
          <SeriesChart title={chartTitles[1]} data={data.seriesSecondary ?? []} />
        </div>
      </div>
    </>
  );
}

export function DashboardsPage() {
  const user = useAuth();
  const quickActions = QUICK_CREATE_ITEMS.filter((item) =>
    item.permissions.some((permission) => user.permissions.includes(permission)),
  );
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
  const regionOptions = useMemo(
    () => optionsFromPairs((regionsQuery.data ?? []).map((region) => ({ value: region.id, label: region.name }))),
    [regionsQuery.data],
  );

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
      description="A live view of the work and results available to your account."
      loading={dashboardQuery.isLoading || (selectedTab?.needsRegion && regionsQuery.isLoading)}
      error={dashboardQuery.error}
      empty={false}
      actions={
        <div className="d-flex flex-wrap gap-2 align-items-center">
          {selectedTab?.needsRegion ? (
            <div className="crm-dashboard-region-picker">
              <TechEarnestPicker
                value={effectiveRegionId}
                onChange={setRegionId}
                options={regionOptions}
                placeholder={regionsQuery.isLoading ? "Loading regions…" : "Select region"}
                searchPlaceholder="Search regions"
                lookupIcon="building"
                allowEmpty={false}
                disabled={regionsQuery.isLoading || regionOptions.length === 0}
              />
            </div>
          ) : null}
          <div className="module-view-tabs crm-dashboard-tabs" role="tablist" aria-label="Dashboard type">
            {tabs.map((tab) => (
              <button
                key={tab.kind}
                type="button"
                role="tab"
                aria-selected={selectedKind === tab.kind}
                className={`module-view-tab${selectedKind === tab.kind ? " is-active" : ""}`}
                onClick={() => setActiveKind(tab.kind)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="crm-dashboard-home">
        <section className="crm-dashboard-welcome">
          <div>
            <div className="crm-dashboard-eyebrow">TECH EARNEST CRM</div>
            <h2>Welcome back, {user.displayName.split(" ")[0]}</h2>
            <p>Your latest business activity and key numbers are gathered here.</p>
          </div>
          <div className="crm-dashboard-date">
            {new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date())}
          </div>
        </section>
        {quickActions.length > 0 ? (
          <section className="crm-dashboard-quick-actions" aria-labelledby="crm-dashboard-quick-actions-title">
            <div className="crm-dashboard-quick-actions-heading">
              <div>
                <h3 id="crm-dashboard-quick-actions-title">Quick actions</h3>
                <p>Start a common task in your workspace.</p>
              </div>
            </div>
            <div className="crm-dashboard-quick-actions-list">
              {quickActions.map((action) => (
                <Link key={action.label} className="crm-dashboard-quick-action" to={action.to}>
                  <span className="crm-dashboard-quick-action-icon"><ToolbarIcon name="plus" /></span>
                  <span>Create {action.label}</span>
                  <span className="crm-dashboard-quick-action-arrow" aria-hidden="true">›</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
        {dashboardQuery.data && selectedKind ? <DashboardBody data={dashboardQuery.data} kind={selectedKind} /> : null}
        {!dashboardQuery.isLoading && !dashboardQuery.error && dashboardQuery.data?.cards.length === 0 ? (
          <div className="crm-dashboard-empty crm-dashboard-empty--large">
            <strong>Nothing to summarize yet</strong>
            <span>Once your workspace has records, live metrics and charts will appear here.</span>
          </div>
        ) : null}
      </div>
    </CrmPage>
  );
}
