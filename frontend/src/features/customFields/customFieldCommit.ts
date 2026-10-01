import { isAxiosError } from "axios";
import type { QueryClient } from "@tanstack/react-query";
import { customFieldKeys, isRecordId, saveCustomFieldValues, type CustomFieldValues } from "./customFieldsApi";

/**
 * Custom field values are saved after the module's own save succeeds, because new records only get
 * an id from that save. Forms arm a pending commit right before they submit; the global mutation
 * cache hook then writes the values for the record returned by the save mutation.
 */
interface PendingCommit {
  token: number;
  tableCode: string;
  recordId: string | null;
  values: CustomFieldValues;
  armedAt: number;
  mutationId: number | null;
}

/** The save mutation must start shortly after Save is clicked, otherwise client validation failed. */
const START_WINDOW_MS = 3000;
let pending: PendingCommit | null = null;
let nextToken = 1;

export function armCustomFieldCommit(tableCode: string, recordId: string | null, values: CustomFieldValues): number {
  const token = nextToken++;
  pending = { token, tableCode, recordId, values, armedAt: Date.now(), mutationId: null };
  return token;
}

export function disarmCustomFieldCommit(token?: number) {
  if (!pending) return;
  if (token === undefined || pending.token === token) pending = null;
}

export function bindPendingCustomFields(mutationId: number) {
  if (!pending || pending.mutationId !== null) return;
  if (Date.now() - pending.armedAt > START_WINDOW_MS) {
    pending = null;
    return;
  }
  pending.mutationId = mutationId;
}

export function releasePendingCustomFields(mutationId: number) {
  if (pending?.mutationId === mutationId) pending = null;
}

function savedRecordId(data: unknown): string | null {
  if (data && typeof data === "object") {
    const id = (data as { id?: unknown }).id;
    if (isRecordId(id)) return id;
  }
  return null;
}

function errorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
  }
  return error instanceof Error ? error.message : "Unknown error";
}

export async function commitPendingCustomFields(
  data: unknown,
  mutationId: number,
  queryClient: QueryClient,
): Promise<void> {
  const commit = pending;
  if (!commit || commit.mutationId !== mutationId) return;
  pending = null;
  const recordId = commit.recordId ?? savedRecordId(data);
  if (!recordId) {
    window.alert("The record was saved, but its custom fields could not be linked to it. Edit the record to fill them in.");
    return;
  }
  if (!Object.keys(commit.values).length) return;
  try {
    await saveCustomFieldValues(commit.tableCode, recordId, commit.values);
    await queryClient.invalidateQueries({ queryKey: customFieldKeys.valuesForTable(commit.tableCode) });
  } catch (error) {
    if (commit.recordId) {
      throw new Error(`Custom fields could not be saved: ${errorMessage(error)}`);
    }
    window.alert(`The record was created, but its custom fields could not be saved: ${errorMessage(error)}`);
  }
}
