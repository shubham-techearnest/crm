import { FormField } from "@/components/FormField/FormField";
import {
  ZohoDealStagePipeline,
  ZohoRecordInfoSection,
  ZohoRecordRelatedCard,
  ZohoRecordSummaryStrip,
  formatDealStage,
} from "@/components/ZohoRecord";
import type { Deal } from "./crmApi";

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

export interface DealRecordOverviewProps {
  deal: Deal;
  ownerName: string;
  accountName: string;
  contactName?: string;
  canStage: boolean;
  canCreateProject: boolean;
  canViewNotes: boolean;
  canCreateNotes: boolean;
  canViewDocs: boolean;
  canUploadDocs: boolean;
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
  onUploadDocument: (file: File) => void;
  onDownloadDocument: (id: string) => void;
}

export function DealRecordOverview({
  deal,
  ownerName,
  accountName,
  contactName,
  canStage,
  canCreateProject,
  canViewNotes,
  canCreateNotes,
  canViewDocs,
  canUploadDocs,
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
  onUploadDocument,
  onDownloadDocument,
}: DealRecordOverviewProps) {
  return (
    <>
      <ZohoDealStagePipeline
        stages={DEAL_STAGES}
        currentStage={deal.stage}
        startDate={deal.createdAt}
        closingDate={deal.expectedCloseDate}
        onStageClick={canStage && deal.stage !== "WON" && deal.stage !== "LOST" ? onStageClick : undefined}
        disabled={stagePending}
      />

      <ZohoRecordSummaryStrip
        fields={[
          { label: "Deal Owner", value: ownerName },
          { label: "Stage", value: formatDealStage(deal.stage) },
          { label: "Probability (%)", value: deal.probability ?? "—" },
          { label: "Expected Revenue", value: expectedRevenue(deal) },
          { label: "Closing Date", value: deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : "—" },
        ]}
      />

      {contactName ? (
        <div className="zoho-deal-contact-card">
          <div className="zoho-deal-contact-avatar" aria-hidden="true">
            {contactName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="zoho-deal-contact-name">{contactName}</div>
            <div className="zoho-deal-contact-account">at {accountName}</div>
          </div>
        </div>
      ) : null}

      <ZohoRecordInfoSection
        title="Deal Information"
        fields={[
          { label: "Deal Owner", value: ownerName },
          { label: "Amount", value: formatMoney(deal.value) },
          { label: "Deal Name", value: deal.name },
          { label: "Closing Date", value: deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : "—" },
          { label: "Account Name", value: <span className="zoho-record-link">{accountName}</span> },
          { label: "Stage", value: formatDealStage(deal.stage) },
          { label: "Type", value: deal.source ?? "—" },
          { label: "Probability (%)", value: deal.probability ?? "—" },
          { label: "Next Step", value: "—" },
          { label: "Expected Revenue", value: expectedRevenue(deal) },
          { label: "Lead Source", value: deal.source ?? "—" },
          { label: "Campaign Source", value: deal.competitor ?? "—" },
          { label: "Contact Name", value: contactName ? <span className="zoho-record-link">{contactName}</span> : "—" },
          {
            label: "Created By",
            value: `${new Date(deal.createdAt).toLocaleString()}`,
          },
        ]}
      />

      {deal.description ? (
        <ZohoRecordInfoSection
          title="Description Information"
          collapsible={false}
          fields={[{ label: "Description", value: deal.description }]}
        />
      ) : null}

      {stageError ? <div className="alert alert-danger py-2">{stageError}</div> : null}
      {projectError ? <div className="alert alert-danger py-2">{projectError}</div> : null}
      {projectSuccess ? <div className="alert alert-success py-2">{projectSuccess}</div> : null}

      {canStage && deal.stage !== "WON" && deal.stage !== "LOST" ? (
        <div className="zoho-deal-stage-actions mb-3">
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

      <ZohoRecordRelatedCard
        id="zoho-record-section-stage-history"
        title="Stage History"
        isEmpty={false}
        actions={<span className="badge text-bg-light">{DEAL_STAGES.indexOf(deal.stage as (typeof DEAL_STAGES)[number]) + 1}</span>}
      >
        <div className="table-responsive">
          <table className="table table-sm zoho-record-table mb-0">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Amount</th>
                <th>Probability (%)</th>
                <th>Expected Revenue</th>
                <th>Closing Date</th>
                <th>Modified Time</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{formatDealStage(deal.stage)}</td>
                <td>{formatMoney(deal.value)}</td>
                <td>{deal.probability ?? "—"}</td>
                <td>{expectedRevenue(deal)}</td>
                <td>{deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : "—"}</td>
                <td>{new Date(deal.updatedAt).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ZohoRecordRelatedCard>

      <ZohoRecordRelatedCard id="zoho-record-section-competitors" title="Competitors" isEmpty={!deal.competitor} emptyLabel="No records found">
        {deal.competitor ? <div>{deal.competitor}</div> : null}
      </ZohoRecordRelatedCard>

      <ZohoRecordRelatedCard id="zoho-record-section-open-activities" title="Open Activities" isEmpty emptyLabel="No records found" />
      <ZohoRecordRelatedCard id="zoho-record-section-closed-activities" title="Closed Activities" isEmpty emptyLabel="No records found" />

      <ZohoRecordRelatedCard
        id="zoho-record-section-contact-roles"
        title="Contact Roles"
        isEmpty={!contactName}
        emptyLabel="No records found"
      >
        {contactName ? (
          <div className="table-responsive">
            <table className="table table-sm zoho-record-table mb-0">
              <thead>
                <tr>
                  <th>Contact Name</th>
                  <th>Account Name</th>
                  <th>Role Name</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="zoho-record-link">{contactName}</span></td>
                  <td><span className="zoho-record-link">{accountName}</span></td>
                  <td>Primary Contact</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </ZohoRecordRelatedCard>

      {canViewNotes ? (
        <ZohoRecordRelatedCard
          id="zoho-record-section-notes"
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
                <div className="text-muted">{new Date(note.createdAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </ZohoRecordRelatedCard>
      ) : null}

      {canViewDocs ? (
        <ZohoRecordRelatedCard
          id="zoho-record-section-attachments"
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
              <li key={doc.id} className="mb-2">
                <button type="button" className="btn btn-link btn-sm p-0" onClick={() => onDownloadDocument(doc.id)}>
                  {doc.fileName}
                </button>
              </li>
            ))}
          </ul>
        </ZohoRecordRelatedCard>
      ) : null}

      <ZohoRecordRelatedCard id="zoho-record-section-emails" title="Emails" isEmpty emptyLabel="No records found" />
    </>
  );
}

export { DEAL_STAGES };
