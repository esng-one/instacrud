"use client";

import { useState, useEffect, useCallback } from "react";
import { MeService } from "@/api/services/MeService";
import type { MeResponse } from "@/api/models/MeResponse";

export default function useMe() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const data = await MeService.getMeMeGet();
      setMe(data);
    } catch (error) {
      console.error("Failed to fetch /me:", error);
      setMe(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  return { me, isLoading, refetch: fetchMe };
}
