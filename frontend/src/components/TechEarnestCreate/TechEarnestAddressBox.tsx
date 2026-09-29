import type { Control, FieldValues, Path, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { LEAD_COUNTRIES, LEAD_STATES, noneLabel } from "@/features/crm/leadFormConstants";
import { enumPickerOptions } from "./techearnestPickerHelpers";
import { TechEarnestCreateField as TechEarnestField } from "./TechEarnestCreateField";
import { TechEarnestFormSelect } from "./TechEarnestFormSelect";
import type { TechEarnestAddressValues } from "./techearnestAddressUtils";

const countryOptions = enumPickerOptions(LEAD_COUNTRIES, noneLabel);
const stateOptions = enumPickerOptions(LEAD_STATES, noneLabel);

interface TechEarnestAddressBoxProps<TForm extends FieldValues> {
  title: string;
  prefix: Record<keyof TechEarnestAddressValues, Path<TForm>>;
  register: UseFormRegister<TForm>;
  control: Control<TForm>;
  onClear: () => void;
}

export function TechEarnestAddressBox<TForm extends FieldValues>({
  title,
  prefix,
  register,
  control,
  onClear,
}: TechEarnestAddressBoxProps<TForm>) {
  return (
    <div className="techearnest-address-box">
      <div className="techearnest-address-box-title">{title}</div>
      <TechEarnestField label="Country / Region" wide>
        <TechEarnestFormSelect
          control={control}
          name={prefix.country}
          options={countryOptions}
          searchPlaceholder="Search Countries"
          lookupIcon="apps"
        />
      </TechEarnestField>
      <TechEarnestField label="Flat / House No./ Building / Apartment Name" wide>
        <input type="text" className="form-control form-control-sm" {...register(prefix.flat)} />
      </TechEarnestField>
      <TechEarnestField label="Street Address" wide>
        <input type="text" className="form-control form-control-sm" {...register(prefix.street)} />
      </TechEarnestField>
      <TechEarnestField label="City" wide>
        <input type="text" className="form-control form-control-sm" {...register(prefix.city)} />
      </TechEarnestField>
      <TechEarnestField label="State / Province" wide>
        <TechEarnestFormSelect
          control={control}
          name={prefix.state}
          options={stateOptions}
          searchPlaceholder="Search States"
          lookupIcon="apps"
        />
      </TechEarnestField>
      <TechEarnestField label="Zip / Postal Code" wide>
        <input type="text" className="form-control form-control-sm" {...register(prefix.zip)} />
      </TechEarnestField>
      <TechEarnestField label="Coordinates" wide>
        <div className="techearnest-coordinates">
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Latitude"
            {...register(prefix.latitude)}
          />
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Longitude"
            {...register(prefix.longitude)}
          />
        </div>
      </TechEarnestField>
      <div className="techearnest-address-clear">
        <button type="button" className="btn btn-link btn-sm" onClick={onClear}>
          Clear All
        </button>
      </div>
    </div>
  );
}

export function clearAddressFields<TForm extends FieldValues>(
  prefix: Record<keyof TechEarnestAddressValues, Path<TForm>>,
  setValue: UseFormSetValue<TForm>,
) {
  (Object.keys(prefix) as (keyof TechEarnestAddressValues)[]).forEach((key) => {
    setValue(prefix[key], "" as never);
  });
}
