import { Navigate } from "react-router-dom";
import { getAccessToken } from "./authApi";
import { LoginPage } from "./LoginPage";

export function GuestGuard() {
  if (getAccessToken()) {
    return <Navigate to="/" replace />;
  }
  return <LoginPage />;
}
