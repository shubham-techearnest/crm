import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listRoles } from "@/features/admin/adminApi";
import {
  listFieldAcls,
  listSysFields,
  listSysTables,
  upsertFieldAcl,
  type FieldAclRow,
} from "./studio/metadataApi";

const LEVELS = ["HIDDEN", "READ", "WRITE"] as const;

export function FieldAclMatrixPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("FIELD_ACL_MANAGE");
  const [tableId, setTableId] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tablesQuery = useQuery({ queryKey: ["metadata", "tables"], queryFn: listSysTables });
  const rolesQuery = useQuery({ queryKey: ["admin", "roles"], queryFn: listRoles });

  const tables = useMemo(
    () =>
      (tablesQuery.data ?? [])
        .filter((t) => t.organizationId == null)
        .sort((a, b) => a.code.localeCompare(b.code)),
    [tablesQuery.data],
  );

  const selectedTableId = tableId || tables.find((t) => t.code === "resource")?.id || tables[0]?.id || "";

  const fieldsQuery = useQuery({
    queryKey: ["metadata", "fields", selectedTableId],
    queryFn: () => listSysFields(selectedTableId),
    enabled: !!selectedTableId,
  });

  const aclsQuery = useQuery({
    queryKey: ["metadata", "field-acls", selectedTableId],
    queryFn: () => listFieldAcls(selectedTableId),
    enabled: !!selectedTableId,
  });

  const roles = useMemo(
    () => (rolesQuery.data ?? []).filter((r) => r.code !== "SUPER_ADMIN"),
    [rolesQuery.data],
  );
  const fields = fieldsQuery.data ?? [];

  const aclMap = useMemo(() => {
    const map = new Map<string, FieldAclRow>();
    for (const row of aclsQuery.data ?? []) {
      map.set(`${row.roleId}:${row.fieldId}`, row);
    }
    return map;
  }, [aclsQuery.data]);

  const upsertMutation = useMutation({
    mutationFn: upsertFieldAcl,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["metadata", "field-acls", selectedTableId] });
      setToast("Field ACL updated");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  if (tablesQuery.isLoading || rolesQuery.isLoading) {
    return <LoadingState label="Loading Field ACL..." />;
  }
  if (tablesQuery.error || rolesQuery.error) {
    return <ErrorState title="Unable to load Field ACL" message="Requires FIELD_ACL_VIEW." />;
  }

  return (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h1 className="h4 mb-0">Field ACL (FLS)</h1>
          <p className="text-muted small mb-0">Hidden / Read / Write by role — audited on change</p>
        </div>
        <select
          className="form-select form-select-sm w-auto"
          value={selectedTableId}
          onChange={(e) => setTableId(e.target.value)}
          aria-label="Table"
        >
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.plural} ({t.code})
            </option>
          ))}
        </select>
      </div>
      {toast ? <div className="alert alert-success py-2">{toast}</div> : null}
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {fieldsQuery.isLoading || aclsQuery.isLoading ? (
        <LoadingState label="Loading fields..." />
      ) : fields.length === 0 ? (
        <EmptyState title="No fields" description="Select a table with a field dictionary." />
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-bordered align-middle">
            <thead>
              <tr>
                <th>Role \\ Field</th>
                {fields.map((f) => (
                  <th key={f.id} className="text-center">
                    <div>{f.label}</div>
                    <code className="small">{f.code}</code>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td>
                    <strong>{role.name}</strong>
                    <div className="small text-muted">{role.code}</div>
                  </td>
                  {fields.map((field) => {
                    const row = aclMap.get(`${role.id}:${field.id}`);
                    const level = row?.accessLevel ?? "WRITE";
                    return (
                      <td key={field.id} className="text-center">
                        <select
                          className="form-select form-select-sm"
                          value={level}
                          disabled={!canManage || upsertMutation.isPending}
                          onChange={(e) =>
                            upsertMutation.mutate({
                              roleId: role.id,
                              fieldId: field.id,
                              accessLevel: e.target.value,
                            })
                          }
                        >
                          {LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small text-muted mt-3 mb-0">
        Seeded defaults: Sales cannot see costRate/billingRate/margin on Resources &amp; Allocations; Finance and Org
        Admin can.
      </p>
    </div>
  );
}
