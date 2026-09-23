import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormActions, FormSection, UnsavedGuard } from "@/components/FormKit";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
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
  const [saveAndNew, setSaveAndNew] = useState(false);

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

  const createMutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });
      setFormError(null);
      if (saveAndNew) {
        reset(DEPT_DEFAULTS);
        setSaveAndNew(false);
      } else {
        reset(DEPT_DEFAULTS);
        setShowForm(false);
      }
    },
    onError: () => setFormError("Could not create department."),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (departmentsQuery.data ?? []).filter((department) => {
      if (statusFilter && department.status !== statusFilter) return false;
      if (!q) return true;
      return department.name.toLowerCase().includes(q);
    });
  }, [departmentsQuery.data, search, statusFilter]);

  return (
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
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Add department"}
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
            <h3>Status</h3>
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {showForm ? (
        <form
          className="border-bottom p-3 bg-white"
          onSubmit={handleSubmit((values) => createMutation.mutate({ name: values.name }))}
        >
          <UnsavedGuard when={isDirty && showForm} />
          {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
          <FormSection title="Primary details" description="Department name">
            <div className="col-md-6">
              <FormField label="Name" required error={errors.name} {...register("name")} />
            </div>
          </FormSection>
          <FormActions
            submitLabel="Save"
            showSaveAndNew
            submitting={isSubmitting || createMutation.isPending}
            onSaveAndNew={() => {
              setSaveAndNew(true);
              void handleSubmit((values) => createMutation.mutate({ name: values.name }))();
            }}
            onCancel={() => {
              if (isDirty && !window.confirm("Discard unsaved changes?")) return;
              setShowForm(false);
              reset(DEPT_DEFAULTS);
            }}
          />
        </form>
      ) : null}

      {departmentsQuery.isLoading ? <LoadingState label="Loading departments..." /> : null}
      {departmentsQuery.error ? (
        <ErrorState title="Unable to load departments" message="Try again." />
      ) : null}

      {!departmentsQuery.isLoading && !departmentsQuery.error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <div className="module-list-table-wrap">
              <table className="table module-list-table align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((department) => (
                    <tr key={department.id}>
                      <td className="lead-name">{department.name}</td>
                      <td>
                        <StatusBadge status={department.status} />
                      </td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={2} className="text-center text-muted py-5">
                        No departments match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
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
  );
}
