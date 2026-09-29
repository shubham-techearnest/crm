import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { TechEarnestPicker, type TechEarnestPickerProps } from "./TechEarnestPicker";

export interface TechEarnestFormSelectProps<T extends FieldValues>
  extends Omit<TechEarnestPickerProps, "value" | "onChange" | "id"> {
  control: Control<T>;
  name: FieldPath<T>;
  onValueChange?: (value: string) => void;
}

export function TechEarnestFormSelect<T extends FieldValues>({
  control,
  name,
  invalid,
  onValueChange,
  ...pickerProps
}: TechEarnestFormSelectProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TechEarnestPicker
          {...pickerProps}
          id={field.name}
          value={field.value ?? ""}
          onChange={(next) => {
            field.onChange(next);
            onValueChange?.(next);
          }}
          invalid={invalid ?? !!fieldState.error}
        />
      )}
    />
  );
}
