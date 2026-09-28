import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { listWorkflowDefinitions, setWorkflowActive } from "./workflowApi";

export function WorkflowAdminPage() {
  const canManage = useHasPermission("WORKFLOW_MANAGE");
  const queryClient = useQueryClient();
  const { filterOpen, setFilterOpen, viewMode, setViewMode } = useModuleWorkspace(false);

  const query = useQuery({
    queryKey: ["admin", "workflows"],
    queryFn: listWorkflowDefinitions,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setWorkflowActive(id, active),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "workflows"] });
    },
  });

  return (
    <ModuleListShell
      title="Workflow definitions"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      toolbarActions={
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setFilterOpen((v) => !v)}>
          Info
        </button>
      }
      filterPanel={
        <p className="small text-muted mb-0">
          Toggle workflow definitions that react to domain events such as deal stage changes. Inactive definitions are
          skipped by the workflow engine.
        </p>
      }
    >
      {query.isLoading ? <LoadingState label="Loading workflows…" /> : null}
      {query.error ? <ErrorState title="Unable to load workflows" message="Try again." /> : null}
      {!query.isLoading && !query.error ? (
        <div className="module-list-table-wrap">
          <table className="table module-list-table align-middle">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Event</th>
                <th>Version</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(query.data ?? []).map((row) => (
                <tr key={row.id}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.eventType}</td>
                  <td>{row.version}</td>
                  <td>
                    <StatusBadge status={row.active ? "ACTIVE" : "INACTIVE"} />
                  </td>
                  <td>
                    {canManage ? (
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        disabled={toggleMutation.isPending}
                        onClick={() => toggleMutation.mutate({ id: row.id, active: !row.active })}
                      >
                        {row.active ? "Deactivate" : "Activate"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!query.data?.length ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-5">
                    No workflow definitions seeded for this organization.
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
