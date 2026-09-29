export interface TechEarnestAddressValues {
  country: string;
  flat: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  latitude: string;
  longitude: string;
}

export const EMPTY_ADDRESS: TechEarnestAddressValues = {
  country: "",
  flat: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  latitude: "",
  longitude: "",
};

export function parseAddressJson(raw: string | null | undefined): TechEarnestAddressValues {
  if (!raw?.trim()) return { ...EMPTY_ADDRESS };
  try {
    const parsed = JSON.parse(raw) as Partial<TechEarnestAddressValues>;
    return { ...EMPTY_ADDRESS, ...parsed };
  } catch {
    return { ...EMPTY_ADDRESS, street: raw };
  }
}

export function serializeAddressJson(values: TechEarnestAddressValues): string | undefined {
  const hasValue = Object.values(values).some((value) => value.trim());
  return hasValue ? JSON.stringify(values) : undefined;
}

export function addressPrefix<TPrefix extends string>(prefix: TPrefix) {
  return {
    country: `${prefix}Country` as const,
    flat: `${prefix}Flat` as const,
    street: `${prefix}Street` as const,
    city: `${prefix}City` as const,
    state: `${prefix}State` as const,
    zip: `${prefix}Zip` as const,
    latitude: `${prefix}Latitude` as const,
    longitude: `${prefix}Longitude` as const,
  };
}
