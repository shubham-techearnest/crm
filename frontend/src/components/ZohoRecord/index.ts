export { ZohoRecordView } from "./ZohoRecordView";
export type { ZohoRecordViewProps, ZohoRecordTab, ZohoRecordRelatedLink } from "./ZohoRecordView";
export { ZohoRecordAvatar } from "./ZohoRecordAvatar";
export type { ZohoRecordAvatarProps } from "./ZohoRecordAvatar";
export { ZohoRecordFieldGrid, ZohoRecordSummaryStrip } from "./ZohoRecordFieldGrid";
export type { ZohoRecordField } from "./ZohoRecordFieldGrid";
export { ZohoRecordSection, ZohoRecordRelatedCard } from "./ZohoRecordSection";
export { ZohoRecordInfoSection } from "./ZohoRecordInfoSection";
export { useRecordNavigation } from "./useRecordNavigation";
export { ZohoRecordTimeline } from "./ZohoRecordTimeline";
export {
  buildTimelineEntries,
  buildDealTimelineEntries,
  formatTimelineValue,
  recordLifecycleInfo,
} from "./buildTimelineEntries";
export type { TimelineEntry, TimelineChange, DealStageHistoryEntry, RecordLifecycleInfo } from "./buildTimelineEntries";
export { ZohoDealStagePipeline, formatDealStage } from "./ZohoDealStagePipeline";

export const DEFAULT_RELATED_LINKS = [
  { id: "notes", label: "Notes" },
  { id: "attachments", label: "Attachments" },
  { id: "open-activities", label: "Open Activities" },
  { id: "closed-activities", label: "Closed Activities" },
  { id: "emails", label: "Emails" },
  { id: "meetings", label: "Invited Meetings" },
  { id: "campaigns", label: "Campaigns" },
  { id: "social", label: "Social" },
] as const;

export const DEAL_RELATED_LINKS = [
  { id: "notes", label: "Notes" },
  { id: "attachments", label: "Attachments" },
  { id: "stage-history", label: "Stage History" },
  { id: "competitors", label: "Competitors" },
  { id: "open-activities", label: "Open Activities" },
  { id: "closed-activities", label: "Closed Activities" },
  { id: "contact-roles", label: "Contact Roles" },
  { id: "emails", label: "Emails" },
] as const;
