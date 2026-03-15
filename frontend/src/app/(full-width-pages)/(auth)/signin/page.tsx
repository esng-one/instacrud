import SignInClient from "@/components/auth/SignInClient";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "SignIn Page | InstaCRUD - Multi-Tenant CRUD Foundation",
  description: "A production-ready, extendable Python CRUD platform for multi-tenant SaaS",
};

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInClient />
    </Suspense>
  );
}