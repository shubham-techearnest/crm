import type { ReactNode } from "react";
import { ErrorState } from "@/components/ErrorState/ErrorState";
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
    return (
      <ErrorState
        title="Access restricted"
        message="Your role does not have permission to view this page. Contact your organization administrator if you need access."
      />
    );
  }
  return <>{children}</>;
}
