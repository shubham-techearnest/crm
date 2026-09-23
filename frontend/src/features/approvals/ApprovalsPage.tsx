import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { actOnApproval, listApprovalRequests } from "./approvalApi";

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const canAct =
    useHasPermission("APPROVAL_ACT") ||
    useHasPermission("TIMESHEET_APPROVE") ||
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
            <h3>Type</h3>
            <select className="form-select form-select-sm" value={targetType} onChange={(e) => setTargetType(e.target.value)}>
              <option value="">All</option>
              <option value="TIMESHEET">TIMESHEET</option>
              <option value="DEAL">DEAL</option>
              <option value="EXPENSE">EXPENSE</option>
              <option value="PURCHASE_ORDER">PURCHASE_ORDER</option>
            </select>
          </div>
          <div className="module-filter-section">
            <h3>Status</h3>
            <select className="form-select form-select-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
        </>
      }
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {actionError ? <div className="alert alert-danger m-3 py-2">{actionError}</div> : null}
      {query.isLoading ? <LoadingState label="Loading approvals..." /> : null}
      {query.error ? <ErrorState title="Unable to load approvals" message="Try again." /> : null}
      {!query.isLoading && !query.error ? (
        <div className="module-list-table-wrap">
          <table className="table module-list-table align-middle">
            <thead>
              <tr>
                <th>Type</th>
                <th>Target</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Comment</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.targetType}</td>
                  <td className="small text-muted">{row.targetId.slice(0, 8)}…</td>
                  <td className="small">{new Date(row.submittedAt).toLocaleString()}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td style={{ minWidth: 160 }}>
                    {row.status === "PENDING" && canAct ? (
                      <input
                        className="form-control form-control-sm"
                        placeholder="Optional comment"
                        value={commentById[row.id] ?? ""}
                        onChange={(e) =>
                          setCommentById((prev) => ({ ...prev, [row.id]: e.target.value }))
                        }
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="text-nowrap">
                    {row.status === "PENDING" && canAct ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-success me-1"
                          disabled={actMutation.isPending}
                          onClick={() =>
                            actMutation.mutate({
                              id: row.id,
                              action: "APPROVE",
                              comment: commentById[row.id],
                            })
                          }
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          disabled={actMutation.isPending}
                          onClick={() =>
                            actMutation.mutate({
                              id: row.id,
                              action: "REJECT",
                              comment: commentById[row.id] || "Rejected",
                            })
                          }
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-5">
                    No approval requests
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </ModuleListShell>
  );
}
