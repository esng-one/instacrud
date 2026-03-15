// components/auth/SignInClient.tsx
"use client";

import SignInForm from "@/components/auth/SignInForm";
import useUrlStatus from "@/hooks/useUrlStatus";

export default function SignInClient() {
  useUrlStatus();

  return <SignInForm />;
}
