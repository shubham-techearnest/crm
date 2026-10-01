import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { isAxiosError } from "axios";
import { buildTimelineEntries, recordLifecycleInfo, TechEarnestRecordTimeline } from "@/components/TechEarnestRecord";
import { optionsFromPairs, TechEarnestPicker, type TechEarnestPickerOption } from "@/components/TechEarnestCreate";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listAuditLogs, type AdminUser } from "./adminApi";

export function adminErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
  }
  return fallback;
}

export function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export const inputClass = (invalid?: unknown) => `form-control form-control-sm${invalid ? " is-invalid" : ""}`;

export function confirmDiscard(isDirty: boolean) {
  return !isDirty || window.confirm("Discard unsaved changes?");
}

export const dash = (value: string | number | null | undefined) =>
  value == null || value === "" ? "—" : String(value);

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB");
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-GB");
}

export const fullName = (user: Pick<AdminUser, "firstName" | "lastName">) =>
  `${user.firstName} ${user.lastName}`.trim();

export const ACTIVE_STATUS_OPTIONS: TechEarnestPickerOption[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

export const TIMEZONE_OPTIONS = optionsFromPairs(
  [
    ["Asia/Kolkata", "(GMT+05:30) India Standard Time"],
    ["Asia/Dubai", "(GMT+04:00) Gulf Standard Time"],
    ["Asia/Singapore", "(GMT+08:00) Singapore"],
    ["Asia/Tokyo", "(GMT+09:00) Tokyo"],
    ["Asia/Shanghai", "(GMT+08:00) China Standard Time"],
    ["Australia/Sydney", "(GMT+10:00) Sydney"],
    ["Europe/London", "(GMT+00:00) London"],
    ["Europe/Berlin", "(GMT+01:00) Central European Time"],
    ["Europe/Paris", "(GMT+01:00) Paris"],
    ["Africa/Johannesburg", "(GMT+02:00) South Africa"],
    ["America/New_York", "(GMT-05:00) Eastern Time"],
    ["America/Chicago", "(GMT-06:00) Central Time"],
    ["America/Denver", "(GMT-07:00) Mountain Time"],
    ["America/Los_Angeles", "(GMT-08:00) Pacific Time"],
    ["America/Sao_Paulo", "(GMT-03:00) São Paulo"],
    ["UTC", "(GMT+00:00) UTC"],
  ].map(([value, label]) => ({ value, label })),
);

export const LOCALE_OPTIONS = optionsFromPairs(
  [
    ["en-IN", "English (India)"],
    ["en-US", "English (United States)"],
    ["en-GB", "English (United Kingdom)"],
    ["hi-IN", "Hindi (India)"],
    ["mr-IN", "Marathi (India)"],
    ["de-DE", "German (Germany)"],
    ["fr-FR", "French (France)"],
    ["es-ES", "Spanish (Spain)"],
    ["ar-AE", "Arabic (UAE)"],
    ["ja-JP", "Japanese (Japan)"],
  ].map(([value, label]) => ({ value, label })),
);

export const CURRENCY_OPTIONS = optionsFromPairs(
  [
    ["INR", "INR - Indian Rupee"],
    ["USD", "USD - US Dollar"],
    ["EUR", "EUR - Euro"],
    ["GBP", "GBP - British Pound"],
    ["AED", "AED - UAE Dirham"],
    ["SGD", "SGD - Singapore Dollar"],
    ["AUD", "AUD - Australian Dollar"],
    ["CAD", "CAD - Canadian Dollar"],
    ["JPY", "JPY - Japanese Yen"],
    ["ZAR", "ZAR - South African Rand"],
  ].map(([value, label]) => ({ value, label })),
);

/** Keeps a saved value selectable even when it isn't in the predefined list. */
export function withCurrentOption(options: TechEarnestPickerOption[], current: string | null | undefined) {
  if (!current || options.some((option) => option.value === current)) return options;
  return [{ value: current, label: current }, ...options];
}

/** Chip list plus a picker for adding more; used for roles and region access. */
export function AdminMultiPicker({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel = "None selected",
  disabled = false,
  readOnly = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options: TechEarnestPickerOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const labels = new Map(options.map((option) => [option.value, option.label]));
  const remaining = options.filter((option) => !value.includes(option.value));
  return (
    <div className="admin-multi-picker">
      <div className="d-flex flex-wrap gap-1 mb-1">
        {value.length ? (
          value.map((id) => (
            <span key={id} className="badge text-bg-light border d-inline-flex align-items-center gap-1 fw-normal">
              {labels.get(id) ?? id.slice(0, 8)}
              {readOnly ? null : (
                <button
                  type="button"
                  className="btn-close"
                  style={{ fontSize: "0.55rem" }}
                  aria-label={`Remove ${labels.get(id) ?? "item"}`}
                  disabled={disabled}
                  onClick={() => onChange(value.filter((item) => item !== id))}
                />
              )}
            </span>
          ))
        ) : (
          <span className="small text-muted">{emptyLabel}</span>
        )}
      </div>
      {readOnly ? null : (
        <TechEarnestPicker
          value=""
          onChange={(next) => {
            if (next && !value.includes(next)) onChange([...value, next]);
          }}
          options={remaining}
          placeholder={remaining.length ? placeholder : "All options added"}
          searchPlaceholder={searchPlaceholder}
          disabled={disabled || !remaining.length}
          menuPlacement="portal"
        />
      )}
    </div>
  );
}

export function useUserLabel(users: AdminUser[] | undefined) {
  const auth = useAuth();
  return useMemo(() => {
    const map = new Map((users ?? []).map((user) => [user.id, fullName(user)]));
    return (id: string | null | undefined) =>
      id ? (map.get(id) ?? (id === auth.userId ? auth.displayName : id.slice(0, 8))) : "—";
  }, [users, auth.userId, auth.displayName]);
}

export function AdminRecordTimeline({
  entityType,
  entityLabel,
  record,
  userLabel,
}: {
  entityType: string;
  entityLabel: string;
  record: { id: string; createdAt?: string | null; updatedAt?: string | null };
  userLabel: (id: string | null | undefined) => string;
}) {
  const canViewAudit = useHasPermission("AUDIT_VIEW");
  const auditQuery = useQuery({
    queryKey: ["admin", "audit-logs", entityType, record.id],
    queryFn: () => listAuditLogs({ entityType, entityId: record.id, size: 50 }),
    enabled: canViewAudit,
  });
  const entries = useMemo(
    () => buildTimelineEntries(auditQuery.data, undefined, userLabel, recordLifecycleInfo(entityLabel, record)),
    [auditQuery.data, userLabel, entityLabel, record],
  );
  return <TechEarnestRecordTimeline entries={entries} loading={auditQuery.isLoading && canViewAudit} />;
}
