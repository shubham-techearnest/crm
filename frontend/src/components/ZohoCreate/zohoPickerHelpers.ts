import type { ZohoPickerOption } from "./ZohoPicker";

export function optionsFromValues(values: readonly string[], labelFn?: (value: string) => string): ZohoPickerOption[] {
  return values
    .filter((value) => value !== "")
    .map((value) => ({
      value,
      label: labelFn ? labelFn(value) : value,
    }));
}

export function optionsFromPairs(items: { value: string; label: string; subtitle?: string }[]): ZohoPickerOption[] {
  return items.map((item) => ({
    value: item.value,
    label: item.label,
    subtitle: item.subtitle,
  }));
}

export function enumPickerOptions(
  values: readonly string[],
  labelFn: (value: string) => string = (value) => value,
): ZohoPickerOption[] {
  return values
    .filter((value) => value !== "")
    .map((value) => ({
      value,
      label: labelFn(value),
    }));
}

export function buildFilterOwnerOptions(
  users: { id: string; firstName: string; lastName: string; email?: string | null }[] | undefined,
  currentUserId?: string,
  currentUserLabel = "Current user",
): ZohoPickerOption[] {
  const options: ZohoPickerOption[] = [];
  if (currentUserId) {
    options.push({ value: currentUserId, label: currentUserLabel });
  }
  for (const user of users ?? []) {
    if (user.id === currentUserId) continue;
    options.push({
      value: user.id,
      label: `${user.firstName} ${user.lastName}`.trim(),
      subtitle: user.email ?? undefined,
    });
  }
  return options;
}
