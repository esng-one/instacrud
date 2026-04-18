// components/auth/ProvisioningGuard.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import useAuth from "@/hooks/useAuth";
import { useMeContext } from "@/context/MeContext";
import { MeService } from "@/api/services/MeService";
import type { MeResponse } from "@/api/models/MeResponse";
import AuthLoader from "@/components/auth/AuthLoader";
import { getApiErrorInfo } from "@/app/lib/api-error";

const PROVISIONING_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const POLL_INTERVAL = 5000;
const ORG_STATUS_CACHE_KEY = "org.status";

function getCachedOrgStatus(orgId: string): string | null {
  try {
    const cached = localStorage.getItem(ORG_STATUS_CACHE_KEY);
    if (!cached) return null;
    const { id, status } = JSON.parse(cached);
    return id === orgId ? status : null;
  } catch {
    return null;
  }
}

function setCachedOrgStatus(orgId: string, status: string) {
  try {
    localStorage.setItem(ORG_STATUS_CACHE_KEY, JSON.stringify({ id: orgId, status }));
  } catch {}
}

function resolveProvisioningStatus(me: MeResponse): "ready" | "provisioning" | "failed" {
  if (!me.organization) {
    return me.user.role === "ADMIN" ? "ready" : "failed";
  }

  const cached = getCachedOrgStatus(me.organization.id);
  if (cached === "ACTIVE") return "ready";

  switch (me.organization.status) {
    case "PROVISIONING": return "provisioning";
    case "FAILED": return "failed";
    default:
      setCachedOrgStatus(me.organization.id, me.organization.status ?? "ACTIVE");
      return "ready";
  }
}

export default function ProvisioningGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const { me, isLoading: meLoading } = useMeContext();

  // Keep me in a ref so the effect can read the latest value without re-running
  // when MeContext does a background stale-while-revalidate (~60s TTL). Without this,
  // each revalidation would restart the effect, resetting the 5-minute provisioning timeout.
  const meRef = useRef(me);
  useEffect(() => { meRef.current = me; }, [me]);

  const [status, setStatus] = useState<"loading" | "provisioning" | "failed" | "ready">("loading");

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const logout = () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user.info");
      localStorage.removeItem(ORG_STATUS_CACHE_KEY);
    } catch {}
    window.location.href = "/signin";
  };

  useEffect(() => {
    if (!isAuthenticated || isLoadingAuth || meLoading) return;

    let cancelled = false;

    const stopPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    const poll = async () => {
      try {
        const fresh = await MeService.getMeMeGet();
        if (cancelled) return;
        const freshStatus = resolveProvisioningStatus(fresh);
        if (freshStatus !== "provisioning") {
          setStatus(freshStatus);
          stopPolling();
        }
      } catch (err) {
        if (cancelled) return;
        const { status: httpStatus } = getApiErrorInfo(err);
        if (httpStatus === 403 || httpStatus === 404 || httpStatus === 501) {
          setStatus("failed");
          stopPolling();
        }
        // Transient errors (network, 5xx): keep polling
      }
    };

    const startPolling = () => {
      intervalRef.current = setInterval(poll, POLL_INTERVAL);
      timeoutRef.current = setTimeout(() => {
        setStatus("failed");
        stopPolling();
      }, PROVISIONING_TIMEOUT);
    };

    const initialCheck = async () => {
      let meData = meRef.current;

      // MeContext sets me=null on any fetch error. Fall back to a direct call so that
      // transient network errors don't permanently show "Provisioning Failed".
      if (meData === null) {
        try {
          meData = await MeService.getMeMeGet();
        } catch (err) {
          if (cancelled) return;
          const { status: httpStatus } = getApiErrorInfo(err);
          if (httpStatus === 403 || httpStatus === 404 || httpStatus === 501) {
            setStatus("failed");
          } else {
            // Transient error: start polling so the 5-minute timeout eventually shows the
            // "failed" screen with a Retry button rather than leaving the spinner forever.
            startPolling();
          }
          return;
        }
      }

      if (cancelled) return;

      const resolved = resolveProvisioningStatus(meData);
      setStatus(resolved);

      if (resolved === "provisioning") {
        startPolling();
      }
    };

    initialCheck();

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [isAuthenticated, isLoadingAuth, meLoading]); // me intentionally excluded — read via meRef

  if (isLoadingAuth || meLoading || status === "loading") {
    return <AuthLoader />;
  }

  if (status === "provisioning") {
    return (
      <AuthLoader>
        <h2 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
          Setting up your workspace...
        </h2>

        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
          We are provisioning your organization&apos;s resources. This usually takes about 2-3 minutes.
        </p>

        <button
          onClick={logout}
          className="mt-6 px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700"
        >
          Sign out
        </button>
      </AuthLoader>
    );
  }

  if (status === "failed") {
    return (
      <AuthLoader
        icon={
          <div className="w-16 h-16 text-red-500 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-900/30">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        }
      >
        <h2 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
          Provisioning Failed
        </h2>

        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
          Something went wrong while setting up your workspace.
        </p>

        <div className="flex gap-4 mt-6">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-white bg-brand-500 rounded-md hover:bg-brand-600"
          >
            Retry
          </button>

          <button
            onClick={logout}
            className="px-4 py-2 text-white bg-gray-600 rounded-md hover:bg-gray-700"
          >
            Sign out
          </button>
        </div>
      </AuthLoader>
    );
  }

  return <>{children}</>;
}
