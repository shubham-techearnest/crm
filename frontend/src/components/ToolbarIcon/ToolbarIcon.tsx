import type { ReactNode } from "react";

export type ToolbarIconName =
  | "filter"
  | "sort"
  | "list"
  | "grid"
  | "more"
  | "plus"
  | "search"
  | "bell"
  | "settings"
  | "calendar"
  | "menu"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "sidebar"
  | "help"
  | "apps"
  | "upload"
  | "export"
  | "columns"
  | "users"
  | "building";

interface ToolbarIconProps {
  name: ToolbarIconName;
  className?: string;
}

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

const ICONS: Record<ToolbarIconName, ReactNode> = {
  filter: (
    <>
      <path d="M2.5 3.5h11" />
      <path d="M4.5 7.5h7" />
      <path d="M6.5 11.5h3" />
    </>
  ),
  sort: (
    <>
      <path d="M5 3.5v9M5 12.5 3 10.5M5 12.5 7 10.5" />
      <path d="M11 12.5v-9M11 3.5 9 5.5M11 3.5 13 5.5" />
    </>
  ),
  list: (
    <>
      <path d="M3 4.5h10M3 8h10M3 11.5h10" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="4.5" height="4.5" rx="0.75" />
      <rect x="8.5" y="3" width="4.5" height="4.5" rx="0.75" />
      <rect x="3" y="8.5" width="4.5" height="4.5" rx="0.75" />
      <rect x="8.5" y="8.5" width="4.5" height="4.5" rx="0.75" />
    </>
  ),
  more: (
    <>
      <circle cx="4" cy="8" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8" r="0.85" fill="currentColor" stroke="none" />
    </>
  ),
  plus: (
    <>
      <path d="M8 3.5v9M3.5 8h9" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="3.75" />
      <path d="M10 10l3 3" />
    </>
  ),
  bell: (
    <>
      <path d="M4 6.5a4 4 0 0 1 8 0c0 4.5 1.5 5.5 2 6.5H2c.5-1 2-2 2-6.5z" />
      <path d="M6.5 13a1.5 1.5 0 0 0 3 0" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 2.5v1.5M8 12v1.5M2.5 8H4M12 8h1.5M4.6 4.6l1 1M10.4 10.4l1 1M11.4 4.6l-1 1M5.6 10.4l-1 1" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="10" height="8.5" rx="1" />
      <path d="M3 6.5h10M6 2.5v2M10 2.5v2" />
    </>
  ),
  menu: (
    <>
      <path d="M3 4.5h10M3 8h10M3 11.5h10" />
    </>
  ),
  "chevron-down": (
    <>
      <path d="M4 6l4 4 4-4" />
    </>
  ),
  "chevron-left": (
    <>
      <path d="M10 4L6 8l4 4" />
    </>
  ),
  "chevron-right": (
    <>
      <path d="M6 4l4 4-4 4" />
    </>
  ),
  sidebar: (
    <>
      <rect x="2.5" y="3" width="11" height="10" rx="1" />
      <path d="M6.5 3v10" />
    </>
  ),
  help: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M6.2 6.2a2 2 0 0 1 3.3.8c0 1.2-1.5 1.5-1.5 2.7M8 12.2v.3" />
    </>
  ),
  apps: (
    <>
      <circle cx="5" cy="5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="11" cy="5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="11" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="11" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="11" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="11" cy="11" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  upload: (
    <>
      <path d="M8 3.5v7M5.5 6 8 3.5 10.5 6" />
      <path d="M4 12.5h8" />
    </>
  ),
  export: (
    <>
      <path d="M8 10.5V3.5M5.5 6 8 3.5 10.5 6" />
      <path d="M4 12.5h8" />
    </>
  ),
  columns: (
    <>
      <path d="M3.5 3.5h3v9h-3zM6.5 3.5h6v9h-6z" />
      <path d="M8 6h2M8 8.5h2" />
    </>
  ),
  users: (
    <>
      <circle cx="5.5" cy="6" r="1.75" />
      <circle cx="10.5" cy="6" r="1.75" />
      <path d="M2.5 13c.75-2 1.75-3 3-3s2.25 1 3 3M8.5 13c.75-2 1.75-3 3-3s2.25 1 3 3" />
    </>
  ),
  building: (
    <>
      <path d="M3.5 13V5.5l4.5-2 4.5 2V13" />
      <path d="M6.5 13V9.5h3V13" />
      <path d="M3.5 7.5 8 9.5 12.5 7.5" />
    </>
  ),
};

export function ToolbarIcon({ name, className = "toolbar-icon" }: ToolbarIconProps) {
  return <Svg className={className}>{ICONS[name]}</Svg>;
}
