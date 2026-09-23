import { Navigate, Outlet } from "react-router-dom";
import { useAuth, isPlatformScope } from "@/features/auth/AuthContext";

/** Only PLATFORM-scope users may enter Platform Console routes. */
export function PlatformGuard() {
  const user = useAuth();
  if (!isPlatformScope(user.dataScope)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

/** PLATFORM-scope users are redirected out of tenant CRM into Platform Console. */
export function TenantGuard() {
  const user = useAuth();
  if (isPlatformScope(user.dataScope)) {
    return <Navigate to="/platform" replace />;
  }
  return <Outlet />;
}
