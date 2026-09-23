import type { ReactNode } from "react";
import { useHasPermission } from "@/features/auth/AuthContext";

interface PermissionGuardProps {
  permission?: string;
  anyOf?: string[];
  children: ReactNode;
}

export function PermissionGuard({ permission, anyOf, children }: PermissionGuardProps) {
  const allowed = useHasPermission(anyOf && anyOf.length > 0 ? anyOf : permission);
  if (!allowed) {
    return null;
  }
  return <>{children}</>;
}
