// hooks/useApiFormErrors.ts
import { useState } from "react";
import { getApiErrorInfo, getApiErrorDetail } from "@/app/lib/api-error";
import toast from "react-hot-toast";

/**
 * Handles validation errors returned by FastAPI (usually 422) or other ApiErrors.
 * Returns:
 *  - fieldErrors: Record<string, string>
 *  - handleApiError: (error: unknown) => boolean (true if handled at field level)
 *  - clearFieldErrors: () => void
 */
export function useApiFormErrors() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldErrors = () => setFieldErrors({});

  const handleApiError = (err: unknown): boolean => {
    // reset old field errors
    setFieldErrors({});

    const { status, fields, message } = getApiErrorInfo(err);

    // If the backend returned per-field issues, surface them
    if (fields && Object.keys(fields).length > 0) {
      setFieldErrors(fields);
      // only toast for validation-style errors; keep quiet for success UX if you prefer
      if (status === 422) {
        toast.error("Please correct the highlighted fields.");
      }
      return true; // handled at field level
    }

    // Otherwise show a global toast
    toast.error(message || (getApiErrorDetail(err) as string));
    return false;
  };

  return { fieldErrors, handleApiError, clearFieldErrors };
}
