import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { TechEarnestRecordRelatedCard } from "@/components/TechEarnestRecord";
import { useOpenRecord } from "@/components/RecordLink";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listTaxRates } from "@/features/finance/taxApi";
import { errorMessage } from "@/features/resources/ResourcePortalPanel";
import {
  billingTypeLabel,
  generateProjectInvoice,
  previewProjectInvoice,
  type Project,
  type ProjectInvoiceRequest,
} from "./projectApi";

function isoDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function currentMonth(): { start: string; end: string; month: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start: isoDate(start), end: isoDate(end), month: isoDate(start).slice(0, 7) };
}

function money(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Builds a draft invoice for the project according to its billing type. */
export function ProjectBillingCard({ project }: { project: Project }) {
  const queryClient = useQueryClient();
  const openRecord = useOpenRecord();
  const canViewTax = useHasPermission("TAX_VIEW");
  const defaults = useMemo(currentMonth, []);
  const [periodStart, setPeriodStart] = useState(defaults.start);
  const [periodEnd, setPeriodEnd] = useState(defaults.end);
  const [month, setMonth] = useState(defaults.month);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [taxRateId, setTaxRateId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const type = project.billingType;
  const hourly = type === "STAFF_AUGMENTATION" || type === "TIME_AND_MATERIAL";

  const request: ProjectInvoiceRequest = useMemo(() => {
    if (hourly) return { periodStart, periodEnd };
    if (type === "FIXED_MONTHLY") return { periodStart: month ? `${month}-01` : null };
    const parsed = Number(amount);
    return {
      amount: amount.trim() && Number.isFinite(parsed) ? parsed : null,
      description: description.trim() || null,
    };
  }, [hourly, type, periodStart, periodEnd, month, amount, description]);

  const taxQuery = useQuery({
    queryKey: ["tax-rates", "active"],
    queryFn: () => listTaxRates({ activeOnly: true }),
    enabled: canViewTax,
  });

  const previewQuery = useQuery({
    queryKey: ["projects", project.id, "invoice-preview", request],
    queryFn: () => previewProjectInvoice(project.id, request),
    retry: false,
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      generateProjectInvoice(project.id, {
        ...request,
        taxRateId: taxRateId || null,
        dueDate: dueDate || null,
      }),
    onSuccess: async (invoice) => {
      setError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["projects", project.id, "invoice-preview"] }),
      ]);
      openRecord("invoice", invoice.id, project.name);
    },
    onError: (err) => setError(errorMessage(err, "Could not generate the invoice.")),
  });

  const preview = previewQuery.data;
  const blocked = preview?.blockedReason ?? null;

  return (
    <TechEarnestRecordRelatedCard id="techearnest-record-section-billing" title={`Generate Invoice · ${billingTypeLabel(type)}`}>
      <div className="row g-2 align-items-end mb-2">
        {hourly ? (
          <>
            <div className="col-sm-4">
              <label className="form-label small mb-1" htmlFor="billing-from">Hours from</label>
              <input id="billing-from" type="date" className="form-control form-control-sm" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="col-sm-4">
              <label className="form-label small mb-1" htmlFor="billing-to">Hours to</label>
              <input id="billing-to" type="date" className="form-control form-control-sm" value={periodEnd} min={periodStart} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </>
        ) : null}
        {type === "FIXED_MONTHLY" ? (
          <div className="col-sm-4">
            <label className="form-label small mb-1" htmlFor="billing-month">Month</label>
            <input id="billing-month" type="month" className="form-control form-control-sm" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
        ) : null}
        {type === "FIXED_BID" ? (
          <>
            <div className="col-sm-4">
              <label className="form-label small mb-1" htmlFor="billing-amount">Amount</label>
              <input
                id="billing-amount"
                type="number"
                min={0}
                step="0.01"
                className="form-control form-control-sm"
                placeholder={preview?.remaining != null ? `Remaining ${money(preview.remaining)}` : ""}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="col-sm-8">
              <label className="form-label small mb-1" htmlFor="billing-desc">Description</label>
              <input
                id="billing-desc"
                type="text"
                maxLength={300}
                className="form-control form-control-sm"
                placeholder="e.g. 30% advance on signing"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </>
        ) : null}
        {canViewTax ? (
          <div className="col-sm-4">
            <label className="form-label small mb-1" htmlFor="billing-tax">Tax</label>
            <select id="billing-tax" className="form-select form-select-sm" value={taxRateId} onChange={(e) => setTaxRateId(e.target.value)}>
              <option value="">No tax</option>
              {(taxQuery.data ?? []).map((tax) => (
                <option key={tax.id} value={tax.id}>
                  {tax.name} ({tax.ratePercent}%)
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="col-sm-4">
          <label className="form-label small mb-1" htmlFor="billing-due">Due date</label>
          <input id="billing-due" type="date" className="form-control form-control-sm" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>

      {type === "FIXED_BID" && preview ? (
        <p className="small text-muted mb-2">
          Contract {money(preview.contractValue)} · invoiced {money(preview.billedToDate)} · remaining {money(preview.remaining)}
        </p>
      ) : null}

      {previewQuery.isLoading ? <p className="small text-muted mb-2">Calculating…</p> : null}
      {previewQuery.isError ? (
        <div className="alert alert-danger py-2 small mb-2">{errorMessage(previewQuery.error, "Could not calculate the invoice.")}</div>
      ) : null}
      {blocked ? <div className="alert alert-secondary py-2 small mb-2">{blocked}</div> : null}
      {(preview?.warnings ?? []).map((warning) => (
        <div key={warning} className="alert alert-warning py-2 small mb-2">{warning}</div>
      ))}

      {preview && preview.lines.length ? (
        <div className="table-responsive mb-2" style={{ maxHeight: 260 }}>
          <table className="table table-sm small mb-0">
            <thead>
              <tr>
                <th>Description</th>
                <th className="text-end">Qty</th>
                <th className="text-end">Rate</th>
                <th className="text-end">Amount</th>
              </tr>
            </thead>
            <tbody>
              {preview.lines.map((line, index) => (
                <tr key={line.timeEntryId ?? index}>
                  <td>{line.description}</td>
                  <td className="text-end">{line.quantity}</td>
                  <td className="text-end">{money(line.unitPrice)}</td>
                  <td className="text-end">{money(line.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={3} className="text-end">Subtotal (before tax)</th>
                <th className="text-end">{money(preview.subtotal)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}

      {error ? <div className="alert alert-danger py-2 small mb-2">{error}</div> : null}
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={!preview || !!blocked || generateMutation.isPending}
        onClick={() => generateMutation.mutate()}
      >
        {generateMutation.isPending ? "Generating…" : "Generate draft invoice"}
      </button>
      <span className="small text-muted ms-2">The draft opens in Invoices for review before you issue it.</span>
    </TechEarnestRecordRelatedCard>
  );
}
