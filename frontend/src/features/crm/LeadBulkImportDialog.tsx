import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { CreateLeadBody } from "./crmApi";
import { importLeads } from "./crmApi";
import { readCsvFile } from "@/utils/csvParse";

export const LEAD_IMPORT_FIELD_OPTIONS = [
  { key: "", label: "— Skip column —" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "companyName", label: "Company" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website" },
  { key: "source", label: "Lead source" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "industry", label: "Industry" },
  { key: "designation", label: "Designation" },
  { key: "estimatedValue", label: "Estimated value" },
  { key: "expectedCloseDate", label: "Expected close date" },
  { key: "description", label: "Description" },
] as const;

interface RegionOption {
  id: string;
  name: string;
}

interface LeadBulkImportDialogProps {
  open: boolean;
  regions: RegionOption[];
  onClose: () => void;
  onImported: (count: number) => void;
}

function guessMapping(header: string): string {
  const normalized = header.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const guesses: Record<string, string> = {
    firstname: "firstName",
    lastname: "lastName",
    company: "companyName",
    companyname: "companyName",
    email: "email",
    phone: "phone",
    website: "website",
    source: "source",
    leadsource: "source",
    status: "status",
    priority: "priority",
    industry: "industry",
    designation: "designation",
    title: "designation",
    estimatedvalue: "estimatedValue",
    value: "estimatedValue",
    expectedclosedate: "expectedCloseDate",
    closedate: "expectedCloseDate",
    description: "description",
    notes: "description",
  };
  return guesses[normalized] ?? "";
}

function buildLeadRows(
  rows: string[][],
  mappings: string[],
  defaultRegionId: string,
): CreateLeadBody[] {
  const [, ...dataRows] = rows;
  return dataRows
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => {
      const body: CreateLeadBody = { regionId: defaultRegionId, status: "NEW" };
      mappings.forEach((field, index) => {
        if (!field) return;
        const raw = row[index]?.trim();
        if (!raw) return;
        if (field === "estimatedValue") {
          const n = Number(raw);
          if (Number.isFinite(n)) body.estimatedValue = n;
          return;
        }
        (body as Record<string, string | number | null | undefined>)[field] = raw;
      });
      return body;
    });
}

export function LeadBulkImportDialog({ open, regions, onClose, onImported }: LeadBulkImportDialogProps) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [defaultRegionId, setDefaultRegionId] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: (rows: CreateLeadBody[]) => importLeads(rows),
    onSuccess: (result) => {
      onImported(result.imported);
      onClose();
      resetState();
    },
  });

  function resetState() {
    setFileName("");
    setHeaders([]);
    setMappings([]);
    setDataRows([]);
    setParseError(null);
  }

  const previewCount = useMemo(() => dataRows.length, [dataRows]);

  if (!open) {
    return null;
  }

  return (
    <div className="module-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="module-modal"
        role="dialog"
        aria-labelledby="lead-import-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="module-modal-header">
          <h2 className="h5 mb-0" id="lead-import-title">
            Import leads from CSV
          </h2>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
        </div>
        <div className="module-modal-body">
          <p className="small text-muted">
            Upload a CSV file (export Excel as CSV), map columns to lead fields, then import.
          </p>
          {parseError ? <div className="alert alert-danger py-2">{parseError}</div> : null}
          {importMutation.error ? (
            <div className="alert alert-danger py-2">Import failed. Check mappings and required region.</div>
          ) : null}
          <div className="mb-3">
            <label className="form-label">CSV file</label>
            <input
              className="form-control form-control-sm"
              type="file"
              accept=".csv,text/csv"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setParseError(null);
                try {
                  const rows = await readCsvFile(file);
                  if (rows.length < 2) {
                    setParseError("File must include a header row and at least one data row.");
                    return;
                  }
                  const [headerRow, ...body] = rows;
                  setFileName(file.name);
                  setHeaders(headerRow);
                  setMappings(headerRow.map((header) => guessMapping(header)));
                  setDataRows(body);
                } catch {
                  setParseError("Could not read CSV file.");
                }
                event.target.value = "";
              }}
            />
            {fileName ? <div className="small text-muted mt-1">{fileName} · {previewCount} rows</div> : null}
          </div>
          <div className="mb-3">
            <label className="form-label required">Default region</label>
            <select
              className="form-select form-select-sm"
              value={defaultRegionId}
              onChange={(event) => setDefaultRegionId(event.target.value)}
            >
              <option value="">Select region for imported leads</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
          {headers.length ? (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>File column</th>
                    <th>Maps to</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((header, index) => (
                    <tr key={`${header}-${index}`}>
                      <td className="small">{header || `Column ${index + 1}`}</td>
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
                            <option key={option.key || "skip"} value={option.key}>
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
          ) : null}
        </div>
        <div className="module-modal-footer">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={
              !defaultRegionId ||
              !dataRows.length ||
              !mappings.some(Boolean) ||
              importMutation.isPending
            }
            onClick={() => {
              const payload = buildLeadRows([headers, ...dataRows], mappings, defaultRegionId);
              if (!payload.length) {
                setParseError("No rows to import after mapping.");
                return;
              }
              importMutation.mutate(payload);
            }}
          >
            {importMutation.isPending ? "Importing…" : `Import ${previewCount} leads`}
          </button>
        </div>
      </div>
    </div>
  );
}
