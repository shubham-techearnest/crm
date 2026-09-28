import type { Control, FieldValues, Path, UseFormRegister } from "react-hook-form";
import { LEAD_COUNTRIES, LEAD_STATES, noneLabel } from "@/features/crm/leadFormConstants";
import { enumPickerOptions } from "./zohoPickerHelpers";
import { ZohoCreateField as ZohoField } from "./ZohoCreateField";
import { ZohoFormSelect } from "./ZohoFormSelect";
import type { ZohoAddressValues } from "./zohoAddressUtils";

const countryOptions = enumPickerOptions(LEAD_COUNTRIES, noneLabel);
const stateOptions = enumPickerOptions(LEAD_STATES, noneLabel);

interface ZohoAddressBoxProps<TForm extends FieldValues> {
  title: string;
  prefix: Record<keyof ZohoAddressValues, Path<TForm>>;
  register: UseFormRegister<TForm>;
  control: Control<TForm>;
  onClear: () => void;
}

export function ZohoAddressBox<TForm extends FieldValues>({
  title,
  prefix,
  register,
  control,
  onClear,
}: ZohoAddressBoxProps<TForm>) {
  return (
    <div className="zoho-address-box">
      <div className="zoho-address-box-title">{title}</div>
      <ZohoField label="Country / Region" wide>
        <ZohoFormSelect
          control={control}
          name={prefix.country}
          options={countryOptions}
          searchPlaceholder="Search Countries"
          lookupIcon="apps"
        />
      </ZohoField>
      <ZohoField label="Flat / House No./ Building / Apartment Name" wide>
        <input type="text" className="form-control form-control-sm" {...register(prefix.flat)} />
      </ZohoField>
      <ZohoField label="Street Address" wide>
        <input type="text" className="form-control form-control-sm" {...register(prefix.street)} />
      </ZohoField>
      <ZohoField label="City" wide>
        <input type="text" className="form-control form-control-sm" {...register(prefix.city)} />
      </ZohoField>
      <ZohoField label="State / Province" wide>
        <ZohoFormSelect
          control={control}
          name={prefix.state}
          options={stateOptions}
          searchPlaceholder="Search States"
          lookupIcon="apps"
        />
      </ZohoField>
      <ZohoField label="Zip / Postal Code" wide>
        <input type="text" className="form-control form-control-sm" {...register(prefix.zip)} />
      </ZohoField>
      <ZohoField label="Coordinates" wide>
        <div className="zoho-coordinates">
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
      </ZohoField>
      <div className="zoho-address-clear">
        <button type="button" className="btn btn-link btn-sm" onClick={onClear}>
          Clear All
        </button>
      </div>
    </div>
  );
}

export function clearAddressFields<TForm extends FieldValues>(
  prefix: Record<keyof ZohoAddressValues, Path<TForm>>,
  setValue: (name: Path<TForm>, value: string) => void,
) {
  (Object.keys(prefix) as (keyof ZohoAddressValues)[]).forEach((key) => {
    setValue(prefix[key], "");
  });
}
