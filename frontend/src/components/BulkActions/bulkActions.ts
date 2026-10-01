import { isValidElement, type ReactNode } from "react";
import { isAxiosError } from "axios";
import api from "@/api/client";
import type { ApiResponse } from "@/types/api";

export interface BulkOption {
  value: string;
  label: string;
}

export type BulkInput =
  | { kind: "select"; label: string; options: BulkOption[]; placeholder?: string; optional?: boolean }
  | { kind: "text"; label: string; placeholder?: string; optional?: boolean; multiline?: boolean }
  | { kind: "date"; label: string; optional?: boolean; defaultToday?: boolean };

export interface BulkBatchResult {
  succeeded: number;
  failures: { id: string; reason: string }[];
}

export interface BulkAction<T> {
  id: string;
  label: string;
  tone?: "default" | "danger" | "success" | "warning";
  /** Use for permission gating; hidden actions are not rendered. */
  visible?: boolean;
  /** Rows that fail this check are skipped and reported, not sent to the server. */
  applies?: (row: T) => boolean;
  confirm?: string;
  input?: BulkInput;
  /** Past-tense verb for the result summary, e.g. "deleted". */
  doneLabel?: string;
  run?: (row: T, value: string) => Promise<unknown>;
  runBatch?: (ids: string[], value: string) => Promise<BulkBatchResult>;
}

export interface BulkConfig<T> {
  actions?: BulkAction<T>[];
  /** Plural noun used in the bar, e.g. "leads". */
  noun?: string;
  rowLabel?: (row: T) => string;
  onComplete?: () => void;
  exportFileName?: string;
  csvValue?: (row: T, field: string) => string | null | undefined;
}

export interface BulkFailure {
  id: string;
  label: string;
  reason: string;
}

export interface BulkOutcome {
  action: string;
  doneLabel: string;
  succeeded: number;
  skipped: number;
  failures: BulkFailure[];
  succeededIds: string[];
}

const BATCH_SIZE = 100;
const CONCURRENCY = 4;

export function bulkErrorMessage(error: unknown, fallback = "Failed"): string {
  if (isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
    if (error.response?.status === 403) return "You do not have permission for this action";
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function runBulkAction<T>(
  action: BulkAction<T>,
  rows: T[],
  rowKey: (row: T) => string,
  value: string,
  rowLabel: (row: T) => string,
): Promise<BulkOutcome> {
  const eligible = action.applies ? rows.filter(action.applies) : rows;
  const labels = new Map(rows.map((row) => [rowKey(row), rowLabel(row)]));
  const failures: BulkFailure[] = [];
  const succeededIds: string[] = [];

  if (action.runBatch) {
    const ids = eligible.map(rowKey);
    for (let start = 0; start < ids.length; start += BATCH_SIZE) {
      const chunk = ids.slice(start, start + BATCH_SIZE);
      try {
        const result = await action.runBatch(chunk, value);
        const failed = new Set(result.failures.map((failure) => failure.id));
        result.failures.forEach((failure) =>
          failures.push({ id: failure.id, label: labels.get(failure.id) ?? failure.id, reason: failure.reason }),
        );
        chunk.filter((id) => !failed.has(id)).forEach((id) => succeededIds.push(id));
      } catch (error) {
        const reason = bulkErrorMessage(error);
        chunk.forEach((id) => failures.push({ id, label: labels.get(id) ?? id, reason }));
      }
    }
  } else if (action.run) {
    const run = action.run;
    let cursor = 0;
    const worker = async () => {
      while (cursor < eligible.length) {
        const row = eligible[cursor++];
        const id = rowKey(row);
        try {
          await run(row, value);
          succeededIds.push(id);
        } catch (error) {
          failures.push({ id, label: labels.get(id) ?? id, reason: bulkErrorMessage(error) });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, eligible.length) }, worker));
  }

  return {
    action: action.label,
    doneLabel: action.doneLabel ?? "updated",
    succeeded: succeededIds.length,
    skipped: rows.length - eligible.length,
    failures,
    succeededIds,
  };
}

/** DELETE a record by path; throws with the server message on failure. */
export async function deleteRecord(path: string): Promise<void> {
  const { data } = await api.delete<ApiResponse<unknown>>(path);
  if (data && data.success === false) throw new Error(data.message ?? "Could not delete record");
}

/** POST a record action (approve, submit, …) by path. */
export async function postRecordAction(path: string, body?: unknown): Promise<void> {
  const { data } = await api.post<ApiResponse<unknown>>(path, body ?? {});
  if (data && data.success === false) throw new Error(data.message ?? "Action failed");
}

/** PUT a full record body by path. */
export async function putRecord(path: string, body: unknown): Promise<void> {
  const { data } = await api.put<ApiResponse<unknown>>(path, body);
  if (data && data.success === false) throw new Error(data.message ?? "Update failed");
}

interface ServerBulkResult {
  succeeded: number;
  failed: number;
  failures: { id?: string; leadId?: string; reason: string }[];
}

/** Calls a server-side bulk endpoint that returns {succeeded, failed, failures}. */
export async function postServerBulk(path: string, body: unknown): Promise<BulkBatchResult> {
  const { data } = await api.post<ApiResponse<ServerBulkResult>>(path, body);
  if (!data?.data) throw new Error(data?.message ?? "Bulk action failed");
  return {
    succeeded: data.data.succeeded,
    failures: data.data.failures.map((failure) => ({
      id: failure.id ?? failure.leadId ?? "",
      reason: failure.reason,
    })),
  };
}

/** Best-effort plain text of a rendered cell, used for CSV export of what the user sees. */
export function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement(node)) {
    const props = node.props as Record<string, unknown>;
    if (props.children != null) return nodeText(props.children as ReactNode);
    for (const key of ["label", "value", "status", "title", "name", "text"]) {
      const candidate = props[key];
      if (typeof candidate === "string" || typeof candidate === "number") return String(candidate);
    }
  }
  return "";
}

function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function downloadCsv(fileName: string, header: string[], rows: string[][]): void {
  const content = [header, ...rows].map((line) => line.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([`\ufeff${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function statusIn<T extends { status?: string | null }>(...statuses: string[]) {
  const allowed = new Set(statuses);
  return (row: T) => allowed.has(String(row.status ?? "").toUpperCase());
}

export function statusNotIn<T extends { status?: string | null }>(...statuses: string[]) {
  const blocked = new Set(statuses);
  return (row: T) => !blocked.has(String(row.status ?? "").toUpperCase());
}
