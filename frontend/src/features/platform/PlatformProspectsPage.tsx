import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { FormActions } from "@/components/FormKit";
import {
  enumPickerOptions,
  TechEarnestCreateColumn,
  TechEarnestCreateField,
  TechEarnestCreateGrid,
  TechEarnestCreateSection,
  TechEarnestFormKitCreateView,
  TechEarnestFormSelect,
  useTechEarnestCreateFlow,
} from "@/components/TechEarnestCreate";
import { ModuleFilterField, ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import {
  createPlatformProspect,
  deletePlatformProspect,
  listPlatformProspects,
  queryPlatformProspects,
  updatePlatformProspect,
  type PlatformProspect,
} from "./platformProspectApi";

const STAGES = ["NEW", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const;
const stageOptions = enumPickerOptions(STAGES);

const schema = z.object({
  name: z.string().min(1, "Required"),
  legalName: z.string().optional(),
  website: z.string().optional(),
  email: z.string().email().or(z.literal("")).optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  stage: z.string().min(1),
  estimatedArr: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const PROSPECT_DEFAULTS: FormValues = {
  name: "",
  legalName: "",
  website: "",
  email: "",
  phone: "",
  source: "",
  stage: "NEW",
  estimatedArr: "",
  notes: "",
};

type ProspectDocument = { name: string; url: string };

function parseProspectPayload(notes: string | null | undefined): { text: string; documents: ProspectDocument[] } {
  if (!notes?.trim()) {
    return { text: "", documents: [] };
  }
  const marker = "---DOCS---";
  const idx = notes.indexOf(marker);
  if (idx < 0) {
    return { text: notes, documents: [] };
  }
  const text = notes.slice(0, idx).trim();
  const raw = notes.slice(idx + marker.length).trim();
  try {
    const parsed = JSON.parse(raw) as { documents?: ProspectDocument[] };
    return { text, documents: parsed.documents ?? [] };
  } catch {
    return { text: notes, documents: [] };
  }
}

function serializeProspectPayload(text: string, documents: ProspectDocument[]): string | undefined {
  const trimmed = text.trim();
  const docs = documents.filter((doc) => doc.name.trim() && doc.url.trim());
  if (!trimmed && !docs.length) {
    return undefined;
  }
  if (!docs.length) {
    return trimmed || undefined;
  }
  return `${trimmed}\n---DOCS---\n${JSON.stringify({ documents: docs })}`;
}

export function PlatformProspectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filterOpen, setFilterOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");
  const [arrMin, setArrMin] = useState("");
  const [useAdvanced, setUseAdvanced] = useState(false);
  const [applied, setApplied] = useState({ search: "", stage: "", source: "", arrMin: "", advanced: false });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PlatformProspect | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailNotes, setDetailNotes] = useState("");
  const [detailDocs, setDetailDocs] = useState<ProspectDocument[]>([]);
  const [detailDocName, setDetailDocName] = useState("");
  const [detailDocUrl, setDetailDocUrl] = useState("");

  const query = useQuery({
    queryKey: ["platform", "prospects", applied],
    queryFn: async () => {
      if (applied.advanced && applied.arrMin) {
        return queryPlatformProspects({
          search: applied.search || undefined,
          stage: applied.stage || undefined,
          source: applied.source || undefined,
          filter: {
            op: "AND",
            conditions: [
              {
                field: "estimatedArr",
                operator: "GTE",
                value: Number(applied.arrMin),
              },
            ],
          },
        });
      }
      return listPlatformProspects({
        search: applied.search || undefined,
        stage: applied.stage || undefined,
        source: applied.source || undefined,
      });
    },
  });

  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: PROSPECT_DEFAULTS,
  });

  const { setSaveAndNew, photo, cancelCreate, afterCreateSuccess } = useTechEarnestCreateFlow({
    defaults: PROSPECT_DEFAULTS,
    reset,
    setShowForm,
    setFormError,
    setSelected: (entity) => setSelectedId(entity.id),
  });

  const buildProspectBody = (values: FormValues) => ({
    name: values.name,
    legalName: values.legalName || undefined,
    website: values.website || undefined,
    email: values.email || undefined,
    phone: values.phone || undefined,
    source: values.source || undefined,
    stage: values.stage,
    estimatedArr: values.estimatedArr ? Number(values.estimatedArr) : undefined,
    notes: values.notes || undefined,
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => createPlatformProspect(buildProspectBody(values)),
    onSuccess: async (prospect) => {
      await queryClient.invalidateQueries({ queryKey: ["platform", "prospects"] });
      setFormError(null);
      await afterCreateSuccess(prospect, "PLATFORM_PROSPECT");
    },
    onError: (err: Error) => setFormError(err.message || "Could not create prospect."),
  });

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) => updatePlatformProspect(editing!.id, buildProspectBody(values)),
    onSuccess: async () => {
      setShowForm(false);
      setEditing(null);
      setFormError(null);
      reset(PROSPECT_DEFAULTS);
      await queryClient.invalidateQueries({ queryKey: ["platform", "prospects"] });
    },
    onError: (err: Error) => setFormError(err.message || "Save failed"),
  });

  const onCreateSubmit = (values: FormValues) => {
    createMutation.mutate(values);
  };

  const deleteMutation = useMutation({
    mutationFn: deletePlatformProspect,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "prospects"] }),
  });

  const detailMutation = useMutation({
    mutationFn: async () => {
      if (!selected) {
        return;
      }
      return updatePlatformProspect(selected.id, {
        name: selected.name,
        legalName: selected.legalName ?? undefined,
        website: selected.website ?? undefined,
        email: selected.email ?? undefined,
        phone: selected.phone ?? undefined,
        source: selected.source ?? undefined,
        stage: selected.stage,
        estimatedArr: selected.estimatedArr ?? undefined,
        notes: serializeProspectPayload(detailNotes, detailDocs),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "prospects"] });
    },
  });

  function openCreate() {
    setEditing(null);
    reset(PROSPECT_DEFAULTS);
    setShowForm(true);
  }

  function openEdit(p: PlatformProspect) {
    setEditing(p);
    const payload = parseProspectPayload(p.notes);
    reset({
      name: p.name,
      legalName: p.legalName ?? "",
      website: p.website ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      source: p.source ?? "",
      stage: p.stage,
      estimatedArr: p.estimatedArr != null ? String(p.estimatedArr) : "",
      notes: payload.text,
    });
    setShowForm(true);
  }

  function openDetail(p: PlatformProspect) {
    setSelectedId(p.id);
    const payload = parseProspectPayload(p.notes);
    setDetailNotes(payload.text);
    setDetailDocs(payload.documents);
  }

  function convertToOrg(p: PlatformProspect) {
    const params = new URLSearchParams({
      prospectId: p.id,
      name: p.name,
    });
    if (p.legalName) params.set("legalName", p.legalName);
    if (p.email) params.set("email", p.email);
    if (p.phone) params.set("phone", p.phone);
    if (p.website) params.set("website", p.website);
    navigate(`/platform/organizations/new?${params.toString()}`);
  }

  const prospectFormFields = (
    <>
      <TechEarnestCreateSection title="Prospect Information">
        <TechEarnestCreateGrid>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Company Name" required error={errors.name?.message}>
              <input
                type="text"
                className={`form-control form-control-sm${errors.name ? " is-invalid" : ""}`}
                {...register("name")}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Legal Name" error={errors.legalName?.message}>
              <input
                type="text"
                className={`form-control form-control-sm${errors.legalName ? " is-invalid" : ""}`}
                {...register("legalName")}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Website" error={errors.website?.message}>
              <input
                type="text"
                className={`form-control form-control-sm${errors.website ? " is-invalid" : ""}`}
                {...register("website")}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Email" error={errors.email?.message}>
              <input
                type="email"
                className={`form-control form-control-sm${errors.email ? " is-invalid" : ""}`}
                {...register("email")}
              />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Stage" required error={errors.stage?.message}>
              <TechEarnestFormSelect
                control={control}
                name="stage"
                options={stageOptions}
                searchPlaceholder="Search Stages"
                allowEmpty={false}
                invalid={!!errors.stage}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Phone" error={errors.phone?.message}>
              <input
                type="text"
                className={`form-control form-control-sm${errors.phone ? " is-invalid" : ""}`}
                {...register("phone")}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Source" error={errors.source?.message}>
              <input
                type="text"
                className={`form-control form-control-sm${errors.source ? " is-invalid" : ""}`}
                {...register("source")}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Est. ARR" error={errors.estimatedArr?.message}>
              <input
                type="number"
                className={`form-control form-control-sm${errors.estimatedArr ? " is-invalid" : ""}`}
                {...register("estimatedArr")}
              />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
        </TechEarnestCreateGrid>
      </TechEarnestCreateSection>
      <TechEarnestCreateSection title="Description Information">
        <TechEarnestCreateField label="Notes" wide error={errors.notes?.message}>
          <textarea rows={4} className="form-control form-control-sm" {...register("notes")} />
        </TechEarnestCreateField>
      </TechEarnestCreateSection>
    </>
  );

  return (
    <>
      {showForm && !editing ? (
        <TechEarnestFormKitCreateView
          title="Create Prospect"
          entityLabel="Prospect"
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
          {prospectFormFields}
        </TechEarnestFormKitCreateView>
      ) : (
    <ModuleListShell
      title="Prospect Orgs"
      filterOpen={filterOpen}
      filterToggle={{ onToggle: () => setFilterOpen((open) => !open) }}
      primaryAction={
        <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
          New prospect
        </button>
      }
      filterPanel={
        <div className="module-filter-section">
          <ModuleFilterField label="Search" htmlFor="prospectSearchFilter">
            <input
              id="prospectSearchFilter"
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </ModuleFilterField>
          <ModuleFilterField label="Stage" htmlFor="prospectStageFilter">
            <select
              id="prospectStageFilter"
              className="form-select form-select-sm"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              <option value="">All</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </ModuleFilterField>
          <ModuleFilterField label="Source" htmlFor="prospectSourceFilter">
            <input
              id="prospectSourceFilter"
              className="form-control form-control-sm"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </ModuleFilterField>
          <ModuleFilterField label="Min ARR (advanced)" htmlFor="prospectArrMinFilter">
            <input
              id="prospectArrMinFilter"
              className="form-control form-control-sm"
              type="number"
              value={arrMin}
              onChange={(e) => {
                setArrMin(e.target.value);
                setUseAdvanced(Boolean(e.target.value));
              }}
            />
          </ModuleFilterField>
          <button
            type="button"
            className="btn btn-primary btn-sm w-100"
            onClick={() =>
              setApplied({
                search: search.trim(),
                stage,
                source: source.trim(),
                arrMin: arrMin.trim(),
                advanced: useAdvanced && Boolean(arrMin.trim()),
              })
            }
          >
            Apply
          </button>
        </div>
      }
      activeFilterCount={[applied.search, applied.stage, applied.source, applied.arrMin].filter(Boolean).length}
      onClearFilters={() => {
        setSearch("");
        setStage("");
        setSource("");
        setArrMin("");
        setUseAdvanced(false);
        setApplied({ search: "", stage: "", source: "", arrMin: "", advanced: false });
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span className="small text-muted">{query.data?.total ?? 0} prospects · SaaS pipeline (not tenant Leads)</span>}
    >
      {showForm && editing ? (
        <form
          className="border-bottom p-3 bg-white mb-2"
          onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
        >
          {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
          {prospectFormFields}
          <FormActions
            submitLabel="Save"
            submitting={isSubmitting || updateMutation.isPending}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
              reset(PROSPECT_DEFAULTS);
            }}
          />
        </form>
      ) : null}

      {query.isLoading ? <LoadingState label="Loading prospects…" /> : null}
      {query.isError ? <ErrorState title="Unable to load prospects" message="Try again." /> : null}

      {!query.isLoading && !query.isError ? (
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Company</th>
                <th>Stage</th>
                <th>Source</th>
                <th>Est. ARR</th>
                <th>Linked org</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className={selectedId === p.id ? "table-active" : undefined}
                  onClick={() => openDetail(p)}
                  style={{ cursor: "pointer" }}
                >
                  <td className="fw-medium">{p.name}</td>
                  <td>
                    <StatusBadge status={p.stage} />
                  </td>
                  <td>{p.source || "—"}</td>
                  <td>{p.estimatedArr != null ? p.estimatedArr.toLocaleString() : "—"}</td>
                  <td className="small text-muted">
                    {p.linkedOrganizationId ? (
                      <Link to={`/platform/organizations/${p.linkedOrganizationId}`}>View org</Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="text-end text-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="btn btn-outline-secondary btn-sm me-1" onClick={() => openEdit(p)}>
                      Edit
                    </button>
                    {(p.stage === "WON" || p.stage === "PROPOSAL") && !p.linkedOrganizationId ? (
                      <button type="button" className="btn btn-primary btn-sm me-1" onClick={() => convertToOrg(p)}>
                        Create org
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => {
                        if (window.confirm(`Delete prospect ${p.name}?`)) {
                          deleteMutation.mutate(p.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    No prospects yet. Track companies you sell TechEarnest to here — not tenant Leads.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {selected ? (
        <div className="border-top p-3 bg-white">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h2 className="h6 mb-1">{selected.name}</h2>
              <div className="small text-muted">Notes and proposal documents</div>
            </div>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedId(null)}>
              Close
            </button>
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small">Notes</label>
              <textarea
                className="form-control form-control-sm"
                rows={5}
                value={detailNotes}
                onChange={(e) => setDetailNotes(e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label small">Proposal documents</label>
              <ul className="list-group list-group-flush mb-2">
                {detailDocs.map((doc, index) => (
                  <li key={`${doc.name}-${index}`} className="list-group-item px-0 d-flex justify-content-between gap-2">
                    <a href={doc.url} target="_blank" rel="noreferrer">
                      {doc.name}
                    </a>
                    <button
                      type="button"
                      className="btn btn-link btn-sm text-danger p-0"
                      onClick={() => setDetailDocs((items) => items.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
                {!detailDocs.length ? <li className="list-group-item px-0 text-muted small">No documents linked</li> : null}
              </ul>
              <div className="row g-2">
                <div className="col-md-5">
                  <input
                    className="form-control form-control-sm"
                    placeholder="Document name"
                    value={detailDocName}
                    onChange={(e) => setDetailDocName(e.target.value)}
                  />
                </div>
                <div className="col-md-5">
                  <input
                    className="form-control form-control-sm"
                    placeholder="URL"
                    value={detailDocUrl}
                    onChange={(e) => setDetailDocUrl(e.target.value)}
                  />
                </div>
                <div className="col-md-2">
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm w-100"
                    onClick={() => {
                      if (!detailDocName.trim() || !detailDocUrl.trim()) {
                        return;
                      }
                      setDetailDocs((items) => [...items, { name: detailDocName.trim(), url: detailDocUrl.trim() }]);
                      setDetailDocName("");
                      setDetailDocUrl("");
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm mt-3"
            disabled={detailMutation.isPending}
            onClick={() => detailMutation.mutate()}
          >
            Save notes & documents
          </button>
        </div>
      ) : null}
    </ModuleListShell>
      )}
    </>
  );
}
