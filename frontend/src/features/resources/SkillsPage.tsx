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
import { ModuleFilterField, ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { createSkill, deleteSkill, listSkills, updateSkill, type Skill } from "./resourceApi";

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
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [skillToDelete, setSkillToDelete] = useState<Skill | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const {
    setSaveAndNew,
    cancelCreate,
    afterCreateSuccess,
  } = useTechEarnestCreateFlow({
    defaults: SKILL_DEFAULTS,
    reset,
    setShowForm,
    setFormError,
  });

  const buildBody = (values: FormValues) => ({
    name: values.name,
    category: values.category || undefined,
  });

  const createMutation = useMutation({
    mutationFn: createSkill,
    onSuccess: async (skill) => {
      await queryClient.invalidateQueries({ queryKey: ["skills"] });
      setFormError(null);
      await afterCreateSuccess(skill, "SKILL");
    },
    onError: () => setFormError("Could not create skill. Check the name is unique."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateSkill>[1] }) => updateSkill(id, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["skills"] });
      setFormError(null);
      setEditingSkillId(null);
      setShowForm(false);
      reset(SKILL_DEFAULTS);
    },
    onError: () => setFormError("Could not update skill. Check whether another skill already uses this name."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSkill,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["skills"] });
      setSkillToDelete(null);
      setDeleteError(null);
    },
    onError: () => setDeleteError("Could not deactivate skill. It may be referenced by existing resources."),
  });

  const onCreateSubmit = (values: FormValues) => {
    createMutation.mutate(buildBody(values));
  };

  const onUpdateSubmit = (values: FormValues) => {
    if (!editingSkillId) return;
    updateMutation.mutate({ id: editingSkillId, body: buildBody(values) });
  };

  function openCreate() {
    setEditingSkillId(null);
    setFormError(null);
    reset(SKILL_DEFAULTS);
    setShowForm(true);
  }

  function openEdit(skill: Skill) {
    setEditingSkillId(skill.id);
    setFormError(null);
    reset({ name: skill.name, category: skill.category ?? "" });
    setShowForm(true);
  }

  const rows = skillsQuery.data ?? [];
  const activeFilterCount = [search, nameFilter, categoryFilter].filter(Boolean).length;

  const skillFormFields = (
    <TechEarnestCreateSection title="Skill Information">
      <TechEarnestCreateGrid>
        <TechEarnestCreateColumn>
          <TechEarnestCreateField label="Skill Name" required error={errors.name?.message}>
            <input
              type="text"
              className={`form-control form-control-sm${errors.name ? " is-invalid" : ""}`}
              {...register("name")}
            />
          </TechEarnestCreateField>
        </TechEarnestCreateColumn>
        <TechEarnestCreateColumn>
          <TechEarnestCreateField label="Category" error={errors.category?.message}>
            <input
              type="text"
              className={`form-control form-control-sm${errors.category ? " is-invalid" : ""}`}
              {...register("category")}
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
          title={editingSkillId ? "Edit Skill" : "Create Skill"}
          entityLabel="Skill"
          pending={isSubmitting || createMutation.isPending || updateMutation.isPending}
          isDirty={isDirty}
          formError={formError}
          onCancel={() => {
            if (editingSkillId) {
              setEditingSkillId(null);
              setShowForm(false);
              reset(SKILL_DEFAULTS);
            } else cancelCreate(isDirty);
          }}
          onSave={() => void handleSubmit(editingSkillId ? onUpdateSubmit : onCreateSubmit)()}
          onSaveAndNew={!editingSkillId ? () => {
            setSaveAndNew(true);
            void handleSubmit(onCreateSubmit)();
          } : undefined}
          onSubmit={() => void handleSubmit(editingSkillId ? onUpdateSubmit : onCreateSubmit)()}
          showRecordImage={false}
        >
          {skillFormFields}
        </TechEarnestFormKitCreateView>
      ) : (
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
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openCreate()}>
            Create Skill
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
            <ModuleFilterField label="Name contains" htmlFor="skillNameFilter">
              <input
                id="skillNameFilter"
                className="form-control form-control-sm"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="e.g. Java"
              />
            </ModuleFilterField>
            <ModuleFilterField label="Category" htmlFor="skillCategoryFilter">
              <input
                id="skillCategoryFilter"
                className="form-control form-control-sm"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                placeholder="e.g. Backend"
              />
            </ModuleFilterField>
          </div>
        </>
      }
      activeFilterCount={activeFilterCount}
      onClearFilters={() => {
        setSearch("");
        setNameFilter("");
        setCategoryFilter("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {skillsQuery.isLoading ? <LoadingState label="Loading skills..." /> : null}
      {skillsQuery.error ? <ErrorState title="Unable to load skills" message="Try again." /> : null}

      {!skillsQuery.isLoading && !skillsQuery.error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <ModuleListTable
              tableCode="skill"
              defaultColumns={[
                { field: "name", label: "Name" },
                { field: "category", label: "Category" },
              ]}
              rows={rows}
              rowKey={(skill) => skill.id}
              renderCell={(skill, field) => {
                const value = (skill as unknown as Record<string, unknown>)[field];
                return value == null || value === "" ? "—" : String(value);
              }}
              nameFields={["name"]}
              trailingColumn={canManage ? {
                header: "Actions",
                stopPropagation: true,
                render: (skill) => (
                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(skill)}>Edit</button>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => { setDeleteError(null); setSkillToDelete(skill); }}>Deactivate</button>
                  </div>
                ),
              } : undefined}
              emptyMessage="No skills match the current filters."
            />
          ) : (
            <div className="module-tile-grid">
              {rows.map((skill) => (
                <article key={skill.id} className="module-tile text-start">
                  <div className="tile-title">{skill.name}</div>
                  <div className="small text-muted">{skill.category ?? "Uncategorized"}</div>
                  {canManage ? (
                    <div className="d-flex gap-2 mt-3">
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(skill)}>Edit</button>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => { setDeleteError(null); setSkillToDelete(skill); }}>Deactivate</button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </ModuleListShell>
      )}
      {skillToDelete ? (
        <div className="module-modal-backdrop" role="presentation" onClick={() => deleteMutation.isPending ? null : setSkillToDelete(null)}>
          <section className="module-modal" role="alertdialog" aria-modal="true" aria-labelledby="deactivate-skill-title" onClick={(event) => event.stopPropagation()}>
            <header className="d-flex align-items-center justify-content-between gap-3 mb-3">
              <h2 id="deactivate-skill-title" className="h5 mb-0">Deactivate skill?</h2>
              <button type="button" className="btn-close" aria-label="Close" disabled={deleteMutation.isPending} onClick={() => setSkillToDelete(null)} />
            </header>
            <p><strong>{skillToDelete.name}</strong> will be deactivated and removed from active skill lists.</p>
            {deleteError ? <div className="alert alert-danger py-2" role="alert">{deleteError}</div> : null}
            <footer className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={deleteMutation.isPending} onClick={() => setSkillToDelete(null)}>Cancel</button>
              <button type="button" className="btn btn-danger btn-sm" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(skillToDelete.id)}>
                {deleteMutation.isPending ? "Deactivating…" : "Deactivate skill"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
