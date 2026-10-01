import { useMemo, useState } from "react";
import { NavIcon } from "@/components/NavIcon/NavIcon";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";
import type { OrganizationModule } from "./platformOrgApi";

const MODULE_ICONS: Record<string, string> = {
  LEADS: "leads",
  CONTACTS: "contacts",
  ACCOUNTS: "accounts",
  DEALS: "deals",
  ACTIVITIES: "tasks",
  DOCUMENTS: "documents",
  CONTRACTS: "contracts",
  APPROVALS: "approvals",
  REPORTS: "reports",
  PROJECTS: "projects",
  PROJECT_TASKS: "ptasks",
  MILESTONES: "milestones",
  RESOURCES: "resources",
  RESOURCE_BOARD: "board",
  ALLOCATIONS: "allocation",
  SKILLS: "skills",
  TIMESHEETS: "timesheets",
  INVOICES: "invoices",
  PURCHASE_ORDERS: "po",
  VENDORS: "vendors",
  EXPENSES: "expenses",
  TAX_RATES: "tax",
  USERS: "users",
  ROLES: "roles",
  REGIONS: "regions",
  DEPARTMENTS: "departments",
  TEAMS: "teams",
  SETTINGS: "settings",
  WORKFLOWS: "workflows",
  AUDIT_LOGS: "audit",
  METADATA_STUDIO: "studio",
  TABLE_ACL: "acl",
  FIELD_ACL: "fieldAcl",
};

const GROUP_HINTS: Record<string, string> = {
  Customization:
    "When off, the organization cannot change these itself. You can still manage them from this console.",
};

export function moduleIcon(code: string): string {
  return MODULE_ICONS[code] ?? "module";
}

/** Grouped on/off cards for the sidebar modules an organization may use. */
export function OrganizationModulePicker({
  modules,
  value,
  onChange,
  disabled = false,
}: {
  modules: OrganizationModule[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(value), [value]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const byGroup = new Map<string, OrganizationModule[]>();
    for (const module of modules) {
      if (needle && !`${module.label} ${module.description}`.toLowerCase().includes(needle)) continue;
      const list = byGroup.get(module.group) ?? [];
      list.push(module);
      byGroup.set(module.group, list);
    }
    return [...byGroup.entries()];
  }, [modules, query]);

  function toggle(code: string) {
    onChange(selected.has(code) ? value.filter((item) => item !== code) : [...value, code]);
  }

  function setGroup(groupModules: OrganizationModule[], enabled: boolean) {
    const codes = new Set(groupModules.map((module) => module.code));
    const rest = value.filter((code) => !codes.has(code));
    onChange(enabled ? [...rest, ...codes] : rest);
  }

  return (
    <div className="platform-modules">
      <div className="platform-modules-toolbar">
        <div className="module-filter-find platform-modules-search">
          <ToolbarIcon name="search" className="module-filter-find-icon" />
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Find a module"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Find a module"
          />
        </div>
        <span className="platform-modules-count">
          {value.length} of {modules.length} enabled
        </span>
        <div className="d-flex gap-1">
          <button
            type="button"
            className="btn btn-sm btn-light border"
            disabled={disabled}
            onClick={() => onChange(modules.map((module) => module.code))}
          >
            Enable all
          </button>
          <button
            type="button"
            className="btn btn-sm btn-light border"
            disabled={disabled}
            onClick={() => onChange([])}
          >
            Disable all
          </button>
        </div>
      </div>

      {groups.length === 0 ? <p className="text-muted small mb-0">No modules match “{query}”.</p> : null}

      {groups.map(([group, groupModules]) => {
        const enabledCount = groupModules.filter((module) => selected.has(module.code)).length;
        const allOn = enabledCount === groupModules.length;
        return (
          <section key={group} className="platform-modules-group">
            <header className="platform-modules-group-head">
              <div>
                <h3>{group}</h3>
                {GROUP_HINTS[group] ? <p>{GROUP_HINTS[group]}</p> : null}
              </div>
              <div className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id={`module-group-${group}`}
                  checked={allOn}
                  disabled={disabled}
                  onChange={() => setGroup(groupModules, !allOn)}
                />
                <label className="form-check-label small" htmlFor={`module-group-${group}`}>
                  {enabledCount}/{groupModules.length}
                </label>
              </div>
            </header>
            <div className="platform-modules-grid">
              {groupModules.map((module) => {
                const on = selected.has(module.code);
                return (
                  <label
                    key={module.code}
                    className={`platform-module-card${on ? " is-on" : ""}${disabled ? " is-disabled" : ""}`}
                  >
                    <NavIcon name={moduleIcon(module.code)} colored />
                    <span className="platform-module-text">
                      <span className="platform-module-label">{module.label}</span>
                      <span className="platform-module-desc">{module.description}</span>
                    </span>
                    <span className="form-check form-switch mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={on}
                        disabled={disabled}
                        onChange={() => toggle(module.code)}
                        aria-label={`${module.label} module`}
                      />
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
