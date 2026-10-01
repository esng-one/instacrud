// lib/authFailure.ts
/**
 * Global handling of 401 responses: any authenticated request rejected by the
 * server ends the session once, through the handler the admin layout registers.
 */
import axios from "axios";
import { OpenAPI } from "@/api/core/OpenAPI";

// Auth endpoints answer 401 for bad credentials or codes, which is not a session failure
const AUTH_PATH = /\/api\/v1\/(signin|signup|session|forgotPassword|resetPassword)(\/|\?|$)/;

let handler: (() => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null) {
  handler = fn;
}

/** Call on a 401 from an authenticated request. No-op once the session is already gone. */
export function reportUnauthorized(url: string) {
  if (!OpenAPI.TOKEN || AUTH_PATH.test(url)) return;
  handler?.();
}

// Kept on globalThis so a hot reload replaces the interceptor instead of stacking another
const g = globalThis as { __authInterceptorId?: number };

export function installAuthInterceptor() {
  if (g.__authInterceptorId !== undefined) axios.interceptors.response.eject(g.__authInterceptorId);
  g.__authInterceptorId = axios.interceptors.response.use(undefined, (error) => {
    if (error?.response?.status === 401 && error.config?.headers?.Authorization) {
      reportUnauthorized(error.config.url ?? "");
    }
    return Promise.reject(error);
  });
}
