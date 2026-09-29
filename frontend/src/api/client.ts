import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

export const ACCESS_TOKEN_KEY = "te.accessToken";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  withCredentials: true,
});

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshInFlight: Promise<string> | null = null;

/** `crypto.randomUUID` only exists in secure contexts (HTTPS or localhost). */
export function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function redirectToLogin() {
  if (!window.location.pathname.startsWith("/login")) {
    window.location.assign("/login");
  }
}

api.interceptors.request.use((config) => {
  config.headers.set("X-Request-Id", newRequestId());
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";
    const skipRefresh = url.includes("/auth/login") || url.includes("/auth/refresh") || url.includes("/auth/logout");
    if (status !== 401 || !original || original._retry || skipRefresh) {
      return Promise.reject(error);
    }
    original._retry = true;
    try {
      const token = await refreshAccessToken();
      original.headers.set("Authorization", `Bearer ${token}`);
      return api.request(original);
    } catch (refreshError) {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  },
);

async function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .create({
        baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
        withCredentials: true,
      })
      .post("/auth/refresh")
      .then((response) => {
        const token = response.data?.data?.accessToken as string | undefined;
        if (!token) {
          throw new Error("Refresh failed");
        }
        window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
        return token;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export default api;
