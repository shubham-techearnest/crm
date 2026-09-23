import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listRoles } from "@/features/admin/adminApi";
import { listSysTables, listTableAcls, upsertTableAcl, type TableAclRow } from "./studio/metadataApi";

export function AclMatrixPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("ACL_MANAGE");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tablesQuery = useQuery({ queryKey: ["metadata", "tables"], queryFn: listSysTables });
  const rolesQuery = useQuery({ queryKey: ["admin", "roles"], queryFn: listRoles });
  const aclsQuery = useQuery({ queryKey: ["metadata", "table-acls"], queryFn: listTableAcls });

  const tables = useMemo(
    () => (tablesQuery.data ?? []).filter((t) => t.organizationId == null).sort((a, b) => a.code.localeCompare(b.code)),
    [tablesQuery.data],
  );
  const roles = useMemo(
    () => (rolesQuery.data ?? []).filter((r) => r.code !== "SUPER_ADMIN"),
    [rolesQuery.data],
  );

  const aclMap = useMemo(() => {
    const map = new Map<string, TableAclRow>();
    for (const row of aclsQuery.data ?? []) {
      map.set(`${row.roleId}:${row.tableId}`, row);
    }
    return map;
  }, [aclsQuery.data]);

  const upsertMutation = useMutation({
    mutationFn: upsertTableAcl,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["metadata", "table-acls"] });
      setToast("ACL updated");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const toggle = (
    roleId: string,
    tableId: string,
    field: "canCreate" | "canRead" | "canUpdate" | "canDelete",
    current: TableAclRow | undefined,
  ) => {
    if (!canManage) return;
    upsertMutation.mutate({
      roleId,
      tableId,
      canCreate: field === "canCreate" ? !current?.canCreate : !!current?.canCreate,
      canRead: field === "canRead" ? !current?.canRead : !!current?.canRead,
      canUpdate: field === "canUpdate" ? !current?.canUpdate : !!current?.canUpdate,
      canDelete: field === "canDelete" ? !current?.canDelete : !!current?.canDelete,
    });
  };

  if (tablesQuery.isLoading || rolesQuery.isLoading || aclsQuery.isLoading) {
    return <LoadingState label="Loading ACL matrix..." />;
  }
  if (tablesQuery.error || rolesQuery.error || aclsQuery.error) {
    return <ErrorState title="Unable to load ACL matrix" message="Requires ACL_VIEW." />;
  }

  return (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h4 mb-0">Table ACL matrix</h1>
          <p className="text-muted small mb-0">
            Role × Table × CRUD — VIEWER read-only; ORG_ADMIN full; documented defaults from seed
          </p>
        </div>
      </div>
      {toast ? <div className="alert alert-success py-2">{toast}</div> : null}
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {roles.length === 0 || tables.length === 0 ? (
        <EmptyState title="Nothing to configure" description="Roles and dictionary tables are required." />
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-bordered align-middle">
            <thead>
              <tr>
                <th>Role \\ Table</th>
                {tables.map((t) => (
                  <th key={t.id} className="text-center">
                    <div>{t.plural}</div>
                    <div className="small text-muted">C R U D</div>
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
                  {tables.map((table) => {
                    const row = aclMap.get(`${role.id}:${table.id}`);
                    return (
                      <td key={table.id} className="text-center">
                        {(["canCreate", "canRead", "canUpdate", "canDelete"] as const).map((field) => (
                          <input
                            key={field}
                            type="checkbox"
                            className="form-check-input mx-1"
                            checked={!!row?.[field]}
                            disabled={!canManage || upsertMutation.isPending}
                            onChange={() => toggle(role.id, table.id, field, row)}
                            title={field}
                          />
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
