import type { Activity } from "@/features/crm/crmApi";
import type { AuditLog } from "@/features/admin/adminApi";
import { formatDealStage } from "./ZohoDealStagePipeline";

export interface TimelineChange {
  label: string;
  from?: string | null;
  to?: string | null;
}

export interface TimelineEntry {
  id: string;
  at: string;
  title?: string;
  subtitle?: string;
  actor?: string;
  changes?: TimelineChange[];
}

export interface DealStageHistoryEntry {
  id: string;
  fromStage: string | null;
  toStage: string;
  changedBy: string;
  changedAt: string;
}

export interface RecordLifecycleInfo {
  entityLabel: string;
  createdAt: string;
  updatedAt: string;
  actorId?: string | null;
}

export function recordLifecycleInfo(
  entityLabel: string,
  record?: { createdAt?: string | null; updatedAt?: string | null; ownerId?: string | null } | null,
): RecordLifecycleInfo | undefined {
  if (!record?.createdAt || !record?.updatedAt) return undefined;
  return {
    entityLabel,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    actorId: record.ownerId,
  };
}

export interface TimelineNote {
  id: string;
  body: string;
  createdAt: string;
  createdBy?: string | null;
}

const MONEY_FIELDS = new Set([
  "amount",
  "value",
  "expectedrevenue",
  "estimatedvalue",
  "expected revenue",
  "estimated value",
]);

export function buildTimelineEntries(
  auditLogs: AuditLog[] | undefined,
  activities: Activity[] | undefined,
  userName?: (userId: string | null | undefined) => string,
  lifecycle?: RecordLifecycleInfo,
  notes?: TimelineNote[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const log of auditLogs ?? []) {
    entries.push(parseAuditLog(log, userName));
  }

  for (const activity of activities ?? []) {
    entries.push({
      id: `activity-${activity.id}`,
      at: activity.updatedAt || activity.createdAt,
      title: `${activity.type}: ${activity.subject}`,
      subtitle: activity.status,
    });
  }

  for (const note of notes ?? []) {
    entries.push({
      id: `note-${note.id}`,
      at: note.createdAt,
      title: "Note added",
      subtitle: note.body,
      actor: userName?.(note.createdBy),
    });
  }

  return appendRecordLifecycleEntries(entries, lifecycle, userName);
}

export function buildDealTimelineEntries(
  auditLogs: AuditLog[] | undefined,
  activities: Activity[] | undefined,
  stageHistory: DealStageHistoryEntry[] | undefined,
  userName?: (userId: string | null | undefined) => string,
  lifecycle?: RecordLifecycleInfo,
  notes?: TimelineNote[],
): TimelineEntry[] {
  let entries = buildTimelineEntries(auditLogs, activities, userName, lifecycle, notes);

  for (const row of stageHistory ?? []) {
    const duplicate = entries.some(
      (entry) =>
        entry.changes?.some((change) => change.label === "Stage") &&
        Math.abs(new Date(entry.at).getTime() - new Date(row.changedAt).getTime()) < 2000,
    );
    if (duplicate) continue;

    entries.push({
      id: `stage-${row.id}`,
      at: row.changedAt,
      actor: userName?.(row.changedBy),
      changes: [
        {
          label: "Stage",
          from: row.fromStage ? formatDealStage(row.fromStage) : null,
          to: formatDealStage(row.toStage),
        },
      ],
    });
  }

  return sortTimelineEntries(entries);
}

function appendRecordLifecycleEntries(
  entries: TimelineEntry[],
  lifecycle: RecordLifecycleInfo | undefined,
  userName?: (userId: string | null | undefined) => string,
): TimelineEntry[] {
  if (!lifecycle) return sortTimelineEntries(entries);

  const result = [...entries];
  const actor = lifecycle.actorId ? userName?.(lifecycle.actorId) : undefined;
  const hasCreate = result.some((entry) => entry.title?.toLowerCase().includes("was created"));

  if (!hasCreate) {
    result.push({
      id: `lifecycle-created-${lifecycle.createdAt}`,
      at: lifecycle.createdAt,
      title: `${lifecycle.entityLabel} was created`,
      actor,
    });
  }

  const createdMs = new Date(lifecycle.createdAt).getTime();
  const updatedMs = new Date(lifecycle.updatedAt).getTime();
  const hasUpdateAudit = result.some(
    (entry) => Math.abs(new Date(entry.at).getTime() - updatedMs) < 3000,
  );

  if (updatedMs - createdMs > 3000 && !hasUpdateAudit) {
    result.push({
      id: `lifecycle-updated-${lifecycle.updatedAt}`,
      at: lifecycle.updatedAt,
      title: `${lifecycle.entityLabel} was updated`,
      actor,
    });
  }

  return sortTimelineEntries(result);
}

function parseAuditLog(log: AuditLog, userName?: (userId: string | null | undefined) => string): TimelineEntry {
  const changes = parseAuditChanges(log.newValue);
  if (changes.length > 0) {
    return {
      id: `audit-${log.id}`,
      at: log.createdAt,
      actor: userName?.(log.userId),
      changes,
    };
  }

  return {
    id: `audit-${log.id}`,
    at: log.createdAt,
    actor: userName?.(log.userId),
    title: formatAuditAction(log.action, log.entityType),
  };
}

function parseAuditChanges(newValue?: string | null): TimelineChange[] {
  if (!newValue) return [];
  try {
    const parsed = JSON.parse(newValue) as {
      changes?: Array<{ field?: string; label?: string; from?: unknown; to?: unknown }>;
    };
    if (!Array.isArray(parsed.changes)) return [];
    return parsed.changes.map((change) => ({
      label: change.label ?? labelize(String(change.field ?? "Field")),
      from: formatTimelineValue(change.label ?? change.field, change.from),
      to: formatTimelineValue(change.label ?? change.field, change.to),
    }));
  } catch {
    return [];
  }
}

function formatAuditAction(action: string, entityType: string) {
  const entity = entityType.toLowerCase();
  switch (action) {
    case "CREATE":
      return `${capitalize(entity)} was created`;
    case "UPDATE":
      return `${capitalize(entity)} was updated`;
    case "DELETE":
      return `${capitalize(entity)} was deleted`;
    case "ASSIGN":
      return `${capitalize(entity)} owner was assigned`;
    case "CONVERT":
      return `${capitalize(entity)} was converted`;
    default:
      return action.replace(/_/g, " ");
  }
}

export function formatTimelineValue(labelOrField: string | undefined, value: unknown): string | null {
  if (value == null || value === "") return null;
  const raw = String(value);
  const key = (labelOrField ?? "").toLowerCase();
  if (MONEY_FIELDS.has(key) || key.includes("amount") || key.includes("revenue") || key.includes("value")) {
    const amount = Number(raw);
    if (Number.isFinite(amount)) {
      return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
    }
  }
  if (key.includes("probability")) {
    const amount = Number(raw);
    if (Number.isFinite(amount)) return String(amount);
  }
  return raw;
}

function labelize(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sortTimelineEntries(entries: TimelineEntry[]) {
  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function groupTimelineByDate(entries: TimelineEntry[]) {
  const groups = new Map<string, TimelineEntry[]>();
  for (const entry of entries) {
    const key = new Date(entry.at).toLocaleDateString("en-GB");
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

export function formatTimelineTime(at: string) {
  return new Date(at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function formatTimelineDate(at: string) {
  return new Date(at).toLocaleDateString("en-GB");
}
