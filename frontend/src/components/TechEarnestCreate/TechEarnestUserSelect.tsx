import { TechEarnestPicker, type TechEarnestPickerProps } from "./TechEarnestPicker";

export interface TechEarnestPickerUser {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
}

export interface TechEarnestUserSelectProps
  extends Omit<TechEarnestPickerProps, "options" | "mode" | "lookupIcon" | "searchPlaceholder" | "allowEmpty"> {
  users: TechEarnestPickerUser[];
  searchPlaceholder?: string;
  allowEmpty?: boolean;
}

export function TechEarnestUserSelect({
  users,
  value,
  onChange,
  searchPlaceholder = "Search Users",
  allowEmpty = true,
  ...rest
}: TechEarnestUserSelectProps) {
  const options = users.map((user) => ({
    value: user.id,
    label: `${user.firstName} ${user.lastName}`.trim(),
    subtitle: user.email ?? undefined,
  }));

  return (
    <TechEarnestPicker
      mode="user"
      lookupIcon="users"
      options={options}
      value={value}
      onChange={onChange}
      searchPlaceholder={searchPlaceholder}
      allowEmpty={allowEmpty}
      {...rest}
    />
  );
}
