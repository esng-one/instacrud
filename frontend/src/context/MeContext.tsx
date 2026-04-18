// context/MeContext.tsx
"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { MeService } from "@/api/services/MeService";
import type { MeResponse } from "@/api/models/MeResponse";

const SESSION_CACHE_KEY = "me.cache";
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

interface MeCache {
  data: MeResponse;
  timestamp: number;
}

function readCache(): MeCache | null {
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MeCache;
  } catch {
    return null;
  }
}

function writeCache(data: MeResponse) {
  try {
    const cache: MeCache = { data, timestamp: Date.now() };
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

export function clearMeCache() {
  try {
    sessionStorage.removeItem(SESSION_CACHE_KEY);
  } catch {}
}

interface MeContextValue {
  me: MeResponse | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  updateMe: (data: MeResponse) => void;
}

const MeContext = createContext<MeContextValue | undefined>(undefined);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const cached = readCache();
  const [me, setMe] = useState<MeResponse | null>(cached?.data ?? null);
  const [isLoading, setIsLoading] = useState(!cached);
  const fetchingRef = useRef(false);

  const fetchMe = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const data = await MeService.getMeMeGet();
      setMe(data);
      writeCache(data);
    } catch (error) {
      console.error("Failed to fetch /me:", error);
      setMe(null);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const cache = readCache();
    const isStale = !cache || Date.now() - cache.timestamp > CACHE_TTL_MS;

    if (cache && !isStale) {
      // Serve cached immediately — no loading state
      setIsLoading(false);
      return;
    }

    // Either no cache or stale — fetch in background (stale-while-revalidate)
    fetchMe();
  }, [fetchMe]);

  const updateMe = useCallback((data: MeResponse) => {
    setMe(data);
    writeCache(data);
  }, []);

  return (
    <MeContext.Provider value={{ me, isLoading, refetch: fetchMe, updateMe }}>
      {children}
    </MeContext.Provider>
  );
}

export function useMeContext(): MeContextValue {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMeContext must be used within MeProvider");
  return ctx;
}
