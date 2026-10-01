import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { adminErrorMessage } from "@/features/admin/adminKit";
import {
  createFormPolicy,
  listFormPolicies,
  publishFormPolicy,
  type FormPolicy,
} from "./metadataApi";

const DEAL_STAGES = ["NEW", "QUALIFICATION", "REQUIREMENT", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];
const CONDITIONS = ["EQ", "NEQ", "EMPTY", "NOT_EMPTY"] as const;
const CONDITION_FIELDS = [
  { code: "stage", label: "Stage" },
  { code: "lostReason", label: "Lost reason" },
  { code: "expectedCloseDate", label: "Expected close date" },
] as const;
const EFFECT_FIELDS = [
  { code: "lostReason", label: "Lost reason" },
  { code: "expectedCloseDate", label: "Expected close date" },
] as const;

function summarize(policy: FormPolicy["policy"]): string {
  const condition = policy.when;
  const effect = policy.then.filter((item) => item.mandatory).map((item) => EFFECT_FIELDS.find((field) => field.code === item.field)?.label ?? item.field);
  const conditionField = CONDITION_FIELDS.find((field) => field.code === condition.field)?.label ?? condition.field;
  return `When ${conditionField} ${condition.op.replaceAll("_", " ").toLowerCase()}${condition.value ? ` “${condition.value}”` : ""}, require ${effect.join(" and ") || "no fields"}.`;
}

export function FormPolicyStudio({ tableId, canManage }: { tableId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [conditionField, setConditionField] = useState<string>("stage");
  const [operator, setOperator] = useState<(typeof CONDITIONS)[number]>("EQ");
  const [conditionValue, setConditionValue] = useState("WON");
  const [requiredField, setRequiredField] = useState<string>("expectedCloseDate");
  const [formError, setFormError] = useState<string | null>(null);

  const policiesQuery = useQuery({
    queryKey: ["metadata", "form-policies", tableId],
    queryFn: () => listFormPolicies(tableId),
  });

  const createMutation = useMutation({
    mutationFn: () => createFormPolicy(tableId, {
      name: name.trim(),
      layoutKey: "EDIT",
      active: true,
      policy: {
        when: {
          field: conditionField,
          op: operator,
          ...(!["EMPTY", "NOT_EMPTY"].includes(operator) ? { value: conditionValue } : {}),
        },
        then: [{ field: requiredField, mandatory: true }],
      },
    }),
    onSuccess: async () => {
      setName("");
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["metadata", "form-policies", tableId] });
    },
    onError: (error) => setFormError(adminErrorMessage(error, "Could not save policy draft.")),
  });

  const publishMutation = useMutation({
    mutationFn: publishFormPolicy,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["metadata", "form-policies", tableId] });
      await queryClient.invalidateQueries({ queryKey: ["metadata", "runtime", "form-policies", "deal", "EDIT"] });
      setFormError(null);
    },
    onError: (error) => setFormError(adminErrorMessage(error, "Could not publish this policy.")),
  });

  const needsValue = !["EMPTY", "NOT_EMPTY"].includes(operator);
  const conditionIsStage = conditionField === "stage";

  return (
    <section className="studio-policy-designer">
      <div>
        <h2 className="h6 mb-1">Deal stage policies</h2>
        <p className="small text-muted mb-0">
          These policies run when a deal stage changes. They can require a lost reason or closing date; the server validates the requirement too.
        </p>
      </div>
      {formError ? <div className="alert alert-danger py-2 mb-0" role="alert">{formError}</div> : null}
      <form className="studio-policy-card" onSubmit={(event) => { event.preventDefault(); if (canManage) createMutation.mutate(); }}>
        <h3 className="h6">Create a policy draft</h3>
        <div className="row g-2">
          <div className="col-md-6">
            <label className="form-label small">Policy name</label>
            <input className="form-control form-control-sm" required maxLength={128} value={name} disabled={!canManage} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label small">When this field</label>
            <select className="form-select form-select-sm" value={conditionField} disabled={!canManage} onChange={(event) => { setConditionField(event.target.value); setConditionValue(""); }}>
              {CONDITION_FIELDS.map((field) => <option key={field.code} value={field.code}>{field.label}</option>)}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label small">Condition</label>
            <select className="form-select form-select-sm" value={operator} disabled={!canManage} onChange={(event) => setOperator(event.target.value as (typeof CONDITIONS)[number])}>
              {CONDITIONS.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
            </select>
          </div>
          {needsValue ? (
            <div className="col-md-4">
              <label className="form-label small">Value</label>
              {conditionIsStage ? (
                <select className="form-select form-select-sm" value={conditionValue} disabled={!canManage} onChange={(event) => setConditionValue(event.target.value)}>
                  {DEAL_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                </select>
              ) : (
                <input className="form-control form-control-sm" type={conditionField === "expectedCloseDate" ? "date" : "text"} value={conditionValue} disabled={!canManage} onChange={(event) => setConditionValue(event.target.value)} />
              )}
            </div>
          ) : null}
          <div className="col-md-4">
            <label className="form-label small">Require this field</label>
            <select className="form-select form-select-sm" value={requiredField} disabled={!canManage} onChange={(event) => setRequiredField(event.target.value)}>
              {EFFECT_FIELDS.map((field) => <option key={field.code} value={field.code}>{field.label}</option>)}
            </select>
          </div>
        </div>
        <div className="d-flex justify-content-between align-items-center gap-2 mt-3">
          <span className="small text-muted">Layout: Deal stage change</span>
          <button type="submit" className="btn btn-outline-primary btn-sm" disabled={!canManage || !name.trim() || (needsValue && !conditionValue) || createMutation.isPending}>
            {createMutation.isPending ? "Saving…" : "Save draft"}
          </button>
        </div>
      </form>
      {policiesQuery.isLoading ? <LoadingState label="Loading deal policies…" /> : null}
      {policiesQuery.error ? <ErrorState title="Unable to load policies" message="Check metadata view permission and retry." /> : null}
      {!policiesQuery.isLoading && !policiesQuery.error ? (
        <div className="studio-policy-list">
          {(policiesQuery.data ?? []).map((policy) => (
            <article className="studio-policy-card" key={policy.id}>
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <strong>{policy.name}</strong>
                  <span className={`badge ms-2 ${policy.status === "PUBLISHED" ? "text-bg-success" : policy.status === "DRAFT" ? "text-bg-warning" : "text-bg-light"}`}>{policy.status}</span>
                  {!policy.active ? <span className="badge text-bg-secondary ms-2">Inactive</span> : null}
                  <p className="small text-muted mb-0 mt-1">{summarize(policy.policy)}</p>
                </div>
                {policy.status === "DRAFT" ? (
                  <button type="button" className="btn btn-primary btn-sm" disabled={!canManage || !policy.active || publishMutation.isPending} onClick={() => publishMutation.mutate(policy.id)}>
                    Publish
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {!policiesQuery.data?.length ? <EmptyState title="No deal policies" description="Add a draft to require stage-specific values." /> : null}
        </div>
      ) : null}
    </section>
  );
}
