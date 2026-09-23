/**
 * Contact advanced filter catalog (whitelist — must match ContactFilterFields.ALLOWED on server).
 */
export const CONTACT_FILTER_CATALOG = [
  { field: "accountId", label: "Account", type: "uuid" as const },
  { field: "status", label: "Status", type: "enum" as const },
  { field: "ownerId", label: "Owner", type: "uuid" as const, special: "CURRENT_USER" as const },
  { field: "email", label: "Email", type: "string" as const },
  { field: "designation", label: "Designation", type: "string" as const },
] as const;

export type ContactListFilters = {
  search?: string;
  accountId?: string;
  status?: string;
  ownerId?: string;
  email?: string;
  designation?: string;
};
