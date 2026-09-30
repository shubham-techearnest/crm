import { FormField } from "@/components/FormField/FormField";
import { RecordLink, RelatedRecordList } from "@/components/RecordLink";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import {
  TechEarnestDealStagePipeline,
  TechEarnestRecordInfoSection,
  TechEarnestRecordRelatedCard,
  TechEarnestRecordSummaryStrip,
  formatDealStage,
} from "@/components/TechEarnestRecord";
import type { Activity, Deal, DealStageHistoryEntry } from "./crmApi";

const DEAL_STAGES = [
  "NEW",
  "QUALIFICATION",
  "REQUIREMENT",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";
  return value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}

function expectedRevenue(deal: Deal) {
  if (deal.value == null || deal.probability == null) return "—";
  return formatMoney((deal.value * deal.probability) / 100);
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export interface DealRecordOverviewProps {
  deal: Deal;
  ownerName: string;
  accountName: string;
  contactName?: string;
  contactEmail?: string | null;
  userName: (userId: string | null | undefined) => string;
  stageHistory: DealStageHistoryEntry[];
  activities: Activity[] | null;
  /** Projects created from this deal; null hides the section (no permission). */
  projects?: { id: string; name: string; projectCode?: string | null; status: string }[] | null;
  leadName?: string | null;
  canStage: boolean;
  canCreateProject: boolean;
  canViewNotes: boolean;
  canCreateNotes: boolean;
  canDeleteNotes: boolean;
  canViewDocs: boolean;
  canUploadDocs: boolean;
  canDeleteDocs: boolean;
  stageError: string | null;
  projectError: string | null;
  projectSuccess: string | null;
  lostReason: string;
  wonCloseDate: string;
  noteBody: string;
  notes: { id: string; body: string; createdAt: string }[];
  documents: { id: string; fileName: string }[];
  stagePending: boolean;
  projectPending: boolean;
  onLostReasonChange: (value: string) => void;
  onWonCloseDateChange: (value: string) => void;
  onNoteBodyChange: (value: string) => void;
  onStageClick: (stage: string) => void;
  onCreateProject: () => void;
  onSaveNote: () => void;
  onDeleteNote: (id: string) => void;
  onUploadDocument: (file: File) => void;
  onDownloadDocument: (id: string, fileName: string) => void;
  onDeleteDocument: (id: string) => void;
}

export function DealRecordOverview({
  deal,
  ownerName,
  accountName,
  contactName,
  contactEmail,
  userName,
  stageHistory,
  activities,
  projects = null,
  leadName,
  canStage,
  canCreateProject,
  canViewNotes,
  canCreateNotes,
  canDeleteNotes,
  canViewDocs,
  canUploadDocs,
  canDeleteDocs,
  stageError,
  projectError,
  projectSuccess,
  lostReason,
  wonCloseDate,
  noteBody,
  notes,
  documents,
  stagePending,
  projectPending,
  onLostReasonChange,
  onWonCloseDateChange,
  onNoteBodyChange,
  onStageClick,
  onCreateProject,
  onSaveNote,
  onDeleteNote,
  onUploadDocument,
  onDownloadDocument,
  onDeleteDocument,
}: DealRecordOverviewProps) {
  const openActivities = (activities ?? []).filter((activity) => activity.status !== "COMPLETED");
  const closedActivities = (activities ?? []).filter((activity) => activity.status === "COMPLETED");
  const history = [...stageHistory].sort((a, b) => b.changedAt.localeCompare(a.changedAt));

  return (
    <>
      <TechEarnestDealStagePipeline
        stages={DEAL_STAGES}
        currentStage={deal.stage}
        startDate={deal.createdAt}
        closingDate={deal.expectedCloseDate}
        onStageClick={canStage && deal.stage !== "WON" && deal.stage !== "LOST" ? onStageClick : undefined}
        disabled={stagePending}
      />

      <TechEarnestRecordSummaryStrip
        fields={[
          { label: "Deal Owner", value: ownerName },
          { label: "Stage", value: formatDealStage(deal.stage) },
          { label: "Probability (%)", value: deal.probability ?? "—" },
          { label: "Expected Revenue", value: expectedRevenue(deal) },
          { label: "Closing Date", value: deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : "—" },
        ]}
      />

      {contactName ? (
        <div className="techearnest-deal-contact-card">
          <div className="techearnest-deal-contact-avatar" aria-hidden="true">
            {contactName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="techearnest-deal-contact-name">
              <RecordLink module="contact" id={deal.contactId}>
                {contactName}
              </RecordLink>
            </div>
            <div className="techearnest-deal-contact-account">
              at{" "}
              <RecordLink module="account" id={deal.accountId}>
                {accountName}
              </RecordLink>
              {contactEmail ? <> · {contactEmail}</> : null}
            </div>
          </div>
        </div>
      ) : null}

      <TechEarnestRecordInfoSection
        title="Deal Information"
        fields={[
          { label: "Deal Owner", value: ownerName },
          { label: "Amount", value: formatMoney(deal.value) },
          { label: "Deal Name", value: deal.name },
          { label: "Closing Date", value: formatDate(deal.expectedCloseDate) },
          {
            label: "Account Name",
            value: (
              <RecordLink module="account" id={deal.accountId}>
                {accountName}
              </RecordLink>
            ),
          },
          { label: "Stage", value: formatDealStage(deal.stage) },
          {
            label: "Contact Name",
            value: contactName ? (
              <RecordLink module="contact" id={deal.contactId}>
                {contactName}
              </RecordLink>
            ) : (
              "—"
            ),
          },
          { label: "Probability (%)", value: deal.probability ?? "—" },
          { label: "Lead Source", value: deal.source ?? "—" },
          ...(deal.leadId
            ? [
                {
                  label: "Converted From Lead",
                  value: (
                    <RecordLink module="lead" id={deal.leadId}>
                      {leadName ?? "Open lead"}
                    </RecordLink>
                  ),
                },
              ]
            : []),
          { label: "Expected Revenue", value: expectedRevenue(deal) },
          { label: "Competitor", value: deal.competitor ?? "—" },
          ...(deal.wonAt ? [{ label: "Won On", value: formatDate(deal.wonAt) }] : []),
          ...(deal.lostAt ? [{ label: "Lost On", value: formatDate(deal.lostAt) }] : []),
          ...(deal.lostReason ? [{ label: "Lost Reason", value: deal.lostReason }] : []),
          { label: "Created", value: new Date(deal.createdAt).toLocaleString() },
          { label: "Modified", value: new Date(deal.updatedAt).toLocaleString() },
        ]}
      />

      {deal.description ? (
        <TechEarnestRecordInfoSection
          title="Description Information"
          collapsible={false}
          fields={[{ label: "Description", value: deal.description }]}
        />
      ) : null}

      {stageError ? <div className="alert alert-danger py-2">{stageError}</div> : null}
      {projectError ? <div className="alert alert-danger py-2">{projectError}</div> : null}
      {projectSuccess ? <div className="alert alert-success py-2">{projectSuccess}</div> : null}

      {canStage && deal.stage !== "WON" && deal.stage !== "LOST" ? (
        <div className="techearnest-deal-stage-actions mb-3">
          <FormField label="Lost reason (if LOST)" value={lostReason} onChange={(e) => onLostReasonChange(e.target.value)} />
          <FormField
            label="Close date (if WON)"
            type="date"
            value={wonCloseDate || deal.expectedCloseDate?.slice(0, 10) || ""}
            onChange={(e) => onWonCloseDateChange(e.target.value)}
          />
        </div>
      ) : null}

      {canCreateProject && deal.stage === "WON" ? (
        <button type="button" className="btn btn-success btn-sm mb-3" disabled={projectPending} onClick={onCreateProject}>
          Create project
        </button>
      ) : null}

      <TechEarnestRecordRelatedCard
        id="techearnest-record-section-stage-history"
        title="Stage History"
        isEmpty={false}
        actions={<span className="badge text-bg-light">{history.length || 1}</span>}
      >
        <div className="table-responsive">
          <table className="table table-sm techearnest-record-table mb-0">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Changed By</th>
                <th>Changed At</th>
              </tr>
            </thead>
            <tbody>
              {history.length ? (
                history.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.fromStage ? formatDealStage(entry.fromStage) : "—"}</td>
                    <td>{formatDealStage(entry.toStage)}</td>
                    <td>{userName(entry.changedBy)}</td>
                    <td>{new Date(entry.changedAt).toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td>—</td>
                  <td>{formatDealStage(deal.stage)}</td>
                  <td>{ownerName}</td>
                  <td>{new Date(deal.createdAt).toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </TechEarnestRecordRelatedCard>

      <TechEarnestRecordRelatedCard id="techearnest-record-section-competitors" title="Competitors" isEmpty={!deal.competitor} emptyLabel="No records found">
        {deal.competitor ? <div>{deal.competitor}</div> : null}
      </TechEarnestRecordRelatedCard>

      {activities ? (
        <>
          <TechEarnestRecordRelatedCard
            id="techearnest-record-section-open-activities"
            title="Open Activities"
            isEmpty={!openActivities.length}
            emptyLabel="No records found"
          >
            <RelatedRecordList
              module="activity"
              items={openActivities.map((activity) => ({
                id: activity.id,
                label: activity.subject,
                secondary: activity.dueDate ? `due ${formatDate(activity.dueDate)}` : undefined,
                trailing: <StatusBadge status={activity.status} />,
              }))}
            />
          </TechEarnestRecordRelatedCard>
          <TechEarnestRecordRelatedCard
            id="techearnest-record-section-closed-activities"
            title="Closed Activities"
            isEmpty={!closedActivities.length}
            emptyLabel="No records found"
          >
            <RelatedRecordList
              module="activity"
              items={closedActivities.map((activity) => ({
                id: activity.id,
                label: activity.subject,
                trailing: <StatusBadge status={activity.status} />,
              }))}
            />
          </TechEarnestRecordRelatedCard>
        </>
      ) : null}

      {projects ? (
        <TechEarnestRecordRelatedCard
          id="techearnest-record-section-projects"
          title="Projects"
          isEmpty={!projects.length}
          emptyLabel="No projects created from this deal"
        >
          <RelatedRecordList
            module="project"
            items={projects.map((project) => ({
              id: project.id,
              label: project.name,
              secondary: project.projectCode ?? undefined,
              trailing: <StatusBadge status={project.status} />,
            }))}
          />
        </TechEarnestRecordRelatedCard>
      ) : null}

      <TechEarnestRecordRelatedCard
        id="techearnest-record-section-contact-roles"
        title="Contact Roles"
        isEmpty={!contactName}
        emptyLabel="No records found"
      >
        {contactName ? (
          <div className="table-responsive">
            <table className="table table-sm techearnest-record-table mb-0">
              <thead>
                <tr>
                  <th>Contact Name</th>
                  <th>Account Name</th>
                  <th>Role Name</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <RecordLink module="contact" id={deal.contactId}>
                      {contactName}
                    </RecordLink>
                  </td>
                  <td>
                    <RecordLink module="account" id={deal.accountId}>
                      {accountName}
                    </RecordLink>
                  </td>
                  <td>Primary Contact</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </TechEarnestRecordRelatedCard>

      {canViewNotes ? (
        <TechEarnestRecordRelatedCard
          id="techearnest-record-section-notes"
          title="Notes"
          isEmpty={!notes.length && !canCreateNotes}
          emptyLabel="No notes yet"
          actions={
            canCreateNotes ? (
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={!noteBody.trim()} onClick={onSaveNote}>
                Save
              </button>
            ) : null
          }
        >
          {canCreateNotes ? (
            <textarea
              className="form-control form-control-sm mb-2"
              rows={2}
              value={noteBody}
              onChange={(e) => onNoteBodyChange(e.target.value)}
              placeholder="Add a note"
            />
          ) : null}
          <ul className="list-unstyled small mb-0">
            {notes.map((note) => (
              <li key={note.id} className="mb-2 border-bottom pb-2">
                <div>{note.body}</div>
                <div className="text-muted d-flex justify-content-between">
                  <span>{new Date(note.createdAt).toLocaleString()}</span>
                  {canDeleteNotes ? (
                    <button type="button" className="btn btn-link btn-sm p-0" onClick={() => onDeleteNote(note.id)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </TechEarnestRecordRelatedCard>
      ) : null}

      {canViewDocs ? (
        <TechEarnestRecordRelatedCard
          id="techearnest-record-section-attachments"
          title="Attachments"
          isEmpty={!documents.length}
          emptyLabel="No Attachment"
          actions={
            canUploadDocs ? (
              <label className="btn btn-outline-secondary btn-sm mb-0">
                Attach
                <input type="file" className="d-none" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onUploadDocument(file);
                    e.target.value = "";
                  }
                }} />
              </label>
            ) : null
          }
        >
          <ul className="list-unstyled small mb-0">
            {documents.map((doc) => (
              <li key={doc.id} className="mb-2 d-flex justify-content-between gap-2">
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-start"
                  onClick={() => onDownloadDocument(doc.id, doc.fileName)}
                >
                  {doc.fileName}
                </button>
                {canDeleteDocs ? (
                  <button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={() => onDeleteDocument(doc.id)}>
                    Delete
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </TechEarnestRecordRelatedCard>
      ) : null}

      <TechEarnestRecordRelatedCard id="techearnest-record-section-emails" title="Emails" isEmpty emptyLabel="No records found" />
      <TechEarnestRecordRelatedCard id="techearnest-record-section-meetings" title="Invited Meetings" isEmpty emptyLabel="No records found" />
      <TechEarnestRecordRelatedCard id="techearnest-record-section-social" title="Social" isEmpty emptyLabel="No records found" />
    </>
  );
}

export { DEAL_STAGES };
