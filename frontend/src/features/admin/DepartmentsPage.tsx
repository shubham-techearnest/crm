import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  TechEarnestCreateColumn,
  TechEarnestCreateField,
  TechEarnestCreateGrid,
  TechEarnestCreateSection,
  TechEarnestFormKitCreateView,
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
import { createDepartment, listDepartments } from "./adminApi";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
});

type FormValues = z.infer<typeof schema>;

const DEPT_DEFAULTS: FormValues = { name: "" };

export function DepartmentsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("DEPARTMENT_MANAGE");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const departmentsQuery = useQuery({ queryKey: ["admin", "departments"], queryFn: listDepartments });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEPT_DEFAULTS,
  });

  const {
    setSaveAndNew,
    cancelCreate,
    afterCreateSuccess,
  } = useTechEarnestCreateFlow({
    defaults: DEPT_DEFAULTS,
    reset,
    setShowForm,
    setFormError,
  });

  const createMutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: async (department) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });
      setFormError(null);
      await afterCreateSuccess(department, "DEPARTMENT");
    },
    onError: () => setFormError("Could not create department."),
  });

  const onCreateSubmit = (values: FormValues) => {
    createMutation.mutate({ name: values.name });
  };

  function openCreate() {
    reset(DEPT_DEFAULTS);
    setShowForm(true);
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (departmentsQuery.data ?? []).filter((department) => {
      if (statusFilter && department.status !== statusFilter) return false;
      if (!q) return true;
      return department.name.toLowerCase().includes(q);
    });
  }, [departmentsQuery.data, search, statusFilter]);

  const departmentFormFields = (
    <TechEarnestCreateSection title="Department Information">
      <TechEarnestCreateGrid>
        <TechEarnestCreateColumn>
          <TechEarnestCreateField label="Department Name" required error={errors.name?.message}>
            <input
              type="text"
              className={`form-control form-control-sm${errors.name ? " is-invalid" : ""}`}
              {...register("name")}
            />
          </TechEarnestCreateField>
        </TechEarnestCreateColumn>
      </TechEarnestCreateGrid>
    </TechEarnestCreateSection>
  );

  return (
    <>
      {showForm && canManage ? (
        <TechEarnestFormKitCreateView
          title="Create Department"
          entityLabel="Department"
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
          showRecordImage={false}
        >
          {departmentFormFields}
        </TechEarnestFormKitCreateView>
      ) : (
    <ModuleListShell
      title="Departments"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Departments</span>}
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
              placeholder="Name"
            />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search department statuses" />
          </div>
        </>
      }
      activeFilterCount={[search.trim(), statusFilter].filter(Boolean).length}
      onClearFilters={() => {
        setSearch("");
        setStatusFilter("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {departmentsQuery.isLoading ? <LoadingState label="Loading departments..." /> : null}
      {departmentsQuery.error ? (
        <ErrorState title="Unable to load departments" message="Try again." />
      ) : null}

      {!departmentsQuery.isLoading && !departmentsQuery.error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <ModuleListTable
              tableCode="department"
              defaultColumns={[
                { field: "name", label: "Name" },
                { field: "status", label: "Status" },
              ]}
              rows={rows}
              rowKey={(department) => department.id}
              renderCell={(department, field) => {
                if (field === "status") return <StatusBadge status={department.status} />;
                const value = (department as unknown as Record<string, unknown>)[field];
                return value == null || value === "" ? "—" : String(value);
              }}
              nameFields={["name"]}
              emptyMessage="No departments match the current filters."
            />
          ) : (
            <div className="module-tile-grid">
              {rows.map((department) => (
                <div key={department.id} className="module-tile text-start">
                  <div className="tile-title">{department.name}</div>
                  <div className="small text-muted">{department.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </ModuleListShell>
      )}
    </>
  );
}
