import ForgotPasswordClient from "@/components/auth/ForgotPasswordClient";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Forgot Password | InstaCRUD - Multi-Tenant CRUD Foundation",
  description: "Reset your password",
};

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordClient />
    </Suspense>
  );
}
