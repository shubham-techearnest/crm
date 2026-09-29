import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { FormField } from "@/components/FormField/FormField";
import { FormSection } from "@/components/FormKit";
import { optionsFromPairs, TechEarnestFormKitCreateView, TechEarnestPicker } from "@/components/TechEarnestCreate";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { listDepartments, listUsers, createTeam, listTeams, updateTeam, type Team } from "./adminApi";

const schema = z.object({
  name: z.string().trim().min(1, "Team name is required"),
  departmentId: z.string().min(1, "Department is required"),
  managerId: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;
const EMPTY: FormValues = { name: "", departmentId: "", managerId: "" };

export function TeamsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("TEAM_MANAGE");
  const canViewDepartments = useHasPermission("DEPARTMENT_VIEW");
  const canViewUsers = useHasPermission("USER_VIEW");
  const { search, setSearch, showForm, setShowForm } = useModuleWorkspace();
  const [editing, setEditing] = useState<Team | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveAndNew, setSaveAndNew] = useState(false);
  const teamsQuery = useQuery({ queryKey: ["admin", "teams", search], queryFn: () => listTeams(search) });
  const departmentsQuery = useQuery({ queryKey: ["admin", "departments"], queryFn: listDepartments, enabled: canManage && canViewDepartments });
  const usersQuery = useQuery({ queryKey: ["admin", "users", "team-manager-options"], queryFn: () => listUsers(), enabled: canManage && canViewUsers });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const departmentOptions = useMemo(
    () => optionsFromPairs((departmentsQuery.data ?? []).map((department) => ({ value: department.id, label: department.name }))),
    [departmentsQuery.data],
  );
  const managerOptions = useMemo(
    () => optionsFromPairs((usersQuery.data ?? []).map((user) => ({
      value: user.id,
      label: `${user.firstName} ${user.lastName}`.trim(),
      subtitle: user.email,
    }))),
    [usersQuery.data],
  );

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => editing
      ? updateTeam(editing.id, { name: values.name, departmentId: values.departmentId, managerId: values.managerId || null })
      : createTeam({ name: values.name, departmentId: values.departmentId, managerId: values.managerId || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "teams"] });
      setFormError(null);
      if (saveAndNew && !editing) {
        form.reset(EMPTY);
        setShowForm(true);
      } else {
        setShowForm(false);
        setEditing(null);
        form.reset(EMPTY);
      }
      setSaveAndNew(false);
    },
    onError: () => setFormError("Could not save team. Check the selected department and try again."),
  });

  const rows = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data]);
  const departmentName = (id: string) => departmentsQuery.data?.find((department) => department.id === id)?.name ?? "Department";
  const managerName = (id: string | null) => {
    if (!id) return "—";
    const manager = usersQuery.data?.find((user) => user.id === id);
    return manager ? `${manager.firstName} ${manager.lastName}`.trim() : "Assigned user";
  };
  function openCreate() {
    setEditing(null);
    setFormError(null);
    form.reset(EMPTY);
    setShowForm(true);
  }
  function openEdit(team: Team) {
    setEditing(team);
    setFormError(null);
    form.reset({ name: team.name, departmentId: team.departmentId, managerId: team.managerId ?? "" });
    setShowForm(true);
  }

  return showForm && canManage ? (
    <TechEarnestFormKitCreateView
      title={editing ? "Edit Team" : "Create Team"}
      entityLabel="Team"
      pending={form.formState.isSubmitting || saveMutation.isPending}
      isDirty={form.formState.isDirty}
      formError={formError}
      onCancel={() => { setShowForm(false); setEditing(null); form.reset(EMPTY); }}
      onSave={() => void form.handleSubmit((values) => saveMutation.mutateAsync(values))()}
      onSaveAndNew={() => { setSaveAndNew(true); void form.handleSubmit((values) => saveMutation.mutateAsync(values))(); }}
      onSubmit={() => void form.handleSubmit((values) => saveMutation.mutateAsync(values))()}
      showRecordImage={false}
    >
      <FormSection title="Team details" description="Set the team name, department, and manager.">
        <div className="col-md-6">
          <FormField label="Team name" required error={form.formState.errors.name} {...form.register("name")} />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="team-department">Department <span className="text-danger">*</span></label>
          <TechEarnestPicker
            id="team-department"
            value={form.watch("departmentId")}
            onChange={(value) => void form.setValue("departmentId", value, { shouldValidate: true, shouldDirty: true })}
            options={departmentOptions}
            placeholder="Select a department"
            searchPlaceholder="Search departments"
            lookupTitle="Choose a department"
            lookupMode="modal"
            menuPlacement="portal"
            allowEmpty={false}
            invalid={!!form.formState.errors.departmentId}
          />
          {form.formState.errors.departmentId ? <div className="invalid-feedback d-block">{form.formState.errors.departmentId.message}</div> : null}
          {!canViewDepartments ? <small className="text-muted">Department access is required to create or edit teams.</small> : null}
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="team-manager">Manager</label>
          <TechEarnestPicker
            id="team-manager"
            value={form.watch("managerId") ?? ""}
            onChange={(value) => void form.setValue("managerId", value, { shouldDirty: true })}
            options={managerOptions}
            placeholder="No manager"
            searchPlaceholder="Search users"
            lookupTitle="Choose a manager"
            lookupMode="modal"
            menuPlacement="portal"
            allowEmpty
            emptyLabel="No manager"
            mode="user"
          />
        </div>
      </FormSection>
    </TechEarnestFormKitCreateView>
  ) : (
    <ModuleListShell
      title="Teams"
      filterOpen={false}
      toolbarSearch={{ value: search, onChange: setSearch, placeholder: "Search teams…" }}
      primaryAction={canManage ? <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>Create Team</button> : null}
      footerLeft={<span>Total teams: {rows.length}</span>}
    >
      {teamsQuery.isLoading ? <LoadingState label="Loading teams…" /> : null}
      {teamsQuery.isError ? <ErrorState title="Unable to load teams" message="Try again in a moment." /> : null}
      {!teamsQuery.isLoading && !teamsQuery.isError ? (
        <ModuleListTable
          tableCode="team"
          enabled={false}
          defaultColumns={[
            { field: "name", label: "Team" },
            { field: "departmentId", label: "Department" },
            { field: "managerId", label: "Manager" },
          ]}
          rows={rows}
          rowKey={(team) => team.id}
          renderCell={(team, field) => {
            if (field === "departmentId") return departmentName(team.departmentId);
            if (field === "managerId") return managerName(team.managerId);
            const value = (team as unknown as Record<string, unknown>)[field];
            return value == null || value === "" ? "—" : String(value);
          }}
          nameFields={["name"]}
          trailingColumn={canManage ? {
            header: "Actions",
            stopPropagation: true,
            render: (team) => <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => openEdit(team)}>Edit</button>,
          } : undefined}
          emptyMessage="No teams found. Create a team to organize department members."
        />
      ) : null}
    </ModuleListShell>
  );
}
