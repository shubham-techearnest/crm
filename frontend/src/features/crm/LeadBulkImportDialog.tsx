import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { LeadImportResult } from "./crmApi";
import { importLeads } from "./crmApi";
import {
  LEAD_IMPORT_FIELD_OPTIONS,
  MAX_IMPORT_ROWS,
  UnsupportedFileError,
  downloadTextFile,
  guessMapping,
  leadImportTemplateCsv,
  prepareLeadRows,
  readSpreadsheetFile,
  type PreparedLeadRow,
  type RowProblem,
} from "./leadImport";
export { LEAD_IMPORT_FIELD_OPTIONS };

function importErrorMessage(error: unknown): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || "Import failed. Please try again.";
}

interface RegionOption {
  id: string;
  name: string;
}

interface LeadBulkImportDialogProps {
  open: boolean;
  regions: RegionOption[];
  onClose: () => void;
  onImported: (result: LeadImportResult) => void;
}

interface ReportLine {
  sourceRow: number;
  outcome: "SKIPPED" | "FAILED";
  reason: string;
}

interface ImportReport {
  result: LeadImportResult;
  lines: ReportLine[];
}

const PREVIEW_ROWS = 5;

export function LeadBulkImportDialog({ open, regions, onClose, onImported }: LeadBulkImportDialogProps) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [defaultRegionId, setDefaultRegionId] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [parseError, setParseError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const importMutation = useMutation({
    mutationFn: (input: { rows: PreparedLeadRow[]; problems: RowProblem[] }) =>
      importLeads(
        input.rows.map((row) => row.body),
        skipDuplicates,
      ),
    onSuccess: (result, input) => {
      const serverLines: ReportLine[] = result.issues.map((issue) => ({
        sourceRow: input.rows[issue.index]?.sourceRow ?? issue.index + 2,
        outcome: issue.outcome,
        reason: issue.reason,
      }));
      const clientLines: ReportLine[] = input.problems.map((problem) => ({
        sourceRow: problem.sourceRow,
        outcome: "FAILED",
        reason: problem.reason,
      }));
      const combined: LeadImportResult = {
        ...result,
        total: result.total + input.problems.length,
        failed: result.failed + input.problems.length,
      };
      setReport({
        result: combined,
        lines: [...serverLines, ...clientLines].sort((a, b) => a.sourceRow - b.sourceRow),
      });
      onImported(combined);
    },
  });

  const mappedFields = useMemo(() => new Set(mappings.filter(Boolean)), [mappings]);
  const hasIdentityColumn =
    mappedFields.has("lastName") || mappedFields.has("companyName") || mappedFields.has("email");
  const nonEmptyRowCount = useMemo(
    () => dataRows.filter((row) => row.some((cell) => cell.trim())).length,
    [dataRows],
  );
  const tooManyRows = nonEmptyRowCount > MAX_IMPORT_ROWS;

  function resetState() {
    setFileName("");
    setHeaders([]);
    setMappings([]);
    setDataRows([]);
    setParseError(null);
    setReport(null);
    importMutation.reset();
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleFile(file: File) {
    setParseError(null);
    setReport(null);
    importMutation.reset();
    setReading(true);
    try {
      const rows = await readSpreadsheetFile(file);
      if (rows.length < 2) {
        setParseError("The file must include a header row and at least one data row.");
        return;
      }
      const [headerRow, ...body] = rows;
      const width = Math.max(...rows.map((row) => row.length));
      const paddedHeaders = Array.from({ length: width }, (_, index) => headerRow[index] ?? "");
      setFileName(file.name);
      setHeaders(paddedHeaders);
      setMappings(paddedHeaders.map((header) => guessMapping(header)));
      setDataRows(body);
    } catch (error) {
      setParseError(
        error instanceof UnsupportedFileError
          ? error.message
          : "Could not read the file. Make sure it is a valid .xlsx or .csv file.",
      );
    } finally {
      setReading(false);
    }
  }

  function startImport() {
    setParseError(null);
    const prepared = prepareLeadRows(dataRows, mappings, defaultRegionId);
    if (!prepared.rows.length) {
      setParseError(
        prepared.problems.length
          ? `None of the rows could be imported. First problem (row ${prepared.problems[0].sourceRow}): ${prepared.problems[0].reason}`
          : "No rows to import after mapping.",
      );
      return;
    }
    importMutation.mutate(prepared);
  }

  function downloadReport() {
    if (!report) return;
    const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = ["Row,Outcome,Reason", ...report.lines.map((line) => `${line.sourceRow},${line.outcome},${quote(line.reason)}`)];
    downloadTextFile(`lead-import-report-${Date.now()}.csv`, lines.join("\r\n"), "text/csv;charset=utf-8");
  }

  if (!open) {
    return null;
  }

  const previewColumns = headers
    .map((header, index) => ({ header, index, field: mappings[index] }))
    .filter((column) => column.field);

  return (
    <div className="module-modal-backdrop" role="presentation" onClick={handleClose}>
      <div
        className="module-modal"
        role="dialog"
        aria-labelledby="lead-import-title"
        style={{ maxWidth: 860, width: "100%" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="module-modal-header">
          <h2 className="h5 mb-0" id="lead-import-title">
            Import leads
          </h2>
          <button type="button" className="btn-close" aria-label="Close" onClick={handleClose} />
        </div>

        {report ? (
          <div className="module-modal-body">
            <div className="d-flex flex-wrap gap-2 mb-3">
              <span className="badge text-bg-light border">Total rows: {report.result.total}</span>
              <span className="badge text-bg-success">Imported: {report.result.imported}</span>
              <span className="badge text-bg-warning">Skipped: {report.result.skipped}</span>
              <span className="badge text-bg-danger">Failed: {report.result.failed}</span>
            </div>
            {report.lines.length ? (
              <>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="small text-muted">Rows that were not imported</span>
                  <button type="button" className="btn btn-link btn-sm p-0" onClick={downloadReport}>
                    Download report
                  </button>
                </div>
                <div className="table-responsive" style={{ maxHeight: 320 }}>
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>Row</th>
                        <th style={{ width: 100 }}>Outcome</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.lines.map((line) => (
                        <tr key={`${line.sourceRow}-${line.outcome}`}>
                          <td className="small">{line.sourceRow}</td>
                          <td>
                            <span className={`badge ${line.outcome === "FAILED" ? "text-bg-danger" : "text-bg-warning"}`}>
                              {line.outcome === "FAILED" ? "Failed" : "Skipped"}
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
        ) : (
          <div className="module-modal-body">
            <p className="small text-muted">
              Upload an Excel (.xlsx) or CSV file with one lead per row and a header row at the top. Map the
              columns to lead fields, check the preview, then import. Up to {MAX_IMPORT_ROWS} leads per file.{" "}
              <button
                type="button"
                className="btn btn-link btn-sm p-0 align-baseline"
                onClick={() => downloadTextFile("lead-import-template.csv", leadImportTemplateCsv(), "text/csv;charset=utf-8")}
              >
                Download template
              </button>
            </p>
            {parseError ? <div className="alert alert-danger py-2">{parseError}</div> : null}
            {importMutation.error ? (
              <div className="alert alert-danger py-2">{importErrorMessage(importMutation.error)}</div>
            ) : null}

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label">File</label>
                <input
                  className="form-control form-control-sm"
                  type="file"
                  accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={reading || importMutation.isPending}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) await handleFile(file);
                  }}
                />
                {reading ? <div className="small text-muted mt-1">Reading file…</div> : null}
                {fileName && !reading ? (
                  <div className="small text-muted mt-1">
                    {fileName} · {nonEmptyRowCount} data rows
                  </div>
                ) : null}
              </div>
              <div className="col-md-6">
                <label className="form-label required">Region for imported leads</label>
                <select
                  className="form-select form-select-sm"
                  value={defaultRegionId}
                  onChange={(event) => setDefaultRegionId(event.target.value)}
                >
                  <option value="">Select region</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-check mb-3">
              <input
                className="form-check-input"
                type="checkbox"
                id="lead-import-skip-duplicates"
                checked={skipDuplicates}
                onChange={(event) => setSkipDuplicates(event.target.checked)}
              />
              <label className="form-check-label small" htmlFor="lead-import-skip-duplicates">
                Skip rows whose email already exists (in the CRM or earlier in the file)
              </label>
            </div>

            {tooManyRows ? (
              <div className="alert alert-warning py-2">
                This file has {nonEmptyRowCount} rows. Split it into files of at most {MAX_IMPORT_ROWS} rows.
              </div>
            ) : null}
            {headers.length && !hasIdentityColumn ? (
              <div className="alert alert-warning py-2">
                Map at least one of Last name, Company or Email so each lead can be identified.
              </div>
            ) : null}

            {headers.length ? (
              <>
                <h3 className="h6">Column mapping</h3>
                <div className="table-responsive mb-3" style={{ maxHeight: 260 }}>
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>File column</th>
                        <th>Sample value</th>
                        <th>Maps to</th>
                      </tr>
                    </thead>
                    <tbody>
                      {headers.map((header, index) => (
                        <tr key={`${header}-${index}`}>
                          <td className="small">{header || `Column ${index + 1}`}</td>
                          <td className="small text-muted text-truncate" style={{ maxWidth: 200 }}>
                            {dataRows.find((row) => row[index]?.trim())?.[index] ?? ""}
                          </td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={mappings[index] ?? ""}
                              onChange={(event) =>
                                setMappings((prev) => {
                                  const next = [...prev];
                                  next[index] = event.target.value;
                                  return next;
                                })
                              }
                            >
                              {LEAD_IMPORT_FIELD_OPTIONS.map((option) => (
                                <option
                                  key={option.key || "skip"}
                                  value={option.key}
                                  disabled={Boolean(option.key) && option.key !== mappings[index] && mappedFields.has(option.key)}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {previewColumns.length ? (
                  <>
                    <h3 className="h6">Preview (first {Math.min(PREVIEW_ROWS, nonEmptyRowCount)} rows)</h3>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered mb-0 small">
                        <thead>
                          <tr>
                            {previewColumns.map((column) => (
                              <th key={column.index}>
                                {LEAD_IMPORT_FIELD_OPTIONS.find((option) => option.key === column.field)?.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dataRows
                            .filter((row) => row.some((cell) => cell.trim()))
                            .slice(0, PREVIEW_ROWS)
                            .map((row, rowIndex) => (
                              <tr key={rowIndex}>
                                {previewColumns.map((column) => (
                                  <td key={column.index} className="text-truncate" style={{ maxWidth: 160 }}>
                                    {row[column.index] ?? ""}
                                  </td>
                                ))}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        )}

        <div className="module-modal-footer">
          {report ? (
            <>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetState}>
                Import another file
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleClose}>
                Done
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={
                  !defaultRegionId ||
                  !nonEmptyRowCount ||
                  !hasIdentityColumn ||
                  tooManyRows ||
                  reading ||
                  importMutation.isPending
                }
                onClick={startImport}
              >
                {importMutation.isPending ? "Importing…" : `Import ${nonEmptyRowCount} leads`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
