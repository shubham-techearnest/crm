import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormMoreDetails, FormSection } from "@/components/FormKit";
import {
  optionsFromPairs,
  TechEarnestFormKitCreateView,
  TechEarnestPicker,
  TechEarnestFormSelect,
  useTechEarnestCreateFlow,
} from "@/components/TechEarnestCreate";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { TechEarnestFilterSelect } from "@/components/TechEarnestCreate/TechEarnestFilterSelect";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import {
  assignUserRegions,
  assignUserRoles,
  createUser,
  deactivateUser,
  listDepartments,
  listRegions,
  listRoles,
  listUsers,
  updateUser,
  type AdminUser,
} from "./adminApi";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().optional(),
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  phone: z.string().optional(),
  regionId: z.string().optional(),
  departmentId: z.string().optional(),
  roleId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const USER_DEFAULTS: FormValues = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  phone: "",
  regionId: "",
  departmentId: "",
  roleId: "",
};

export function UsersPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("USER_MANAGE");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [assignRoleId, setAssignRoleId] = useState("");
  const [assignRegionId, setAssignRegionId] = useState("");
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmReactivate, setConfirmReactivate] = useState(false);
  const [confirmDiscardForm, setConfirmDiscardForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const usersQuery = useQuery({ queryKey: ["admin", "users"], queryFn: () => listUsers() });
  const rolesQuery = useQuery({ queryKey: ["admin", "roles"], queryFn: listRoles });
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const departmentsQuery = useQuery({ queryKey: ["admin", "departments"], queryFn: listDepartments });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: USER_DEFAULTS,
  });

  const {
    setSaveAndNew,
    photo,
    cancelCreate,
    afterCreateSuccess,
  } = useTechEarnestCreateFlow({
    defaults: USER_DEFAULTS,
    reset,
    setShowForm,
    setFormError,
    setSelected: (user: AdminUser) => setSelected(user),
    onResetExtras: () => setShowMore(false),
  });

  const buildBody = (values: FormValues) => ({
    email: values.email,
    password: values.password ?? "",
    firstName: values.firstName,
    lastName: values.lastName,
    phone: values.phone || undefined,
    regionId: values.regionId || null,
    departmentId: values.departmentId || null,
    roleIds: values.roleId ? [values.roleId] : [],
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => editingUser
      ? updateUser(editingUser.id, {
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone || undefined,
          regionId: values.regionId || null,
          branchId: editingUser.branchId,
          departmentId: values.departmentId || null,
          teamId: editingUser.teamId,
          managerId: editingUser.managerId,
          status: editingUser.status,
        })
      : createUser(buildBody(values)),
    onSuccess: async (user) => {
      await refresh();
      setFormError(null);
      if (editingUser) {
        setSelected(user);
        setEditingUser(null);
        setShowForm(false);
        reset(USER_DEFAULTS);
      } else {
        await afterCreateSuccess(user, "USER");
      }
    },
    onError: () => setFormError(
      editingUser
        ? "Could not update user details. Check your access and required fields."
        : "Could not create user. Email may already exist; check the required fields and try again.",
    ),
  });

  const onCreateSubmit = (values: FormValues) => {
    if (!editingUser && (!values.password || values.password.length < 8)) {
      setError("password", { type: "manual", message: "At least 8 characters" });
      return;
    }
    createMutation.mutate(values);
  };

  function openCreate() {
    setEditingUser(null);
    reset(USER_DEFAULTS);
    setShowForm(true);
  }

  function openEdit(user: AdminUser) {
    setEditingUser(user);
    setFormError(null);
    reset({
      email: user.email,
      password: "",
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? "",
      regionId: user.regionId ?? "",
      departmentId: user.departmentId ?? "",
      roleId: "",
    });
    setShowForm(true);
  }

  function cancelUserForm() {
    if (isDirty) {
      setConfirmDiscardForm(true);
      return;
    }
    if (editingUser) {
      setEditingUser(null);
      setShowForm(false);
      setFormError(null);
      reset(USER_DEFAULTS);
      return;
    }
    cancelCreate(false);
  }

  function discardUserFormChanges() {
    setConfirmDiscardForm(false);
    if (editingUser) {
      setEditingUser(null);
      setShowForm(false);
      setFormError(null);
      reset(USER_DEFAULTS);
    } else {
      cancelCreate(false);
    }
  }

  const roleMutation = useMutation({
    mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) =>
      assignUserRoles(userId, roleIds),
    onSuccess: async (user) => {
      await refresh();
      setSelected(user);
      setActionError(null);
      setAssignRoleId("");
    },
    onError: () => setActionError("Could not update this user's roles. Check your permission and try again."),
  });

  const regionMutation = useMutation({
    mutationFn: ({ userId, regionIds }: { userId: string; regionIds: string[] }) =>
      assignUserRegions(userId, regionIds),
    onSuccess: async (user) => {
      await refresh();
      setSelected(user);
      setActionError(null);
      setAssignRegionId("");
    },
    onError: () => setActionError("Could not update this user's region access. Check your permission and try again."),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: async (user) => {
      await refresh();
      setSelected(user);
      if (statusFilter && statusFilter !== user.status) setStatusFilter("");
      setConfirmDeactivate(false);
      setActionError(null);
    },
    onError: () => setActionError("Could not deactivate this user. Check your permission and try again."),
  });

  const reactivateMutation = useMutation({
    mutationFn: (user: AdminUser) => updateUser(user.id, {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? undefined,
      regionId: user.regionId,
      branchId: user.branchId,
      departmentId: user.departmentId,
      teamId: user.teamId,
      managerId: user.managerId,
      status: "ACTIVE",
    }),
    onSuccess: async (user) => {
      await refresh();
      setSelected(user);
      if (statusFilter && statusFilter !== user.status) setStatusFilter("");
      setConfirmReactivate(false);
      setActionError(null);
    },
    onError: () => setActionError("Could not reactivate this user. Check your permission and organization access."),
  });

  const regionName = useMemo(() => {
    const map = new Map((regionsQuery.data ?? []).map((region) => [region.id, region.name]));
    return (id: string | null) => (id ? (map.get(id) ?? id.slice(0, 8)) : "—");
  }, [regionsQuery.data]);

  const regionOptions = useMemo(
    () => optionsFromPairs((regionsQuery.data ?? []).map((r) => ({ value: r.id, label: r.name }))),
    [regionsQuery.data],
  );
  const departmentOptions = useMemo(
    () => optionsFromPairs((departmentsQuery.data ?? []).map((d) => ({ value: d.id, label: d.name }))),
    [departmentsQuery.data],
  );
  const roleOptions = useMemo(
    () =>
      optionsFromPairs(
        (rolesQuery.data ?? [])
          .filter((role) => role.code !== "SUPER_ADMIN")
          .map((role) => ({ value: role.id, label: role.name })),
      ),
    [rolesQuery.data],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (usersQuery.data ?? []).filter((user) => {
      if (statusFilter && user.status !== statusFilter) return false;
      if (!q) return true;
      const name = `${user.firstName} ${user.lastName}`.toLowerCase();
      return (
        name.includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.roleCodes.some((code) => code.toLowerCase().includes(q))
      );
    });
  }, [usersQuery.data, search, statusFilter]);

  const userFormFields = (
    <>
      <FormSection title="Primary details" description="Identity and login">
        <div className="col-md-3">
          <FormField label="First name" required error={errors.firstName} {...register("firstName")} />
        </div>
        <div className="col-md-3">
          <FormField label="Last name" required error={errors.lastName} {...register("lastName")} />
        </div>
        <div className="col-md-3">
          <FormField
            label="Email"
            type="email"
            required={!editingUser}
            disabled={!!editingUser}
            error={errors.email}
            {...register("email")}
          />
          {editingUser ? <div className="form-text">Sign-in email cannot be changed here.</div> : null}
        </div>
        {!editingUser ? <div className="col-md-3">
          <FormField
            label="Password"
            type="password"
            required
            error={errors.password}
            {...register("password")}
          />
        </div> : null}
      </FormSection>
      <FormMoreDetails open={showMore} onToggle={() => setShowMore((v) => !v)}>
        <FormSection title="Org placement">
          <div className="col-md-3">
            <FormField label="Phone" error={errors.phone} {...register("phone")} />
          </div>
          <div className="col-md-3">
            <label className="form-label">Region</label>
            <TechEarnestFormSelect
              control={control}
              name="regionId"
              options={regionOptions}
              searchPlaceholder="Search Regions"
              placeholder="None"
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Department</label>
            <TechEarnestFormSelect
              control={control}
              name="departmentId"
              options={departmentOptions}
              searchPlaceholder="Search Departments"
              placeholder="None"
            />
          </div>
          {!editingUser ? <div className="col-md-3">
            <label className="form-label">Initial role</label>
            <TechEarnestFormSelect
              control={control}
              name="roleId"
              options={roleOptions}
              searchPlaceholder="Search Roles"
              placeholder="None"
            />
          </div> : null}
        </FormSection>
      </FormMoreDetails>
    </>
  );

  return (
    <>
      {showForm && canManage ? (
        <TechEarnestFormKitCreateView
          title={editingUser ? "Edit User" : "Create User"}
          entityLabel="User"
          pending={isSubmitting || createMutation.isPending}
          isDirty={isDirty}
          formError={formError}
          onCancel={cancelUserForm}
          onSave={() => void handleSubmit(onCreateSubmit)()}
          onSaveAndNew={!editingUser ? () => {
            setSaveAndNew(true);
            void handleSubmit(onCreateSubmit)();
          } : undefined}
          onSubmit={() => void handleSubmit(onCreateSubmit)()}
          photo={photo}
        >
          {userFormFields}
        </TechEarnestFormKitCreateView>
      ) : (
    <ModuleListShell
      title="Users"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Users</span>}
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
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openCreate()}>
            Add user
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Users by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, or role"
            />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INVITED", label: "Invited" },
              { value: "DEACTIVATED", label: "Deactivated" },
            ]} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search user statuses" />
          </div>
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {usersQuery.isLoading ? <LoadingState label="Loading users..." /> : null}
      {usersQuery.error ? <ErrorState title="Unable to load users" message="Try again." /> : null}

      {!usersQuery.isLoading && !usersQuery.error ? (
        <div
          className={selected ? "module-list-split" : undefined}
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
        >
          {viewMode === "list" ? (
            <ModuleListTable
              tableCode="user"
              defaultColumns={[
                { field: "firstName", label: "First name" },
                { field: "lastName", label: "Last name" },
                { field: "email", label: "Email" },
                { field: "status", label: "Status" },
                { field: "roleCodes", label: "Roles" },
                { field: "regionId", label: "Region" },
              ]}
              rows={rows}
              rowKey={(user) => user.id}
              selectedRowKey={selected?.id}
              onRowClick={setSelected}
              renderCell={(user, field) => {
                if (field === "status") return <StatusBadge status={user.status} />;
                if (field === "roleCodes") return user.roleCodes.join(", ") || "—";
                if (field === "regionId") return regionName(user.regionId);
                const value = (user as unknown as Record<string, unknown>)[field];
                return value == null || value === "" ? "—" : String(value);
              }}
              nameFields={["firstName", "lastName", "email"]}
              emptyMessage="No users match the current filters."
            />
          ) : (
            <div className="module-tile-grid">
              {rows.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className={`module-tile text-start${selected?.id === user.id ? " is-selected" : ""}`}
                  onClick={() => setSelected(user)}
                >
                  <div className="tile-title">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="small text-muted">
                    {user.email} · {user.status}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selected ? (
            <aside className="module-detail-drawer">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <div className="fw-semibold">
                    {selected.firstName} {selected.lastName}
                  </div>
                  <div className="text-muted small">{selected.email}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
              <p className="small mb-2">
                Status: <StatusBadge status={selected.status} />
              </p>
              <div className="small mb-3">
                <div className="fw-semibold mb-1">Roles</div>
                <div className="d-flex flex-wrap gap-1">
                  {selected.roleIds.length ? selected.roleIds.map((roleId) => {
                    const roleName = rolesQuery.data?.find((role) => role.id === roleId)?.name ?? roleId.slice(0, 8);
                    return (
                      <span key={roleId} className="badge text-bg-light d-inline-flex align-items-center gap-1">
                        {roleName}
                        {canManage ? (
                          <button
                            type="button"
                            className="btn-close"
                            aria-label={`Remove ${roleName} role`}
                            title={`Remove ${roleName}`}
                            disabled={roleMutation.isPending}
                            onClick={() => roleMutation.mutate({ userId: selected.id, roleIds: selected.roleIds.filter((id) => id !== roleId) })}
                          />
                        ) : null}
                      </span>
                    );
                  }) : <span className="text-muted">No roles assigned</span>}
                </div>
              </div>
              <div className="small mb-3">
                <div className="fw-semibold mb-1">Assigned regions</div>
                <div className="d-flex flex-wrap gap-1">
                  {selected.regionIds.length ? selected.regionIds.map((regionId) => {
                    const label = regionName(regionId);
                    return (
                      <span key={regionId} className="badge text-bg-light d-inline-flex align-items-center gap-1">
                        {label}
                        {canManage ? (
                          <button
                            type="button"
                            className="btn-close"
                            aria-label={`Remove ${label} region access`}
                            title={`Remove ${label} access`}
                            disabled={regionMutation.isPending}
                            onClick={() => regionMutation.mutate({ userId: selected.id, regionIds: selected.regionIds.filter((id) => id !== regionId) })}
                          />
                        ) : null}
                      </span>
                    );
                  }) : <span className="text-muted">No additional regions</span>}
                </div>
              </div>
              {actionError ? <div className="alert alert-danger py-2" role="alert">{actionError}</div> : null}

              {canManage ? (
                <>
                  <button type="button" className="btn btn-outline-primary btn-sm mb-3" onClick={() => openEdit(selected)}>
                    Edit user details
                  </button>
                  <div className="mb-3">
                    <label className="form-label">Assign role</label>
                    <div className="d-flex gap-2">
                      <div className="flex-grow-1">
                        <TechEarnestPicker
                          value={assignRoleId}
                          onChange={setAssignRoleId}
                          options={roleOptions.filter((option) => !selected.roleIds.includes(option.value))}
                          placeholder="Select a role"
                          searchPlaceholder="Search roles"
                          lookupTitle="Choose a role"
                          lookupMode="modal"
                          menuPlacement="portal"
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-primary"
                        disabled={!assignRoleId || roleMutation.isPending}
                        onClick={() =>
                          roleMutation.mutate({
                            userId: selected.id,
                            roleIds: Array.from(new Set([...selected.roleIds, assignRoleId])),
                          })
                        }
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Assign region access</label>
                    <div className="d-flex gap-2">
                      <div className="flex-grow-1">
                        <TechEarnestPicker
                          value={assignRegionId}
                          onChange={setAssignRegionId}
                          options={regionOptions.filter((option) => !selected.regionIds.includes(option.value))}
                          placeholder="Select a region"
                          searchPlaceholder="Search regions"
                          lookupTitle="Choose a region"
                          lookupMode="modal"
                          menuPlacement="portal"
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-primary"
                        disabled={!assignRegionId || regionMutation.isPending}
                        onClick={() =>
                          regionMutation.mutate({
                            userId: selected.id,
                            regionIds: Array.from(new Set([...selected.regionIds, assignRegionId])),
                          })
                        }
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  {selected.status === "DEACTIVATED" ? (
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      disabled={reactivateMutation.isPending}
                      onClick={() => {
                        setActionError(null);
                        setConfirmReactivate(true);
                      }}
                    >
                      Reactivate user
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      disabled={deactivateMutation.isPending}
                      onClick={() => {
                        setActionError(null);
                        setConfirmDeactivate(true);
                      }}
                    >
                      Deactivate user
                    </button>
                  )}
                  {confirmDeactivate ? (
                    <div className="module-modal-backdrop" role="presentation" onClick={() => deactivateMutation.isPending ? null : setConfirmDeactivate(false)}>
                      <div className="module-modal" role="dialog" aria-modal="true" aria-labelledby="deactivate-user-title" onClick={(event) => event.stopPropagation()}>
                        <div className="module-modal-header">
                          <h2 id="deactivate-user-title" className="h5 mb-0">Deactivate user?</h2>
                          <button type="button" className="btn-close" aria-label="Close" disabled={deactivateMutation.isPending} onClick={() => setConfirmDeactivate(false)} />
                        </div>
                        <div className="module-modal-body">
                          <p className="mb-0">{selected.firstName} {selected.lastName} will lose access to this organization. Their existing CRM records will be retained.</p>
                        </div>
                        <div className="module-modal-footer">
                          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={deactivateMutation.isPending} onClick={() => setConfirmDeactivate(false)}>Cancel</button>
                          <button type="button" className="btn btn-danger btn-sm" disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(selected.id)}>
                            {deactivateMutation.isPending ? "Deactivating…" : "Deactivate user"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {confirmReactivate ? (
                    <div className="module-modal-backdrop" role="presentation" onClick={() => reactivateMutation.isPending ? null : setConfirmReactivate(false)}>
                      <div className="module-modal" role="alertdialog" aria-modal="true" aria-labelledby="reactivate-user-title" onClick={(event) => event.stopPropagation()}>
                        <div className="module-modal-header">
                          <h2 id="reactivate-user-title" className="h5 mb-0">Reactivate user?</h2>
                          <button type="button" className="btn-close" aria-label="Close" disabled={reactivateMutation.isPending} onClick={() => setConfirmReactivate(false)} />
                        </div>
                        <div className="module-modal-body">
                          <p className="mb-0">{selected.firstName} {selected.lastName} will be able to sign in again. Their profile, assigned roles, regions, and CRM records will be retained.</p>
                          {!selected.roleIds.length ? <p className="text-muted small mt-2 mb-0">This user has no roles assigned, so they may still have no application permissions after reactivation.</p> : null}
                        </div>
                        <div className="module-modal-footer">
                          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={reactivateMutation.isPending} onClick={() => setConfirmReactivate(false)}>Cancel</button>
                          <button type="button" className="btn btn-primary btn-sm" disabled={reactivateMutation.isPending} onClick={() => reactivateMutation.mutate(selected)}>
                            {reactivateMutation.isPending ? "Reactivating…" : "Reactivate user"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </aside>
          ) : null}
        </div>
      ) : null}
    </ModuleListShell>
      )}
      {confirmDiscardForm ? (
        <div className="module-modal-backdrop" role="presentation" onClick={() => setConfirmDiscardForm(false)}>
          <section className="module-modal" role="alertdialog" aria-modal="true" aria-labelledby="discard-user-changes-title" onClick={(event) => event.stopPropagation()}>
            <header className="d-flex align-items-center justify-content-between gap-3 mb-3">
              <h2 id="discard-user-changes-title" className="h5 mb-0">Discard changes?</h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={() => setConfirmDiscardForm(false)} />
            </header>
            <p>Your unsaved user changes will be lost.</p>
            <footer className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setConfirmDiscardForm(false)}>Keep editing</button>
              <button type="button" className="btn btn-danger btn-sm" onClick={discardUserFormChanges}>Discard changes</button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
