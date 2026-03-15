// hooks/useUrlStatus.ts
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

export default function useUrlStatus(path?: string) {

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const status = searchParams.get("status");
    const message = searchParams.get("message");

    if (status && message) {
      const decoded = decodeURIComponent(message);
      if (status === "error") {
        toast.error(decoded);
      } else if (status === "success") {
        toast.success(decoded);
      } else {
        toast(decoded);
      }

      // Clean URL
      setTimeout(() => {
        router.replace(path ?? window.location.pathname, { scroll: false });
      }, 0);
    }
  }, [searchParams, router]);
}
