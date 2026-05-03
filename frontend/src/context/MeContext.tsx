// context/MeContext.tsx
"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { MeService } from "@/api/services/MeService";
import type { MeResponse } from "@/api/models/MeResponse";
import { ApiError } from "@/api/core/ApiError";

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

// Module-level ref that lets non-React code (e.g. the logout utility) reset
// authFailed state without requiring context access or prop drilling. This
// mirrors the same pattern used by clearMeCache above.
//
// Safe as a singleton because MeProvider is intentionally mounted once in the
// component tree. The useEffect cleanup in MeProvider nullifies it on unmount
// so a stale setter cannot fire after the provider is gone.
//
// IMPORTANT: performLogout MUST call resetAuthFailed() alongside clearMeCache().
// If MeProvider is ever promoted to the root layout it will persist across
// route group navigations (including /signin), so authFailed=true set during
// a 401 would still be true when the user re-logs in — triggering an infinite
// logout loop unless it is explicitly cleared here.
let _resetAuthFailed: (() => void) | null = null;

export function resetAuthFailed() {
  _resetAuthFailed?.();
}

interface MeContextValue {
  me: MeResponse | null;
  isLoading: boolean;
  // true when the server rejected the token with 401 (e.g. user missing after a DB switch).
  // Distinct from me===null, which can also result from a transient network error.
  // Client-side JWT validity does NOT imply server-side auth validity.
  authFailed: boolean;
  refetch: () => Promise<void>;
  updateMe: (data: MeResponse) => void;
}

const MeContext = createContext<MeContextValue | undefined>(undefined);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const cached = readCache();
  const [me, setMe] = useState<MeResponse | null>(cached?.data ?? null);
  const [isLoading, setIsLoading] = useState(!cached);
  const [authFailed, setAuthFailed] = useState(false);
  const fetchingRef = useRef(false);

  const fetchMe = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const data = await MeService.getMeMeGet();
      setMe(data);
      writeCache(data);
      setAuthFailed(false); // reset in case a prior fetch failed (e.g. after token refresh)
    } catch (error) {
      console.error("Failed to fetch /me:", error);
      // A 401 means the server actively rejected the token — not a transient error.
      // Surface this explicitly so downstream guards can react without re-fetching.
      if (error instanceof ApiError && error.status === 401) {
        setAuthFailed(true);
        clearMeCache(); // don't serve stale data after a token rejection
      }
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

  // Wire the module-level ref to the live state setter so resetAuthFailed()
  // can reach into this provider from outside React (e.g. performLogout).
  // Cleanup nullifies it on unmount to prevent a stale call after unmount.
  useEffect(() => {
    _resetAuthFailed = () => setAuthFailed(false);
    return () => { _resetAuthFailed = null; };
  }, []); // setAuthFailed is a stable dispatcher — intentionally no deps

  const updateMe = useCallback((data: MeResponse) => {
    setMe(data);
    writeCache(data);
  }, []);

  return (
    <MeContext.Provider value={{ me, isLoading, authFailed, refetch: fetchMe, updateMe }}>
      {children}
    </MeContext.Provider>
  );
}

export function useMeContext(): MeContextValue {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMeContext must be used within MeProvider");
  return ctx;
}
