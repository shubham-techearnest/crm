import type { UseQueryResult } from "@tanstack/react-query";
import type { Control, FieldErrors, FieldValues, UseFormHandleSubmit, UseFormRegister } from "react-hook-form";
import { DynamicForm } from "@/components/FormKit/DynamicForm";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { TechEarnestCreateSection } from "./TechEarnestCreateSection";
import { TechEarnestCreateShell } from "./TechEarnestCreateShell";
import { TechEarnestRecordImage } from "./TechEarnestRecordImage";
import type { useTechEarnestRecordPhoto } from "./useTechEarnestRecordPhoto";
import type { RuntimeFormBundle } from "@/features/admin/studio/metadataApi";
import type { DynamicFormFieldConfig } from "@/components/FormKit/DynamicForm";

type PhotoState = ReturnType<typeof useTechEarnestRecordPhoto>;

export interface TechEarnestDynamicCreateViewProps<TForm extends FieldValues> {
  title: string;
  tableCode: string;
  entityLabel: string;
  entityType: string;
  formBundleQuery: UseQueryResult<RuntimeFormBundle, Error>;
  register: UseFormRegister<TForm>;
  control: Control<TForm>;
  errors: FieldErrors<TForm>;
  isDirty: boolean;
  isSubmitting: boolean;
  formError: string | null;
  showMore: boolean;
  onMoreToggle: () => void;
  fieldConfig?: Partial<Record<string, DynamicFormFieldConfig>>;
  handleSubmit: UseFormHandleSubmit<TForm>;
  onSubmit: (values: TForm) => void;
  onCancel: () => void;
  onSaveAndNew: () => void;
  photo: PhotoState;
  imageLabel?: string;
}

export function TechEarnestDynamicCreateView<TForm extends FieldValues>({
  title,
  tableCode,
  entityLabel,
  register,
  control,
  errors,
  isDirty,
  isSubmitting,
  formError,
  showMore,
  onMoreToggle,
  fieldConfig,
  formBundleQuery,
  handleSubmit,
  onSubmit,
  onCancel,
  onSaveAndNew,
  photo,
  imageLabel,
}: TechEarnestDynamicCreateViewProps<TForm>) {
  return (
    <TechEarnestCreateShell
      title={title}
      tableCode={tableCode}
      entityLabel={entityLabel}
      pending={isSubmitting}
      isDirty={isDirty}
      formError={formError}
      onCancel={onCancel}
      onSave={() => void handleSubmit(onSubmit)()}
      onSaveAndNew={onSaveAndNew}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit(onSubmit)();
      }}
      recordImage={
        <TechEarnestRecordImage
          photoInputRef={photo.photoInputRef}
          photoPreviewUrl={photo.photoPreviewUrl}
          photoError={photo.photoError}
          hasPhoto={!!photo.photoFile}
          onPhotoSelected={photo.onPhotoSelected}
          onPickPhoto={photo.openPhotoPicker}
          onClearPhoto={photo.clearPhoto}
          imageLabel={imageLabel ?? `${entityLabel} Image`}
        />
      }
    >
      {formBundleQuery.isLoading ? <LoadingState label="Loading form layout..." workspace /> : null}
      {formBundleQuery.error ? (
        <ErrorState
          title="Form layout unavailable"
          message={`Published ${entityLabel} CREATE layout is required.`}
          workspace
        />
      ) : null}
      {formBundleQuery.data ? (
        <TechEarnestCreateSection title={`${entityLabel} Information`}>
          <div className="techearnest-create-dynamic-form">
            <DynamicForm
              layout={formBundleQuery.data.layout.layout}
              fields={formBundleQuery.data.fields}
              register={register}
              control={control}
              errors={errors}
              moreOpen={showMore}
              onMoreToggle={onMoreToggle}
              fieldConfig={fieldConfig}
            />
          </div>
        </TechEarnestCreateSection>
      ) : null}
    </TechEarnestCreateShell>
  );
}
