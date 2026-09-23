import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
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
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", stage: "NEW", estimatedArr: "" },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = {
        name: values.name,
        legalName: values.legalName || undefined,
        website: values.website || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        source: values.source || undefined,
        stage: values.stage,
        estimatedArr: values.estimatedArr ? Number(values.estimatedArr) : undefined,
        notes: values.notes || undefined,
      };
      if (editing) {
        return updatePlatformProspect(editing.id, body);
      }
      return createPlatformProspect(body);
    },
    onSuccess: () => {
      setShowForm(false);
      setEditing(null);
      setFormError(null);
      reset({ name: "", stage: "NEW", estimatedArr: "" });
      queryClient.invalidateQueries({ queryKey: ["platform", "prospects"] });
    },
    onError: (err: Error) => setFormError(err.message || "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlatformProspect,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "prospects"] }),
  });

  function openCreate() {
    setEditing(null);
    reset({ name: "", stage: "NEW", estimatedArr: "", legalName: "", email: "", phone: "", website: "", source: "", notes: "" });
    setShowForm(true);
  }

  function openEdit(p: PlatformProspect) {
    setEditing(p);
    reset({
      name: p.name,
      legalName: p.legalName ?? "",
      website: p.website ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      source: p.source ?? "",
      stage: p.stage,
      estimatedArr: p.estimatedArr != null ? String(p.estimatedArr) : "",
      notes: p.notes ?? "",
    });
    setShowForm(true);
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

  return (
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
      {showForm ? (
        <form
          className="border-bottom p-3 bg-white mb-2"
          onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
        >
          {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
          <div className="row g-2">
            <div className="col-md-4">
              <FormField label="Company name" required error={errors.name} {...register("name")} />
            </div>
            <div className="col-md-4">
              <FormField label="Legal name" error={errors.legalName} {...register("legalName")} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Stage</label>
              <select className="form-select" {...register("stage")}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
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
          <div className="d-flex gap-2 mt-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting || saveMutation.isPending}>
              {editing ? "Save" : "Create"}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {query.isLoading ? <LoadingState label="Loading prospects…" /> : null}
      {query.isError ? <ErrorState title="Unable to load prospects" /> : null}

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
                <tr key={p.id}>
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
                  <td className="text-end text-nowrap">
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
    </ModuleListShell>
  );
}
