import type { ReactNode } from "react";

interface NavIconProps {
  name?: string;
  className?: string;
  /** Colored tile behind icon — Zoho-style sidebar. */
  colored?: boolean;
}

/** Per-module accent colors for sidebar icons. */
const ICON_COLORS: Record<string, string> = {
  home: "#5b8def",
  leads: "#f97316",
  contacts: "#6366f1",
  accounts: "#0ea5e9",
  deals: "#14b8a6",
  projects: "#8b5cf6",
  resources: "#ec4899",
  invoices: "#22c55e",
  po: "#f59e0b",
  timesheets: "#64748b",
  tasks: "#3b82f6",
  meetings: "#a855f7",
  calls: "#06b6d4",
  activities: "#eab308",
  documents: "#78716c",
  ptasks: "#6366f1",
  milestones: "#f43f5e",
  allocation: "#0d9488",
  skills: "#d946ef",
  approvals: "#10b981",
  contracts: "#475569",
  reports: "#2563eb",
  expenses: "#ef4444",
  users: "#0284c7",
  roles: "#7c3aed",
  regions: "#0891b2",
  departments: "#4f46e5",
  settings: "#64748b",
  studio: "#db2777",
  workflows: "#059669",
  acl: "#334155",
  audit: "#57534e",
  module: "#64748b",
};

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M2.5 6.5 8 2.5l5.5 4" />
      <path d="M4 6v7.5h8V6" />
    </>
  ),
  leads: (
    <>
      <circle cx="8" cy="5.5" r="2.25" />
      <path d="M4 13.5c0-2.2 1.8-4 4-4s4 1.8 4 4" />
    </>
  ),
  contacts: (
    <>
      <path d="M3.5 4.5h9v7H3.5z" />
      <path d="M6 7h4M6 9.5h2.5" />
    </>
  ),
  accounts: (
    <>
      <path d="M3 13.5V5.5l5-2.5 5 2.5v8" />
      <path d="M6.5 13.5V9h3v4.5" />
    </>
  ),
  deals: (
    <>
      <path d="M4 12.5 8 3.5l4 9" />
      <path d="M5.5 9.5h5" />
    </>
  ),
  projects: (
    <>
      <path d="M3.5 5.5 8 3l4.5 2.5v7L8 15l-4.5-2.5z" />
      <path d="M8 5.5V15" />
    </>
  ),
  resources: (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="11" cy="6" r="2" />
      <path d="M3 13.5c.5-2 1.8-3 3-3s2.5 1 3 3M9 13.5c.5-2 1.8-3 3-3s2.5 1 3 3" />
    </>
  ),
  invoices: (
    <>
      <path d="M5 2.5h6v11l-3-1.5-3 1.5z" />
      <path d="M7 6.5h4M7 9h4" />
    </>
  ),
  po: (
    <>
      <path d="M4 3.5h8v9H4z" />
      <path d="M6 6.5h4M6 9h4" />
    </>
  ),
  timesheets: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3.5l2.5 1.5" />
    </>
  ),
  tasks: (
    <>
      <path d="M3.5 4.5h9M3.5 8h9M3.5 11.5h6" />
      <path d="M12.5 11.5 11 13l-.75-.75" />
    </>
  ),
  meetings: (
    <>
      <rect x="3" y="4" width="10" height="8.5" rx="1" />
      <path d="M3 6.5h10M6 2.5v2M10 2.5v2" />
    </>
  ),
  calls: (
    <>
      <path d="M4.5 3.5c3 2 5 4 6.5 6.5M4.5 12.5c3-2 5-4 6.5-6.5" />
      <path d="M3 6.5h2v3H3zM11 6.5h2v3h-2z" />
    </>
  ),
  activities: (
    <>
      <path d="M8 2.5v11M4.5 6.5h7M4.5 9.5h5" />
    </>
  ),
  documents: (
    <>
      <path d="M5.5 2.5h5l2 2v9.5h-9z" />
      <path d="M10.5 2.5V5h2" />
    </>
  ),
  ptasks: (
    <>
      <path d="M4 4.5h8M4 8h8M4 11.5h5" />
      <path d="M11.5 11 13 12.5 11.5 14" />
    </>
  ),
  milestones: (
    <>
      <path d="M3 13.5 8 3l5 10.5z" />
      <path d="M5.5 10h5" />
    </>
  ),
  allocation: (
    <>
      <path d="M3.5 12.5V6l4.5-2.5L12.5 6v6.5" />
      <path d="M8 3.5v9" />
    </>
  ),
  skills: (
    <>
      <path d="M8 2.5l1.5 3 3.5.5-2.5 2.5.5 3.5-3-1.5-3 1.5.5-3.5-2.5-2.5 3.5-.5z" />
    </>
  ),
  approvals: (
    <>
      <path d="M4 8.5 6.5 11 12 5" />
      <rect x="3" y="3" width="10" height="10" rx="1.5" />
    </>
  ),
  contracts: (
    <>
      <path d="M4.5 2.5h7v11l-3.5-1.5L4.5 13.5z" />
      <path d="M7 6h4M7 8.5h3" />
    </>
  ),
  reports: (
    <>
      <path d="M3.5 13V7M8 13V4M12.5 13v-5" />
    </>
  ),
  expenses: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v6M6 8h4" />
    </>
  ),
  users: (
    <>
      <circle cx="8" cy="5.5" r="2" />
      <path d="M4 13c0-2.2 1.8-4 4-4s4 1.8 4 4" />
    </>
  ),
  roles: (
    <>
      <path d="M8 2.5l2 1v3.5c0 2-2 3.5-2 3.5S6 9 6 7V3.5z" />
      <path d="M4 13.5h8" />
    </>
  ),
  regions: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M2.5 8h11M8 2.5a8 8 0 0 1 0 11" />
    </>
  ),
  departments: (
    <>
      <path d="M3 5.5h10v7H3z" />
      <path d="M6 5.5V4M10 5.5V4" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 2.5v1.5M8 12v1.5M2.5 8H4M12 8h1.5M4.6 4.6l1 1M10.4 10.4l1 1M11.4 4.6l-1 1M5.6 10.4l-1 1" />
    </>
  ),
  studio: (
    <>
      <path d="M3.5 12.5 6 4l4 1.5L12.5 12.5z" />
      <path d="M6 4 10 5.5" />
    </>
  ),
  workflows: (
    <>
      <circle cx="4.5" cy="8" r="1.5" />
      <circle cx="11.5" cy="4.5" r="1.5" />
      <circle cx="11.5" cy="11.5" r="1.5" />
      <path d="M6 7.5 10 5M6 8.5l5 2.5" />
    </>
  ),
  acl: (
    <>
      <rect x="3.5" y="6" width="9" height="7" rx="1" />
      <path d="M6 6V4.5a2 2 0 0 1 4 0V6" />
    </>
  ),
  audit: (
    <>
      <path d="M4 3.5h8v9H4z" />
      <path d="M6.5 7h5M6.5 9.5h3.5" />
    </>
  ),
  module: (
    <>
      <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
      <path d="M6 8h4" />
    </>
  ),
};

export function NavIcon({ name = "module", className = "nav-link-icon", colored = false }: NavIconProps) {
  const icon = <Svg className={className}>{ICONS[name] ?? ICONS.module}</Svg>;
  if (!colored) {
    return icon;
  }
  const accent = ICON_COLORS[name] ?? ICON_COLORS.module;
  return (
    <span className="nav-link-icon-tile" style={{ ["--nav-icon-accent" as string]: accent }}>
      {icon}
    </span>
  );
}
