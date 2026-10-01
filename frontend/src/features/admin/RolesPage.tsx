import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import {
  enumPickerOptions,
  optionsFromPairs,
  TechEarnestCreateColumn,
  TechEarnestCreateField,
  TechEarnestCreateGrid,
  TechEarnestCreateSection,
  TechEarnestFormKitCreateView,
  TechEarnestFormSelect,
  TechEarnestPicker,
} from "@/components/TechEarnestCreate";
import {
  TechEarnestRecordInfoSection,
  TechEarnestRecordRelatedCard,
  TechEarnestRecordSummaryStrip,
  useRecordNavigation,
} from "@/components/TechEarnestRecord";
import { RecordShell } from "@/components/RecordShell";
import { RelatedRecordList } from "@/components/RecordLink";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { TechEarnestFilterSelect } from "@/components/TechEarnestCreate/TechEarnestFilterSelect";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { useUrlSelection } from "@/hooks/useUrlRecord";
import {
  createRole,
  DATA_SCOPES,
  getRole,
  listPermissions,
  listRoles,
  listUsers,
  roleUpdateBody,
  updateRole,
  type Permission,
  type Role,
} from "./adminApi";
import {
  AdminRecordTimeline,
  adminErrorMessage,
  blankToNull,
  confirmDiscard,
  dash,
  formatDateTime,
  fullName,
  inputClass,
  useUserLabel,
} from "./adminKit";
import { listTableAcls } from "./studio/metadataApi";

const SCOPE_HELP: Record<string, string> = {
  ORGANIZATION: "Every record in the organization",
  REGION: "Records in the user's assigned regions",
  DEPARTMENT: "Records owned by the user's department",
  TEAM: "Records owned by the user's team",
  OWN: "Only records the user owns",
};
const scopeLabel = (scope: string) => scope.charAt(0) + scope.slice(1).toLowerCase();
const dataScopeOptions = enumPickerOptions(DATA_SCOPES, scopeLabel).map((option) => ({
  ...option,
  subtitle: SCOPE_HELP[option.value],
}));

const schema = z.object({
  name: z.string().trim().min(1, "Role name is required").max(128),
  code: z
    .string()
    .trim()
    .min(1, "Role code is required")
    .max(64)
    .regex(/^[A-Za-z0-9_]+$/, "Use letters, numbers or _"),
  dataScope: z.enum(DATA_SCOPES),
  description: z.string().max(2000).optional(),
  permissionCodes: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = { name: "", code: "", dataScope: "OWN", description: "", permissionCodes: [] };

const isEditable = (role: Role) => role.organizationId != null;

function toFormValues(role: Role): FormValues {
  return {
    name: role.name,
    code: role.code,
    dataScope: (DATA_SCOPES as readonly string[]).includes(role.dataScope) ? (role.dataScope as FormValues["dataScope"]) : "OWN",
    description: role.description ?? "",
    permissionCodes: [...role.permissionCodes],
  };
}

function groupPermissions(permissions: Permission[], query: string) {
  const q = query.trim().toLowerCase();
  const groups = new Map<string, Permission[]>();
  for (const permission of permissions) {
    if (q && !permission.code.toLowerCase().includes(q) && !(permission.description ?? "").toLowerCase().includes(q)) {
      continue;
    }
    const list = groups.get(permission.module) ?? [];
    list.push(permission);
    groups.set(permission.module, list);
  }
  return [...groups.entries()];
}

function PermissionMatrix({
  permissions,
  value,
  onChange,
  disabled = false,
}: {
  permissions: Permission[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupPermissions(permissions, query), [permissions, query]);
  const selected = new Set(value);
  const visibleCodes = groups.flatMap(([, list]) => list.map((p) => p.code));

  const setMany = (codes: string[], on: boolean) => {
    const next = new Set(value);
    for (const code of codes) {
      if (on) next.add(code);
      else next.delete(code);
    }
    onChange([...next]);
  };

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <input
          className="form-control form-control-sm"
          style={{ maxWidth: "22rem" }}
          placeholder="Search permissions"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search permissions"
        />
        <span className="small text-muted">
          {value.length} of {permissions.length} selected
        </span>
        {!disabled ? (
          <>
            <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setMany(visibleCodes, true)}>
              Select {query ? "matching" : "all"}
            </button>
            <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setMany(visibleCodes, false)}>
              Clear {query ? "matching" : "all"}
            </button>
          </>
        ) : null}
      </div>
      <div className="role-create-permissions">
        {groups.map(([module, list]) => {
          const codes = list.map((p) => p.code);
          const count = codes.filter((code) => selected.has(code)).length;
          return (
            <section key={module} className="role-create-permission-group">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <label className="form-check mb-0 d-flex align-items-center gap-2">
                  <input
                    className="form-check-input mt-0"
                    type="checkbox"
                    checked={count === codes.length}
                    ref={(el) => {
                      if (el) el.indeterminate = count > 0 && count < codes.length;
                    }}
                    disabled={disabled}
                    onChange={() => setMany(codes, count !== codes.length)}
                    aria-label={`Toggle all ${module} permissions`}
                  />
                  <h3 className="mb-0">{module}</h3>
                </label>
                <span className="badge text-bg-light border">
                  {count}/{codes.length}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(16rem, 1fr))", gap: "0.25rem 1rem" }}>
                {list.map((permission) => (
                  <label key={permission.id} className="form-check small mb-0" title={permission.description}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={selected.has(permission.code)}
                      disabled={disabled}
                      onChange={() => setMany([permission.code], !selected.has(permission.code))}
                    />
                    <span className="form-check-label">{permission.code}</span>
                  </label>
                ))}
              </div>
            </section>
          );
        })}
        {!groups.length ? <p className="text-muted small mb-0">No permissions match your search.</p> : null}
      </div>
    </>
  );
}

function RoleForm({
  role,
  roles,
  permissions,
  permissionsError,
  onCancel,
  onSaved,
}: {
  role: Role | null;
  roles: Role[];
  permissions: Permission[];
  permissionsError: boolean;
  onCancel: () => void;
  onSaved: (role: Role, again: boolean) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [copyFrom, setCopyFrom] = useState("");
  const locked = !!role?.system;
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: role ? toFormValues(role) : DEFAULTS,
  });

  const saveMutation = useMutation({
    mutationFn: ({ values }: { values: FormValues; again: boolean }) => {
      const description = blankToNull(values.description);
      if (role) {
        return updateRole(
          role.id,
          roleUpdateBody(role, {
            name: locked ? role.name : values.name.trim(),
            dataScope: locked ? role.dataScope : values.dataScope,
            permissionCodes: values.permissionCodes,
            description,
          }),
        );
      }
      return createRole({
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        dataScope: values.dataScope,
        permissionCodes: values.permissionCodes,
        description,
      });
    },
    onSuccess: (saved, { again }) => {
      setFormError(null);
      if (again) {
        reset(DEFAULTS);
        setCopyFrom("");
      }
      onSaved(saved, again);
    },
    onError: (error) =>
      setFormError(adminErrorMessage(error, role ? "Could not update the role." : "Could not create the role. Check the code is unique.")),
  });

  const submit = (again: boolean) => {
    if (permissionsError) {
      setFormError("Permissions could not be loaded. Reload the page before saving the role.");
      return;
    }
    void handleSubmit((values) => saveMutation.mutate({ values, again }))();
  };

  const copyOptions = useMemo(
    () =>
      optionsFromPairs(
        roles
          .filter((r) => r.id !== role?.id)
          .map((r) => ({ value: r.id, label: r.name, subtitle: `${r.permissionCodes.length} permissions` })),
      ),
    [roles, role?.id],
  );

  return (
    <TechEarnestFormKitCreateView
      title={role ? `Edit ${role.name}` : "Create Role"}
      tableCode="role"
      recordId={role?.id}
      entityLabel="Role"
      pending={saveMutation.isPending}
      isDirty={isDirty}
      formError={formError}
      alert={
        locked ? (
          <div className="alert alert-info py-2 small mb-0">
            This is a system role. Its name and data scope are fixed, but you can change its description and permissions.
          </div>
        ) : undefined
      }
      onCancel={() => confirmDiscard(isDirty) && onCancel()}
      onSave={() => submit(false)}
      onSaveAndNew={role ? undefined : () => submit(true)}
      onSubmit={() => submit(false)}
      showRecordImage={false}
    >
      <TechEarnestCreateSection title="Role Information">
        <TechEarnestCreateGrid>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Role Name" required error={errors.name?.message}>
              <input type="text" className={inputClass(errors.name)} disabled={locked} {...register("name")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField
              label="Role Code"
              required
              error={errors.code?.message}
              hint={role ? "The code can't be changed after creation." : "Uppercase identifier, e.g. SALES_REP"}
            >
              <input
                type="text"
                className={inputClass(errors.code)}
                style={{ textTransform: "uppercase" }}
                disabled={!!role}
                {...register("code")}
              />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Data Scope" required error={errors.dataScope?.message} hint="Which records members of this role can see.">
              <TechEarnestFormSelect
                control={control}
                name="dataScope"
                options={dataScopeOptions}
                searchPlaceholder="Search Scopes"
                allowEmpty={false}
                disabled={locked}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Copy Permissions From" hint="Replaces the current selection with another role's permissions.">
              <TechEarnestPicker
                value={copyFrom}
                onChange={(id) => {
                  setCopyFrom(id);
                  const source = roles.find((r) => r.id === id);
                  if (source) setValue("permissionCodes", [...source.permissionCodes], { shouldDirty: true });
                }}
                options={copyOptions}
                placeholder="Select a role"
                searchPlaceholder="Search Roles"
              />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
        </TechEarnestCreateGrid>
      </TechEarnestCreateSection>

      <TechEarnestCreateSection title="Description Information">
        <TechEarnestCreateField label="Description" wide error={errors.description?.message}>
          <textarea
            className={inputClass(errors.description)}
            rows={3}
            placeholder="What is this role for?"
            {...register("description")}
          />
        </TechEarnestCreateField>
      </TechEarnestCreateSection>

      <TechEarnestCreateSection title="Permissions">
        {permissionsError ? (
          <p className="text-danger small" role="alert">
            Permissions could not be loaded. Reload the page before saving the role.
          </p>
        ) : (
          <Controller
            control={control}
            name="permissionCodes"
            render={({ field }) => <PermissionMatrix permissions={permissions} value={field.value} onChange={field.onChange} />}
          />
        )}
      </TechEarnestCreateSection>
    </TechEarnestFormKitCreateView>
  );
}

export function RolesPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("ROLE_MANAGE");
  const canViewAcl = useHasPermission("ACL_VIEW");
  const canViewUsers = useHasPermission("USER_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch } = useModuleWorkspace();
  const [scopeFilter, setScopeFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);

  const rolesQuery = useQuery({ queryKey: ["admin", "roles"], queryFn: listRoles });
  const permissionsQuery = useQuery({ queryKey: ["admin", "permissions"], queryFn: listPermissions });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: canViewUsers,
    retry: false,
  });
  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const userLabel = useUserLabel(usersQuery.data);
  const [selected, setSelected] = useUrlSelection(rolesQuery.data, { fetchById: getRole });

  const tableAclsQuery = useQuery({
    queryKey: ["metadata", "table-acls"],
    queryFn: listTableAcls,
    enabled: canViewAcl && !!selected,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roles.filter((role) => {
      if (scopeFilter && role.dataScope !== scopeFilter) return false;
      if (typeFilter === "SYSTEM" && !role.system) return false;
      if (typeFilter === "CUSTOM" && role.system) return false;
      if (!q) return true;
      return [role.name, role.code, role.dataScope, role.description ?? ""].some((value) => value.toLowerCase().includes(q));
    });
  }, [roles, search, scopeFilter, typeFilter]);

  const recordNav = useRecordNavigation(rows, selected, setSelected);

  const permissionOptions = useMemo(
    () => permissions.map((p) => ({ value: p.code, label: `${p.code} — ${p.description}` })),
    [permissions],
  );

  if (formMode && canManage && (formMode === "create" || (selected && isEditable(selected)))) {
    return (
      <RoleForm
        key={formMode === "edit" ? selected?.id : "new"}
        role={formMode === "edit" ? selected : null}
        roles={roles}
        permissions={permissions}
        permissionsError={permissionsQuery.isError}
        onCancel={() => setFormMode(null)}
        onSaved={(role, again) => {
          void invalidate();
          if (again) return;
          setFormMode(null);
          setSelected(role);
        }}
      />
    );
  }

  if (selected) {
    const members = users.filter((u) => u.roleIds.includes(selected.id));
    const grouped = groupPermissions(permissions.filter((p) => selected.permissionCodes.includes(p.code)), "");
    const aclRows = (tableAclsQuery.data ?? [])
      .filter((row) => row.roleId === selected.id)
      .map((row) => ({
        table: row.tableCode,
        crud: `${row.canCreate ? "C" : "-"}${row.canRead ? "R" : "-"}${row.canUpdate ? "U" : "-"}${row.canDelete ? "D" : "-"}`,
      }))
      .sort((a, b) => a.table.localeCompare(b.table));
    return (
      <RecordShell
        layout="page"
        title={selected.name}
        subtitle={selected.code}
        avatarLabel={selected.name}
        status={<StatusBadge status={selected.system ? "SYSTEM" : "CUSTOM"} />}
        recordKey={selected.id}
        customFieldsTable="role"
        onBack={recordNav.goBack}
        onPrev={recordNav.goPrev}
        onNext={recordNav.goNext}
        hasPrev={recordNav.hasPrev}
        hasNext={recordNav.hasNext}
        relatedLinks={[
          { id: "permissions", label: "Permissions" },
          { id: "users", label: "Users" },
          { id: "table-access", label: "Table Access" },
        ]}
        primaryAction={
          canManage && isEditable(selected) ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setFormMode("edit")}>
              Edit
            </button>
          ) : null
        }
        secondaryActions={
          canManage ? (
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setFormMode("create")}>
              New Role
            </button>
          ) : null
        }
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <>
                {!isEditable(selected) ? (
                  <div className="alert alert-secondary py-2 small">Platform roles are managed by the platform team and can't be edited here.</div>
                ) : null}
                <TechEarnestRecordSummaryStrip
                  fields={[
                    { label: "Role Code", value: <code>{selected.code}</code> },
                    { label: "Data Scope", value: scopeLabel(selected.dataScope) },
                    { label: "Permissions", value: selected.permissionCodes.length },
                    { label: "Users", value: canViewUsers ? members.length : "—" },
                    { label: "Type", value: selected.system ? "System" : "Custom" },
                  ]}
                />
                <TechEarnestRecordInfoSection
                  title="Role Information"
                  fields={[
                    { label: "Role Name", value: selected.name },
                    { label: "Role Code", value: selected.code },
                    { label: "Data Scope", value: `${scopeLabel(selected.dataScope)} — ${SCOPE_HELP[selected.dataScope] ?? ""}` },
                    { label: "Type", value: selected.system ? "System role" : "Custom role" },
                    { label: "Created", value: formatDateTime(selected.createdAt) },
                    { label: "Modified", value: formatDateTime(selected.updatedAt) },
                  ]}
                />
                <TechEarnestRecordInfoSection
                  title="Description Information"
                  collapsible={false}
                  fields={[{ label: "Description", value: dash(selected.description) }]}
                />
                <TechEarnestRecordRelatedCard
                  id="techearnest-record-section-permissions"
                  title={`Permissions (${selected.permissionCodes.length})`}
                  isEmpty={!selected.permissionCodes.length}
                  emptyLabel="This role has no permissions"
                  actions={
                    canManage && isEditable(selected) ? (
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setFormMode("edit")}>
                        Manage
                      </button>
                    ) : null
                  }
                >
                  {grouped.map(([module, list]) => (
                    <div key={module} className="mb-2">
                      <div className="text-uppercase text-muted small mb-1">{module}</div>
                      <div className="d-flex flex-wrap gap-1">
                        {list.map((p) => (
                          <span key={p.code} className="badge text-bg-light border fw-normal" title={p.description}>
                            {p.code}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </TechEarnestRecordRelatedCard>
                <TechEarnestRecordRelatedCard
                  id="techearnest-record-section-users"
                  title={`Users (${members.length})`}
                  isEmpty={!members.length}
                  emptyLabel={canViewUsers ? "No users have this role" : "You don't have access to users"}
                >
                  <RelatedRecordList
                    module="user"
                    loading={usersQuery.isLoading && canViewUsers}
                    items={members.map((u) => ({
                      id: u.id,
                      label: fullName(u),
                      secondary: u.jobTitle ?? u.email,
                      trailing: <StatusBadge status={u.status} />,
                    }))}
                  />
                </TechEarnestRecordRelatedCard>
                <TechEarnestRecordRelatedCard
                  id="techearnest-record-section-table-access"
                  title="Table Access"
                  isEmpty={canViewAcl && !aclRows.length}
                  emptyLabel="No table-level rules for this role"
                  actions={
                    <>
                      <Link to="/admin/acl-matrix" className="btn btn-outline-secondary btn-sm">
                        Table ACL matrix
                      </Link>
                      <Link to="/admin/field-acl" className="btn btn-outline-secondary btn-sm">
                        Field ACL
                      </Link>
                    </>
                  }
                >
                  {!canViewAcl ? <p className="small text-muted mb-0">You don't have access to table ACLs.</p> : null}
                  {aclRows.length ? (
                    <div className="d-flex flex-wrap gap-1">
                      {aclRows.map((row) => (
                        <span key={row.table} className="badge text-bg-light border fw-normal">
                          {row.table}: {row.crud}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </TechEarnestRecordRelatedCard>
              </>
            ),
          },
          {
            id: "timeline",
            label: "Timeline",
            content: <AdminRecordTimeline entityType="ROLE" entityLabel="Role" record={selected} userLabel={userLabel} />,
          },
        ]}
      />
    );
  }

  return (
    <ModuleListShell
      title="Roles"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Roles</span>}
      filterToggle={{ onToggle: () => setFilterOpen((open) => !open) }}
      primaryAction={
        canManage ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setFormMode("create")}>
            Add role
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
              placeholder="Name, code, scope, or description"
            />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Data scope" value={scopeFilter} onChange={setScopeFilter} options={dataScopeOptions} placeholder="All scopes" emptyLabel="All scopes" searchPlaceholder="Search data scopes" />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect
              label="Type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: "SYSTEM", label: "System" },
                { value: "CUSTOM", label: "Custom" },
              ]}
              placeholder="All types"
              emptyLabel="All types"
              searchPlaceholder="Search types"
            />
          </div>
        </>
      }
      activeFilterCount={[search.trim(), scopeFilter, typeFilter].filter(Boolean).length}
      onClearFilters={() => {
        setSearch("");
        setScopeFilter("");
        setTypeFilter("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {rolesQuery.isLoading ? <LoadingState label="Loading roles..." /> : null}
      {rolesQuery.error ? <ErrorState title="Unable to load roles" message="Try again." /> : null}

      {!rolesQuery.isLoading && !rolesQuery.error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <ModuleListTable
              tableCode="role"
              defaultColumns={[
                { field: "name", label: "Name" },
                { field: "code", label: "Code" },
                { field: "dataScope", label: "Scope" },
                { field: "permissionCodes", label: "Permissions" },
                { field: "description", label: "Description" },
              ]}
              rows={rows}
              rowKey={(role) => role.id}
              onRowClick={(role) => setSelected(role)}
              bulk={{
                noun: "roles",
                exportFileName: "roles",
                csvValue: (role, field) => (field === "permissionCodes" ? role.permissionCodes.join(" ") : undefined),
                onComplete: () => void invalidate(),
                actions: [
                  {
                    id: "grant",
                    label: "Grant permission",
                    visible: canManage,
                    doneLabel: "updated",
                    applies: (role) => !role.system && isEditable(role),
                    input: { kind: "select", label: "Permission", options: permissionOptions },
                    run: (role, code) =>
                      updateRole(role.id, roleUpdateBody(role, { permissionCodes: [...new Set([...role.permissionCodes, code])] })),
                  },
                  {
                    id: "revoke",
                    label: "Revoke permission",
                    tone: "warning",
                    visible: canManage,
                    doneLabel: "updated",
                    applies: (role) => !role.system && isEditable(role),
                    input: { kind: "select", label: "Permission", options: permissionOptions },
                    run: (role, code) =>
                      updateRole(role.id, roleUpdateBody(role, { permissionCodes: role.permissionCodes.filter((c) => c !== code) })),
                  },
                  {
                    id: "change-scope",
                    label: "Change data scope",
                    visible: canManage,
                    doneLabel: "updated",
                    applies: (role) => !role.system && isEditable(role),
                    input: { kind: "select", label: "Data scope", options: dataScopeOptions },
                    run: (role, dataScope) => updateRole(role.id, roleUpdateBody(role, { dataScope })),
                  },
                ],
              }}
              renderCell={(role, field) => {
                if (field === "name")
                  return (
                    <>
                      {role.name}
                      {role.system ? <span className="badge text-bg-secondary ms-2">system</span> : null}
                    </>
                  );
                if (field === "code") return <code>{role.code}</code>;
                if (field === "dataScope") return scopeLabel(role.dataScope);
                if (field === "permissionCodes") return role.permissionCodes.length;
                const value = (role as unknown as Record<string, unknown>)[field];
                return value == null || value === "" ? "—" : String(value);
              }}
              nameFields={["name", "code"]}
              emptyMessage="No roles match the current filters."
            />
          ) : (
            <div className="module-tile-grid">
              {rows.map((role) => (
                <button key={role.id} type="button" className="module-tile text-start" onClick={() => setSelected(role)}>
                  <div className="tile-title">{role.name}</div>
                  <div className="small text-muted">
                    {role.code} · {scopeLabel(role.dataScope)} · {role.permissionCodes.length} permissions
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </ModuleListShell>
  );
}
