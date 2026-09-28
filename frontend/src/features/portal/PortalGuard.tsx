import { Navigate, Outlet } from "react-router-dom";
import { PORTAL_ACCESS_TOKEN_KEY } from "./portalApi";

export function PortalGuard() {
  const token = window.localStorage.getItem(PORTAL_ACCESS_TOKEN_KEY);
  if (!token) {
    return <Navigate to="/portal/login" replace />;
  }
  return <Outlet />;
}
