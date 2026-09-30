import axios from "axios";
import { newRequestId } from "./client";

/**
 * Client for token-authenticated public endpoints (invites, emailed timesheet links). It sends no bearer token and
 * never redirects to /login, so it works for people who have no CRM session.
 */
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
});

publicApi.interceptors.request.use((config) => {
  config.headers.set("X-Request-Id", newRequestId());
  return config;
});

export function publicErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
  }
  return fallback;
}

export default publicApi;
