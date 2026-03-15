// components/auth/SignUpForm.tsx
"use client";

import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import LegalModal from "@/components/auth/LegalModal";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import { OpenAPI } from "@/api/core/OpenAPI";
import { SystemService } from "@/api/services/SystemService";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import useAuth from "@/hooks/useAuth";
import { useApiFormErrors } from "@/hooks/useApiFormErrors";
import { useAutofillSync } from "@/hooks/useAutofillSync";
import { useTurnstileSettings } from "@/hooks/useTurnstileSettings";

export default function SignUpForm() {
  const router = useRouter();
  const { isAuthenticated, isLoadingAuth } = useAuth({ redirectIfUnauthenticated: false });
  const { fieldErrors, handleApiError } = useApiFormErrors();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  const [loadMockData, setLoadMockData] = useState(false);
  const [legalModalType, setLegalModalType] = useState<"terms" | "privacy" | null>(null);

  const {
    widget: turnstileWidget,
    canSubmit,
    showVerifying,
    reset: resetTurnstile,
    token,
    effectiveTurnstileEnabled,
    settingsLoaded,
    settings,
  } = useTurnstileSettings({ submitting: loading });

  const openRegistration = settings?.OPEN_REGISTRATION === true;
  const suggestLoadingMockData = settings?.SUGGEST_LOADING_MOCK_DATA === true;

  useEffect(() => {
    if (settings) {
      setLoadMockData(settings.SUGGEST_LOADING_MOCK_DATA_DEFAULT === true);
    }
  }, [settings]);

  // Redirect logged-in users away from /signup
  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      const redirectTo = sessionStorage.getItem("originalUrl") || "/";
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoadingAuth, router]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setForm((prev) => ({ ...prev, invitationId: q.get('invitation_id') ?? '' }))
  }, [])
  
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    invitationId: "",
    organizationName: "",
  });

  // Sync autofill values to React state
  useAutofillSync(setForm);

  const [userSetOrganizationName, setUserSetOrganizationName] = useState(false);

  // Auto-populate organization name when first/last name changes (only if user hasn't manually set it and invitation ID is empty)
  useEffect(() => {
    if (!userSetOrganizationName && openRegistration && form.firstName && form.lastName && !form.invitationId.trim()) {
      const autoOrgName = `${form.firstName} ${form.lastName}'s Team`;
      setForm(prev => ({ ...prev, organizationName: autoOrgName }));
    }
  }, [form.firstName, form.lastName, form.invitationId, userSetOrganizationName, openRegistration]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (!isChecked) {
      toast.error("You must agree to the terms and conditions.");
      setLoading(false);
      return;
    }

    // Validation based on OPEN_REGISTRATION setting
    if (openRegistration) {
      // When OPEN_REGISTRATION is true, either invitation ID or organization name must be filled
      if (!form.invitationId.trim() && !form.organizationName.trim()) {
        toast.error("Please provide either an Invitation ID or Organization Name.");
        setLoading(false);
        return;
      }
    } else {
      // When OPEN_REGISTRATION is false, invitation ID is mandatory
      if (!form.invitationId.trim()) {
        toast.error("Invitation ID is required.");
        setLoading(false);
        return;
      }
    }

    try {
      const res = await SystemService.signupSignupPost(
        {
          email: form.email,
          password: form.password,
          name: `${form.firstName} ${form.lastName}`.trim(),
          invitation_id: form.invitationId.trim(),
        },
        openRegistration && form.organizationName.trim() ? form.organizationName.trim() : undefined,
        loadMockData || undefined,
        token
      );
      if (res) {
        router.replace("/signin?status=success&message=User%20signed%20up%20successfully!%20Please%20sign%20in.");
      } else {
        toast.error("Error signing up user. Please try again.");
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      resetTurnstile();
      setLoading(false);
    }
  }

  const handleOAuthSignup = (provider: string) => {
    if (!isChecked) {
      toast.error("You must agree to the Terms and Conditions before signing up.");
      return;
    }

    const invitationId = form.invitationId.trim();
    
    let stateObj: any = {};
    if (invitationId) {
      stateObj.invitation_id = invitationId;
    } else if (openRegistration) {
      const orgName = form.organizationName.trim();
      if (orgName) {
        stateObj.organization_name = orgName;
      }
      if (loadMockData) {
        stateObj.load_mock_data = true;
      }
    }

    let stateStr: string | undefined;
    if (Object.keys(stateObj).length > 0) {
      // Use encodeURIComponent to safely handle non-ASCII characters in organization name
      stateStr = btoa(unescape(encodeURIComponent(JSON.stringify(stateObj))));
    }
    
    const url = new URL(`${OpenAPI.BASE}/api/v1/signup/${provider}`);
    if (stateStr) {
        url.searchParams.set("state", stateStr);
    }
    window.location.href = url.toString();
  };

  return (
    <>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Sign Up
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your email and password to sign up!
            </p>
          </div>
          <div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5">
              <button 
                type="button"
                disabled={loading}
                onClick={() => handleOAuthSignup("google")}
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
                Sign up with Google
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleOAuthSignup("microsoft")}
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
                Sign up with Microsoft
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
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {/* <!-- First Name --> */}
                  <div className="sm:col-span-1">
                    <Label>
                      First Name<span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={form.firstName}
                      onChange={(e) =>
                        setForm({ ...form, firstName: e.target.value })
                      }
                      placeholder="Enter your first name"
                      className={fieldErrors.firstName ? "border-red-500" : ""}
                      required
                    />
                    {fieldErrors.firstName && <p className="text-xs text-red-500">{fieldErrors.firstName}</p>}
                  </div>
                  {/* <!-- Last Name --> */}
                  <div className="sm:col-span-1">
                    <Label>
                      Last Name<span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={form.lastName}
                      onChange={(e) =>
                        setForm({ ...form, lastName: e.target.value })
                      }
                      placeholder="Enter your last name"
                      className={fieldErrors.lastName ? "border-red-500" : ""}
                      required
                    />
                    {fieldErrors.lastName && <p className="text-xs text-red-500">{fieldErrors.lastName}</p>}
                  </div>
                </div>
                {/* <!-- Email --> */}
                <div>
                  <Label>
                    Email<span className="text-error-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="Enter your email"
                    className={fieldErrors.email ? "border-red-500" : ""}
                    required
                  />
                  {fieldErrors.email && <p className="text-xs text-red-500">{fieldErrors.email}</p>}
                </div>
                {/* <!-- Password --> */}
                <div>
                  <Label>
                    Password<span className="text-error-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      placeholder="Enter your password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                      className={fieldErrors.password ? "border-red-500" : ""}
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
                    {fieldErrors.password && <p className="text-xs text-red-500">{fieldErrors.password}</p>}
                  </div>
                </div>
                {/* <!-- Organization Name --> */}
                {openRegistration && (
                  <div>
                    <Label>
                      Organization Name{!form.invitationId.trim() && <span className="text-error-500">*</span>}
                    </Label>
                    <Input
                      type="text"
                      id="organizationName"
                      name="organizationName"
                      value={form.organizationName}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        if (newValue.trim() !== "") {
                          // If user starts typing organization name, clear and disable invitation ID
                          setForm({ ...form, organizationName: newValue, invitationId: "" });
                        } else {
                          // If organization name is cleared, just update it
                          setForm({ ...form, organizationName: newValue });
                        }
                        setUserSetOrganizationName(true);
                      }}
                      placeholder="Enter your organization name"
                      disabled={form.invitationId.trim() !== ""}
                    />
                  </div>
                )}
                {/* <!-- Invitation ID --> */}
                <div>
                  <Label>
                    Invitation ID{!openRegistration || !form.organizationName.trim() ? <span className="text-error-500">*</span> : null}
                  </Label>
                  <Input
                    type="text"
                    id="invitationId"
                    name="invitationId"
                    value={form.invitationId}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      if (newValue.trim() !== "") {
                        // If user starts typing invitation ID, clear organization name
                        setForm({ ...form, invitationId: newValue, organizationName: "" });
                        setUserSetOrganizationName(false); // Reset the user set organization flag
                      } else {
                        // If invitation ID is cleared, just update it
                        setForm({ ...form, invitationId: newValue });
                      }
                    }}
                    placeholder="Paste your invitation ID here"
                    className={fieldErrors.invitationId ? "border-red-500" : ""}
                    disabled={form.organizationName.trim() !== ""}
                  />
                  {fieldErrors.invitationId && <p className="text-xs text-red-500">{fieldErrors.invitationId}</p>}
                  {openRegistration && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Either Invitation ID or Organization Name is required. Fields are mutually exclusive.
                    </p>
                  )}
                </div>
                {/* <!-- Load Mock Data Option --> */}
                {openRegistration && suggestLoadingMockData && form.organizationName.trim() && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <Checkbox
                      className="w-5 h-5"
                      checked={loadMockData}
                      onChange={setLoadMockData}
                    />
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white/90">
                        Load sample data
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Pre-populate your organization with sample clients, projects, and documents to explore the platform.
                      </p>
                    </div>
                  </div>
                )}
                {/* <!-- Checkbox --> */}
                <div className="flex items-center gap-3">
                  <Checkbox
                    className="w-5 h-5"
                    checked={isChecked}
                    onChange={setIsChecked}
                    required
                  />
                  <p className="inline-block font-normal text-gray-500 dark:text-gray-400">
                    By creating an account means you agree to the{" "}
                    <button
                      type="button"
                      onClick={() => setLegalModalType("terms")}
                      className="text-gray-800 dark:text-white/90 hover:underline"
                    >
                      Terms and Conditions
                    </button>
                    {" "}and our{" "}
                    <button
                      type="button"
                      onClick={() => setLegalModalType("privacy")}
                      className="text-gray-800 dark:text-white hover:underline"
                    >
                      Privacy Policy
                    </button>
                  </p>
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
                {/* <!-- Button --> */}
                <div>
                  <button 
                  type="submit"
                  disabled={!canSubmit}
                  className={`
                    flex items-center justify-center w-full px-4 py-3 text-sm font-medium rounded-lg shadow-theme-xs transition
                    ${!canSubmit
                      ? "bg-slate-200 dark:bg-slate-600/40 text-gray-500 cursor-not-allowed"
                      : "bg-brand-500 text-white hover:bg-brand-600 dark:bg-brand-400 dark:hover:bg-brand-500"
                    }
                  `}
                  >
                    {loading ? "Signing Up..." : "Sign Up"}
                  </button>
                </div>
              </div>
            </form>

            <div className="mt-5">
              <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
                Already have an account?{" "}
                <Link
                  href="/signin"
                  className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {legalModalType && (
        <LegalModal
          isOpen={true}
          onClose={() => setLegalModalType(null)}
          type={legalModalType}
        />
      )}
    </>
  );
}
