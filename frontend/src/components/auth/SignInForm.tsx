// components/auth/SignInForm.tsx
"use client";

import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import { OpenAPI } from "@/api/core/OpenAPI";
import { SystemService } from "@/api/services/SystemService";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import useAuth from "@/hooks/useAuth";
import { getApiErrorDetail } from "@/app/lib/api-error";
import { setToken } from "@/lib/tokenStorage";
import { useTurnstileSettings } from "@/hooks/useTurnstileSettings";

export default function SignInForm() {
  const router = useRouter();
  const { isAuthenticated, isLoadingAuth } = useAuth({ redirectIfUnauthenticated: false });

  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(true);

  // Controlled form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    widget: turnstileWidget,
    canSubmit,
    showVerifying,
    reset: resetTurnstile,
    token,
    effectiveTurnstileEnabled,
  } = useTurnstileSettings({ submitting: loading });

  // Redirect logged-in users away from /signin
  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      const redirectTo = sessionStorage.getItem("originalUrl") || "/";
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoadingAuth, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await SystemService.signinSigninPost({ email, password }, token);
      if (res && res.access_token) {
        setToken(res.access_token, isChecked);
        const originalUrl = sessionStorage.getItem("originalUrl") || "/";
        sessionStorage.removeItem("originalUrl");
        router.push(originalUrl);
      } else {
        throw new Error("No access token returned");
      }
    } catch (error) {
      toast.error(getApiErrorDetail(error) as string);
    } finally {
      resetTurnstile();
      setLoading(false);
    }
  };

  const handleOAuthSignin = (provider: string) => {
    window.location.href = `${OpenAPI.BASE}/api/v1/signin/${provider}`;
  };

  return (
    <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
      <div>
        <div className="mb-5 sm:mb-8">
          <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
            Sign In
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enter your email and password to sign in!
          </p>
        </div>
        <div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleOAuthSignin("google")}
              className="inline-flex items-center justify-center gap-2 py-3 px-5 text-sm font-medium text-gray-700 transition-colors bg-gray-100 rounded-md hover:bg-gray-200 hover:text-gray-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10 whitespace-nowrap"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18.7511 10.1944C18.7511 9.47495 18.6915 8.94995 18.5626 8.40552H10.1797V11.6527H15.1003C15.0011 12.4597 14.4654 13.675 13.2749 14.4916L13.2582 14.6003L15.9087 16.6126L16.0924 16.6305C17.7788 15.1041 18.7511 12.8583 18.7511 10.1944Z"
                  fill="#4285F4"
                />
                <path
                  d="M10.1788 18.75C12.5895 18.75 14.6133 17.9722 16.0915 16.6305L13.274 14.4916C12.5201 15.0068 11.5081 15.3666 10.1788 15.3666C7.81773 15.3666 5.81379 13.8402 5.09944 11.7305L4.99473 11.7392L2.23868 13.8295L2.20264 13.9277C3.67087 16.786 6.68674 18.75 10.1788 18.75Z"
                  fill="#34A853"
                />
                <path
                  d="M5.10014 11.7305C4.91165 11.186 4.80257 10.6027 4.80257 9.99992C4.80257 9.3971 4.91165 8.81379 5.09022 8.26935L5.08523 8.1534L2.29464 6.02954L2.20333 6.0721C1.5982 7.25823 1.25098 8.5902 1.25098 9.99992C1.25098 11.4096 1.5982 12.7415 2.20333 13.9277L5.10014 11.7305Z"
                  fill="#FBBC05"
                />
                <path
                  d="M10.1789 4.63331C11.8554 4.63331 12.9864 5.34303 13.6312 5.93612L16.1511 3.525C14.6035 2.11528 12.5895 1.25 10.1789 1.25C6.68676 1.25 3.67088 3.21387 2.20264 6.07218L5.08953 8.26943C5.81381 6.15972 7.81776 4.63331 10.1789 4.63331Z"
                  fill="#EB4335"
                />
              </svg>
              Sign in with Google
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleOAuthSignin("microsoft")}
              className="inline-flex items-center justify-center gap-2 py-3 px-5 text-sm font-medium text-gray-700 transition-colors bg-gray-100 rounded-md hover:bg-gray-200 hover:text-gray-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10 whitespace-nowrap"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path fill="#ff5722" d="M2.5 2.5H9.2V9.2H2.5z" transform="rotate(-180 5.83 5.83)"/>
                <path fill="#4caf50" d="M10.8 2.5H17.5V9.2H10.8z" transform="rotate(-180 14.17 5.83)"/>
                <path fill="#ffc107" d="M10.8 10.8H17.5V17.5H10.8z" transform="rotate(-180 14.17 14.17)"/>
                <path fill="#03a9f4" d="M2.5 10.8H9.2V17.5H2.5z" transform="rotate(-180 5.83 14.17)"/>
              </svg>
              Sign in with Microsoft
            </button>
          </div>
          <div className="relative py-3 sm:py-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="p-2 text-gray-400 bg-white dark:bg-gray-900 sm:px-5 sm:py-2">
                Or
              </span>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              <div>
                <Label>
                  Email <span className="text-error-500">*</span>{" "}
                </Label>
                <Input
                  placeholder="info@gmail.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>
                  Password <span className="text-error-500">*</span>{" "}
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <span
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                  >
                    {showPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                    )}
                  </span>
                </div>
              </div>

              {/* <!-- Cloudflare Turnstile widget --> */}
              {effectiveTurnstileEnabled && (
                <div className="mt-4">{turnstileWidget}</div>
              )}
              {/* <!-- Verifying badge --> */}
              {showVerifying && (
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <span className="animate-spin h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full" />
                  Verifying…
                </p>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox checked={isChecked} onChange={setIsChecked} />
                  <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                    Keep me logged in
                  </span>
                </div>
                <Link
                  href="/forgot-password"
                  className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Forgot password?
                </Link>
              </div>
              <div>
                <Button
                  className="w-full"
                  size="sm"
                  type="submit"
                  disabled={loading || !canSubmit}
                >
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </div>
            </div>
          </form>

          <div className="mt-5">
            <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                Sign Up
              </Link>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-center text-gray-400 dark:text-gray-500">
              Powered by{" "}
              <a
                href="https://instacrud.it"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 transition-colors"
              >
                InstaCRUD
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
