import { Navigate, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { AuthContextProvider } from "./AuthContext";
import { clearAccessToken, fetchMe, getAccessToken } from "./authApi";

export function AuthGuard() {
  const token = getAccessToken();
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    enabled: Boolean(token),
    retry: false,
  });

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (meQuery.isLoading) {
    return <LoadingState label="Restoring session..." />;
  }

  if (meQuery.isError || !meQuery.data) {
    clearAccessToken();
    return <Navigate to="/login" replace />;
  }

  return (
    <AuthContextProvider user={meQuery.data}>
      <Outlet />
    </AuthContextProvider>
  );
}
