import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, type ReactNode } from "react";
import { setTargetOrganizationId } from "@/api/client";
import { AuthContextProvider, useAuth } from "@/features/auth/AuthContext";

/** Mirrors the backend grant for a Super Admin acting inside a tenant (JwtAuthenticationFilter). */
export const PLATFORM_TENANT_PERMISSIONS = [
  "ACL_VIEW",
  "ACL_MANAGE",
  "FIELD_ACL_VIEW",
  "FIELD_ACL_MANAGE",
  "METADATA_VIEW",
  "METADATA_MANAGE",
  "ROLE_VIEW",
  "ROLE_MANAGE",
  "USER_VIEW",
  "USER_MANAGE",
  "REGION_VIEW",
  "DEPARTMENT_VIEW",
  "TEAM_VIEW",
  "ORG_VIEW",
];

/**
 * Renders tenant admin screens (roles, users, ACL, Metadata Studio) for one organization inside the
 * platform console: API calls carry the target organization header, the query cache is isolated per
 * organization, and permission checks see the platform grant instead of the Super Admin's own.
 */
export function TenantScope({ organizationId, children }: { organizationId: string; children: ReactNode }) {
  const platformUser = useAuth();
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
    // A fresh cache per organization keeps one tenant's metadata from leaking into another's screens.
    [organizationId],
  );
  const scopedUser = useMemo(
    () => ({
      ...platformUser,
      organizationId,
      dataScope: "ORGANIZATION",
      regionIds: [],
      departmentId: null,
      teamId: null,
      resourceId: null,
      permissions: PLATFORM_TENANT_PERMISSIONS,
    }),
    [platformUser, organizationId],
  );

  // Children start fetching in their own effects, which run before this component's effects.
  setTargetOrganizationId(organizationId);

  useEffect(() => {
    setTargetOrganizationId(organizationId);
    return () => {
      setTargetOrganizationId(null);
      queryClient.clear();
    };
  }, [organizationId, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContextProvider user={scopedUser}>{children}</AuthContextProvider>
    </QueryClientProvider>
  );
}
