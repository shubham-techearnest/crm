import type { ReactNode } from "react";
import { ZohoCreateShell } from "./ZohoCreateShell";
import { ZohoRecordImage } from "./ZohoRecordImage";
import type { useZohoRecordPhoto } from "./useZohoRecordPhoto";

type PhotoState = ReturnType<typeof useZohoRecordPhoto>;

export interface ZohoFormKitCreateViewProps {
  title: string;
  tableCode?: string;
  entityLabel?: string;
  pending?: boolean;
  isDirty?: boolean;
  formError?: string | null;
  alert?: ReactNode;
  onCancel: () => void;
  onSave: () => void;
  onSaveAndNew?: () => void;
  onSubmit?: () => void;
  photo: PhotoState;
  imageLabel?: string;
  showRecordImage?: boolean;
  children: ReactNode;
}

export function ZohoFormKitCreateView({
  title,
  tableCode,
  entityLabel,
  pending = false,
  isDirty = false,
  formError,
  alert,
  onCancel,
  onSave,
  onSaveAndNew,
  onSubmit,
  photo,
  imageLabel,
  showRecordImage = true,
  children,
}: ZohoFormKitCreateViewProps) {
  const label = entityLabel ?? title.replace(/^Create\s+/i, "");

  return (
    <ZohoCreateShell
      title={title}
      tableCode={tableCode}
      entityLabel={label}
      pending={pending}
      isDirty={isDirty}
      formError={formError}
      alert={alert}
      onCancel={onCancel}
      onSave={onSave}
      onSaveAndNew={onSaveAndNew}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
      showRecordImage={showRecordImage}
      recordImage={
        <ZohoRecordImage
          photoInputRef={photo.photoInputRef}
          photoPreviewUrl={photo.photoPreviewUrl}
          photoError={photo.photoError}
          hasPhoto={!!photo.photoFile}
          onPhotoSelected={photo.onPhotoSelected}
          onPickPhoto={photo.openPhotoPicker}
          onClearPhoto={photo.clearPhoto}
          imageLabel={imageLabel ?? `${label} Image`}
        />
      }
    >
      <div className="zoho-create-formkit">{children}</div>
    </ZohoCreateShell>
  );
}
