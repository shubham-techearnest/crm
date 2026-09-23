import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useHasPermission } from "@/features/auth/AuthContext";

interface RoutePermissionProps {
  permission?: string;
  anyOf?: string[];
  children: ReactNode;
}

/** Blocks deep-linked routes when the user lacks the required permission. */
export function RoutePermission({ permission, anyOf, children }: RoutePermissionProps) {
  const allowed = useHasPermission(anyOf && anyOf.length > 0 ? anyOf : permission);
  if (!allowed) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
