export { TechEarnestRecordView } from "./TechEarnestRecordView";
export type { TechEarnestRecordViewProps, TechEarnestRecordTab, TechEarnestRecordRelatedLink } from "./TechEarnestRecordView";
export { TechEarnestRecordAvatar } from "./TechEarnestRecordAvatar";
export type { TechEarnestRecordAvatarProps } from "./TechEarnestRecordAvatar";
export { TechEarnestRecordFieldGrid, TechEarnestRecordSummaryStrip } from "./TechEarnestRecordFieldGrid";
export type { TechEarnestRecordField } from "./TechEarnestRecordFieldGrid";
export { TechEarnestRecordSection, TechEarnestRecordRelatedCard } from "./TechEarnestRecordSection";
export { TechEarnestRecordInfoSection } from "./TechEarnestRecordInfoSection";
export { useRecordNavigation } from "./useRecordNavigation";
export { TechEarnestRecordTimeline } from "./TechEarnestRecordTimeline";
export {
  buildTimelineEntries,
  buildDealTimelineEntries,
  formatTimelineValue,
  recordLifecycleInfo,
} from "./buildTimelineEntries";
export type { TimelineEntry, TimelineChange, DealStageHistoryEntry, RecordLifecycleInfo } from "./buildTimelineEntries";
export { TechEarnestDealStagePipeline, formatDealStage } from "./TechEarnestDealStagePipeline";

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
