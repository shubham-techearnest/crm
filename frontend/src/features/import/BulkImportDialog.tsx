import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listRegions } from "@/features/admin/adminApi";
import { UnsupportedFileError, downloadTextFile, readSpreadsheetFile } from "./spreadsheetFile";
import {
  IGNORE_COLUMN,
  getImportSchema,
  importModuleRows,
  listImportTemplates,
  saveImportTemplates,
  validateModuleRows,
  type BulkImportResult,
  type ImportMappingTemplate,
  type ImportSchema,
} from "./bulkImportApi";
import { bestTemplate, matchColumns, normalizeHeader } from "./fieldMatching";
import { ImportMappingStep } from "./ImportMappingStep";
import { ImportReviewStep } from "./ImportReviewStep";
import {
  buildImportPlan,
  classifyRows,
  mappingBlockers,
  summarizeMapping,
  type MappingDecisions,
  type PlannedRow,
  type ReviewedRow,
} from "./importPlan";
import type { ModuleImportConfig } from "./moduleImportConfigs";

interface BulkImportDialogProps {
  config: ModuleImportConfig;
  open: boolean;
  onClose: () => void;
  onImported: (result: BulkImportResult) => void;
}

type Step = "upload" | "mapping" | "review" | "result";

interface ReportLine {
  sourceRow: number;
  outcome: "SKIPPED" | "FAILED";
  reason: string;
}

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "mapping", label: "Map fields" },
  { id: "review", label: "Preview & validate" },
  { id: "result", label: "Result" },
];

const EMPTY_DECISIONS: MappingDecisions = {
  mappings: [],
  transforms: {},
  defaults: {},
  valueMaps: {},
  defaultRegionId: "",
};

function errorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || (error instanceof Error && error.message) || fallback;
}

function csvQuote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function decisionsFor(
  headers: string[],
  schema: ImportSchema,
  template: ImportMappingTemplate | null,
  defaultRegionId: string,
): MappingDecisions {
  return {
    mappings: matchColumns(headers, schema.fields, template),
    transforms: { ...(template?.transforms ?? {}) },
    defaults: { ...(template?.defaults ?? {}) },
    valueMaps: { ...(template?.valueMaps ?? {}) },
    defaultRegionId,
  };
}

export function BulkImportDialog({ config, open, onClose, onImported }: BulkImportDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [decisions, setDecisions] = useState<MappingDecisions>(EMPTY_DECISIONS);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [plan, setPlan] = useState<PlannedRow[]>([]);
  const [sentRows, setSentRows] = useState<PlannedRow[]>([]);
  const [dryRun, setDryRun] = useState<BulkImportResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [report, setReport] = useState<{ result: BulkImportResult; lines: ReportLine[] } | null>(null);

  const schemaQuery = useQuery({
    queryKey: ["imports", "schema", config.module],
    queryFn: () => getImportSchema(config.module),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const schema = schemaQuery.data;
  const templatesQuery = useQuery({
    queryKey: ["imports", "templates", config.module],
    queryFn: () => listImportTemplates(config.module),
    enabled: open,
  });
  const templates = templatesQuery.data ?? [];
  const regionsQuery = useQuery({
    queryKey: ["imports", "regions"],
    queryFn: listRegions,
    enabled: open && !!schema?.usesRegion,
  });

  const reviewed: ReviewedRow[] = useMemo(() => classifyRows(plan, sentRows, dryRun), [plan, sentRows, dryRun]);
  const importable = reviewed.filter((item) => item.outcome === "valid" || item.outcome === "warning");
  const blockers = schema ? mappingBlockers(schema, decisions) : [];
  const maxRows = schema?.maxRows ?? 2000;

  function resetAll() {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setDataRows([]);
    setDecisions(EMPTY_DECISIONS);
    setAppliedTemplate(null);
    setFileError(null);
    setPlan([]);
    setSentRows([]);
    setDryRun(null);
    setValidationError(null);
    setImportError(null);
    setReport(null);
  }

  function handleClose() {
    if (validating || importing) return;
    resetAll();
    onClose();
  }

  async function handleFile(file: File) {
    if (!schema) return;
    setFileError(null);
    setReading(true);
    try {
      const rows = await readSpreadsheetFile(file);
      if (rows.length < 2) {
        setFileError("The file must include a header row and at least one data row.");
        return;
      }
      const [headerRow, ...body] = rows;
      const width = Math.max(...rows.map((row) => row.length));
      const paddedHeaders = Array.from({ length: width }, (_, index) => headerRow[index]?.trim() ?? "");
      const nonEmpty = body.filter((row) => row.some((cell) => cell?.trim())).length;
      if (nonEmpty > maxRows) {
        setFileError(`This file has ${nonEmpty} rows. Split it into files of at most ${maxRows} rows.`);
        return;
      }
      const template = bestTemplate(paddedHeaders, templates);
      setFileName(file.name);
      setHeaders(paddedHeaders);
      setDataRows(body);
      setAppliedTemplate(template?.name ?? null);
      setDecisions(decisionsFor(paddedHeaders, schema, template, ""));
      setStep("mapping");
    } catch (error) {
      setFileError(
        error instanceof UnsupportedFileError
          ? error.message
          : "Could not read the file. Make sure it is a valid .xlsx or .csv file.",
      );
    } finally {
      setReading(false);
    }
  }

  function applyTemplate(name: string | null) {
    if (!schema) return;
    const template = name ? (templates.find((item) => item.name === name) ?? null) : null;
    setAppliedTemplate(template?.name ?? null);
    setDecisions(decisionsFor(headers, schema, template, decisions.defaultRegionId));
  }

  async function saveTemplate(name: string) {
    const columns: Record<string, string> = {};
    decisions.mappings.forEach((mapping) => {
      const key = normalizeHeader(mapping.header);
      if (!key) return;
      if (mapping.status === "ignored") columns[key] = IGNORE_COLUMN;
      else if (mapping.target && mapping.status === "matched") columns[key] = mapping.target;
    });
    const template: ImportMappingTemplate = {
      name,
      columns,
      transforms: decisions.transforms,
      defaults: decisions.defaults,
      valueMaps: decisions.valueMaps,
      savedAt: new Date().toISOString(),
    };
    const next = [...templates.filter((item) => item.name !== name), template];
    await saveImportTemplates(config.module, next);
    queryClient.setQueryData(["imports", "templates", config.module], next);
    setAppliedTemplate(name);
  }

  async function runValidation() {
    if (!schema) return;
    const nextPlan = buildImportPlan(dataRows, schema, decisions);
    const toSend = nextPlan.filter((row) => !row.errors.length);
    setPlan(nextPlan);
    setSentRows(toSend);
    setDryRun(null);
    setValidationError(null);
    setImportError(null);
    setStep("review");
    if (!toSend.length) return;
    setValidating(true);
    try {
      setDryRun(
        await validateModuleRows(
          config.module,
          toSend.map((row) => row.values),
          { defaultRegionId: decisions.defaultRegionId, skipDuplicates },
        ),
      );
    } catch (error) {
      setValidationError(errorMessage(error, "Validation failed. Please try again."));
    } finally {
      setValidating(false);
    }
  }

  async function runImport() {
    const rows = importable.map((item) => item.row);
    setImporting(true);
    setImportError(null);
    try {
      const result = await importModuleRows(
        config.module,
        rows.map((row) => row.values),
        { defaultRegionId: decisions.defaultRegionId, skipDuplicates },
      );
      const lines: ReportLine[] = [
        ...result.issues.map((issue) => ({
          sourceRow: rows[issue.index]?.sourceRow ?? issue.index + 2,
          outcome: issue.outcome,
          reason: issue.reason,
        })),
        ...reviewed
          .filter((item) => item.outcome === "invalid" || item.outcome === "duplicate")
          .map((item) => ({
            sourceRow: item.row.sourceRow,
            outcome: (item.outcome === "duplicate" ? "SKIPPED" : "FAILED") as ReportLine["outcome"],
            reason: item.messages.join("; "),
          })),
      ].sort((a, b) => a.sourceRow - b.sourceRow);
      const combined: BulkImportResult = {
        ...result,
        total: reviewed.length,
        skipped: lines.filter((line) => line.outcome === "SKIPPED").length,
        failed: lines.filter((line) => line.outcome === "FAILED").length,
      };
      setReport({ result: combined, lines });
      setStep("result");
      onImported(combined);
    } catch (error) {
      setImportError(errorMessage(error, "Import failed. Please try again."));
    } finally {
      setImporting(false);
    }
  }

  function downloadIssues() {
    const lines = [
      "Row,Outcome,Details",
      ...reviewed
        .filter((item) => item.outcome !== "valid")
        .map((item) => `${item.row.sourceRow},${item.outcome},${csvQuote(item.messages.join("; "))}`),
    ];
    downloadTextFile(`${config.module}-import-issues-${Date.now()}.csv`, lines.join("\r\n"), "text/csv;charset=utf-8");
  }

  function downloadReport() {
    if (!report) return;
    const lines = ["Row,Outcome,Reason", ...report.lines.map((line) => `${line.sourceRow},${line.outcome},${csvQuote(line.reason)}`)];
    downloadTextFile(`${config.module}-import-report-${Date.now()}.csv`, lines.join("\r\n"), "text/csv;charset=utf-8");
  }

  if (!open) {
    return null;
  }

  const titleId = `${config.module}-import-title`;
  const stepIndex = STEPS.findIndex((item) => item.id === step);
  const rowCount = dataRows.filter((row) => row.some((cell) => cell?.trim())).length;

  return (
    <div className="module-modal-backdrop" role="presentation" onClick={handleClose}>
      <div
        className="module-modal module-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ width: "min(1180px, 100%)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="module-modal-header">
          <div>
            <h2 className="h5 mb-1" id={titleId}>
              Bulk upload {config.plural}
            </h2>
            <ol className="d-flex flex-wrap gap-3 list-unstyled small mb-0" aria-label="Import steps">
              {STEPS.map((item, index) => (
                <li
                  key={item.id}
                  className={index === stepIndex ? "fw-semibold text-primary" : index < stepIndex ? "text-success" : "text-muted"}
                  aria-current={index === stepIndex ? "step" : undefined}
                >
                  {index + 1}. {item.label}
                </li>
              ))}
            </ol>
          </div>
          <button type="button" className="btn-close" aria-label="Close" onClick={handleClose} />
        </div>

        {step === "upload" ? (
          <div className="module-modal-body">
            {schemaQuery.isLoading ? <div className="small text-muted">Loading {config.singular} fields…</div> : null}
            {schemaQuery.error ? (
              <div className="alert alert-danger py-2 d-flex flex-wrap align-items-center justify-content-between gap-2">
                <span>
                  {(schemaQuery.error as { response?: { status?: number } })?.response?.status === 404
                    ? `Bulk upload for ${config.plural} is not available on the server yet. Restart the backend so it picks up the latest version, then retry.`
                    : errorMessage(schemaQuery.error, `Could not load ${config.singular} fields for the import.`)}
                </span>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  disabled={schemaQuery.isFetching}
                  onClick={() => void schemaQuery.refetch()}
                >
                  {schemaQuery.isFetching ? "Retrying…" : "Retry"}
                </button>
              </div>
            ) : null}
            {schema ? (
              <>
                <p className="small text-muted">
                  Upload an Excel (.xlsx) or CSV file with a header row. Columns are matched to {config.singular} fields
                  automatically; you review every match, decide what happens to unmatched columns and preview the
                  converted data before anything is saved. Up to {maxRows} rows per file.
                </p>
                {fileError ? <div className="alert alert-danger py-2">{fileError}</div> : null}
                <label className="form-label" htmlFor={`${config.module}-import-file`}>
                  File
                </label>
                <input
                  id={`${config.module}-import-file`}
                  className="form-control"
                  type="file"
                  accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={reading}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) await handleFile(file);
                  }}
                />
                {reading ? <div className="small text-muted mt-2">Reading file…</div> : null}
                {templates.length ? (
                  <div className="small text-muted mt-2">
                    {templates.length} saved mapping{templates.length === 1 ? "" : "s"} available; a matching one is
                    applied automatically.
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {step === "mapping" && schema ? (
          <ImportMappingStep
            schema={schema}
            fileName={fileName}
            rowCount={rowCount}
            dataRows={dataRows}
            decisions={decisions}
            onChange={setDecisions}
            regions={regionsQuery.data ?? []}
            skipDuplicates={skipDuplicates}
            onSkipDuplicatesChange={setSkipDuplicates}
            templates={templates}
            appliedTemplate={appliedTemplate}
            onApplyTemplate={applyTemplate}
            onSaveTemplate={saveTemplate}
          />
        ) : null}

        {step === "review" && schema ? (
          <>
            <ImportReviewStep
              schema={schema}
              reviewed={reviewed}
              summary={summarizeMapping(schema, decisions)}
              validating={validating}
              validationError={validationError}
              onRetry={() => void runValidation()}
              onDownloadIssues={downloadIssues}
            />
            {importError ? (
              <div className="px-4">
                <div className="alert alert-danger py-2">{importError}</div>
              </div>
            ) : null}
          </>
        ) : null}

        {step === "result" && report ? (
          <div className="module-modal-body">
            <div className="d-flex flex-wrap gap-2 mb-3">
              <span className="badge text-bg-light border">Total rows: {report.result.total}</span>
              <span className="badge text-bg-success">Imported: {report.result.imported}</span>
              <span className="badge text-bg-warning">Skipped: {report.result.skipped}</span>
              <span className="badge text-bg-danger">Not imported: {report.result.failed}</span>
            </div>
            {report.lines.length ? (
              <>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="small text-muted">Rows that were not imported</span>
                  <button type="button" className="btn btn-link btn-sm p-0" onClick={downloadReport}>
                    Download error report
                  </button>
                </div>
                <div className="table-responsive" style={{ maxHeight: 360 }}>
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>Row</th>
                        <th style={{ width: 110 }}>Outcome</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.lines.map((line) => (
                        <tr key={`${line.sourceRow}-${line.outcome}-${line.reason}`}>
                          <td className="small">{line.sourceRow}</td>
                          <td>
                            <span className={`badge ${line.outcome === "FAILED" ? "text-bg-danger" : "text-bg-warning"}`}>
                              {line.outcome === "FAILED" ? "Not imported" : "Skipped"}
                            </span>
                          </td>
                          <td className="small">{line.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="alert alert-success py-2 mb-0">All rows were imported.</div>
            )}
          </div>
        ) : null}

        <div className="module-modal-footer">
          {step === "upload" ? (
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleClose}>
              Cancel
            </button>
          ) : null}
          {step === "mapping" ? (
            <>
              <button type="button" className="btn btn-outline-secondary btn-sm me-auto" onClick={resetAll}>
                Choose another file
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleClose}>
                Cancel import
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={blockers.length > 0 || !rowCount}
                onClick={() => void runValidation()}
              >
                Preview &amp; validate
              </button>
            </>
          ) : null}
          {step === "review" ? (
            <>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm me-auto"
                disabled={validating || importing}
                onClick={() => setStep("mapping")}
              >
                Back to mapping
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={validating || importing}
                onClick={handleClose}
              >
                Cancel import
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={validating || importing || !!validationError || !importable.length}
                onClick={() => void runImport()}
              >
                {importing
                  ? "Importing…"
                  : `Import ${importable.length} valid ${importable.length === 1 ? "row" : "rows"}`}
              </button>
            </>
          ) : null}
          {step === "result" ? (
            <>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetAll}>
                Import another file
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleClose}>
                Done
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}