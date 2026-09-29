import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { TechEarnestFilterSelect, enumPickerOptions } from "@/components/TechEarnestCreate";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { actOnApproval, listApprovalRequests } from "./approvalApi";

const APPROVAL_TYPES = enumPickerOptions(["TIMESHEET", "DEAL", "EXPENSE", "PURCHASE_ORDER"]);
const APPROVAL_STATUSES = enumPickerOptions(["PENDING", "APPROVED", "REJECTED"]);

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const canAct =
    useHasPermission("APPROVAL_ACT") ||
    useHasPermission("TIMESHEET_APPROVE") ||
    useHasPermission("EXPENSE_APPROVE") ||
    useHasPermission("APPROVAL_ADMIN");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch } = useModuleWorkspace();
  const [targetType, setTargetType] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [commentById, setCommentById] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const listParams = useMemo(
    () => ({
      targetType: targetType || undefined,
      status: status || undefined,
    }),
    [targetType, status],
  );

  const query = useQuery({
    queryKey: ["approvals", listParams],
    queryFn: () => listApprovalRequests(listParams),
  });

  const actMutation = useMutation({
    mutationFn: ({
      id,
      action,
      comment,
    }: {
      id: string;
      action: "APPROVE" | "REJECT";
      comment?: string;
    }) => actOnApproval(id, { action, comment }),
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["approvals"] }),
        queryClient.invalidateQueries({ queryKey: ["timesheets"] }),
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
      ]);
    },
    onError: () => setActionError("Could not record approval action."),
  });

  const rows = (query.data ?? []).filter((row) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      row.targetType.toLowerCase().includes(q) ||
      row.targetId.toLowerCase().includes(q) ||
      row.status.toLowerCase().includes(q)
    );
  });
  const activeFilterCount = [search, targetType, status !== "PENDING" ? status : ""].filter(Boolean).length;

  return (
    <ModuleListShell
      title="My Approvals"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">Inbox</span>}
      toolbarActions={
        <button
          type="button"
          className={`btn btn-sm ${filterOpen ? "btn-primary" : "btn-outline-secondary"}`}
          onClick={() => setFilterOpen((o) => !o)}
        >
          Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </button>
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Approvals by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type or id"
            />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect
              label="Type"
              value={targetType}
              onChange={setTargetType}
              options={APPROVAL_TYPES}
              placeholder="All types"
              emptyLabel="All types"
              searchPlaceholder="Search approval types"
            />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect
              label="Status"
              value={status}
              onChange={setStatus}
              options={APPROVAL_STATUSES}
              placeholder="Select status"
              allowEmpty={false}
              searchPlaceholder="Search approval statuses"
            />
          </div>
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {actionError ? <div className="alert alert-danger m-3 py-2">{actionError}</div> : null}
      {query.isLoading ? <LoadingState label="Loading approvals..." /> : null}
      {query.error ? <ErrorState title="Unable to load approvals" message="Try again." /> : null}
      {!query.isLoading && !query.error ? (
        <ModuleListTable
          tableCode="approval_request"
          enabled={false}
          defaultColumns={[
            { field: "targetType", label: "Type" },
            { field: "targetId", label: "Target" },
            { field: "submittedAt", label: "Submitted" },
            { field: "status", label: "Status" },
            { field: "comment", label: "Comment" },
          ]}
          rows={rows}
          rowKey={(row) => row.id}
          renderCell={(row, field) => {
            if (field === "targetId") return <span className="small text-muted">{row.targetId.slice(0, 8)}…</span>;
            if (field === "submittedAt") return <span className="small">{new Date(row.submittedAt).toLocaleString()}</span>;
            if (field === "status") return <StatusBadge status={row.status} />;
            if (field === "comment") return row.status === "PENDING" && canAct ? (
              <input
                className="form-control form-control-sm"
                placeholder="Optional comment"
                value={commentById[row.id] ?? ""}
                onChange={(event) => setCommentById((previous) => ({ ...previous, [row.id]: event.target.value }))}
              />
            ) : "—";
            const value = (row as unknown as Record<string, unknown>)[field];
            return value == null || value === "" ? "—" : String(value);
          }}
          trailingColumn={{
            header: "Actions",
            render: (row) => row.status === "PENDING" && canAct ? (
              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-success"
                  disabled={actMutation.isPending}
                  onClick={() => actMutation.mutate({ id: row.id, action: "APPROVE", comment: commentById[row.id] })}
                >Approve</button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  disabled={actMutation.isPending}
                  onClick={() => actMutation.mutate({ id: row.id, action: "REJECT", comment: commentById[row.id] || "Rejected" })}
                >Reject</button>
              </div>
            ) : null,
          }}
          emptyMessage="No approval requests match the current filters."
        />
      ) : null}
    </ModuleListShell>
  );
}
