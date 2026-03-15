// hooks/useAuth.ts
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { OpenAPI } from "@/api";
import { jwtDecode } from "jwt-decode";
import { getToken, removeToken } from "@/lib/tokenStorage";

interface DecodedToken {
  user_id?: string;
  name?: string;
  email?: string;
  role?: string;
  organization_id?: string;
  tier?: number;
  exp?: number;
  has_password?: boolean;
  [key: string]: unknown;
}

export default function useAuth({ redirectIfUnauthenticated = true } = {}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = () => {
      const token = getToken();
      if (!token) {
        cleanupAuthState();
        if (redirectIfUnauthenticated) {
          router.replace("/signin");
        }
        return;
      }

      try {
        const payload: DecodedToken = jwtDecode(token);

        // Check if token is expired
        const currentTime = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < currentTime) {
          cleanupAuthState();
          sessionStorage.setItem("originalUrl", window.location.pathname);
          if (redirectIfUnauthenticated) {
            router.replace("/signin");
          }
          return;
        }

        OpenAPI.TOKEN = () => Promise.resolve(token);
        const userInfo = {
          user_id: payload.user_id || "",
          name: payload.name || payload.role || "USER",
          email: payload.email || "",
          role: payload.role || "",
          organization_id: payload.organization_id || "",
          tier: payload.tier,
          token_exp: payload.exp,
          has_password: payload.has_password ?? true,
        };
        localStorage.setItem("user.info", JSON.stringify(userInfo));
        setIsAuthenticated(true);
      } catch {
        cleanupAuthState();
        sessionStorage.setItem("originalUrl", window.location.pathname);
        if (redirectIfUnauthenticated) {
          router.replace("/signin");
        }
      } finally {
        setIsLoadingAuth(false);
      }
    };

    const cleanupAuthState = () => {
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      removeToken();
      localStorage.removeItem("user.info");
    };

    checkAuth();
  }, [router, redirectIfUnauthenticated]);

  return { isAuthenticated, isLoadingAuth };
}
