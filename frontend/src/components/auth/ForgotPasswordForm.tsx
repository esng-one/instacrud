// components/auth/ForgotPasswordForm.tsx
"use client";

import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { SystemService } from "@/api/services/SystemService";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { getApiErrorDetail } from "@/app/lib/api-error";
import Link from "next/link";
import { useTurnstileSettings } from "@/hooks/useTurnstileSettings";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    widget: turnstileWidget,
    canSubmit,
    showVerifying,
    reset: resetTurnstile,
    token,
    effectiveTurnstileEnabled,
  } = useTurnstileSettings({ submitting: loading });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await SystemService.forgotPasswordForgotPasswordPost({ email }, token);
      setSubmitted(true);
      toast.success("If the email exists, a reset link has been sent");
    } catch (error) {
      toast.error(getApiErrorDetail(error) as string);
       // Reset turnstile on error so user can try again
       resetTurnstile();
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <>
        <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
          <div>
            <div className="mb-5 sm:mb-8">
              <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
                Check Your Email
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                If an account exists with {email}, we've sent a password reset link to your email.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                The link will expire in 1 hour. If you don't receive an email within a few minutes, check your spam folder.
              </p>
              <Link href="/signin">
                <Button variant="outline" className="w-full">
                  Back to Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Forgot Password
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="mail@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
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

              <div className="space-y-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !canSubmit}
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
                <Link href="/signin">
                  <Button variant="outline" className="w-full" type="button">
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
