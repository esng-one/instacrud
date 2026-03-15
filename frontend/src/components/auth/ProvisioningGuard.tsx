// components/auth/ProvisioningGuard.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import useAuth from "@/hooks/useAuth";
import { AdminService } from "@/api/services/AdminService";
import { OrganizationResponse } from "@/api/models/OrganizationResponse";
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

export default function ProvisioningGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();

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
    if (!isAuthenticated || isLoadingAuth) return;

    let cancelled = false;

    const stopPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    const checkStatus = async () => {
      try {
        const userInfoStr = localStorage.getItem("user.info");

        if (!userInfoStr) {
          setStatus("failed");
          stopPolling();
          return;
        }

        const userInfo = JSON.parse(userInfoStr);
        const orgId = userInfo.organization_id;
        const role = userInfo.role;

        if (!orgId) {
          if (role === "ADMIN") {
            setStatus("ready");
            stopPolling();
            return;
          }

          setStatus("failed");
          stopPolling();
          return;
        }

        // Skip API call if we already know the org is active
        const cachedStatus = getCachedOrgStatus(orgId);
        if (cachedStatus === "ACTIVE") {
          setStatus("ready");
          stopPolling();
          return;
        }

        const org: OrganizationResponse =
          await AdminService.getOrganizationAdminOrganizationsOrganizationIdGet(orgId);

        if (cancelled) return;

        switch (org.status) {
          case "PROVISIONING":
            setStatus("provisioning");
            break;

          case "FAILED":
            setStatus("failed");
            stopPolling();
            break;

          default:
            setCachedOrgStatus(orgId, org.status ?? "ACTIVE");
            setStatus("ready");
            stopPolling();
        }
      } catch (err) {
        const { status } = getApiErrorInfo(err);
        if (status === 403 || status === 404 || status === 501) {
          console.error("Provisioning check failed", err);
          setStatus("failed");
          stopPolling();
        }
      }
    };

    // initial check
    checkStatus();

    // polling only needed when provisioning is in progress
    intervalRef.current = setInterval(checkStatus, POLL_INTERVAL);

    // global timeout
    timeoutRef.current = setTimeout(() => {
      setStatus("failed");
      stopPolling();
    }, PROVISIONING_TIMEOUT);

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [isAuthenticated, isLoadingAuth]);

  if (isLoadingAuth || status === "loading") {
    return <AuthLoader />;
  }

  if (status === "provisioning") {
    return (
      <AuthLoader>
        <h2 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
          Setting up your workspace...
        </h2>

        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
          We are provisioning your organization's resources. This usually takes about 2-3 minutes.
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
