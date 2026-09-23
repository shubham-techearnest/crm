import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormActions, FormMoreDetails, FormSection, UnsavedGuard } from "@/components/FormKit";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { Link } from "react-router-dom";
import { createRole, listPermissions, listRoles, updateRole, type Role } from "./adminApi";
import { listTableAcls } from "./studio/metadataApi";

const schema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  dataScope: z.enum(["ORGANIZATION", "REGION", "DEPARTMENT", "TEAM", "OWN"]),
});

type FormValues = z.infer<typeof schema>;

const ROLE_DEFAULTS: FormValues = { code: "", name: "", dataScope: "OWN" };

export function RolesPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("ROLE_MANAGE");
  const canViewAcl = useHasPermission("ACL_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [scopeFilter, setScopeFilter] = useState("");
  const [selected, setSelected] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [permSearch, setPermSearch] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [saveAndNew, setSaveAndNew] = useState(false);

  const rolesQuery = useQuery({ queryKey: ["admin", "roles"], queryFn: listRoles });
  const permissionsQuery = useQuery({ queryKey: ["admin", "permissions"], queryFn: listPermissions });
  const tableAclsQuery = useQuery({
    queryKey: ["metadata", "table-acls"],
    queryFn: listTableAcls,
    enabled: canViewAcl && !!selected,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: ROLE_DEFAULTS,
  });

  const buildBody = (values: FormValues) => ({
    code: values.code,
    name: values.name,
    dataScope: values.dataScope,
    permissionCodes: [] as string[],
  });

  const permissionsByModule = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    const groups = new Map<string, NonNullable<typeof permissionsQuery.data>>();
    for (const permission of permissionsQuery.data ?? []) {
      if (
        q &&
        !permission.code.toLowerCase().includes(q) &&
        !(permission.description ?? "").toLowerCase().includes(q)
      ) {
        continue;
      }
      const list = groups.get(permission.module) ?? [];
      list.push(permission);
      groups.set(permission.module, list);
    }
    return [...groups.entries()];
  }, [permissionsQuery.data, permSearch]);

  const crudSummaryForModule = (codes: string[]) => {
    const selected = new Set(selectedPermissions);
    const flags = [
      codes.some((c) => selected.has(c) && c.endsWith("_CREATE")) ? "C" : null,
      codes.some((c) => selected.has(c) && c.endsWith("_VIEW")) ? "R" : null,
      codes.some((c) => selected.has(c) && (c.endsWith("_UPDATE") || c.endsWith("_MANAGE"))) ? "U" : null,
      codes.some((c) => selected.has(c) && c.endsWith("_DELETE")) ? "D" : null,
    ].filter(Boolean);
    return flags.length ? flags.join("") : "—";
  };

  const roleTableAclSummary = useMemo(() => {
    if (!selected) return [];
    return (tableAclsQuery.data ?? [])
      .filter((row) => row.roleId === selected.id)
      .map((row) => ({
        table: row.tableCode,
        crud: `${row.canCreate ? "C" : "-"}${row.canRead ? "R" : "-"}${row.canUpdate ? "U" : "-"}${row.canDelete ? "D" : "-"}`,
      }))
      .sort((a, b) => a.table.localeCompare(b.table));
  }, [tableAclsQuery.data, selected]);

  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      setFormError(null);
      if (saveAndNew) {
        reset(ROLE_DEFAULTS);
        setSaveAndNew(false);
        setShowMore(false);
      } else {
        reset(ROLE_DEFAULTS);
        setShowForm(false);
        setShowMore(false);
      }
    },
    onError: () => setFormError("Could not create role."),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { name: string; dataScope?: string; permissionCodes: string[] };
    }) => updateRole(id, body),
    onSuccess: async (role) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      setSelected(role);
      setSelectedPermissions(role.permissionCodes);
    },
  });

  function openRole(role: Role) {
    setSelected(role);
    setSelectedPermissions([...role.permissionCodes]);
  }

  function togglePermission(code: string) {
    setSelectedPermissions((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rolesQuery.data ?? []).filter((role) => {
      if (scopeFilter && role.dataScope !== scopeFilter) return false;
      if (!q) return true;
      return (
        role.name.toLowerCase().includes(q) ||
        role.code.toLowerCase().includes(q) ||
        role.dataScope.toLowerCase().includes(q)
      );
    });
  }, [rolesQuery.data, search, scopeFilter]);

  return (
    <ModuleListShell
      title="Roles"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Roles</span>}
      toolbarActions={
        <button
          type="button"
          className={`btn btn-sm ${filterOpen ? "btn-primary" : "btn-outline-secondary"}`}
          onClick={() => setFilterOpen((o) => !o)}
        >
          Filter
        </button>
      }
      primaryAction={
        canManage ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Add role"}
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Roles by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, code, or scope"
            />
          </div>
          <div className="module-filter-section">
            <h3>Data scope</h3>
            <select
              className="form-select form-select-sm"
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="ORGANIZATION">ORGANIZATION</option>
              <option value="REGION">REGION</option>
              <option value="DEPARTMENT">DEPARTMENT</option>
              <option value="TEAM">TEAM</option>
              <option value="OWN">OWN</option>
            </select>
          </div>
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {showForm ? (
        <form
          className="border-bottom p-3 bg-white"
          onSubmit={handleSubmit((values) => createMutation.mutate(buildBody(values)))}
        >
          <UnsavedGuard when={isDirty && showForm} />
          {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
          <FormSection title="Primary details" description="Role identity and scope">
            <div className="col-md-3">
              <FormField label="Code" required error={errors.code} {...register("code")} />
            </div>
            <div className="col-md-4">
              <FormField label="Name" required error={errors.name} {...register("name")} />
            </div>
            <div className="col-md-3">
              <label className="form-label required">Data scope</label>
              <select className="form-select" {...register("dataScope")}>
                <option value="ORGANIZATION">ORGANIZATION</option>
                <option value="REGION">REGION</option>
                <option value="DEPARTMENT">DEPARTMENT</option>
                <option value="TEAM">TEAM</option>
                <option value="OWN">OWN</option>
              </select>
            </div>
          </FormSection>
          <FormMoreDetails open={showMore} onToggle={() => setShowMore((v) => !v)}>
            <FormSection title="Permissions">
              <div className="col-12">
                <p className="text-muted small mb-0">
                  Create the role first, then open it from the list to assign permissions.
                </p>
              </div>
            </FormSection>
          </FormMoreDetails>
          <FormActions
            submitLabel="Save"
            showSaveAndNew
            submitting={isSubmitting || createMutation.isPending}
            onSaveAndNew={() => {
              setSaveAndNew(true);
              void handleSubmit((values) => createMutation.mutate(buildBody(values)))();
            }}
            onCancel={() => {
              if (isDirty && !window.confirm("Discard unsaved changes?")) return;
              setShowForm(false);
              setShowMore(false);
              reset(ROLE_DEFAULTS);
            }}
          />
        </form>
      ) : null}

      {rolesQuery.isLoading ? <LoadingState label="Loading roles..." /> : null}
      {rolesQuery.error ? <ErrorState title="Unable to load roles" message="Try again." /> : null}

      {!rolesQuery.isLoading && !rolesQuery.error ? (
        <div
          className={selected ? "module-list-split" : undefined}
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
        >
          {viewMode === "list" ? (
            <div className="module-list-table-wrap">
              <table className="table module-list-table align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Scope</th>
                    <th>Permissions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((role) => (
                    <tr
                      key={role.id}
                      className={selected?.id === role.id ? "is-selected" : undefined}
                      onClick={() => openRole(role)}
                    >
                      <td className="lead-name">
                        {role.name}
                        {role.system ? (
                          <span className="badge text-bg-secondary ms-2">system</span>
                        ) : null}
                      </td>
                      <td>
                        <code>{role.code}</code>
                      </td>
                      <td>{role.dataScope}</td>
                      <td>{role.permissionCodes.length}</td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-5">
                        No roles match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="module-tile-grid">
              {rows.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  className={`module-tile text-start${selected?.id === role.id ? " is-selected" : ""}`}
                  onClick={() => openRole(role)}
                >
                  <div className="tile-title">{role.name}</div>
                  <div className="small text-muted">
                    {role.code} · {role.dataScope}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selected ? (
            <aside className="module-detail-drawer">
              <div className="d-flex justify-content-between mb-2">
                <div>
                  <div className="fw-semibold">{selected.name}</div>
                  <div className="text-muted small">
                    {selected.code} · scope <strong>{selected.dataScope}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
              <div className="mb-2 d-flex flex-wrap gap-2 align-items-center">
                <Link to="/admin/acl-matrix" className="btn btn-outline-primary btn-sm">
                  Open Table ACL matrix
                </Link>
                <Link to="/admin/field-acl" className="btn btn-outline-secondary btn-sm">
                  Field ACL
                </Link>
              </div>
              {roleTableAclSummary.length ? (
                <div className="mb-3">
                  <div className="text-uppercase text-muted small mb-1">Effective table CRUD</div>
                  <div className="d-flex flex-wrap gap-1">
                    {roleTableAclSummary.slice(0, 12).map((row) => (
                      <span key={row.table} className="badge text-bg-light">
                        {row.table}: {row.crud}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <input
                className="form-control form-control-sm mb-2"
                placeholder="Search permissions"
                value={permSearch}
                onChange={(e) => setPermSearch(e.target.value)}
                aria-label="Search permissions"
              />
              <div style={{ maxHeight: "22rem", overflow: "auto" }}>
                {permissionsByModule.map(([module, permissions]) => (
                  <div key={module} className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <div className="text-uppercase text-muted small">{module}</div>
                      <span className="badge text-bg-secondary">
                        CRUD {crudSummaryForModule((permissions ?? []).map((p) => p.code))}
                      </span>
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      {(permissions ?? []).map((permission) => (
                        <label key={permission.id} className="form-check form-check-inline small mb-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={selectedPermissions.includes(permission.code)}
                            disabled={!canManage}
                            onChange={() => togglePermission(permission.code)}
                          />
                          <span className="form-check-label" title={permission.description}>
                            {permission.code}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {!permissionsByModule.length ? (
                  <p className="text-muted small">No permissions match the search.</p>
                ) : null}
              </div>
              {canManage ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm mt-2"
                  disabled={updateMutation.isPending}
                  onClick={() => {
                    const dirty =
                      JSON.stringify([...selectedPermissions].sort()) !==
                      JSON.stringify([...(selected.permissionCodes ?? [])].sort());
                    if (
                      dirty &&
                      !window.confirm("Save permission changes for this role?")
                    ) {
                      return;
                    }
                    updateMutation.mutate({
                      id: selected.id,
                      body: {
                        name: selected.name,
                        dataScope: selected.system ? undefined : selected.dataScope,
                        permissionCodes: selectedPermissions,
                      },
                    });
                  }}
                >
                  Save permissions
                </button>
              ) : null}
            </aside>
          ) : null}
        </div>
      ) : null}
    </ModuleListShell>
  );
}
