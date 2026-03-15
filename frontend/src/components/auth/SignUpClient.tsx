// components/auth/SignUpClient.tsx
"use client";

import { useSearchParams } from "next/navigation";
import useUrlStatus from "@/hooks/useUrlStatus";
import SignUpForm from "./SignUpForm";

export default function SignUpClient() {
  const params = useSearchParams();
  const status = params.get("status");
  const path = status === "success" ? "/signin" : "/signup";

  useUrlStatus(path);

  return <SignUpForm />;
}
