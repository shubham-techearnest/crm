import type { ReactNode } from "react";

interface NavIconProps {
  name?: string;
  className?: string;
  /** Wraps the icon in a `.nav-link-icon-tile` holder (sidebar links, list toolbar heading). */
  colored?: boolean;
}

/** Per-module accent colours; the tile exposes them as `--nav-icon-accent`. */
const ICON_COLORS: Record<string, string> = {
  home: "#3f5ff5",
  leads: "#f97316",
  contacts: "#6366f1",
  accounts: "#0ea5e9",
  deals: "#14b8a6",
  projects: "#8b5cf6",
  resources: "#ec4899",
  invoices: "#16a34a",
  po: "#d97706",
  timesheets: "#0891b2",
  tasks: "#3b82f6",
  meetings: "#a855f7",
  calls: "#06b6d4",
  activities: "#ca8a04",
  documents: "#78716c",
  ptasks: "#6366f1",
  milestones: "#f43f5e",
  board: "#0f766e",
  allocation: "#0d9488",
  skills: "#d946ef",
  approvals: "#10b981",
  contracts: "#475569",
  reports: "#2563eb",
  tax: "#16a34a",
  vendors: "#0369a1",
  expenses: "#ef4444",
  users: "#0284c7",
  teams: "#0e7490",
  roles: "#7c3aed",
  regions: "#0891b2",
  departments: "#4f46e5",
  settings: "#64748b",
  studio: "#db2777",
  workflows: "#059669",
  acl: "#334155",
  fieldAcl: "#475569",
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
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M2.5 7 8 2.5 13.5 7" />
      <path d="M4 6v7.5h8V6" />
      <path d="M6.75 13.5V10.5h2.5v3" />
    </>
  ),
  leads: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="2.75" />
      <circle cx="8" cy="8" r="0.5" fill="currentColor" />
    </>
  ),
  contacts: (
    <>
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" />
      <circle cx="6" cy="7" r="1.4" />
      <path d="M4 10.75c.4-1.1 1.15-1.6 2-1.6s1.6.5 2 1.6" />
      <path d="M9.75 6.5h2M9.75 9h2" />
    </>
  ),
  accounts: (
    <>
      <rect x="3.5" y="2.5" width="9" height="11" rx="1" />
      <path d="M6 5.25h1M9 5.25h1M6 7.75h1M9 7.75h1" />
      <path d="M7 13.5V11h2v2.5" />
    </>
  ),
  deals: (
    <>
      <path d="M2.5 8.2V3.5a1 1 0 0 1 1-1h4.7l5.3 5.3a1 1 0 0 1 0 1.4l-4.3 4.3a1 1 0 0 1-1.4 0z" />
      <circle cx="5.5" cy="5.5" r="1" />
    </>
  ),
  projects: (
    <>
      <path d="M2.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" />
      <path d="M2.5 7h11" />
    </>
  ),
  resources: (
    <>
      <circle cx="6" cy="5.5" r="2" />
      <path d="M2.5 13c0-2 1.6-3.5 3.5-3.5S9.5 11 9.5 13" />
      <circle cx="11.25" cy="6" r="1.6" />
      <path d="M10.75 9.6c1.5-.2 2.75.95 2.75 2.9" />
    </>
  ),
  invoices: (
    <>
      <path d="M4 13.5v-11h8v11l-2-1.25-2 1.25-2-1.25z" />
      <path d="M6 5.5h4M6 8h4M6 10.25h2" />
    </>
  ),
  po: (
    <>
      <path d="M2 2.5h1.75l1.5 7.5h6.75l1.5-5.5H4.4" />
      <circle cx="6" cy="12.75" r="1" />
      <circle cx="11" cy="12.75" r="1" />
    </>
  ),
  timesheets: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3l2 1.25" />
    </>
  ),
  tasks: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
      <path d="m5.25 8.25 1.75 1.75 3.75-4" />
    </>
  ),
  meetings: (
    <>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.75h11M5.5 2v2.5M10.5 2v2.5" />
      <path d="M5.5 9.5h1M9.5 9.5h1M5.5 11.5h1" />
    </>
  ),
  calls: (
    <path d="M5.6 2.5H3.9a1 1 0 0 0-1 1.1 10.5 10.5 0 0 0 9.5 9.5 1 1 0 0 0 1.1-1v-1.7a1 1 0 0 0-.8-1l-1.8-.4a1 1 0 0 0-.95.3l-.75.75a8 8 0 0 1-3.2-3.2l.75-.75a1 1 0 0 0 .3-.95l-.4-1.8a1 1 0 0 0-1-.8z" />
  ),
  activities: <path d="M1.5 8h3l1.75-4 3.5 8 1.75-4h3" />,
  documents: (
    <>
      <path d="M4 2.5h5.5L12 5v8.5H4z" />
      <path d="M9.5 2.5V5H12" />
      <path d="M6 8h4M6 10.5h3" />
    </>
  ),
  ptasks: (
    <>
      <path d="m2.5 4.5 1 1 2-2M2.5 10.5l1 1 2-2" />
      <path d="M7.5 4.5h6M7.5 10.5h6" />
    </>
  ),
  milestones: (
    <>
      <path d="M3.5 14V2.5" />
      <path d="M3.5 3h8l-1.75 2.75L11.5 8.5h-8" />
    </>
  ),
  board: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M5.5 5.25v4.5M8 5.25v6M10.5 5.25v2.5" />
    </>
  ),
  allocation: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 2.5V8h5.5" />
    </>
  ),
  skills: (
    <path d="m8 2.25 1.7 3.45 3.8.55-2.75 2.7.65 3.8L8 10.95l-3.4 1.8.65-3.8L2.5 6.25l3.8-.55z" />
  ),
  approvals: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="m5.5 8.25 1.75 1.75 3.25-3.75" />
    </>
  ),
  contracts: (
    <>
      <path d="M4 2.5h5.5L12 5v8.5H4z" />
      <path d="M9.5 2.5V5H12" />
      <path d="M6 10.75c.7-1 1.3-1 1.75 0s1 .9 1.75-.25" />
    </>
  ),
  reports: (
    <>
      <path d="M2.5 2.5v11h11" />
      <path d="M5.5 11V8M8.5 11V5.5M11.5 11V7" />
    </>
  ),
  tax: (
    <>
      <path d="M4 12 12 4" />
      <circle cx="5" cy="5" r="1.25" />
      <circle cx="11" cy="11" r="1.25" />
    </>
  ),
  vendors: (
    <>
      <path d="M2.5 6.5 3.5 3h9l1 3.5" />
      <path d="M2.5 6.5a1.8 1.8 0 0 0 3.67 0 1.8 1.8 0 0 0 3.67 0 1.8 1.8 0 0 0 3.66 0" />
      <path d="M3.5 8.5v5h9v-5" />
      <path d="M6.5 13.5v-3h3v3" />
    </>
  ),
  expenses: (
    <>
      <rect x="2.5" y="4" width="11" height="9" rx="1.5" />
      <path d="M13.5 7.25h-2.75a1.25 1.25 0 0 0 0 2.5h2.75" />
      <path d="M4.5 4 10.5 2.5V4" />
    </>
  ),
  users: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="6.75" r="1.75" />
      <path d="M4.6 12.2c.7-1.3 1.9-2 3.4-2s2.7.7 3.4 2" />
    </>
  ),
  teams: (
    <>
      <circle cx="8" cy="5" r="1.75" />
      <circle cx="3.75" cy="7" r="1.25" />
      <circle cx="12.25" cy="7" r="1.25" />
      <path d="M5 13c0-1.9 1.3-3.25 3-3.25s3 1.35 3 3.25" />
      <path d="M1.75 12c0-1.3.8-2.25 2-2.25.5 0 .9.1 1.25.35M14.25 12c0-1.3-.8-2.25-2-2.25-.5 0-.9.1-1.25.35" />
    </>
  ),
  roles: (
    <>
      <path d="M8 2 13 4v3.75c0 3-2.2 5.2-5 6.25-2.8-1.05-5-3.25-5-6.25V4z" />
      <path d="m6 8 1.5 1.5 2.75-2.75" />
    </>
  ),
  regions: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M2.5 8h11" />
      <path d="M8 2.5c1.6 1.6 2.25 3.5 2.25 5.5S9.6 11.9 8 13.5C6.4 11.9 5.75 10 5.75 8S6.4 4.1 8 2.5z" />
    </>
  ),
  departments: (
    <>
      <rect x="6" y="2" width="4" height="3" rx="0.75" />
      <rect x="2" y="11" width="4" height="3" rx="0.75" />
      <rect x="10" y="11" width="4" height="3" rx="0.75" />
      <path d="M8 5v3M4 11V8h8v3" />
    </>
  ),
  settings: (
    <>
      <path d="M2.5 4.5h6M12 4.5h1.5M2.5 8h1.5M7.5 8h6M2.5 11.5h5M11 11.5h2.5" />
      <circle cx="10.25" cy="4.5" r="1.5" />
      <circle cx="5.75" cy="8" r="1.5" />
      <circle cx="9.25" cy="11.5" r="1.5" />
    </>
  ),
  studio: (
    <>
      <ellipse cx="8" cy="4" rx="4.5" ry="1.75" />
      <path d="M3.5 4v8c0 1 2 1.75 4.5 1.75s4.5-.75 4.5-1.75V4" />
      <path d="M3.5 8c0 1 2 1.75 4.5 1.75S12.5 9 12.5 8" />
    </>
  ),
  workflows: (
    <>
      <rect x="2" y="2.5" width="4.5" height="3.5" rx="0.75" />
      <rect x="9.5" y="10" width="4.5" height="3.5" rx="0.75" />
      <path d="M4.25 6v1.75A1.5 1.5 0 0 0 5.75 9.25h4.5a1.5 1.5 0 0 1 1.5 1.5" />
    </>
  ),
  acl: (
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.25" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
      <path d="M8 9.75v1" />
    </>
  ),
  fieldAcl: (
    <>
      <circle cx="5.25" cy="10.75" r="2.5" />
      <path d="M7 9 13 3M11 5l1.5 1.5M9.5 6.5 10.75 7.75" />
    </>
  ),
  audit: (
    <>
      <path d="M2.75 8a5.25 5.25 0 1 0 1.55-3.7" />
      <path d="M2.5 2.75V5.5h2.75" />
      <path d="M8 5.25V8l2 1.25" />
    </>
  ),
  module: (
    <>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
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
