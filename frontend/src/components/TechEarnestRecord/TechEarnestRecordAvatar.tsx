export interface TechEarnestRecordAvatarProps {
  label: string;
  imageUrl?: string | null;
  variant?: "person" | "building";
}

function initialsFromLabel(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TechEarnestRecordAvatar({ label, imageUrl, variant = "person" }: TechEarnestRecordAvatarProps) {
  if (imageUrl) {
    return (
      <span className="techearnest-record-avatar">
        <img src={imageUrl} alt="" className="techearnest-record-avatar-img" />
      </span>
    );
  }

  return (
    <span className={`techearnest-record-avatar techearnest-record-avatar--${variant}`} aria-hidden="true">
      {initialsFromLabel(label)}
    </span>
  );
}
