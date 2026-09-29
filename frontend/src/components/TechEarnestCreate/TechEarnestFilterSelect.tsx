import { TechEarnestPicker, type TechEarnestPickerOption } from "@/components/TechEarnestCreate/TechEarnestPicker";

export interface TechEarnestFilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: TechEarnestPickerOption[];
  searchPlaceholder?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export function TechEarnestFilterSelect({
  label,
  value,
  onChange,
  options,
  searchPlaceholder,
  placeholder = "All",
  allowEmpty = true,
  emptyLabel = "All",
}: TechEarnestFilterSelectProps) {
  return (
    <div className="techearnest-filter-field">
      <label className="form-label">{label}</label>
      <TechEarnestPicker
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
