// components/auth/AuthLoader.tsx
"use client";

import { ReactNode } from "react";

interface AuthLoaderProps {
  icon?: ReactNode;        // custom icon, defaults to spinner
  children?: ReactNode;    // extra content like buttons
}

export default function AuthLoader({ icon, children }: AuthLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-center px-6">
      <div className="mb-6">
        {icon ?? (
          <div className="w-16 h-16 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin"></div>
        )}
      </div>
      {children}
    </div>
  );
}
