import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormActions, FormMoreDetails, FormSection, UnsavedGuard } from "@/components/FormKit";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
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
  type AdminUser,
} from "./adminApi";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
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
  const [formError, setFormError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [saveAndNew, setSaveAndNew] = useState(false);
  const [assignRoleId, setAssignRoleId] = useState("");
  const [assignRegionId, setAssignRegionId] = useState("");

  const usersQuery = useQuery({ queryKey: ["admin", "users"], queryFn: () => listUsers() });
  const rolesQuery = useQuery({ queryKey: ["admin", "roles"], queryFn: listRoles });
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const departmentsQuery = useQuery({ queryKey: ["admin", "departments"], queryFn: listDepartments });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: USER_DEFAULTS,
  });

  const buildBody = (values: FormValues) => ({
    email: values.email,
    password: values.password,
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
    mutationFn: createUser,
    onSuccess: async () => {
      await refresh();
      setFormError(null);
      if (saveAndNew) {
        reset(USER_DEFAULTS);
        setSaveAndNew(false);
        setShowMore(false);
      } else {
        reset(USER_DEFAULTS);
        setShowForm(false);
        setShowMore(false);
      }
    },
    onError: () => setFormError("Could not create user. Email may already exist."),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) =>
      assignUserRoles(userId, roleIds),
    onSuccess: async (user) => {
      await refresh();
      setSelected(user);
    },
  });

  const regionMutation = useMutation({
    mutationFn: ({ userId, regionIds }: { userId: string; regionIds: string[] }) =>
      assignUserRegions(userId, regionIds),
    onSuccess: async (user) => {
      await refresh();
      setSelected(user);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: async () => {
      await refresh();
      setSelected(null);
    },
  });

  const regionName = useMemo(() => {
    const map = new Map((regionsQuery.data ?? []).map((region) => [region.id, region.name]));
    return (id: string | null) => (id ? (map.get(id) ?? id.slice(0, 8)) : "—");
  }, [regionsQuery.data]);

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

  return (
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
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Add user"}
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
            <h3>Status</h3>
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INVITED">INVITED</option>
              <option value="DEACTIVATED">DEACTIVATED</option>
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
          <FormSection title="Primary details" description="Identity and login">
            <div className="col-md-3">
              <FormField label="First name" required error={errors.firstName} {...register("firstName")} />
            </div>
            <div className="col-md-3">
              <FormField label="Last name" required error={errors.lastName} {...register("lastName")} />
            </div>
            <div className="col-md-3">
              <FormField label="Email" type="email" required error={errors.email} {...register("email")} />
            </div>
            <div className="col-md-3">
              <FormField
                label="Password"
                type="password"
                required
                error={errors.password}
                {...register("password")}
              />
            </div>
          </FormSection>
          <FormMoreDetails open={showMore} onToggle={() => setShowMore((v) => !v)}>
            <FormSection title="Org placement">
              <div className="col-md-3">
                <FormField label="Phone" error={errors.phone} {...register("phone")} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Region</label>
                <select className="form-select" {...register("regionId")}>
                  <option value="">None</option>
                  {(regionsQuery.data ?? []).map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Department</label>
                <select className="form-select" {...register("departmentId")}>
                  <option value="">None</option>
                  {(departmentsQuery.data ?? []).map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Initial role</label>
                <select className="form-select" {...register("roleId")}>
                  <option value="">None</option>
                  {(rolesQuery.data ?? [])
                    .filter((role) => role.code !== "SUPER_ADMIN")
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                </select>
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
              reset(USER_DEFAULTS);
            }}
          />
        </form>
      ) : null}

      {usersQuery.isLoading ? <LoadingState label="Loading users..." /> : null}
      {usersQuery.error ? <ErrorState title="Unable to load users" message="Try again." /> : null}

      {!usersQuery.isLoading && !usersQuery.error ? (
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
                    <th>Email</th>
                    <th>Status</th>
                    <th>Roles</th>
                    <th>Region</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((user) => (
                    <tr
                      key={user.id}
                      className={selected?.id === user.id ? "is-selected" : undefined}
                      onClick={() => setSelected(user)}
                    >
                      <td className="lead-name">
                        {user.firstName} {user.lastName}
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <StatusBadge status={user.status} />
                      </td>
                      <td>{user.roleCodes.join(", ") || "—"}</td>
                      <td>{regionName(user.regionId)}</td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-5">
                        No users match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
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
              <p className="small mb-2">
                Roles: <strong>{selected.roleCodes.join(", ") || "None"}</strong>
              </p>
              <p className="small mb-3">
                Assigned regions:{" "}
                <strong>{selected.regionIds.map((id) => regionName(id)).join(", ") || "None"}</strong>
              </p>

              {canManage ? (
                <>
                  <div className="mb-3">
                    <label className="form-label">Assign role</label>
                    <div className="input-group input-group-sm">
                      <select
                        className="form-select"
                        value={assignRoleId}
                        onChange={(e) => setAssignRoleId(e.target.value)}
                      >
                        <option value="">Select role</option>
                        {(rolesQuery.data ?? [])
                          .filter((role) => role.code !== "SUPER_ADMIN")
                          .map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                      </select>
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
                    <div className="input-group input-group-sm">
                      <select
                        className="form-select"
                        value={assignRegionId}
                        onChange={(e) => setAssignRegionId(e.target.value)}
                      >
                        <option value="">Select region</option>
                        {(regionsQuery.data ?? []).map((region) => (
                          <option key={region.id} value={region.id}>
                            {region.name}
                          </option>
                        ))}
                      </select>
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
                  {selected.status !== "DEACTIVATED" ? (
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      disabled={deactivateMutation.isPending}
                      onClick={() => deactivateMutation.mutate(selected.id)}
                    >
                      Deactivate user
                    </button>
                  ) : null}
                </>
              ) : null}
            </aside>
          ) : null}
        </div>
      ) : null}
    </ModuleListShell>
  );
}
