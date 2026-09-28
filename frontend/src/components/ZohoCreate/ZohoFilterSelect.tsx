import { ZohoPicker, type ZohoPickerOption } from "@/components/ZohoCreate/ZohoPicker";

export interface ZohoFilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ZohoPickerOption[];
  searchPlaceholder?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export function ZohoFilterSelect({
  label,
  value,
  onChange,
  options,
  searchPlaceholder,
  placeholder = "All",
  allowEmpty = true,
  emptyLabel = "All",
}: ZohoFilterSelectProps) {
  return (
    <div className="zoho-filter-field">
      <label className="form-label">{label}</label>
      <ZohoPicker
        value={value}
        onChange={onChange}
        options={options}
        searchPlaceholder={searchPlaceholder ?? `Search ${label}`}
        placeholder={placeholder}
        allowEmpty={allowEmpty}
        emptyLabel={emptyLabel}
        lookupIcon="apps"
        menuPlacement="portal"
      />
    </div>
  );
}
