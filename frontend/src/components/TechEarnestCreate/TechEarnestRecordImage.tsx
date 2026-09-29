import type { ChangeEvent, RefObject } from "react";

export interface TechEarnestRecordImageProps {
  photoInputRef: RefObject<HTMLInputElement>;
  photoPreviewUrl: string | null;
  photoError: string | null;
  hasPhoto: boolean;
  onPhotoSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  onPickPhoto: () => void;
  onClearPhoto: () => void;
  imageLabel?: string;
  variant?: "person" | "building";
}

export function TechEarnestRecordImage({
  photoInputRef,
  photoPreviewUrl,
  photoError,
  hasPhoto,
  onPhotoSelected,
  onPickPhoto,
  onClearPhoto,
  imageLabel = "Record Image",
  variant = "person",
}: TechEarnestRecordImageProps) {
  const isBuilding = variant === "building";

  return (
    <section className="techearnest-create-section techearnest-create-section--lead-image">
      <h2 className="techearnest-create-section-title">{imageLabel}</h2>
      <div className="techearnest-lead-image-block">
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="techearnest-create-avatar-input"
          onChange={onPhotoSelected}
        />
        <button
          type="button"
          className={`techearnest-lead-image-btn${isBuilding ? " techearnest-lead-image-btn--building" : ""}`}
          onClick={onPickPhoto}
          title={hasPhoto ? "Change photo" : "Upload photo"}
          aria-label={hasPhoto ? "Change photo" : "Upload photo"}
        >
          {photoPreviewUrl ? (
            <img
              src={photoPreviewUrl}
              alt=""
              className={`techearnest-lead-image-preview${isBuilding ? " techearnest-lead-image-preview--building" : ""}`}
            />
          ) : (
            <span
              className={`techearnest-lead-image-placeholder${isBuilding ? " techearnest-lead-image-placeholder--building" : ""}`}
              aria-hidden="true"
            >
              {isBuilding ? (
                <svg viewBox="0 0 24 24" focusable="false">
                  <path
                    d="M4 20V8l8-4 8 4v12H4z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path d="M9 20v-6h6v6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M4 10l8 4 8-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" focusable="false">
                  <circle cx="12" cy="8" r="4.25" fill="currentColor" />
                  <path
                    d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </span>
          )}
        </button>
        {hasPhoto ? (
          <div className="techearnest-lead-image-actions">
            <button type="button" className="btn btn-link btn-sm p-0" onClick={onPickPhoto}>
              Change
            </button>
            <span className="text-muted">·</span>
            <button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={onClearPhoto}>
              Remove
            </button>
          </div>
        ) : null}
        {photoError ? <div className="small text-danger">{photoError}</div> : null}
      </div>
    </section>
  );
}
