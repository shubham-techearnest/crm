import type { UseQueryResult } from "@tanstack/react-query";
import type { Control, FieldErrors, FieldValues, UseFormHandleSubmit, UseFormRegister } from "react-hook-form";
import { DynamicForm } from "@/components/FormKit/DynamicForm";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { ZohoCreateSection } from "./ZohoCreateSection";
import { ZohoCreateShell } from "./ZohoCreateShell";
import { ZohoRecordImage } from "./ZohoRecordImage";
import type { useZohoRecordPhoto } from "./useZohoRecordPhoto";

type FormBundle = {
  layout: { layout: unknown };
  fields: unknown[];
};

type PhotoState = ReturnType<typeof useZohoRecordPhoto>;

export interface ZohoDynamicCreateViewProps<TForm extends FieldValues> {
  title: string;
  tableCode: string;
  entityLabel: string;
  entityType: string;
  formBundleQuery: UseQueryResult<FormBundle, Error>;
  register: UseFormRegister<TForm>;
  control: Control<TForm>;
  errors: FieldErrors<TForm>;
  isDirty: boolean;
  isSubmitting: boolean;
  formError: string | null;
  showMore: boolean;
  onMoreToggle: () => void;
  fieldConfig?: Record<string, unknown>;
  handleSubmit: UseFormHandleSubmit<TForm>;
  onSubmit: (values: TForm) => void;
  onCancel: () => void;
  onSaveAndNew: () => void;
  photo: PhotoState;
  imageLabel?: string;
}

export function ZohoDynamicCreateView<TForm extends FieldValues>({
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
}: ZohoDynamicCreateViewProps<TForm>) {
  return (
    <ZohoCreateShell
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
        <ZohoRecordImage
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
        <ZohoCreateSection title={`${entityLabel} Information`}>
          <div className="zoho-create-dynamic-form">
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
        </ZohoCreateSection>
      ) : null}
    </ZohoCreateShell>
  );
}
