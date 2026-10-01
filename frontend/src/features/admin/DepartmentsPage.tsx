import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  optionsFromPairs,
  TechEarnestCreateColumn,
  TechEarnestCreateField,
  TechEarnestCreateGrid,
  TechEarnestCreateSection,
  TechEarnestFormKitCreateView,
  TechEarnestFormSelect,
  TechEarnestFormUserSelect,
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
import { useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { useUrlSelection } from "@/hooks/useUrlRecord";
import {
  createDepartment,
  departmentUpdateBody,
  getDepartment,
  listBranches,
  listDepartments,
  listTeams,
  listUsers,
  updateDepartment,
  type AdminUser,
  type Branch,
  type Department,
  type DepartmentBody,
} from "./adminApi";
import {
  ACTIVE_STATUS_OPTIONS,
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

const schema = z.object({
  name: z.string().trim().min(1, "Department name is required").max(128),
  code: z
    .string()
    .trim()
    .max(32)
    .refine((value) => !value || /^[A-Za-z0-9_-]+$/.test(value), "Use letters, numbers, - or _")
    .optional(),
  branchId: z.string().optional(),
  headId: z.string().optional(),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  status: z.string().min(1),
  description: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  name: "",
  code: "",
  branchId: "",
  headId: "",
  email: "",
  status: "ACTIVE",
  description: "",
};

function toFormValues(department: Department): FormValues {
  return {
    name: department.name,
    code: department.code ?? "",
    branchId: department.branchId ?? "",
    headId: department.headId ?? "",
    email: department.email ?? "",
    status: department.status,
    description: department.description ?? "",
  };
}

function toBody(values: FormValues): DepartmentBody {
  return {
    name: values.name.trim(),
    code: values.code ? values.code.trim().toUpperCase() || null : null,
    branchId: values.branchId || null,
    headId: values.headId || null,
    email: blankToNull(values.email),
    status: values.status,
    description: blankToNull(values.description),
  };
}

function DepartmentForm({
  department,
  branches,
  users,
  onCancel,
  onSaved,
}: {
  department: Department | null;
  branches: Branch[];
  users: AdminUser[];
  onCancel: () => void;
  onSaved: (department: Department, again: boolean) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: department ? toFormValues(department) : DEFAULTS,
  });

  const saveMutation = useMutation({
    mutationFn: ({ values }: { values: FormValues; again: boolean }) =>
      department ? updateDepartment(department.id, toBody(values)) : createDepartment(toBody(values)),
    onSuccess: (saved, { again }) => {
      setFormError(null);
      if (again) reset(DEFAULTS);
      onSaved(saved, again);
    },
    onError: (error) =>
      setFormError(adminErrorMessage(error, department ? "Could not update the department." : "Could not create the department.")),
  });

  const submit = (again: boolean) => void handleSubmit((values) => saveMutation.mutate({ values, again }))();

  const branchOptions = useMemo(
    () => optionsFromPairs(branches.map((b) => ({ value: b.id, label: b.name, subtitle: b.address ?? undefined }))),
    [branches],
  );

  return (
    <TechEarnestFormKitCreateView
      title={department ? `Edit ${department.name}` : "Create Department"}
      tableCode="department"
      recordId={department?.id}
      entityLabel="Department"
      pending={saveMutation.isPending}
      isDirty={isDirty}
      formError={formError}
      onCancel={() => confirmDiscard(isDirty) && onCancel()}
      onSave={() => submit(false)}
      onSaveAndNew={department ? undefined : () => submit(true)}
      onSubmit={() => submit(false)}
      showRecordImage={false}
    >
      <TechEarnestCreateSection title="Department Information">
        <TechEarnestCreateGrid>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Department Name" required error={errors.name?.message}>
              <input type="text" className={inputClass(errors.name)} {...register("name")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Department Code" error={errors.code?.message} hint="Optional short code, e.g. ENG">
              <input
                type="text"
                className={inputClass(errors.code)}
                style={{ textTransform: "uppercase" }}
                {...register("code")}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Branch">
              <TechEarnestFormSelect
                control={control}
                name="branchId"
                options={branchOptions}
                searchPlaceholder="Search Branches"
                placeholder={branches.length ? "Select branch" : "No branches available"}
              />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Department Head">
              <TechEarnestFormUserSelect control={control} name="headId" users={users} placeholder="Select head" />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Email" error={errors.email?.message}>
              <input type="email" className={inputClass(errors.email)} placeholder="team@company.com" {...register("email")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Status" required>
              <TechEarnestFormSelect control={control} name="status" options={ACTIVE_STATUS_OPTIONS} allowEmpty={false} />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
        </TechEarnestCreateGrid>
      </TechEarnestCreateSection>

      <TechEarnestCreateSection title="Description Information">
        <TechEarnestCreateField label="Description" wide error={errors.description?.message}>
          <textarea className={inputClass(errors.description)} rows={3} {...register("description")} />
        </TechEarnestCreateField>
      </TechEarnestCreateSection>
    </TechEarnestFormKitCreateView>
  );
}

export function DepartmentsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("DEPARTMENT_MANAGE");
  const canViewUsers = useHasPermission("USER_VIEW");
  const canViewTeams = useHasPermission("TEAM_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch } = useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const departmentsQuery = useQuery({ queryKey: ["admin", "departments"], queryFn: listDepartments });
  const branchesQuery = useQuery({ queryKey: ["admin", "branches"], queryFn: listBranches, retry: false });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: canViewUsers,
    retry: false,
  });
  const teamsQuery = useQuery({
    queryKey: ["admin", "teams", ""],
    queryFn: () => listTeams(),
    enabled: canViewTeams,
    retry: false,
  });
  const departments = departmentsQuery.data ?? [];
  const branches = branchesQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const userLabel = useUserLabel(usersQuery.data);
  const [selected, setSelected] = useUrlSelection(departmentsQuery.data, { fetchById: getDepartment });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });

  const branchName = useMemo(() => {
    const map = new Map(branches.map((b) => [b.id, b.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "—");
  }, [branches]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return departments.filter((department) => {
      if (statusFilter && department.status !== statusFilter) return false;
      if (branchFilter && department.branchId !== branchFilter) return false;
      if (!q) return true;
      return [department.name, department.code ?? "", department.email ?? "", branchName(department.branchId)]
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [departments, search, statusFilter, branchFilter, branchName]);

  const recordNav = useRecordNavigation(rows, selected, (item) => {
    setActionError(null);
    setSelected(item);
  });

  const statusMutation = useMutation({
    mutationFn: ({ department, status }: { department: Department; status: string }) =>
      updateDepartment(department.id, departmentUpdateBody(department, { status })),
    onSuccess: async (department) => {
      setActionError(null);
      setSelected(department);
      await invalidate();
    },
    onError: (error) => setActionError(adminErrorMessage(error, "Could not change the department status.")),
  });

  const branchOptions = useMemo(
    () => optionsFromPairs(branches.map((b) => ({ value: b.id, label: b.name }))),
    [branches],
  );

  if (formMode && canManage) {
    return (
      <DepartmentForm
        key={formMode === "edit" ? selected?.id : "new"}
        department={formMode === "edit" ? selected : null}
        branches={branches}
        users={users}
        onCancel={() => setFormMode(null)}
        onSaved={(department, again) => {
          void invalidate();
          if (again) return;
          setFormMode(null);
          setSelected(department);
        }}
      />
    );
  }

  if (selected) {
    const teams = (teamsQuery.data ?? []).filter((t) => t.departmentId === selected.id);
    const members = users.filter((u) => u.departmentId === selected.id);
    return (
      <RecordShell
        layout="page"
        title={selected.name}
        subtitle={selected.code ?? undefined}
        avatarLabel={selected.name}
        avatarVariant="building"
        status={<StatusBadge status={selected.status} />}
        recordKey={selected.id}
        customFieldsTable="department"
        onBack={recordNav.goBack}
        onPrev={recordNav.goPrev}
        onNext={recordNav.goNext}
        hasPrev={recordNav.hasPrev}
        hasNext={recordNav.hasNext}
        relatedLinks={[
          { id: "teams", label: "Teams" },
          { id: "users", label: "Users" },
        ]}
        primaryAction={
          canManage ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setFormMode("edit")}>
              Edit
            </button>
          ) : null
        }
        secondaryActions={
          <>
            {selected.email ? (
              <a className="btn btn-outline-secondary btn-sm" href={`mailto:${selected.email}`}>
                Send Email
              </a>
            ) : null}
            {canManage ? (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate({
                    department: selected,
                    status: selected.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                  })
                }
              >
                {selected.status === "ACTIVE" ? "Deactivate" : "Activate"}
              </button>
            ) : null}
          </>
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
                    { label: "Department Head", value: <RecordLink module="user" id={selected.headId}>{userLabel(selected.headId)}</RecordLink> },
                    { label: "Branch", value: branchName(selected.branchId) },
                    { label: "Teams", value: canViewTeams ? teams.length : "—" },
                    { label: "Users", value: canViewUsers ? members.length : "—" },
                    { label: "Status", value: <StatusBadge status={selected.status} /> },
                  ]}
                />
                <TechEarnestRecordInfoSection
                  title="Department Information"
                  fields={[
                    { label: "Department Name", value: selected.name },
                    { label: "Department Code", value: dash(selected.code) },
                    { label: "Branch", value: branchName(selected.branchId) },
                    { label: "Department Head", value: userLabel(selected.headId) },
                    { label: "Email", value: dash(selected.email) },
                    { label: "Status", value: selected.status },
                    { label: "Created", value: formatDateTime(selected.createdAt) },
                    { label: "Modified", value: formatDateTime(selected.updatedAt) },
                  ]}
                />
                {selected.description ? (
                  <TechEarnestRecordInfoSection
                    title="Description Information"
                    collapsible={false}
                    fields={[{ label: "Description", value: selected.description }]}
                  />
                ) : null}
                <TechEarnestRecordRelatedCard
                  id="techearnest-record-section-teams"
                  title={`Teams (${teams.length})`}
                  isEmpty={!teams.length}
                  emptyLabel={canViewTeams ? "No teams in this department" : "You don't have access to teams"}
                >
                  <RelatedRecordList
                    module="team"
                    loading={teamsQuery.isLoading && canViewTeams}
                    items={teams.map((t) => ({
                      id: t.id,
                      label: t.name,
                      secondary: t.managerId ? `Manager: ${userLabel(t.managerId)}` : undefined,
                      trailing: <StatusBadge status={t.status} />,
                    }))}
                  />
                </TechEarnestRecordRelatedCard>
                <TechEarnestRecordRelatedCard
                  id="techearnest-record-section-users"
                  title={`Users (${members.length})`}
                  isEmpty={!members.length}
                  emptyLabel={canViewUsers ? "No users in this department" : "You don't have access to users"}
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
              </>
            ),
          },
          {
            id: "timeline",
            label: "Timeline",
            content: (
              <AdminRecordTimeline entityType="DEPARTMENT" entityLabel="Department" record={selected} userLabel={userLabel} />
            ),
          },
        ]}
      />
    );
  }

  return (
    <ModuleListShell
      title="Departments"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Departments</span>}
      filterToggle={{ onToggle: () => setFilterOpen((open) => !open) }}
      primaryAction={
        canManage ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setFormMode("create")}>
            Add department
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Departments by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, code, email, or branch"
            />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={ACTIVE_STATUS_OPTIONS} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search department statuses" />
          </div>
          {branches.length ? (
            <div className="module-filter-section">
              <TechEarnestFilterSelect label="Branch" value={branchFilter} onChange={setBranchFilter} options={branchOptions} placeholder="All branches" emptyLabel="All branches" searchPlaceholder="Search branches" />
            </div>
          ) : null}
        </>
      }
      activeFilterCount={[search.trim(), statusFilter, branchFilter].filter(Boolean).length}
      onClearFilters={() => {
        setSearch("");
        setStatusFilter("");
        setBranchFilter("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {departmentsQuery.isLoading ? <LoadingState label="Loading departments..." /> : null}
      {departmentsQuery.error ? <ErrorState title="Unable to load departments" message="Try again." /> : null}

      {!departmentsQuery.isLoading && !departmentsQuery.error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <ModuleListTable
              tableCode="department"
              defaultColumns={[
                { field: "name", label: "Name" },
                { field: "code", label: "Code" },
                { field: "headId", label: "Head" },
                { field: "branchId", label: "Branch" },
                { field: "email", label: "Email" },
                { field: "status", label: "Status" },
              ]}
              rows={rows}
              rowKey={(department) => department.id}
              onRowClick={(department) => setSelected(department)}
              bulk={{
                noun: "departments",
                exportFileName: "departments",
                onComplete: () => void invalidate(),
                actions: [
                  {
                    id: "activate",
                    label: "Activate",
                    tone: "success",
                    visible: canManage,
                    doneLabel: "activated",
                    applies: (department) => department.status !== "ACTIVE",
                    run: (department) => updateDepartment(department.id, departmentUpdateBody(department, { status: "ACTIVE" })),
                  },
                  {
                    id: "deactivate",
                    label: "Deactivate",
                    tone: "warning",
                    visible: canManage,
                    doneLabel: "deactivated",
                    applies: (department) => department.status === "ACTIVE",
                    run: (department) => updateDepartment(department.id, departmentUpdateBody(department, { status: "INACTIVE" })),
                  },
                ],
              }}
              renderCell={(department, field) => {
                if (field === "status") return <StatusBadge status={department.status} />;
                if (field === "code") return department.code ? <code>{department.code}</code> : "—";
                if (field === "headId") return userLabel(department.headId);
                if (field === "branchId") return branchName(department.branchId);
                const value = (department as unknown as Record<string, unknown>)[field];
                return value == null || value === "" ? "—" : String(value);
              }}
              nameFields={["name"]}
              emptyMessage="No departments match the current filters."
            />
          ) : (
            <div className="module-tile-grid">
              {rows.map((department) => (
                <button key={department.id} type="button" className="module-tile text-start" onClick={() => setSelected(department)}>
                  <div className="tile-title">{department.name}</div>
                  <div className="small text-muted">
                    {[department.code, department.status].filter(Boolean).join(" · ")}
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
