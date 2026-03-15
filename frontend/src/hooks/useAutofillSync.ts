// hooks/useAutofillSync.ts
import { useEffect } from "react";

type FormSetter<T> = (updater: (prev: T) => T) => void;

export function useAutofillSync<T extends Record<string, any>>(
  setForm: FormSetter<T>
) {
  useEffect(() => {
    const handleAutoFill = (e: AnimationEvent) => {
      if (e.animationName !== "onAutoFillStart") return;

      const input = e.target as HTMLInputElement;
      const { name, value } = input;

      if (!name) return;

      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    };

    document.addEventListener("animationstart", handleAutoFill);
    return () => document.removeEventListener("animationstart", handleAutoFill);
  }, [setForm]);
}