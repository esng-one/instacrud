// components/auth/ResetPasswordForm.tsx
"use client";

import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import { SystemService } from "@/api/services/SystemService";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { getApiErrorDetail } from "@/app/lib/api-error";
import Link from "next/link";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (!tokenParam) {
      toast.error("Invalid or missing reset token");
      router.push("/signin");
      return;
    }
    setToken(tokenParam);
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!token) {
      toast.error("Invalid reset token");
      return;
    }

    setLoading(true);
    try {
      await SystemService.resetPasswordResetPasswordPost({
        token,
        new_password: newPassword,
      });
      toast.success("Password reset successfully! You can now sign in.");
      router.push("/signin");
    } catch (error) {
      toast.error(getApiErrorDetail(error) as string);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Reset Password
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your new password below.
            </p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    name="newPassword"
                    placeholder="Min. 8 characters"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute transform -translate-y-1/2 right-4 top-1/2"
                  >
                    {showPassword ? (
                      <EyeIcon className="w-5 h-5 text-gray-500" />
                    ) : (
                      <EyeCloseIcon className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    placeholder="Re-enter your password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute transform -translate-y-1/2 right-4 top-1/2"
                  >
                    {showConfirmPassword ? (
                      <EyeIcon className="w-5 h-5 text-gray-500" />
                    ) : (
                      <EyeCloseIcon className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
              {newPassword && newPassword.length < 8 && (
                <p className="text-xs text-red-500">
                  Password must be at least 8 characters long
                </p>
              )}
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">
                  Passwords do not match
                </p>
              )}
              <div className="space-y-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                >
                  {loading ? "Resetting..." : "Reset Password"}
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
