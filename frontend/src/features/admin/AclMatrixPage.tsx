import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listRoles } from "@/features/admin/adminApi";
import { adminErrorMessage } from "@/features/admin/adminKit";
import { listSysTables, listTableAcls, upsertTableAcl, type TableAclRow } from "./studio/metadataApi";

type CrudField = "canCreate" | "canRead" | "canUpdate" | "canDelete";
const CRUD_FIELDS: { field: CrudField; label: string }[] = [
  { field: "canCreate", label: "Create" },
  { field: "canRead", label: "Read" },
  { field: "canUpdate", label: "Update" },
  { field: "canDelete", label: "Delete" },
];
const ACLS_KEY = ["metadata", "table-acls"] as const;

export function AclMatrixPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("ACL_MANAGE");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingCell, setPendingCell] = useState<string | null>(null);

  const tablesQuery = useQuery({ queryKey: ["metadata", "tables"], queryFn: listSysTables });
  const rolesQuery = useQuery({ queryKey: ["admin", "roles"], queryFn: listRoles });
  const aclsQuery = useQuery({ queryKey: ACLS_KEY, queryFn: listTableAcls });

  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(handle);
  }, [toast]);

  const tables = useMemo(
    () => (tablesQuery.data ?? []).filter((t) => t.organizationId == null).sort((a, b) => a.plural.localeCompare(b.plural)),
    [tablesQuery.data],
  );
  // ACLs are stored per organization role; platform roles (no organization) cannot be configured here.
  const roles = useMemo(
    () => (rolesQuery.data ?? []).filter((r) => r.code !== "SUPER_ADMIN" && !!r.organizationId),
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
    onMutate: (body) => setPendingCell(`${body.roleId}:${body.tableId}`),
    onSuccess: (saved) => {
      queryClient.setQueryData<TableAclRow[]>(ACLS_KEY, (current = []) => {
        const others = current.filter((row) => !(row.roleId === saved.roleId && row.tableId === saved.tableId));
        return [...others, saved];
      });
      setToast(`Updated ${saved.roleCode} on ${saved.tableCode}`);
      setError(null);
    },
    onError: (err) => setError(adminErrorMessage(err, "Could not update the ACL.")),
    onSettled: () => setPendingCell(null),
  });

  const toggle = (roleId: string, tableId: string, field: CrudField, current: TableAclRow | undefined) => {
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
            Create / Read / Update / Delete access per role and table. Changes save immediately and are audited.
            {canManage ? "" : " You have view-only access."}
          </p>
        </div>
      </div>
      {toast ? <div className="alert alert-success py-2">{toast}</div> : null}
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center">
          <span>{error}</span>
          <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => setError(null)} />
        </div>
      ) : null}
      {roles.length === 0 || tables.length === 0 ? (
        <EmptyState title="Nothing to configure" description="Roles and dictionary tables are required." />
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-bordered align-middle">
            <thead>
              <tr>
                <th>Role / Table</th>
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
                    const key = `${role.id}:${table.id}`;
                    const row = aclMap.get(key);
                    return (
                      <td key={table.id} className="text-center text-nowrap">
                        {CRUD_FIELDS.map(({ field, label }) => (
                          <input
                            key={field}
                            type="checkbox"
                            className="form-check-input mx-1"
                            checked={!!row?.[field]}
                            disabled={!canManage || pendingCell === key}
                            onChange={() => toggle(role.id, table.id, field, row)}
                            title={`${label} ${table.plural} — ${role.name}`}
                            aria-label={`${label} ${table.plural} for ${role.name}`}
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
