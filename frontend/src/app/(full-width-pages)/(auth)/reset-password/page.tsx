import ResetPasswordClient from "@/components/auth/ResetPasswordClient";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Reset Password | InstaCRUD - Multi-Tenant CRUD Foundation",
  description: "Set your new password",
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordClient />
    </Suspense>
  );
}
