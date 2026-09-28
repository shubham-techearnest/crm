import type { AdminUser } from "@/features/admin/adminApi";
import type { ZohoPickerUser } from "./ZohoUserSelect";

export function buildOwnerOptions(
  users: AdminUser[] | undefined,
  currentUser?: { userId: string; displayName: string },
): ZohoPickerUser[] {
  const list = (users ?? []).map((user) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  }));

  if (currentUser?.userId && !list.some((user) => user.id === currentUser.userId)) {
    const parts = currentUser.displayName.trim().split(/\s+/);
    list.unshift({
      id: currentUser.userId,
      firstName: parts[0] ?? currentUser.displayName,
      lastName: parts.slice(1).join(" "),
      email: null,
    });
  }

  return list;
}
