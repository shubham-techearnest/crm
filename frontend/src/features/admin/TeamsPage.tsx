import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ErrorState } from "@/components/ErrorState/ErrorState";
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
import { useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { useUrlSelection } from "@/hooks/useUrlRecord";
import {
  createTeam,
  getTeam,
  listDepartments,
  listTeams,
  listUsers,
  teamUpdateBody,
  updateTeam,
  type AdminUser,
  type Department,
  type Team,
  type TeamBody,
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
  name: z.string().trim().min(1, "Team name is required").max(128),
  departmentId: z.string().min(1, "Department is required"),
  managerId: z.string().optional(),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  status: z.string().min(1),
  description: z.string().max(2000).optional(),
});
type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = { name: "", departmentId: "", managerId: "", email: "", status: "ACTIVE", description: "" };

function toFormValues(team: Team): FormValues {
  return {
    name: team.name,
    departmentId: team.departmentId,
    managerId: team.managerId ?? "",
    email: team.email ?? "",
    status: team.status ?? "ACTIVE",
    description: team.description ?? "",
  };
}

function toBody(values: FormValues): TeamBody {
  return {
    name: values.name.trim(),
    departmentId: values.departmentId,
    managerId: values.managerId || null,
    email: blankToNull(values.email),
    status: values.status,
    description: blankToNull(values.description),
  };
}

function TeamForm({
  team,
  departments,
  users,
  canViewDepartments,
  onCancel,
  onSaved,
}: {
  team: Team | null;
  departments: Department[];
  users: AdminUser[];
  canViewDepartments: boolean;
  onCancel: () => void;
  onSaved: (team: Team, again: boolean) => void;
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
    defaultValues: team ? toFormValues(team) : DEFAULTS,
  });

  const saveMutation = useMutation({
    mutationFn: ({ values }: { values: FormValues; again: boolean }) =>
      team ? updateTeam(team.id, toBody(values)) : createTeam(toBody(values)),
    onSuccess: (saved, { again }) => {
      setFormError(null);
      if (again) reset(DEFAULTS);
      onSaved(saved, again);
    },
    onError: (error) =>
      setFormError(adminErrorMessage(error, "Could not save the team. Check the selected department and try again.")),
  });

  const submit = (again: boolean) => void handleSubmit((values) => saveMutation.mutate({ values, again }))();

  const departmentOptions = useMemo(
    () =>
      optionsFromPairs(
        departments
          .filter((d) => d.status === "ACTIVE" || d.id === team?.departmentId)
          .map((d) => ({ value: d.id, label: d.name, subtitle: d.code ?? undefined })),
      ),
    [departments, team?.departmentId],
  );

  return (
    <TechEarnestFormKitCreateView
      title={team ? `Edit ${team.name}` : "Create Team"}
      tableCode="team"
      recordId={team?.id}
      entityLabel="Team"
      pending={saveMutation.isPending}
      isDirty={isDirty}
      formError={formError}
      onCancel={() => confirmDiscard(isDirty) && onCancel()}
      onSave={() => submit(false)}
      onSaveAndNew={team ? undefined : () => submit(true)}
      onSubmit={() => submit(false)}
      showRecordImage={false}
    >
      <TechEarnestCreateSection title="Team Information">
        <TechEarnestCreateGrid>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Team Name" required error={errors.name?.message}>
              <input type="text" className={inputClass(errors.name)} {...register("name")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField
              label="Department"
              required
              error={errors.departmentId?.message}
              hint={canViewDepartments ? undefined : "Department access is required to create or edit teams."}
            >
              <TechEarnestFormSelect
                control={control}
                name="departmentId"
                options={departmentOptions}
                placeholder="Select a department"
                searchPlaceholder="Search departments"
                lookupTitle="Choose a department"
                lookupMode="modal"
                allowEmpty={false}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Team Manager">
              <TechEarnestFormUserSelect control={control} name="managerId" users={users} placeholder="No manager" />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Team Email" error={errors.email?.message}>
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

export function TeamsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("TEAM_MANAGE");
  const canViewDepartments = useHasPermission("DEPARTMENT_VIEW");
  const canViewUsers = useHasPermission("USER_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch } = useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const teamsQuery = useQuery({ queryKey: ["admin", "teams", ""], queryFn: () => listTeams() });
  const departmentsQuery = useQuery({
    queryKey: ["admin", "departments"],
    queryFn: listDepartments,
    enabled: canViewDepartments,
    retry: false,
  });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: canViewUsers,
    retry: false,
  });
  const teams = teamsQuery.data ?? [];
  const departments = departmentsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const userLabel = useUserLabel(usersQuery.data);
  const [selected, setSelected] = useUrlSelection(teamsQuery.data, { fetchById: getTeam });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "teams"] });

  const departmentName = useMemo(() => {
    const map = new Map(departments.map((d) => [d.id, d.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "—");
  }, [departments]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((team) => {
      if (statusFilter && (team.status ?? "ACTIVE") !== statusFilter) return false;
      if (departmentFilter && team.departmentId !== departmentFilter) return false;
      if (managerFilter && team.managerId !== managerFilter) return false;
      if (!q) return true;
      return [team.name, team.email ?? "", departmentName(team.departmentId), userLabel(team.managerId)]
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [teams, search, statusFilter, departmentFilter, managerFilter, departmentName, userLabel]);

  const recordNav = useRecordNavigation(rows, selected, (item) => {
    setActionError(null);
    setSelected(item);
  });

  const statusMutation = useMutation({
    mutationFn: ({ team, status }: { team: Team; status: string }) => updateTeam(team.id, teamUpdateBody(team, { status })),
    onSuccess: async (team) => {
      setActionError(null);
      setSelected(team);
      await invalidate();
    },
    onError: (error) => setActionError(adminErrorMessage(error, "Could not change the team status.")),
  });

  const departmentOptions = useMemo(
    () => optionsFromPairs(departments.map((d) => ({ value: d.id, label: d.name }))),
    [departments],
  );
  const userOptions = useMemo(
    () => optionsFromPairs(users.map((u) => ({ value: u.id, label: fullName(u) || u.email, subtitle: u.email }))),
    [users],
  );

  if (formMode && canManage) {
    return (
      <TeamForm
        key={formMode === "edit" ? selected?.id : "new"}
        team={formMode === "edit" ? selected : null}
        departments={departments}
        users={users}
        canViewDepartments={canViewDepartments}
        onCancel={() => setFormMode(null)}
        onSaved={(team, again) => {
          void invalidate();
          if (again) return;
          setFormMode(null);
          setSelected(team);
        }}
      />
    );
  }

  if (selected) {
    const members = users.filter((u) => u.teamId === selected.id);
    return (
      <RecordShell
        layout="page"
        title={selected.name}
        subtitle={departmentName(selected.departmentId)}
        avatarLabel={selected.name}
        status={<StatusBadge status={selected.status ?? "ACTIVE"} />}
        recordKey={selected.id}
        customFieldsTable="team"
        onBack={recordNav.goBack}
        onPrev={recordNav.goPrev}
        onNext={recordNav.goNext}
        hasPrev={recordNav.hasPrev}
        hasNext={recordNav.hasNext}
        relatedLinks={[{ id: "members", label: "Members" }]}
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
                  statusMutation.mutate({ team: selected, status: selected.status === "INACTIVE" ? "ACTIVE" : "INACTIVE" })
                }
              >
                {selected.status === "INACTIVE" ? "Activate" : "Deactivate"}
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
                    {
                      label: "Department",
                      value: <RecordLink module="department" id={selected.departmentId}>{departmentName(selected.departmentId)}</RecordLink>,
                    },
                    { label: "Manager", value: <RecordLink module="user" id={selected.managerId}>{userLabel(selected.managerId)}</RecordLink> },
                    { label: "Members", value: canViewUsers ? members.length : "—" },
                    { label: "Email", value: dash(selected.email) },
                    { label: "Status", value: <StatusBadge status={selected.status ?? "ACTIVE"} /> },
                  ]}
                />
                <TechEarnestRecordInfoSection
                  title="Team Information"
                  fields={[
                    { label: "Team Name", value: selected.name },
                    { label: "Department", value: departmentName(selected.departmentId) },
                    { label: "Team Manager", value: userLabel(selected.managerId) },
                    { label: "Team Email", value: dash(selected.email) },
                    { label: "Status", value: selected.status ?? "ACTIVE" },
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
                  id="techearnest-record-section-members"
                  title={`Members (${members.length})`}
                  isEmpty={!members.length}
                  emptyLabel={canViewUsers ? "No users are assigned to this team" : "You don't have access to users"}
                >
                  <RelatedRecordList
                    module="user"
                    loading={usersQuery.isLoading && canViewUsers}
                    items={members.map((u) => ({
                      id: u.id,
                      label: fullName(u),
                      secondary: u.id === selected.managerId ? "Manager" : (u.jobTitle ?? u.email),
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
            content: <AdminRecordTimeline entityType="TEAM" entityLabel="Team" record={selected} userLabel={userLabel} />,
          },
        ]}
      />
    );
  }

  return (
    <ModuleListShell
      title="Teams"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Teams</span>}
      filterToggle={{ onToggle: () => setFilterOpen((open) => !open) }}
      primaryAction={
        canManage ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setFormMode("create")}>
            Create Team
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Teams by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, department, or manager"
            />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={ACTIVE_STATUS_OPTIONS} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search team statuses" />
          </div>
          {canViewDepartments ? (
            <div className="module-filter-section">
              <TechEarnestFilterSelect label="Department" value={departmentFilter} onChange={setDepartmentFilter} options={departmentOptions} placeholder="All departments" emptyLabel="All departments" searchPlaceholder="Search departments" />
            </div>
          ) : null}
          {canViewUsers ? (
            <div className="module-filter-section">
              <TechEarnestFilterSelect label="Manager" value={managerFilter} onChange={setManagerFilter} options={userOptions} placeholder="Any manager" emptyLabel="Any manager" searchPlaceholder="Search users" />
            </div>
          ) : null}
        </>
      }
      activeFilterCount={[search.trim(), statusFilter, departmentFilter, managerFilter].filter(Boolean).length}
      onClearFilters={() => {
        setSearch("");
        setStatusFilter("");
        setDepartmentFilter("");
        setManagerFilter("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {teamsQuery.isLoading ? <LoadingState label="Loading teams…" /> : null}
      {teamsQuery.isError ? <ErrorState title="Unable to load teams" message="Try again in a moment." /> : null}
      {!teamsQuery.isLoading && !teamsQuery.isError ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <ModuleListTable
              tableCode="team"
              defaultColumns={[
                { field: "name", label: "Team" },
                { field: "departmentId", label: "Department" },
                { field: "managerId", label: "Manager" },
                { field: "email", label: "Email" },
                { field: "status", label: "Status" },
              ]}
              rows={rows}
              rowKey={(team) => team.id}
              onRowClick={(team) => setSelected(team)}
              bulk={{
                noun: "teams",
                exportFileName: "teams",
                onComplete: () => void invalidate(),
                actions: [
                  {
                    id: "activate",
                    label: "Activate",
                    tone: "success",
                    visible: canManage,
                    doneLabel: "activated",
                    applies: (team) => team.status === "INACTIVE",
                    run: (team) => updateTeam(team.id, teamUpdateBody(team, { status: "ACTIVE" })),
                  },
                  {
                    id: "deactivate",
                    label: "Deactivate",
                    tone: "warning",
                    visible: canManage,
                    doneLabel: "deactivated",
                    applies: (team) => team.status !== "INACTIVE",
                    run: (team) => updateTeam(team.id, teamUpdateBody(team, { status: "INACTIVE" })),
                  },
                  {
                    id: "change-manager",
                    label: "Change manager",
                    visible: canManage && canViewUsers,
                    doneLabel: "updated",
                    input: { kind: "select", label: "Manager", options: userOptions },
                    run: (team, managerId) => updateTeam(team.id, teamUpdateBody(team, { managerId })),
                  },
                  {
                    id: "change-department",
                    label: "Move to department",
                    visible: canManage && canViewDepartments,
                    doneLabel: "moved",
                    input: { kind: "select", label: "Department", options: departmentOptions },
                    run: (team, departmentId) => updateTeam(team.id, teamUpdateBody(team, { departmentId })),
                  },
                ],
              }}
              renderCell={(team, field) => {
                if (field === "departmentId") return departmentName(team.departmentId);
                if (field === "managerId") return userLabel(team.managerId);
                if (field === "status") return <StatusBadge status={team.status ?? "ACTIVE"} />;
                const value = (team as unknown as Record<string, unknown>)[field];
                return value == null || value === "" ? "—" : String(value);
              }}
              nameFields={["name"]}
              emptyMessage="No teams found. Create a team to organize department members."
            />
          ) : (
            <div className="module-tile-grid">
              {rows.map((team) => (
                <button key={team.id} type="button" className="module-tile text-start" onClick={() => setSelected(team)}>
                  <div className="tile-title">{team.name}</div>
                  <div className="small text-muted">
                    {departmentName(team.departmentId)} · {team.status ?? "ACTIVE"}
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
