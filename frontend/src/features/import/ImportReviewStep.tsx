import type { ImportSchema } from "./bulkImportApi";
import type { MappingSummary, PlannedCell, ReviewedRow, RowOutcome } from "./importPlan";
import type { CellStatus } from "./valueTransforms";

interface ImportReviewStepProps {
  schema: ImportSchema;
  reviewed: ReviewedRow[];
  summary: MappingSummary;
  validating: boolean;
  validationError: string | null;
  onRetry: () => void;
  onDownloadIssues: () => void;
}

const PREVIEW_ROWS = 10;
const MAX_LISTED_ISSUES = 300;

const CELL_BADGE: Record<CellStatus, { label: string; className: string }> = {
  valid: { label: "Valid", className: "text-bg-success" },
  converted: { label: "Converted", className: "text-bg-info" },
  warning: { label: "Warning", className: "text-bg-warning" },
  error: { label: "Error", className: "text-bg-danger" },
};

const OUTCOME_BADGE: Record<RowOutcome, { label: string; className: string }> = {
  valid: { label: "Valid", className: "text-bg-success" },
  warning: { label: "Warning", className: "text-bg-warning" },
  duplicate: { label: "Duplicate (skipped)", className: "text-bg-secondary" },
  invalid: { label: "Invalid", className: "text-bg-danger" },
};

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="border rounded px-3 py-2 bg-white" style={{ minWidth: 120 }}>
      <div className="small text-muted">{label}</div>
      <div className={`fs-5 fw-semibold${tone ? ` ${tone}` : ""}`}>{value}</div>
    </div>
  );
}

/** One sample cell per field, preferring the most informative status (error, warning, converted, valid). */
function conversionSamples(reviewed: ReviewedRow[]): PlannedCell[] {
  const rank: Record<CellStatus, number> = { error: 3, warning: 2, converted: 1, valid: 0 };
  const best = new Map<string, PlannedCell>();
  reviewed.forEach(({ row }) =>
    row.cells.forEach((cell) => {
      const current = best.get(cell.field);
      if (!current || rank[cell.result.status] > rank[current.result.status]) best.set(cell.field, cell);
    }),
  );
  return [...best.values()];
}

export function ImportReviewStep({
  schema,
  reviewed,
  summary,
  validating,
  validationError,
  onRetry,
  onDownloadIssues,
}: ImportReviewStepProps) {
  const labels = new Map(schema.fields.map((field) => [field.key, field.label]));
  const count = (outcome: RowOutcome) => reviewed.filter((item) => item.outcome === outcome).length;
  const errorCount = reviewed.reduce(
    (total, item) => total + (item.outcome === "invalid" ? item.messages.length - item.row.warnings.length : 0),
    0,
  );
  const warningCount = reviewed.reduce((total, item) => total + item.row.warnings.length, 0);
  const withIssues = reviewed.filter((item) => item.outcome !== "valid");
  const samples = conversionSamples(reviewed);
  const previewFields = schema.fields.filter((field) => reviewed.some(({ row }) => row.values[field.key] !== undefined));

  if (validating) {
    return (
      <div className="module-modal-body text-center py-5">
        <div className="spinner-border text-primary mb-3" role="status" aria-hidden="true" />
        <div className="small text-muted">
          Validating {reviewed.length} rows against the CRM (lookups, duplicates and business rules). Nothing is saved.
        </div>
      </div>
    );
  }

  return (
    <div className="module-modal-body">
      {validationError ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center">
          <span className="small">{validationError}</span>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={onRetry}>
            Retry validation
          </button>
        </div>
      ) : null}

      <h3 className="h6">Import summary</h3>
      <div className="d-flex flex-wrap gap-2 mb-2">
        <Stat label="Imported rows" value={reviewed.length} />
        <Stat label="Valid rows" value={count("valid") + count("warning")} tone="text-success" />
        <Stat label="Rows with warnings" value={count("warning")} tone="text-warning" />
        <Stat label="Duplicates to skip" value={count("duplicate")} />
        <Stat label="Invalid rows" value={count("invalid")} tone="text-danger" />
      </div>
      <div className="small text-muted mb-3">
        {errorCount} error{errorCount === 1 ? "" : "s"} · {warningCount} warning{warningCount === 1 ? "" : "s"} ·
        Fields mapped: {summary.mapped} · unmatched: {summary.unmatched} · ignored: {summary.ignored} · created:{" "}
        {summary.created} · requiring conversion: {summary.conversions}
      </div>

      {samples.length ? (
        <>
          <h3 className="h6">Conversion preview</h3>
          <div className="table-responsive mb-3" style={{ maxHeight: 260 }}>
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Imported</th>
                  <th>Target</th>
                  <th>Original value</th>
                  <th>Converted value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((cell) => (
                  <tr key={cell.field}>
                    <td className="small">{cell.fromDefault ? <em>Default value</em> : cell.header}</td>
                    <td className="small">{labels.get(cell.field)}</td>
                    <td className="small text-truncate" style={{ maxWidth: 200 }}>
                      {cell.original}
                    </td>
                    <td className="small text-truncate" style={{ maxWidth: 200 }}>
                      {cell.result.value ?? "—"}
                    </td>
                    <td className="small">
                      <span className={`badge ${CELL_BADGE[cell.result.status].className}`}>
                        {CELL_BADGE[cell.result.status].label}
                      </span>
                      {cell.result.message ? <div className="text-muted">{cell.result.message}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {previewFields.length ? (
        <>
          <h3 className="h6">Transformed data (first {Math.min(PREVIEW_ROWS, reviewed.length)} rows)</h3>
          <div className="table-responsive mb-3">
            <table className="table table-sm table-bordered mb-0 small">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Status</th>
                  {previewFields.map((field) => (
                    <th key={field.key}>{field.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reviewed.slice(0, PREVIEW_ROWS).map((item) => (
                  <tr key={item.row.sourceRow}>
                    <td>{item.row.sourceRow}</td>
                    <td>
                      <span className={`badge ${OUTCOME_BADGE[item.outcome].className}`}>
                        {OUTCOME_BADGE[item.outcome].label}
                      </span>
                    </td>
                    {previewFields.map((field) => (
                      <td key={field.key} className="text-truncate" style={{ maxWidth: 160 }}>
                        {item.row.values[field.key] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <div className="d-flex justify-content-between align-items-center mb-2">
        <h3 className="h6 mb-0">Validation issues</h3>
        {withIssues.length ? (
          <button type="button" className="btn btn-link btn-sm p-0" onClick={onDownloadIssues}>
            Download all issues (CSV)
          </button>
        ) : null}
      </div>
      {withIssues.length ? (
        <div className="table-responsive" style={{ maxHeight: 280 }}>
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Row</th>
                <th style={{ width: 150 }}>Outcome</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {withIssues.slice(0, MAX_LISTED_ISSUES).map((item) => (
                <tr key={item.row.sourceRow}>
                  <td className="small">{item.row.sourceRow}</td>
                  <td>
                    <span className={`badge ${OUTCOME_BADGE[item.outcome].className}`}>
                      {OUTCOME_BADGE[item.outcome].label}
                    </span>
                  </td>
                  <td className="small">{item.messages.join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {withIssues.length > MAX_LISTED_ISSUES ? (
            <div className="small text-muted mt-1">
              Showing the first {MAX_LISTED_ISSUES} of {withIssues.length}; download the CSV for the full list.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="alert alert-success py-2 mb-0 small">No problems found. Every row is ready to import.</div>
      )}
    </div>
  );
}
