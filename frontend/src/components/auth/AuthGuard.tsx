// components/auth/AuthGuard.tsx
"use client";

import React from "react";
import useAuth from "@/hooks/useAuth";
import AuthLoader from "@/components/auth/AuthLoader";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth || !isAuthenticated) {
    return <AuthLoader />;
  }

  return <>{children}</>;
}
