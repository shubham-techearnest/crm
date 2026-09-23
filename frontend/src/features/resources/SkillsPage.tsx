import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormActions, FormMoreDetails, FormSection, UnsavedGuard } from "@/components/FormKit";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { createSkill, listSkills } from "./resourceApi";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(128),
  category: z.string().max(64).optional(),
});

type FormValues = z.infer<typeof schema>;

const SKILL_DEFAULTS: FormValues = { name: "", category: "" };

export function SkillsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("SKILL_MANAGE");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch, showForm, setShowForm } =
    useModuleWorkspace();
  const [nameFilter, setNameFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [saveAndNew, setSaveAndNew] = useState(false);

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      name: nameFilter || undefined,
      category: categoryFilter || undefined,
    }),
    [search, nameFilter, categoryFilter],
  );

  const skillsQuery = useQuery({
    queryKey: ["skills", listParams],
    queryFn: () => listSkills(listParams),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: SKILL_DEFAULTS,
  });

  const buildBody = (values: FormValues) => ({
    name: values.name,
    category: values.category || undefined,
  });

  const createMutation = useMutation({
    mutationFn: createSkill,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["skills"] });
      setFormError(null);
      if (saveAndNew) {
        reset(SKILL_DEFAULTS);
        setSaveAndNew(false);
        setShowMore(false);
      } else {
        reset(SKILL_DEFAULTS);
        setShowForm(false);
        setShowMore(false);
      }
    },
    onError: () => setFormError("Could not create skill. Check the name is unique."),
  });

  const rows = skillsQuery.data ?? [];
  const activeFilterCount = [search, nameFilter, categoryFilter].filter(Boolean).length;

  return (
    <ModuleListShell
      title="Skills"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Skills</span>}
      toolbarActions={
        <button
          type="button"
          className={`btn btn-sm ${filterOpen ? "btn-primary" : "btn-outline-secondary"}`}
          onClick={() => setFilterOpen((o) => !o)}
        >
          Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </button>
      }
      primaryAction={
        canManage ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Create Skill"}
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Skills by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or category"
            />
          </div>
          <div className="module-filter-section">
            <h3>Filter by fields</h3>
            <label className="form-label small mb-1">Name contains</label>
            <input
              className="form-control form-control-sm mb-2"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="e.g. Java"
            />
            <label className="form-label small mb-1">Category</label>
            <input
              className="form-control form-control-sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              placeholder="e.g. Backend"
            />
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
          <FormSection title="Primary details" description="Skill name">
            <div className="col-md-6">
              <FormField label="Name" required error={errors.name} {...register("name")} />
            </div>
          </FormSection>
          <FormMoreDetails open={showMore} onToggle={() => setShowMore((v) => !v)}>
            <FormSection title="Classification">
              <div className="col-md-4">
                <FormField label="Category" error={errors.category} {...register("category")} />
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
              reset(SKILL_DEFAULTS);
            }}
          />
        </form>
      ) : null}

      {skillsQuery.isLoading ? <LoadingState label="Loading skills..." /> : null}
      {skillsQuery.error ? <ErrorState title="Unable to load skills" message="Try again." /> : null}

      {!skillsQuery.isLoading && !skillsQuery.error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <div className="module-list-table-wrap">
              <table className="table module-list-table align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((skill) => (
                    <tr key={skill.id}>
                      <td className="lead-name">{skill.name}</td>
                      <td>{skill.category ?? "—"}</td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={2} className="text-center text-muted py-5">
                        No skills match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="module-tile-grid">
              {rows.map((skill) => (
                <div key={skill.id} className="module-tile text-start">
                  <div className="tile-title">{skill.name}</div>
                  <div className="small text-muted">{skill.category ?? "Uncategorized"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </ModuleListShell>
  );
}
