// components/auth/ResetPasswordClient.tsx
"use client";

import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import useUrlStatus from "@/hooks/useUrlStatus";

export default function ResetPasswordClient() {
  useUrlStatus();

  return <ResetPasswordForm />;
}
