import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { NavIcon } from "@/components/NavIcon/NavIcon";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { adminErrorMessage, formatDate, formatDateTime } from "@/features/admin/adminKit";
import { moduleIcon, OrganizationModulePicker } from "./OrganizationModulePicker";
import {
  getOrganizationModules,
  getPlatformOrganization,
  listOrganizationAdmins,
  setPlatformOrganizationStatus,
  updateOrganizationModules,
  type OrganizationModule,
  type PlatformOrganization,
} from "./platformOrgApi";
import { TenantScope } from "./TenantScope";

const UsersPage = lazy(() => import("@/features/admin/UsersPage").then((m) => ({ default: m.UsersPage })));
const RolesPage = lazy(() => import("@/features/admin/RolesPage").then((m) => ({ default: m.RolesPage })));
const AclMatrixPage = lazy(() => import("@/features/admin/AclMatrixPage").then((m) => ({ default: m.AclMatrixPage })));
const FieldAclMatrixPage = lazy(() =>
  import("@/features/admin/FieldAclMatrixPage").then((m) => ({ default: m.FieldAclMatrixPage })),
);
const StudioPage = lazy(() => import("@/features/admin/studio/StudioPage").then((m) => ({ default: m.StudioPage })));

type Section = "overview" | "modules" | "users" | "roles" | "table-acl" | "field-acl" | "studio";

const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "home" },
  { key: "modules", label: "Modules", icon: "module" },
  { key: "users", label: "Users", icon: "users" },
  { key: "roles", label: "Roles", icon: "roles" },
  { key: "table-acl", label: "Table ACL", icon: "acl" },
  { key: "field-acl", label: "Field ACL", icon: "fieldAcl" },
  { key: "studio", label: "Metadata Studio", icon: "studio" },
];

const TENANT_SECTION_NOTES: Partial<Record<Section, { module: string; text: string }>> = {
  users: { module: "USERS", text: "Users of this organization. Invite users and assign their roles here." },
  roles: {
    module: "ROLES",
    text: "Roles and permissions of this organization. Only permissions of enabled modules are listed.",
  },
  "table-acl": { module: "TABLE_ACL", text: "Create, read, update and delete access per role and table." },
  "field-acl": { module: "FIELD_ACL", text: "Hidden, read-only or editable access per role and field." },
  studio: { module: "METADATA_STUDIO", text: "Fields, form layouts, list columns and related lists." },
};

function isSection(value: string | null): value is Section {
  return SECTIONS.some((section) => section.key === value);
}

export function PlatformOrganizationDetailPage() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const requested = searchParams.get("section");
  const section: Section = isSection(requested) ? requested : "overview";
  const justCreated = searchParams.get("created") === "1";

  const orgQuery = useQuery({
    queryKey: ["platform", "organizations", id],
    queryFn: () => getPlatformOrganization(id),
    enabled: Boolean(id),
  });
  const modulesQuery = useQuery({
    queryKey: ["platform", "organizations", id, "modules"],
    queryFn: () => getOrganizationModules(id),
    enabled: Boolean(id),
  });

  const statusMutation = useMutation({
    mutationFn: (status: "ACTIVE" | "SUSPENDED") => setPlatformOrganizationStatus(id, status),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
    },
    onError: (err) => setActionError(adminErrorMessage(err, "Status update failed")),
  });

  function openSection(next: Section) {
    const params = new URLSearchParams(searchParams);
    params.delete("created");
    if (next === "overview") params.delete("section");
    else params.set("section", next);
    setSearchParams(params, { replace: true });
  }

  if (orgQuery.isLoading) {
    return <LoadingState label="Loading organization…" />;
  }
  if (orgQuery.isError || !orgQuery.data) {
    return <ErrorState title="Organization not found" message="The organization could not be loaded." />;
  }

  const org = orgQuery.data;
  const suspended = org.status === "SUSPENDED";
  const note = TENANT_SECTION_NOTES[section];
  const noteModule = note ? modulesQuery.data?.find((module) => module.code === note.module) : undefined;

  return (
    <div className="platform-page">
      <div className="platform-page-head">
        <div className="platform-org-heading">
          <Link to="/platform/organizations" className="platform-back">
            ← Organizations
          </Link>
          <div className="d-flex align-items-center gap-3">
            <span className="platform-org-avatar" aria-hidden>
              {org.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h1 className="platform-page-title d-flex align-items-center gap-2">
                {org.name} <StatusBadge status={org.status} />
              </h1>
              <p className="platform-page-subtitle">
                {org.slug} · created {formatDate(org.createdAt)}
              </p>
            </div>
          </div>
        </div>
        <div className="d-flex gap-2">
          {suspended ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate("ACTIVE")}
            >
              Activate
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              disabled={statusMutation.isPending}
              onClick={() => {
                if (window.confirm(`Suspend ${org.name}? Users in this org will not be able to sign in.`)) {
                  statusMutation.mutate("SUSPENDED");
                }
              }}
            >
              Suspend
            </button>
          )}
        </div>
      </div>

      {justCreated ? (
        <div className="alert alert-success py-2">
          Organization created. The admin can now sign in with the email and password you set.
        </div>
      ) : null}
      {actionError ? <div className="alert alert-danger py-2">{actionError}</div> : null}

      <nav className="platform-tabs" aria-label="Organization sections">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`platform-tab${section === item.key ? " is-active" : ""}`}
            onClick={() => openSection(item.key)}
          >
            <NavIcon name={item.icon} className="platform-tab-icon" />
            {item.label}
          </button>
        ))}
      </nav>

      {section === "overview" ? (
        <OverviewSection org={org} modules={modulesQuery.data} onOpen={openSection} />
      ) : null}
      {section === "modules" ? <ModulesSection organizationId={id} query={modulesQuery} /> : null}

      {note ? (
        <>
          <div className="platform-scope-note">
            <span>
              Managing <strong>{org.name}</strong> as Super Admin. {note.text}
            </span>
            {noteModule ? (
              <span className={`platform-scope-pill${noteModule.enabled ? " is-on" : ""}`}>
                {noteModule.enabled ? "Org admin can also manage this" : "Only you can manage this"}
              </span>
            ) : null}
          </div>
          <div className="platform-tenant-frame">
            <TenantScope organizationId={id}>
              <Suspense fallback={<LoadingState label="Loading…" />}>
                {section === "users" ? <UsersPage /> : null}
                {section === "roles" ? <RolesPage /> : null}
                {section === "table-acl" ? <AclMatrixPage /> : null}
                {section === "field-acl" ? <FieldAclMatrixPage /> : null}
                {section === "studio" ? <StudioPage /> : null}
              </Suspense>
            </TenantScope>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatTile({ label, value, icon }: { label: string; value: ReactNode; icon: string }) {
  return (
    <div className="platform-stat">
      <NavIcon name={icon} colored />
      <div>
        <div className="platform-stat-value">{value}</div>
        <div className="platform-stat-label">{label}</div>
      </div>
    </div>
  );
}

function OverviewSection({
  org,
  modules,
  onOpen,
}: {
  org: PlatformOrganization;
  modules: OrganizationModule[] | undefined;
  onOpen: (section: Section) => void;
}) {
  const adminsQuery = useQuery({
    queryKey: ["platform", "organizations", org.id, "admins"],
    queryFn: () => listOrganizationAdmins(org.id),
  });
  const enabled = modules?.filter((module) => module.enabled) ?? [];

  return (
    <div className="platform-overview">
      <div className="platform-stats">
        <StatTile label="Users" value={org.userCount ?? "—"} icon="users" />
        <StatTile label="Regions" value={org.regionCount ?? "—"} icon="regions" />
        <StatTile
          label="Modules enabled"
          value={modules ? `${enabled.length}/${modules.length}` : "—"}
          icon="module"
        />
        <StatTile label="Currency" value={org.currencyCode} icon="invoices" />
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <section className="platform-card h-100">
            <h2 className="platform-card-title">Organization admin login</h2>
            {adminsQuery.isLoading ? <LoadingState label="Loading admins…" /> : null}
            {adminsQuery.data?.length === 0 ? (
              <p className="text-muted small mb-0">No active organization admin.</p>
            ) : null}
            <ul className="platform-admin-list">
              {adminsQuery.data?.map((admin) => (
                <li key={admin.id}>
                  <span className="platform-admin-avatar" aria-hidden>
                    {`${admin.firstName.charAt(0)}${admin.lastName.charAt(0)}`.toUpperCase()}
                  </span>
                  <div className="flex-grow-1 min-w-0">
                    <div className="fw-semibold text-truncate">
                      {admin.firstName} {admin.lastName}
                    </div>
                    <div className="small text-muted text-truncate">{admin.email}</div>
                  </div>
                  <div className="text-end small">
                    <StatusBadge status={admin.status} />
                    <div className="text-muted mt-1">
                      {admin.lastLoginAt ? `Last sign-in ${formatDateTime(admin.lastLoginAt)}` : "Never signed in"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-sm btn-light border mt-2" onClick={() => onOpen("users")}>
              Manage users
            </button>
          </section>
        </div>
        <div className="col-lg-6">
          <section className="platform-card h-100">
            <h2 className="platform-card-title">Profile</h2>
            <dl className="platform-dl">
              <dt>Legal name</dt>
              <dd>{org.legalName || "—"}</dd>
              <dt>Email</dt>
              <dd>{org.email || "—"}</dd>
              <dt>Phone</dt>
              <dd>{org.phone || "—"}</dd>
              <dt>Website</dt>
              <dd>{org.website || "—"}</dd>
              <dt>Timezone</dt>
              <dd>{org.timezone}</dd>
              <dt>Locale</dt>
              <dd>{org.locale}</dd>
              <dt>Updated</dt>
              <dd>{formatDateTime(org.updatedAt)}</dd>
            </dl>
          </section>
        </div>
        <div className="col-12">
          <section className="platform-card">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h2 className="platform-card-title mb-0">Enabled modules</h2>
              <button type="button" className="btn btn-sm btn-light border" onClick={() => onOpen("modules")}>
                Change modules
              </button>
            </div>
            {modules ? (
              enabled.length ? (
                <div className="platform-module-chips">
                  {enabled.map((module) => (
                    <span key={module.code} className="platform-module-chip">
                      <NavIcon name={moduleIcon(module.code)} className="platform-module-chip-icon" />
                      {module.label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted small mb-0">No modules enabled; users only see Home.</p>
              )
            ) : (
              <LoadingState label="Loading modules…" />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ModulesSection({
  organizationId,
  query,
}: {
  organizationId: string;
  query: UseQueryResult<OrganizationModule[]>;
}) {
  const queryClient = useQueryClient();
  const saved = useMemo(
    () => query.data?.filter((module) => module.enabled).map((module) => module.code) ?? [],
    [query.data],
  );
  const [draft, setDraft] = useState<string[] | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const value = draft ?? saved;
  const dirty = draft !== null && (draft.length !== saved.length || draft.some((code) => !saved.includes(code)));

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const mutation = useMutation({
    mutationFn: (codes: string[]) => updateOrganizationModules(organizationId, codes),
    onSuccess: (modules) => {
      queryClient.setQueryData(["platform", "organizations", organizationId, "modules"], modules);
      setDraft(null);
      setMessage({
        tone: "success",
        text: "Modules saved. Users of this organization see the change on their next page load.",
      });
    },
    onError: (err) => setMessage({ tone: "danger", text: adminErrorMessage(err, "Could not save modules") }),
  });

  if (query.isLoading) return <LoadingState label="Loading modules…" />;
  if (query.isError || !query.data) {
    return <ErrorState title="Modules unavailable" message="The module list could not be loaded." />;
  }

  return (
    <section className="platform-card">
      <div className="platform-card-head">
        <div>
          <h2 className="platform-card-title mb-1">Sidebar modules</h2>
          <p className="text-muted small mb-0">
            Disabled modules disappear from the organization&apos;s sidebar and their permissions are removed from
            every role, including the organization admin.
          </p>
        </div>
      </div>
      {message ? <div className={`alert alert-${message.tone} py-2`}>{message.text}</div> : null}
      <OrganizationModulePicker
        modules={query.data}
        value={value}
        onChange={(next) => {
          setMessage(null);
          setDraft(next);
        }}
        disabled={mutation.isPending}
      />
      <div className={`platform-savebar${dirty ? " is-visible" : ""}`}>
        <span>You have unsaved module changes.</span>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-light border"
            disabled={mutation.isPending}
            onClick={() => setDraft(null)}
          >
            Discard
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(value)}
          >
            {mutation.isPending ? "Saving…" : "Save modules"}
          </button>
        </div>
      </div>
    </section>
  );
}
