import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
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
      onCloseFilters={() => setFilterOpen(false)}
      filterPanelTitle="About"
    >
      {query.isLoading ? <LoadingState label="Loading workflows…" /> : null}
      {query.error ? <ErrorState title="Unable to load workflows" message="Try again." /> : null}
      {!query.isLoading && !query.error ? (
        viewMode === "list" ? (
          <ModuleListTable
            tableCode="workflow_definition"
            enabled={false}
            defaultColumns={[
              { field: "code", label: "Code" },
              { field: "name", label: "Name" },
              { field: "eventType", label: "Event" },
              { field: "version", label: "Version" },
              { field: "active", label: "Status" },
            ]}
            rows={query.data ?? []}
            rowKey={(row) => row.id}
            renderCell={(row, field) => {
              if (field === "active") return <StatusBadge status={row.active ? "ACTIVE" : "INACTIVE"} />;
              const value = (row as unknown as Record<string, unknown>)[field];
              return value == null || value === "" ? "—" : String(value);
            }}
            trailingColumn={canManage ? {
              header: "Actions",
              stopPropagation: true,
              render: (row) => (
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate({ id: row.id, active: !row.active })}
                >
                  {row.active ? "Deactivate" : "Activate"}
                </button>
              ),
            } : undefined}
            emptyMessage="No workflow definitions seeded for this organization."
          />
        ) : (
          <div className="module-tile-grid">
            {(query.data ?? []).map((row) => (
              <article key={row.id} className="module-tile">
                <div className="tile-title">{row.name}</div>
                <div className="small text-muted">{row.code} · {row.eventType} · v{row.version}</div>
                <div className="mt-2"><StatusBadge status={row.active ? "ACTIVE" : "INACTIVE"} /></div>
                {canManage ? (
                  <button type="button" className="btn btn-outline-primary btn-sm mt-3" disabled={toggleMutation.isPending} onClick={() => toggleMutation.mutate({ id: row.id, active: !row.active })}>
                    {row.active ? "Deactivate" : "Activate"}
                  </button>
                ) : null}
              </article>
            ))}
            {!query.data?.length ? <p className="text-muted">No workflow definitions seeded for this organization.</p> : null}
          </div>
        )
      ) : null}
    </ModuleListShell>
  );
}
