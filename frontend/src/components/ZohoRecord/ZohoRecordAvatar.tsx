export interface ZohoRecordAvatarProps {
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

export function ZohoRecordAvatar({ label, imageUrl, variant = "person" }: ZohoRecordAvatarProps) {
  if (imageUrl) {
    return (
      <span className="zoho-record-avatar">
        <img src={imageUrl} alt="" className="zoho-record-avatar-img" />
      </span>
    );
  }

  return (
    <span className={`zoho-record-avatar zoho-record-avatar--${variant}`} aria-hidden="true">
      {initialsFromLabel(label)}
    </span>
  );
}
