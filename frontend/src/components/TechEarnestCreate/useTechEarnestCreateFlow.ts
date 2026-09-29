import { useState } from "react";
import type { FieldValues, UseFormReset } from "react-hook-form";
import { attachRecordPhoto } from "./attachRecordPhoto";
import { useTechEarnestRecordPhoto } from "./useTechEarnestRecordPhoto";

interface UseTechEarnestCreateFlowOptions<TForm extends FieldValues, TEntity extends { id: string } = { id: string }> {
  defaults: TForm;
  reset: UseFormReset<TForm>;
  setShowForm: (open: boolean) => void;
  setFormError: (message: string | null) => void;
  setSelected?: (entity: TEntity) => void;
  onResetExtras?: () => void;
}

export function useTechEarnestCreateFlow<TForm extends FieldValues, TEntity extends { id: string } = { id: string }>({
  defaults,
  reset,
  setShowForm,
  setFormError,
  setSelected,
  onResetExtras,
}: UseTechEarnestCreateFlowOptions<TForm, TEntity>) {
  const [saveAndNew, setSaveAndNew] = useState(false);
  const photo = useTechEarnestRecordPhoto();

  function cancelCreate(isDirty: boolean) {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    setShowForm(false);
    setFormError(null);
    reset(defaults);
    onResetExtras?.();
    photo.clearPhoto();
  }

  async function afterCreateSuccess(entity: TEntity, entityType: string) {
    await attachRecordPhoto(entityType, entity.id, photo.photoFile);
    photo.clearPhoto();
    if (saveAndNew) {
      reset(defaults);
      setSaveAndNew(false);
      onResetExtras?.();
      return;
    }
    reset(defaults);
    setShowForm(false);
    onResetExtras?.();
    setSelected?.(entity);
  }

  return {
    saveAndNew,
    setSaveAndNew,
    photo,
    cancelCreate,
    afterCreateSuccess,
  };
}
