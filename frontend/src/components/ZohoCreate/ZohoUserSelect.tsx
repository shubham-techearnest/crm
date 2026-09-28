import { ZohoPicker, type ZohoPickerProps } from "./ZohoPicker";

export interface ZohoPickerUser {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
}

export interface ZohoUserSelectProps
  extends Omit<ZohoPickerProps, "options" | "mode" | "lookupIcon" | "searchPlaceholder" | "allowEmpty"> {
  users: ZohoPickerUser[];
  searchPlaceholder?: string;
  allowEmpty?: boolean;
}

export function ZohoUserSelect({
  users,
  value,
  onChange,
  searchPlaceholder = "Search Users",
  allowEmpty = true,
  ...rest
}: ZohoUserSelectProps) {
  const options = users.map((user) => ({
    value: user.id,
    label: `${user.firstName} ${user.lastName}`.trim(),
    subtitle: user.email ?? undefined,
  }));

  return (
    <ZohoPicker
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
