// app/lib/api-error.ts
import { ApiError } from "@/api/core/ApiError";

export interface ValidationIssue {
  loc: Array<string | number>;
  msg?: string;
  type?: string;
  input?: unknown;
  detail?: unknown;
}

export interface ApiErrorInfo {
  status?: number;
  message: string;
  fields: Record<string, string>; // field -> message
  detail?: unknown;               // raw detail if needed
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object";

const firstMsg = (arr: unknown[]): string | undefined => {
  const first = (arr[0] ?? {}) as Record<string, unknown>;
  const m = first.msg ?? first.detail;
  return typeof m === "string" ? m : undefined;
};

const toFieldMap = (arr: unknown[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const e of arr) {
    if (!isRecord(e)) continue;
    const loc = Array.isArray(e.loc) ? e.loc : undefined;
    const field = loc ? String(loc[loc.length - 1]) : undefined;
    const msgRaw = e.msg ?? e.detail;
    const msg = typeof msgRaw === "string" ? msgRaw : "Invalid value";
    if (field) out[field] = msg;
  }
  return out;
};

/**
 * Typed extractor for status, message and field-level errors.
 * Works with openapi-typescript-codegen ApiError, Axios-like errors, and generic throws.
 */
export function getApiErrorInfo(err: unknown): ApiErrorInfo {
  // openapi-typescript-codegen error
  if (err instanceof ApiError) {
    const status = err.status;
    const body = err.body;

    if (isRecord(body) && "detail" in body) {
      const d = (body as { detail?: unknown }).detail;

      if (typeof d === "string") {
        return { status, message: d, fields: {}, detail: d };
      }
      if (Array.isArray(d)) {
        return {
          status,
          message: firstMsg(d) ?? "Validation error",
          fields: toFieldMap(d),
          detail: d,
        };
      }
      if (isRecord(d)) {
        return { status, message: JSON.stringify(d), fields: {}, detail: d };
      }
      const maybeMsg = (body as { message?: unknown }).message;
      if (typeof maybeMsg === "string") {
        return { status, message: maybeMsg, fields: {}, detail: maybeMsg };
      }
    }

    if (typeof body === "string") {
      return { status, message: body, fields: {}, detail: body };
    }
    return { status, message: err.message ?? "Request failed", fields: {} };
  }

  // Axios-like / generic objects
  if (isRecord(err)) {
    const status =
      (isRecord(err.response) &&
        typeof (err.response as Record<string, unknown>).status === "number" &&
        ((err.response as Record<string, unknown>).status as number)) ||
      (typeof err.status === "number" ? (err.status as number) : undefined);

    const detailArr =
      (isRecord(err.body) &&
        Array.isArray((err.body as Record<string, unknown>).detail) &&
        ((err.body as Record<string, unknown>).detail as unknown[])) ||
      (isRecord(err.response) &&
        isRecord((err.response as Record<string, unknown>).data) &&
        Array.isArray(
          ((err.response as Record<string, unknown>).data as Record<string, unknown>).detail
        ) &&
        (((err.response as Record<string, unknown>).data as Record<string, unknown>)
          .detail as unknown[])) ||
      undefined;

    if (detailArr) {
      return {
        status,
        message: firstMsg(detailArr) ?? "Validation error",
        fields: toFieldMap(detailArr),
        detail: detailArr,
      };
    }

    const message =
      (typeof err.message === "string" && err.message) ||
      (isRecord(err.body) && typeof err.body?.message === "string" && (err.body.message as string)) ||
      "Request failed";

    return { status, message, fields: {} };
  }

  return { message: typeof err === "string" ? err : "Unexpected error", fields: {} };
}

/**
 * Extract human-friendly error details from FastAPI/ApiError responses.
 *
 * Supports both:
 *  • getApiErrorDetail(err) → string message (for toast/global errors)
 *  • getApiErrorDetail(err, true) → Record<string,string> map (for form field errors)
 */
export function getApiErrorDetail(
  err: unknown,
  asObject = false
): string | Record<string, string> {
  const info = getApiErrorInfo(err);
  return asObject ? info.fields : info.message;
}
