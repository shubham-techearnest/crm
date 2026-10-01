import { useQuery } from "@tanstack/react-query";
import { listUsers } from "@/features/admin/adminApi";
import type { BulkOption } from "./bulkActions";

/** Active users as owner choices for bulk reassignment. Shares the cache key used by list pages. */
export function useActiveUserOptions(enabled: boolean): BulkOption[] {
  const query = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled,
    staleTime: 60_000,
  });
  return (query.data ?? [])
    .filter((user) => user.status === "ACTIVE")
    .map((user) => ({ value: user.id, label: `${user.firstName} ${user.lastName}`.trim() || user.email }));
}

export function enumOptions(values: readonly string[]): BulkOption[] {
  return values.map((value) => ({
    value,
    label: value
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  }));
}
