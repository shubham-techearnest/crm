import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  attachRecordPhoto,
  enumPickerOptions,
  optionsFromPairs,
  TechEarnestCreateColumn,
  TechEarnestCreateField,
  TechEarnestCreateGrid,
  TechEarnestCreateSection,
  TechEarnestFormKitCreateView,
  TechEarnestFormSelect,
  TechEarnestFormUserSelect,
  useTechEarnestRecordPhoto,
} from "@/components/TechEarnestCreate";
import {
  TechEarnestRecordInfoSection,
  TechEarnestRecordRelatedCard,
  TechEarnestRecordSummaryStrip,
  useRecordNavigation,
} from "@/components/TechEarnestRecord";
import { RecordShell } from "@/components/RecordShell";
import { RecordLink, RelatedRecordList } from "@/components/RecordLink";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { TechEarnestFilterSelect } from "@/components/TechEarnestCreate/TechEarnestFilterSelect";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { useUrlSelection } from "@/hooks/useUrlRecord";
import {
  assignUserRegions,
  assignUserRoles,
  createUser,
  deactivateUser,
  getUser,
  listBranches,
  listDepartments,
  listRegions,
  listRoles,
  listTeams,
  listUsers,
  updateUser,
  userUpdateBody,
  USER_STATUSES,
  type AdminUser,
  type Branch,
  type Department,
  type Region,
  type Role,
  type Team,
  type UserUpdateBody,
} from "./adminApi";
import {
  AdminMultiPicker,
  AdminRecordTimeline,
  adminErrorMessage,
  blankToNull,
  confirmDiscard,
  dash,
  formatDate,
  formatDateTime,
  fullName,
  inputClass,
  LOCALE_OPTIONS,
  TIMEZONE_OPTIONS,
  useUserLabel,
  withCurrentOption,
} from "./adminKit";

const statusLabel = (status: string) => status.charAt(0) + status.slice(1).toLowerCase();
const STATUS_OPTIONS = enumPickerOptions(USER_STATUSES, statusLabel);
const CREATE_STATUS_OPTIONS = enumPickerOptions(["ACTIVE", "INVITED"], statusLabel);

const baseSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
  phone: z.string().max(50).optional(),
  mobile: z.string().max(50).optional(),
  jobTitle: z.string().max(128).optional(),
  employeeCode: z.string().max(64).optional(),
  dateOfJoining: z.string().optional(),
  status: z.string().min(1),
  regionId: z.string().optional(),
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  teamId: z.string().optional(),
  managerId: z.string().optional(),
  roleIds: z.array(z.string()),
  regionIds: z.array(z.string()),
  timezone: z.string().optional(),
  locale: z.string().optional(),
});

type FormValues = z.infer<typeof baseSchema>;

const createSchema = baseSchema.superRefine((values, ctx) => {
  if (!values.password || values.password.length < 8) {
    ctx.addIssue({ code: "custom", path: ["password"], message: "Use at least 8 characters" });
  } else if (values.password !== values.confirmPassword) {
    ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords don't match" });
  }
});

const DEFAULTS: FormValues = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
  phone: "",
  mobile: "",
  jobTitle: "",
  employeeCode: "",
  dateOfJoining: "",
  status: "ACTIVE",
  regionId: "",
  branchId: "",
  departmentId: "",
  teamId: "",
  managerId: "",
  roleIds: [],
  regionIds: [],
  timezone: "",
  locale: "",
};

function toFormValues(user: AdminUser): FormValues {
  return {
    ...DEFAULTS,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone ?? "",
    mobile: user.mobile ?? "",
    jobTitle: user.jobTitle ?? "",
    employeeCode: user.employeeCode ?? "",
    dateOfJoining: user.dateOfJoining ?? "",
    status: user.status,
    regionId: user.regionId ?? "",
    branchId: user.branchId ?? "",
    departmentId: user.departmentId ?? "",
    teamId: user.teamId ?? "",
    managerId: user.managerId ?? "",
    roleIds: user.roleIds,
    regionIds: user.regionIds,
    timezone: user.timezone ?? "",
    locale: user.locale ?? "",
  };
}

function toUpdateBody(values: FormValues): UserUpdateBody {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: blankToNull(values.phone),
    mobile: blankToNull(values.mobile),
    jobTitle: blankToNull(values.jobTitle),
    employeeCode: blankToNull(values.employeeCode),
    dateOfJoining: values.dateOfJoining || null,
    status: values.status,
    regionId: values.regionId || null,
    branchId: values.branchId || null,
    departmentId: values.departmentId || null,
    teamId: values.teamId || null,
    managerId: values.managerId || null,
    timezone: values.timezone || null,
    locale: values.locale || null,
  };
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

function UserForm({
  user,
  users,
  roles,
  regions,
  branches,
  departments,
  teams,
  onCancel,
  onSaved,
}: {
  user: AdminUser | null;
  users: AdminUser[];
  roles: Role[];
  regions: Region[];
  branches: Branch[];
  departments: Department[];
  teams: Team[];
  onCancel: () => void;
  onSaved: (user: AdminUser, again: boolean) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const photo = useTechEarnestRecordPhoto();
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(user ? baseSchema : createSchema),
    defaultValues: user ? toFormValues(user) : DEFAULTS,
  });

  const regionId = watch("regionId");
  const departmentId = watch("departmentId");

  const saveMutation = useMutation({
    mutationFn: async ({ values }: { values: FormValues; again: boolean }) => {
      if (!user) {
        const created = await createUser({
          ...toUpdateBody(values),
          email: values.email.trim().toLowerCase(),
          password: values.password ?? "",
          roleIds: values.roleIds,
          regionIds: values.regionIds,
        });
        await attachRecordPhoto("USER", created.id, photo.photoFile);
        return created;
      }
      let saved = await updateUser(user.id, toUpdateBody(values));
      if (!sameSet(values.roleIds, user.roleIds)) saved = await assignUserRoles(user.id, values.roleIds);
      if (!sameSet(values.regionIds, user.regionIds)) saved = await assignUserRegions(user.id, values.regionIds);
      return saved;
    },
    onSuccess: (saved, { again }) => {
      setFormError(null);
      photo.clearPhoto();
      if (again) reset(DEFAULTS);
      onSaved(saved, again);
    },
    onError: (error) =>
      setFormError(
        adminErrorMessage(
          error,
          user
            ? "Could not update the user. Check your access and the required fields."
            : "Could not create the user. The email may already exist.",
        ),
      ),
  });

  const submit = (again: boolean) => void handleSubmit((values) => saveMutation.mutate({ values, again }))();

  const regionOptions = useMemo(
    () => optionsFromPairs(regions.map((r) => ({ value: r.id, label: r.name, subtitle: r.code }))),
    [regions],
  );
  const branchOptions = useMemo(
    () =>
      optionsFromPairs(
        branches
          .filter((b) => !regionId || b.regionId === regionId)
          .map((b) => ({ value: b.id, label: b.name, subtitle: b.address ?? undefined })),
      ),
    [branches, regionId],
  );
  const departmentOptions = useMemo(
    () =>
      optionsFromPairs(
        departments
          .filter((d) => d.status === "ACTIVE" || d.id === user?.departmentId)
          .map((d) => ({ value: d.id, label: d.name, subtitle: d.code ?? undefined })),
      ),
    [departments, user?.departmentId],
  );
  const teamOptions = useMemo(
    () =>
      optionsFromPairs(
        teams
          .filter((t) => !departmentId || t.departmentId === departmentId)
          .map((t) => ({ value: t.id, label: t.name })),
      ),
    [teams, departmentId],
  );
  const roleOptions = useMemo(
    () =>
      optionsFromPairs(
        roles
          .filter((role) => role.code !== "SUPER_ADMIN" || user?.roleIds.includes(role.id))
          .map((role) => ({ value: role.id, label: role.name, subtitle: role.code })),
      ),
    [roles, user?.roleIds],
  );
  const managerUsers = useMemo(
    () => users.filter((u) => u.id !== user?.id && (u.status === "ACTIVE" || u.id === user?.managerId)),
    [users, user?.id, user?.managerId],
  );

  return (
    <TechEarnestFormKitCreateView
      title={user ? `Edit ${fullName(user)}` : "Create User"}
      tableCode="user"
      recordId={user?.id}
      entityLabel="User"
      pending={saveMutation.isPending}
      isDirty={isDirty}
      formError={formError}
      onCancel={() => confirmDiscard(isDirty) && onCancel()}
      onSave={() => submit(false)}
      onSaveAndNew={user ? undefined : () => submit(true)}
      onSubmit={() => submit(false)}
      photo={user ? undefined : photo}
      showRecordImage={!user}
    >
      <TechEarnestCreateSection title="User Information">
        <TechEarnestCreateGrid>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="First Name" required error={errors.firstName?.message}>
              <input type="text" className={inputClass(errors.firstName)} {...register("firstName")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField
              label="Email"
              required
              error={errors.email?.message}
              hint={user ? "The sign-in email can't be changed here." : undefined}
            >
              <input type="email" className={inputClass(errors.email)} disabled={!!user} {...register("email")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Phone" error={errors.phone?.message}>
              <input type="tel" className={inputClass(errors.phone)} {...register("phone")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Job Title" error={errors.jobTitle?.message}>
              <input type="text" className={inputClass(errors.jobTitle)} placeholder="e.g. Sales Manager" {...register("jobTitle")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Date of Joining">
              <input type="date" className={inputClass()} {...register("dateOfJoining")} />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Last Name" required error={errors.lastName?.message}>
              <input type="text" className={inputClass(errors.lastName)} {...register("lastName")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Status" required>
              <TechEarnestFormSelect
                control={control}
                name="status"
                options={user ? STATUS_OPTIONS : CREATE_STATUS_OPTIONS}
                allowEmpty={false}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Mobile" error={errors.mobile?.message}>
              <input type="tel" className={inputClass(errors.mobile)} {...register("mobile")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Employee Code" error={errors.employeeCode?.message}>
              <input type="text" className={inputClass(errors.employeeCode)} placeholder="e.g. EMP-1024" {...register("employeeCode")} />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
        </TechEarnestCreateGrid>
      </TechEarnestCreateSection>

      {!user ? (
        <TechEarnestCreateSection title="Sign-in">
          <TechEarnestCreateGrid>
            <TechEarnestCreateColumn>
              <TechEarnestCreateField label="Password" required error={errors.password?.message} hint="At least 8 characters.">
                <input type="password" autoComplete="new-password" className={inputClass(errors.password)} {...register("password")} />
              </TechEarnestCreateField>
            </TechEarnestCreateColumn>
            <TechEarnestCreateColumn>
              <TechEarnestCreateField label="Confirm Password" required error={errors.confirmPassword?.message}>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={inputClass(errors.confirmPassword)}
                  {...register("confirmPassword")}
                />
              </TechEarnestCreateField>
            </TechEarnestCreateColumn>
          </TechEarnestCreateGrid>
        </TechEarnestCreateSection>
      ) : null}

      <TechEarnestCreateSection title="Organization">
        <TechEarnestCreateGrid>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Home Region">
              <TechEarnestFormSelect
                control={control}
                name="regionId"
                options={regionOptions}
                searchPlaceholder="Search Regions"
                placeholder="Select region"
                onValueChange={(next) => {
                  const branchId = watch("branchId");
                  if (branchId && branches.find((b) => b.id === branchId)?.regionId !== next) setValue("branchId", "");
                }}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Branch">
              <TechEarnestFormSelect
                control={control}
                name="branchId"
                options={branchOptions}
                searchPlaceholder="Search Branches"
                placeholder={branchOptions.length ? "Select branch" : "No branches available"}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Reports To">
              <TechEarnestFormUserSelect control={control} name="managerId" users={managerUsers} placeholder="Select manager" />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Department">
              <TechEarnestFormSelect
                control={control}
                name="departmentId"
                options={departmentOptions}
                searchPlaceholder="Search Departments"
                placeholder="Select department"
                onValueChange={(next) => {
                  const teamId = watch("teamId");
                  if (teamId && teams.find((t) => t.id === teamId)?.departmentId !== next) setValue("teamId", "");
                }}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Team" hint={departmentId ? undefined : "Pick a department to narrow the teams."}>
              <TechEarnestFormSelect
                control={control}
                name="teamId"
                options={teamOptions}
                searchPlaceholder="Search Teams"
                placeholder={teamOptions.length ? "Select team" : "No teams available"}
                onValueChange={(next) => {
                  const team = teams.find((t) => t.id === next);
                  if (team && !watch("departmentId")) setValue("departmentId", team.departmentId, { shouldDirty: true });
                }}
              />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
        </TechEarnestCreateGrid>
      </TechEarnestCreateSection>

      <TechEarnestCreateSection title="Access">
        <TechEarnestCreateGrid>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Roles" hint="Roles decide what the user can see and do.">
              <Controller
                control={control}
                name="roleIds"
                render={({ field }) => (
                  <AdminMultiPicker
                    value={field.value}
                    onChange={field.onChange}
                    options={roleOptions}
                    placeholder="Add role"
                    searchPlaceholder="Search Roles"
                    emptyLabel="No roles assigned"
                  />
                )}
              />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Region Access" hint="Extra regions whose records this user can work with.">
              <Controller
                control={control}
                name="regionIds"
                render={({ field }) => (
                  <AdminMultiPicker
                    value={field.value}
                    onChange={field.onChange}
                    options={regionOptions}
                    placeholder="Add region"
                    searchPlaceholder="Search Regions"
                    emptyLabel="No additional regions"
                  />
                )}
              />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
        </TechEarnestCreateGrid>
      </TechEarnestCreateSection>

      <TechEarnestCreateSection title="Preferences">
        <TechEarnestCreateGrid>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Time Zone" hint="Leave empty to use the organization time zone.">
              <TechEarnestFormSelect
                control={control}
                name="timezone"
                options={withCurrentOption(TIMEZONE_OPTIONS, watch("timezone"))}
                searchPlaceholder="Search Time Zones"
                placeholder="Organization default"
              />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Language" hint="Leave empty to use the organization locale.">
              <TechEarnestFormSelect
                control={control}
                name="locale"
                options={withCurrentOption(LOCALE_OPTIONS, watch("locale"))}
                searchPlaceholder="Search Languages"
                placeholder="Organization default"
              />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
        </TechEarnestCreateGrid>
      </TechEarnestCreateSection>
    </TechEarnestFormKitCreateView>
  );
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const canManage = useHasPermission("USER_MANAGE");
  const canViewTeams = useHasPermission("TEAM_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch } = useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const usersQuery = useQuery({ queryKey: ["admin", "users"], queryFn: () => listUsers() });
  const rolesQuery = useQuery({ queryKey: ["admin", "roles"], queryFn: listRoles, retry: false });
  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions, retry: false });
  const departmentsQuery = useQuery({ queryKey: ["admin", "departments"], queryFn: listDepartments, retry: false });
  const branchesQuery = useQuery({ queryKey: ["admin", "branches"], queryFn: listBranches, retry: false });
  const teamsQuery = useQuery({
    queryKey: ["admin", "teams", ""],
    queryFn: () => listTeams(),
    enabled: canViewTeams,
    retry: false,
  });

  const users = usersQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const regions = regionsQuery.data ?? [];
  const departments = departmentsQuery.data ?? [];
  const branches = branchesQuery.data ?? [];
  const teams = teamsQuery.data ?? [];
  const userLabel = useUserLabel(usersQuery.data);
  const [selected, setSelected] = useUrlSelection(usersQuery.data, { fetchById: getUser });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] });

  const nameLookup = <T extends { id: string; name: string }>(items: T[]) => {
    const map = new Map(items.map((item) => [item.id, item.name]));
    return (id: string | null | undefined) => (id ? (map.get(id) ?? "—") : "—");
  };
  const regionName = useMemo(() => nameLookup(regions), [regions]);
  const departmentName = useMemo(() => nameLookup(departments), [departments]);
  const teamName = useMemo(() => nameLookup(teams), [teams]);
  const branchName = useMemo(() => nameLookup(branches), [branches]);
  const roleName = useMemo(() => nameLookup(roles), [roles]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter && user.status !== statusFilter) return false;
      if (roleFilter && !user.roleIds.includes(roleFilter)) return false;
      if (regionFilter && user.regionId !== regionFilter && !user.regionIds.includes(regionFilter)) return false;
      if (departmentFilter && user.departmentId !== departmentFilter) return false;
      if (!q) return true;
      return [fullName(user), user.email, user.jobTitle ?? "", user.employeeCode ?? "", ...user.roleCodes]
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [users, search, statusFilter, roleFilter, regionFilter, departmentFilter]);

  const recordNav = useRecordNavigation(rows, selected, (item) => {
    setActionError(null);
    setSelected(item);
  });

  const afterAction = async (user: AdminUser) => {
    setActionError(null);
    setSelected(user);
    await refresh();
  };

  const roleMutation = useMutation({
    mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) => assignUserRoles(userId, roleIds),
    onSuccess: afterAction,
    onError: (error) => setActionError(adminErrorMessage(error, "Could not update this user's roles.")),
  });
  const regionMutation = useMutation({
    mutationFn: ({ userId, regionIds }: { userId: string; regionIds: string[] }) => assignUserRegions(userId, regionIds),
    onSuccess: afterAction,
    onError: (error) => setActionError(adminErrorMessage(error, "Could not update this user's region access.")),
  });
  const statusMutation = useMutation({
    mutationFn: (user: AdminUser) =>
      user.status === "DEACTIVATED"
        ? updateUser(user.id, userUpdateBody(user, { status: "ACTIVE" }))
        : deactivateUser(user.id),
    onSuccess: async (user) => {
      if (statusFilter && statusFilter !== user.status) setStatusFilter("");
      await afterAction(user);
    },
    onError: (error) => setActionError(adminErrorMessage(error, "Could not change this user's status.")),
  });

  const roleOptions = useMemo(
    () => optionsFromPairs(roles.map((role) => ({ value: role.id, label: role.name, subtitle: role.code }))),
    [roles],
  );
  const assignableRoleOptions = useMemo(
    () => roleOptions.filter((option) => roles.find((role) => role.id === option.value)?.code !== "SUPER_ADMIN"),
    [roleOptions, roles],
  );
  const regionOptions = useMemo(
    () => optionsFromPairs(regions.map((r) => ({ value: r.id, label: r.name }))),
    [regions],
  );
  const departmentOptions = useMemo(
    () => optionsFromPairs(departments.map((d) => ({ value: d.id, label: d.name }))),
    [departments],
  );

  if (formMode && canManage) {
    return (
      <UserForm
        key={formMode === "edit" ? selected?.id : "new"}
        user={formMode === "edit" ? selected : null}
        users={users}
        roles={roles}
        regions={regions}
        branches={branches}
        departments={departments}
        teams={teams}
        onCancel={() => setFormMode(null)}
        onSaved={(user, again) => {
          void refresh();
          if (again) return;
          setFormMode(null);
          setSelected(user);
        }}
      />
    );
  }

  if (selected) {
    const reports = users.filter((u) => u.managerId === selected.id);
    const isSelf = selected.id === auth.userId;
    const deactivated = selected.status === "DEACTIVATED";
    return (
      <RecordShell
        layout="page"
        title={fullName(selected)}
        subtitle={selected.jobTitle ?? selected.email}
        avatarLabel={fullName(selected)}
        avatarVariant="person"
        status={<StatusBadge status={selected.status} />}
        recordKey={selected.id}
        customFieldsTable="user"
        onBack={recordNav.goBack}
        onPrev={recordNav.goPrev}
        onNext={recordNav.goNext}
        hasPrev={recordNav.hasPrev}
        hasNext={recordNav.hasNext}
        relatedLinks={[
          { id: "roles", label: "Roles" },
          { id: "region-access", label: "Region Access" },
          { id: "reports", label: "Direct Reports" },
        ]}
        primaryAction={
          <a className="btn btn-primary btn-sm" href={`mailto:${selected.email}`}>
            Send Email
          </a>
        }
        secondaryActions={
          canManage ? (
            <>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setFormMode("edit")}>
                Edit
              </button>
              <button
                type="button"
                className={`btn btn-sm ${deactivated ? "btn-outline-success" : "btn-outline-danger"}`}
                disabled={statusMutation.isPending || (isSelf && !deactivated)}
                title={isSelf && !deactivated ? "You can't deactivate your own account" : undefined}
                onClick={() => {
                  const message = deactivated
                    ? `${fullName(selected)} will be able to sign in again. Their roles, regions and records are kept.`
                    : `${fullName(selected)} will lose access to this organization. Their CRM records are kept.`;
                  if (window.confirm(message)) statusMutation.mutate(selected);
                }}
              >
                {deactivated ? "Reactivate" : "Deactivate"}
              </button>
            </>
          ) : null
        }
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <>
                {actionError ? <div className="alert alert-danger py-2 small">{actionError}</div> : null}
                <TechEarnestRecordSummaryStrip
                  fields={[
                    { label: "Email", value: selected.email },
                    { label: "Phone", value: dash(selected.phone ?? selected.mobile) },
                    { label: "Department", value: <RecordLink module="department" id={selected.departmentId}>{departmentName(selected.departmentId)}</RecordLink> },
                    { label: "Reports To", value: <RecordLink module="user" id={selected.managerId}>{userLabel(selected.managerId)}</RecordLink> },
                    { label: "Status", value: <StatusBadge status={selected.status} /> },
                  ]}
                />
                <TechEarnestRecordInfoSection
                  title="User Information"
                  fields={[
                    { label: "First Name", value: selected.firstName },
                    { label: "Last Name", value: selected.lastName },
                    { label: "Email", value: selected.email },
                    { label: "Status", value: selected.status },
                    { label: "Phone", value: dash(selected.phone) },
                    { label: "Mobile", value: dash(selected.mobile) },
                    { label: "Job Title", value: dash(selected.jobTitle) },
                    { label: "Employee Code", value: dash(selected.employeeCode) },
                    { label: "Date of Joining", value: formatDate(selected.dateOfJoining) },
                  ]}
                />
                <TechEarnestRecordInfoSection
                  title="Organization"
                  fields={[
                    { label: "Home Region", value: <RecordLink module="region" id={selected.regionId}>{regionName(selected.regionId)}</RecordLink> },
                    { label: "Branch", value: branchName(selected.branchId) },
                    { label: "Department", value: <RecordLink module="department" id={selected.departmentId}>{departmentName(selected.departmentId)}</RecordLink> },
                    { label: "Team", value: <RecordLink module="team" id={selected.teamId}>{teamName(selected.teamId)}</RecordLink> },
                    { label: "Reports To", value: <RecordLink module="user" id={selected.managerId}>{userLabel(selected.managerId)}</RecordLink> },
                  ]}
                />
                <TechEarnestRecordInfoSection
                  title="Preferences & Activity"
                  fields={[
                    { label: "Time Zone", value: selected.timezone ?? "Organization default" },
                    { label: "Language", value: LOCALE_OPTIONS.find((o) => o.value === selected.locale)?.label ?? selected.locale ?? "Organization default" },
                    { label: "Last Login", value: formatDateTime(selected.lastLoginAt) },
                    { label: "Created", value: formatDateTime(selected.createdAt) },
                    { label: "Modified", value: formatDateTime(selected.updatedAt) },
                  ]}
                />
                <TechEarnestRecordRelatedCard id="techearnest-record-section-roles" title={`Roles (${selected.roleIds.length})`}>
                  <AdminMultiPicker
                    value={selected.roleIds}
                    onChange={(roleIds) => roleMutation.mutate({ userId: selected.id, roleIds })}
                    options={selected.roleIds.some((id) => !assignableRoleOptions.some((o) => o.value === id)) ? roleOptions : assignableRoleOptions}
                    placeholder="Assign role"
                    searchPlaceholder="Search Roles"
                    emptyLabel="No roles assigned"
                    disabled={roleMutation.isPending}
                    readOnly={!canManage}
                  />
                  {selected.roleIds.length ? (
                    <RelatedRecordList
                      module="role"
                      items={selected.roleIds.map((id) => ({
                        id,
                        label: roleName(id),
                        secondary: roles.find((role) => role.id === id)?.dataScope,
                      }))}
                    />
                  ) : null}
                </TechEarnestRecordRelatedCard>
                <TechEarnestRecordRelatedCard id="techearnest-record-section-region-access" title={`Region Access (${selected.regionIds.length})`}>
                  <AdminMultiPicker
                    value={selected.regionIds}
                    onChange={(regionIds) => regionMutation.mutate({ userId: selected.id, regionIds })}
                    options={regionOptions}
                    placeholder="Grant region access"
                    searchPlaceholder="Search Regions"
                    emptyLabel="No additional regions"
                    disabled={regionMutation.isPending}
                    readOnly={!canManage}
                  />
                </TechEarnestRecordRelatedCard>
                <TechEarnestRecordRelatedCard
                  id="techearnest-record-section-reports"
                  title={`Direct Reports (${reports.length})`}
                  isEmpty={!reports.length}
                  emptyLabel="Nobody reports to this user"
                >
                  <RelatedRecordList
                    module="user"
                    items={reports.map((u) => ({
                      id: u.id,
                      label: fullName(u),
                      secondary: u.jobTitle ?? u.email,
                      trailing: <StatusBadge status={u.status} />,
                    }))}
                  />
                </TechEarnestRecordRelatedCard>
              </>
            ),
          },
          {
            id: "timeline",
            label: "Timeline",
            content: <AdminRecordTimeline entityType="USER" entityLabel="User" record={selected} userLabel={userLabel} />,
          },
        ]}
      />
    );
  }

  return (
    <ModuleListShell
      title="Users"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Users</span>}
      filterToggle={{ onToggle: () => setFilterOpen((open) => !open) }}
      primaryAction={
        canManage ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setFormMode("create")}>
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
              placeholder="Name, email, job title, or role"
            />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search user statuses" />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Role" value={roleFilter} onChange={setRoleFilter} options={roleOptions} placeholder="Any role" emptyLabel="Any role" searchPlaceholder="Search roles" />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Region" value={regionFilter} onChange={setRegionFilter} options={regionOptions} placeholder="Any region" emptyLabel="Any region" searchPlaceholder="Search regions" />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Department" value={departmentFilter} onChange={setDepartmentFilter} options={departmentOptions} placeholder="Any department" emptyLabel="Any department" searchPlaceholder="Search departments" />
          </div>
        </>
      }
      activeFilterCount={[search.trim(), statusFilter, roleFilter, regionFilter, departmentFilter].filter(Boolean).length}
      onClearFilters={() => {
        setSearch("");
        setStatusFilter("");
        setRoleFilter("");
        setRegionFilter("");
        setDepartmentFilter("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {usersQuery.isLoading ? <LoadingState label="Loading users..." /> : null}
      {usersQuery.error ? <ErrorState title="Unable to load users" message="Try again." /> : null}

      {!usersQuery.isLoading && !usersQuery.error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <ModuleListTable
              tableCode="user"
              defaultColumns={[
                { field: "firstName", label: "First name" },
                { field: "lastName", label: "Last name" },
                { field: "email", label: "Email" },
                { field: "jobTitle", label: "Job title" },
                { field: "status", label: "Status" },
                { field: "roleCodes", label: "Roles" },
                { field: "regionId", label: "Region" },
                { field: "departmentId", label: "Department" },
              ]}
              rows={rows}
              rowKey={(user) => user.id}
              onRowClick={(user) => setSelected(user)}
              bulk={{
                noun: "users",
                exportFileName: "users",
                rowLabel: (user) => fullName(user) || user.email,
                onComplete: () => void refresh(),
                actions: [
                  {
                    id: "add-role",
                    label: "Add role",
                    visible: canManage,
                    doneLabel: "updated",
                    input: { kind: "select", label: "Role to add", options: assignableRoleOptions },
                    run: (user, roleId) => assignUserRoles(user.id, [...new Set([...user.roleIds, roleId])]),
                  },
                  {
                    id: "remove-role",
                    label: "Remove role",
                    visible: canManage,
                    doneLabel: "updated",
                    input: { kind: "select", label: "Role to remove", options: roleOptions },
                    applies: (user) => user.roleIds.length > 0,
                    run: (user, roleId) => assignUserRoles(user.id, user.roleIds.filter((id) => id !== roleId)),
                  },
                  {
                    id: "add-region",
                    label: "Add region access",
                    visible: canManage,
                    doneLabel: "updated",
                    input: { kind: "select", label: "Region", options: regionOptions },
                    run: (user, regionId) => assignUserRegions(user.id, [...new Set([...user.regionIds, regionId])]),
                  },
                  {
                    id: "change-department",
                    label: "Move to department",
                    visible: canManage,
                    doneLabel: "moved",
                    input: { kind: "select", label: "Department", options: departmentOptions },
                    run: (user, departmentId) => {
                      const teamStays = teams.find((t) => t.id === user.teamId)?.departmentId === departmentId;
                      return updateUser(user.id, userUpdateBody(user, { departmentId, teamId: teamStays ? user.teamId : null }));
                    },
                  },
                  {
                    id: "reactivate",
                    label: "Reactivate",
                    tone: "success",
                    visible: canManage,
                    doneLabel: "reactivated",
                    applies: (user) => user.status === "DEACTIVATED",
                    run: (user) => updateUser(user.id, userUpdateBody(user, { status: "ACTIVE" })),
                  },
                  {
                    id: "deactivate",
                    label: "Deactivate",
                    tone: "danger",
                    visible: canManage,
                    doneLabel: "deactivated",
                    applies: (user) => user.status !== "DEACTIVATED" && user.id !== auth.userId,
                    confirm: "Deactivated users can no longer log in.",
                    run: (user) => deactivateUser(user.id),
                  },
                ],
              }}
              renderCell={(user, field) => {
                if (field === "status") return <StatusBadge status={user.status} />;
                if (field === "roleCodes") return user.roleCodes.join(", ") || "—";
                if (field === "regionId") return regionName(user.regionId);
                if (field === "departmentId") return departmentName(user.departmentId);
                if (field === "teamId") return teamName(user.teamId);
                if (field === "managerId") return userLabel(user.managerId);
                const value = (user as unknown as Record<string, unknown>)[field];
                return value == null || value === "" ? "—" : String(value);
              }}
              nameFields={["firstName", "lastName", "email"]}
              emptyMessage="No users match the current filters."
            />
          ) : (
            <div className="module-tile-grid">
              {rows.map((user) => (
                <button key={user.id} type="button" className="module-tile text-start" onClick={() => setSelected(user)}>
                  <div className="tile-title">{fullName(user)}</div>
                  <div className="small text-muted">
                    {user.jobTitle ? `${user.jobTitle} · ` : ""}
                    {user.email} · {user.status}
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
