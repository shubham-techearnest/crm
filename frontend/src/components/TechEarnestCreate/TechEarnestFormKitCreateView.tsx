import type { ReactNode } from "react";
import { TechEarnestCreateShell, type TechEarnestCreateExtraAction } from "./TechEarnestCreateShell";
import { TechEarnestRecordImage } from "./TechEarnestRecordImage";
import type { useTechEarnestRecordPhoto } from "./useTechEarnestRecordPhoto";

type PhotoState = ReturnType<typeof useTechEarnestRecordPhoto>;

export interface TechEarnestFormKitCreateViewProps {
  title: string;
  tableCode?: string;
  /** Id of the record being edited; leave empty when creating. */
  recordId?: string | null;
  entityLabel?: string;
  pending?: boolean;
  isDirty?: boolean;
  formError?: string | null;
  alert?: ReactNode;
  onCancel: () => void;
  onSave: () => void;
  onSaveAndNew?: () => void;
  onSubmit?: () => void;
  photo?: PhotoState;
  imageLabel?: string;
  showRecordImage?: boolean;
  saveLabel?: string;
  extraAction?: TechEarnestCreateExtraAction;
  children: ReactNode;
}

export function TechEarnestFormKitCreateView({
  title,
  tableCode,
  recordId,
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
  saveLabel,
  extraAction,
  children,
}: TechEarnestFormKitCreateViewProps) {
  const label = entityLabel ?? title.replace(/^Create\s+/i, "");

  return (
    <TechEarnestCreateShell
      title={title}
      tableCode={tableCode}
      recordId={recordId}
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
      saveLabel={saveLabel}
      extraAction={extraAction}
      recordImage={showRecordImage && photo ? (
        <TechEarnestRecordImage
          photoInputRef={photo.photoInputRef}
          photoPreviewUrl={photo.photoPreviewUrl}
          photoError={photo.photoError}
          hasPhoto={!!photo.photoFile}
          onPhotoSelected={photo.onPhotoSelected}
          onPickPhoto={photo.openPhotoPicker}
          onClearPhoto={photo.clearPhoto}
          imageLabel={imageLabel ?? `${label} Image`}
        />
      ) : undefined}
    >
      <div className="techearnest-create-formkit">{children}</div>
    </TechEarnestCreateShell>
  );
}
