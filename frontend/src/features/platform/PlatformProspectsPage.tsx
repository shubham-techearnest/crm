import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormActions } from "@/components/FormKit";
import {
  enumPickerOptions,
  TechEarnestFormKitCreateView,
  TechEarnestFormSelect,
  useTechEarnestCreateFlow,
} from "@/components/TechEarnestCreate";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
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
    <div className="row g-2">
      <div className="col-md-4">
        <FormField label="Company name" required error={errors.name} {...register("name")} />
      </div>
      <div className="col-md-4">
        <FormField label="Legal name" error={errors.legalName} {...register("legalName")} />
      </div>
      <div className="col-md-4">
        <label className="form-label">Stage</label>
        <TechEarnestFormSelect
          control={control}
          name="stage"
          options={stageOptions}
          searchPlaceholder="Search Stages"
          allowEmpty={false}
        />
      </div>
      <div className="col-md-3">
        <FormField label="Email" error={errors.email} {...register("email")} />
      </div>
      <div className="col-md-3">
        <FormField label="Phone" error={errors.phone} {...register("phone")} />
      </div>
      <div className="col-md-3">
        <FormField label="Source" error={errors.source} {...register("source")} />
      </div>
      <div className="col-md-3">
        <FormField label="Est. ARR" type="number" error={errors.estimatedArr} {...register("estimatedArr")} />
      </div>
      <div className="col-12">
        <FormField label="Notes" error={errors.notes} {...register("notes")} />
      </div>
    </div>
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
      toolbarActions={
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setFilterOpen((v) => !v)}>
          {filterOpen ? "Hide filters" : "Filters"}
        </button>
      }
      primaryAction={
        <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
          New prospect
        </button>
      }
      filterPanel={
        <div className="d-flex flex-column gap-2">
          <label className="small mb-0">
            Search
            <input className="form-control form-control-sm mt-1" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label className="small mb-0">
            Stage
            <select className="form-select form-select-sm mt-1" value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">All</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="small mb-0">
            Source
            <input className="form-control form-control-sm mt-1" value={source} onChange={(e) => setSource(e.target.value)} />
          </label>
          <label className="small mb-0">
            Min ARR (advanced)
            <input
              className="form-control form-control-sm mt-1"
              type="number"
              value={arrMin}
              onChange={(e) => {
                setArrMin(e.target.value);
                setUseAdvanced(Boolean(e.target.value));
              }}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary btn-sm"
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
