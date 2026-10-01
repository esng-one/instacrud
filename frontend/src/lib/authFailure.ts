// lib/authFailure.ts
/**
 * Global handling of 401 responses: any authenticated request rejected by the
 * server ends the session once, through the handler the admin layout registers.
 */
import axios from "axios";
import { OpenAPI } from "@/api/core/OpenAPI";

// Auth endpoints answer 401 for bad credentials, which is not a session failure
const AUTH_PATH = /\/api\/v1\/(signin|signup|forgotPassword|resetPassword)(\/|\?|$)/;

let handler: (() => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null) {
  handler = fn;
}

/** Call on a 401 from an authenticated request. No-op once the session is already gone. */
export function reportUnauthorized(url: string) {
  if (!OpenAPI.TOKEN || AUTH_PATH.test(url)) return;
  handler?.();
}

export function installAuthInterceptor() {
  axios.interceptors.response.use(undefined, (error) => {
    if (error?.response?.status === 401 && error.config?.headers?.Authorization) {
      reportUnauthorized(error.config.url ?? "");
    }
    return Promise.reject(error);
  });
}
