import SignUpClient from "@/components/auth/SignUpClient";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "SignUp Page | InstaCRUD - Multi-Tenant CRUD Foundation",
  description: "A production-ready, extendable Python CRUD platform for multi-tenant SaaS",
};

export default function SignUp() {
    return (
      <Suspense fallback={null}>
        <SignUpClient />
      </Suspense>
    );
}
