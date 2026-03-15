// components/auth/ForgotPasswordClient.tsx
"use client";

import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import useUrlStatus from "@/hooks/useUrlStatus";

export default function ForgotPasswordClient() {
  useUrlStatus();

  return <ForgotPasswordForm />;
}
