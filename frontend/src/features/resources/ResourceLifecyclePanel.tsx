import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TechEarnestRecordRelatedCard } from "@/components/TechEarnestRecord";
import {
  addUnavailability,
  deactivateResource,
  ENDED_STATUSES,
  isExternalType,
  LEAVE_KINDS,
  listUnavailability,
  reactivateResource,
  removeUnavailability,
  type Resource,
  type ResourceLifecycleResult,
} from "./resourceApi";
import { errorMessage } from "./ResourcePortalPanel";

const ENDED_STATUS_LABELS: Record<string, string> = {
  INACTIVE: "Inactive (left or paused)",
  CONTRACT_EXPIRED: "Contract expired",
  TERMINATED: "Terminated",
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isEndedResource(resource: Pick<Resource, "status">): boolean {
  return (ENDED_STATUSES as readonly string[]).includes(resource.status);
}

async function refreshResourceQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["resources"] }),
    queryClient.invalidateQueries({ queryKey: ["allocations"] }),
    queryClient.invalidateQueries({ queryKey: ["resource-board"] }),
  ]);
}

/** Deactivate / reactivate button plus its dialog. Resources are never deleted once they have history. */
export function ResourceLifecycleActions({
  resource,
  onChanged,
}: {
  resource: Resource;
  onChanged?: (result: ResourceLifecycleResult) => void;
}) {
  const queryClient = useQueryClient();
  const ended = isEndedResource(resource);
  const external = isExternalType(resource.resourceType);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string>("INACTIVE");
  const [reason, setReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [endOpenAllocations, setEndOpenAllocations] = useState(true);
  const [revokePortalAccess, setRevokePortalAccess] = useState(true);
  const [engagementStartDate, setEngagementStartDate] = useState("");
  const [engagementEndDate, setEngagementEndDate] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      ended
        ? reactivateResource(resource.id, {
            engagementStartDate: engagementStartDate || null,
            engagementEndDate: engagementEndDate || null,
            availableFrom: availableFrom || null,
          })
        : deactivateResource(resource.id, {
            status,
            reason: reason.trim() || undefined,
            effectiveDate: effectiveDate || undefined,
            endOpenAllocations,
            revokePortalAccess: external ? revokePortalAccess : false,
          }),
    onSuccess: async (result) => {
      setOpen(false);
      await refreshResourceQueries(queryClient);
      onChanged?.(result);
    },
    onError: (e) => setError(errorMessage(e, ended ? "Could not reactivate resource." : "Could not deactivate resource.")),
  });

  const openDialog = () => {
    setError(null);
    setReason("");
    setStatus(external ? "CONTRACT_EXPIRED" : "INACTIVE");
    setEffectiveDate(today());
    setEndOpenAllocations(true);
    setRevokePortalAccess(true);
    setEngagementStartDate(today());
    setEngagementEndDate("");
    setAvailableFrom("");
    setOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <>
      <button
        type="button"
        className={`btn btn-sm ${ended ? "btn-outline-success" : "btn-outline-danger"}`}
        onClick={openDialog}
      >
        {ended ? "Reactivate" : "Deactivate"}
      </button>
      {open ? (
        <div className="module-modal-backdrop" role="presentation" onClick={() => (mutation.isPending ? null : setOpen(false))}>
          <section
            className="module-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="resource-lifecycle-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="module-modal-header">
              <h2 id="resource-lifecycle-title" className="h5 mb-0">
                {ended ? "Reactivate resource" : "Deactivate resource"}
              </h2>
              <button type="button" className="btn-close" aria-label="Close" disabled={mutation.isPending} onClick={() => setOpen(false)} />
            </header>
            <form onSubmit={submit}>
              <div className="module-modal-body">
                {ended ? (
                  <>
                    <p className="small text-muted">
                      The resource returns to the active workforce and can be allocated again. Past allocations and
                      timesheets are unchanged.
                    </p>
                    {external ? (
                      <div className="row g-3 mb-3">
                        <div className="col-sm-6">
                          <label className="form-label" htmlFor="reactivate-start">New engagement start</label>
                          <input id="reactivate-start" type="date" className="form-control" value={engagementStartDate} onChange={(e) => setEngagementStartDate(e.target.value)} />
                        </div>
                        <div className="col-sm-6">
                          <label className="form-label" htmlFor="reactivate-end">New engagement end</label>
                          <input id="reactivate-end" type="date" className="form-control" value={engagementEndDate} min={engagementStartDate || undefined} onChange={(e) => setEngagementEndDate(e.target.value)} />
                        </div>
                      </div>
                    ) : null}
                    <label className="form-label" htmlFor="reactivate-available">Available from (optional)</label>
                    <input id="reactivate-available" type="date" className="form-control" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} />
                  </>
                ) : (
                  <>
                    <p className="small text-muted">
                      The resource leaves the active workforce. Their allocations, timesheets and costs stay in history.
                    </p>
                    <div className="row g-3">
                      <div className="col-sm-6">
                        <label className="form-label" htmlFor="deactivate-status">New status</label>
                        <select id="deactivate-status" className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                          {ENDED_STATUSES.map((value) => (
                            <option key={value} value={value}>{ENDED_STATUS_LABELS[value] ?? value}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-sm-6">
                        <label className="form-label" htmlFor="deactivate-date">Last working day</label>
                        <input id="deactivate-date" type="date" className="form-control" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                      </div>
                      <div className="col-12">
                        <label className="form-label" htmlFor="deactivate-reason">Reason</label>
                        <input id="deactivate-reason" className="form-control" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Resigned, contract ended, …" />
                      </div>
                      <div className="col-12">
                        <div className="form-check">
                          <input id="deactivate-end-allocations" type="checkbox" className="form-check-input" checked={endOpenAllocations} onChange={(e) => setEndOpenAllocations(e.target.checked)} />
                          <label className="form-check-label" htmlFor="deactivate-end-allocations">
                            End current allocations on the last working day and cancel future ones
                          </label>
                        </div>
                        {external ? (
                          <div className="form-check">
                            <input id="deactivate-revoke" type="checkbox" className="form-check-input" checked={revokePortalAccess} onChange={(e) => setRevokePortalAccess(e.target.checked)} />
                            <label className="form-check-label" htmlFor="deactivate-revoke">Revoke their portal login</label>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </>
                )}
                {error ? <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">{error}</div> : null}
              </div>
              <footer className="module-modal-footer">
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={mutation.isPending} onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={`btn btn-sm ${ended ? "btn-success" : "btn-danger"}`} disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving…" : ended ? "Reactivate" : "Deactivate"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

/** Leave, holidays and other time off that reduce the resource's capacity. */
export function ResourceLeaveCard({ resourceId, canManage }: { resourceId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const leaveQuery = useQuery({
    queryKey: ["resources", resourceId, "unavailability"],
    queryFn: () => listUnavailability(resourceId),
  });
  const [adding, setAdding] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [kind, setKind] = useState<string>("LEAVE");
  const [hoursPerDay, setHoursPerDay] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["resources", resourceId, "unavailability"] }),
      queryClient.invalidateQueries({ queryKey: ["resource-board"] }),
      queryClient.invalidateQueries({ queryKey: ["resources"] }),
    ]);
  };

  const addMutation = useMutation({
    mutationFn: () =>
      addUnavailability(resourceId, {
        startDate,
        endDate: endDate || startDate,
        kind,
        hoursPerDay: hoursPerDay ? Number(hoursPerDay) : null,
        reason: reason.trim() || undefined,
      }),
    onSuccess: async () => {
      setAdding(false);
      setStartDate("");
      setEndDate("");
      setHoursPerDay("");
      setReason("");
      setError(null);
      await refresh();
    },
    onError: (e) => setError(errorMessage(e, "Could not add leave.")),
  });

  const removeMutation = useMutation({
    mutationFn: removeUnavailability,
    onSuccess: refresh,
    onError: (e) => setError(errorMessage(e, "Could not remove leave.")),
  });

  const rows = leaveQuery.data ?? [];

  return (
    <TechEarnestRecordRelatedCard
      id="techearnest-record-section-leave"
      title={`Leave & Unavailability (${rows.length})`}
      isEmpty={!leaveQuery.isLoading && rows.length === 0 && !adding && !canManage}
      emptyLabel="No leave recorded"
      actions={
        canManage && !adding ? (
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setError(null); setAdding(true); }}>
            Add leave
          </button>
        ) : null
      }
    >
      {adding ? (
        <form
          className="row g-2 align-items-end mb-3"
          onSubmit={(event) => {
            event.preventDefault();
            addMutation.mutate();
          }}
        >
          <div className="col-sm-3">
            <label className="form-label small mb-0" htmlFor="leave-start">From</label>
            <input id="leave-start" type="date" className="form-control form-control-sm" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="col-sm-3">
            <label className="form-label small mb-0" htmlFor="leave-end">To</label>
            <input id="leave-end" type="date" className="form-control form-control-sm" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="col-sm-2">
            <label className="form-label small mb-0" htmlFor="leave-kind">Type</label>
            <select id="leave-kind" className="form-select form-select-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
              {LEAVE_KINDS.map((value) => (
                <option key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
          <div className="col-sm-2">
            <label className="form-label small mb-0" htmlFor="leave-hours">Hours/day</label>
            <input id="leave-hours" type="number" min={0.5} step="0.5" className="form-control form-control-sm" placeholder="Full day" value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} />
          </div>
          <div className="col-sm-2">
            <label className="form-label small mb-0" htmlFor="leave-reason">Note</label>
            <input id="leave-reason" className="form-control form-control-sm" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="col-12 d-flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={addMutation.isPending}>
              {addMutation.isPending ? "Saving…" : "Save leave"}
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      ) : null}
      {error ? <div className="alert alert-danger py-2 small">{error}</div> : null}
      {rows.length > 0 ? (
        <div className="table-responsive">
          <table className="table table-sm mb-0">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Type</th>
                <th>Hours/day</th>
                <th>Note</th>
                {canManage ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((leave) => (
                <tr key={leave.id}>
                  <td>{leave.startDate}</td>
                  <td>{leave.endDate}</td>
                  <td>{leave.kind.charAt(0) + leave.kind.slice(1).toLowerCase()}</td>
                  <td>{leave.hoursPerDay ?? "Full day"}</td>
                  <td>{leave.reason ?? "—"}</td>
                  {canManage ? (
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-link btn-sm text-danger p-0"
                        disabled={removeMutation.isPending}
                        onClick={() => removeMutation.mutate(leave.id)}
                      >
                        Remove
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !adding && canManage && !leaveQuery.isLoading ? (
        <div className="small text-muted">No leave recorded.</div>
      ) : null}
    </TechEarnestRecordRelatedCard>
  );
}
