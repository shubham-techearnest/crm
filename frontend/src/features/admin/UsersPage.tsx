import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormMoreDetails, FormSection } from "@/components/FormKit";
import {
  optionsFromPairs,
  ZohoFormKitCreateView,
  ZohoFormSelect,
  useZohoCreateFlow,
} from "@/components/ZohoCreate";
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
  const [assignRoleId, setAssignRoleId] = useState("");
  const [assignRegionId, setAssignRegionId] = useState("");

  const usersQuery = useQuery({ queryKey: ["admin", "users"], queryFn: () => listUsers() });
  const rolesQuery = useQuery({ queryKey: ["admin", "roles"], queryFn: listRoles });
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const departmentsQuery = useQuery({ queryKey: ["admin", "departments"], queryFn: listDepartments });

  const {
    register,
    control,
    handleSubmit,
    reset,
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
  } = useZohoCreateFlow({
    defaults: USER_DEFAULTS,
    reset,
    setShowForm,
    setFormError,
    setSelected,
    onResetExtras: () => setShowMore(false),
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
    onSuccess: async (user) => {
      await refresh();
      setFormError(null);
      await afterCreateSuccess(user, "USER");
    },
    onError: () => setFormError("Could not create user. Email may already exist."),
  });

  const onCreateSubmit = (values: FormValues) => {
    createMutation.mutate(buildBody(values));
  };

  function openCreate() {
    reset(USER_DEFAULTS);
    setShowForm(true);
  }

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
            <ZohoFormSelect
              control={control}
              name="regionId"
              options={regionOptions}
              searchPlaceholder="Search Regions"
              placeholder="None"
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Department</label>
            <ZohoFormSelect
              control={control}
              name="departmentId"
              options={departmentOptions}
              searchPlaceholder="Search Departments"
              placeholder="None"
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Initial role</label>
            <ZohoFormSelect
              control={control}
              name="roleId"
              options={roleOptions}
              searchPlaceholder="Search Roles"
              placeholder="None"
            />
          </div>
        </FormSection>
      </FormMoreDetails>
    </>
  );

  return (
    <>
      {showForm && canManage ? (
        <ZohoFormKitCreateView
          title="Create User"
          entityLabel="User"
          pending={isSubmitting || createMutation.isPending}
          isDirty={isDirty}
          formError={formError}
          onCancel={() => cancelCreate(isDirty)}
          onSave={() => void handleSubmit(onCreateSubmit)()}
          onSaveAndNew={() => {
            setSaveAndNew(true);
            void handleSubmit(onCreateSubmit)();
          }}
          onSubmit={() => void handleSubmit(onCreateSubmit)()}
          photo={photo}
        >
          {userFormFields}
        </ZohoFormKitCreateView>
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
      )}
    </>
  );
}
