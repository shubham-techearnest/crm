import { createContext, useContext, type ReactNode } from "react";
import type { MeResponse } from "./authApi";

const AuthContext = createContext<MeResponse | null>(null);

export function AuthContextProvider({ user, children }: { user: MeResponse; children: ReactNode }) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuth(): MeResponse {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within an authenticated layout");
  }
  return value;
}

export function useHasPermission(permission?: string | string[]): boolean {
  const user = useContext(AuthContext);
  if (!user) {
    return false;
  }
  if (!permission) {
    return true;
  }
  const required = Array.isArray(permission) ? permission : [permission];
  return required.some((code) => user.permissions.includes(code));
}

export function isPlatformScope(dataScope: string | undefined | null): boolean {
  return dataScope === "PLATFORM";
}

export function useIsPlatformUser(): boolean {
  const user = useContext(AuthContext);
  return isPlatformScope(user?.dataScope);
}
