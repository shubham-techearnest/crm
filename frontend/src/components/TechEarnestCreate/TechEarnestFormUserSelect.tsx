import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { TechEarnestUserSelect, type TechEarnestUserSelectProps } from "./TechEarnestUserSelect";

export interface TechEarnestFormUserSelectProps<T extends FieldValues>
  extends Omit<TechEarnestUserSelectProps, "value" | "onChange" | "id"> {
  control: Control<T>;
  name: FieldPath<T>;
}

export function TechEarnestFormUserSelect<T extends FieldValues>({
  control,
  name,
  invalid,
  ...pickerProps
}: TechEarnestFormUserSelectProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TechEarnestUserSelect
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
