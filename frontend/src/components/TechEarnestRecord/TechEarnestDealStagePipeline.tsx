const STAGE_LABELS: Record<string, string> = {
  NEW: "Qualification",
  QUALIFICATION: "Qualification",
  REQUIREMENT: "Needs Analysis",
  PROPOSAL: "Proposal/Price Quote",
  NEGOTIATION: "Negotiation/Review",
  WON: "Closed Won",
  LOST: "Closed Lost",
};

export function formatDealStage(stage: string) {
  return STAGE_LABELS[stage] ?? stage.charAt(0) + stage.slice(1).toLowerCase();
}

export function TechEarnestDealStagePipeline({
  stages,
  currentStage,
  startDate,
  closingDate,
  onStageClick,
  disabled,
}: {
  stages: readonly string[];
  currentStage: string;
  startDate?: string | null;
  closingDate?: string | null;
  onStageClick?: (stage: string) => void;
  disabled?: boolean;
}) {
  const currentIndex = stages.indexOf(currentStage);

  return (
    <div className="techearnest-deal-pipeline">
      <div className="techearnest-deal-pipeline-meta">
        <span>{startDate ? `START ${new Date(startDate).toLocaleDateString()}` : "START —"}</span>
        <span>{closingDate ? `CLOSING ${new Date(closingDate).toLocaleDateString()}` : "CLOSING —"}</span>
      </div>
      <div className="techearnest-deal-pipeline-track">
        {stages.map((stage, index) => {
          const isActive = stage === currentStage;
          const isPast = currentIndex >= 0 && index < currentIndex;
          return (
            <button
              key={stage}
              type="button"
              className={`techearnest-deal-pipeline-stage${isActive ? " is-active" : ""}${isPast ? " is-past" : ""}`}
              disabled={disabled || !onStageClick || stage === currentStage}
              onClick={() => onStageClick?.(stage)}
            >
              {formatDealStage(stage)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
