import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { ZohoUserSelect, type ZohoUserSelectProps } from "./ZohoUserSelect";

export interface ZohoFormUserSelectProps<T extends FieldValues>
  extends Omit<ZohoUserSelectProps, "value" | "onChange" | "id"> {
  control: Control<T>;
  name: FieldPath<T>;
}

export function ZohoFormUserSelect<T extends FieldValues>({
  control,
  name,
  invalid,
  ...pickerProps
}: ZohoFormUserSelectProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <ZohoUserSelect
          {...pickerProps}
          id={field.name}
          value={field.value ?? ""}
          onChange={field.onChange}
          invalid={invalid ?? !!fieldState.error}
        />
      )}
    />
  );
}
