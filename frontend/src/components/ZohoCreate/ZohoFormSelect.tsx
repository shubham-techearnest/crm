import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { ZohoPicker, type ZohoPickerProps } from "./ZohoPicker";

export interface ZohoFormSelectProps<T extends FieldValues>
  extends Omit<ZohoPickerProps, "value" | "onChange" | "id"> {
  control: Control<T>;
  name: FieldPath<T>;
  onValueChange?: (value: string) => void;
}

export function ZohoFormSelect<T extends FieldValues>({
  control,
  name,
  invalid,
  onValueChange,
  ...pickerProps
}: ZohoFormSelectProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <ZohoPicker
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
