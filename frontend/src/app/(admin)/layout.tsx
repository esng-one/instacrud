"use client";

import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import AuthGuard from "@/components/auth/AuthGuard";
import ProvisioningGuard from "@/components/auth/ProvisioningGuard";
import Backdrop from "@/layout/Backdrop";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/lib/util";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const router = useRouter();

  useEffect(() => {
    const checkTokenExpiration = () => {
      try {
        const userInfoStr = localStorage.getItem("user.info");
        if (!userInfoStr) return;

        const userInfo = JSON.parse(userInfoStr);
        if (!userInfo.token_exp) return;

        const currentTime = Math.floor(Date.now() / 1000);
        if (userInfo.token_exp < currentTime) {
          logout(router, { message: "Your session has expired", action: "Please sign in again" });
        }
      } catch {
        // Ignore parsing errors
      }
    };

    checkTokenExpiration();
    const interval = setInterval(checkTokenExpiration, 60000);
    return () => clearInterval(interval);
  }, [router]);

  // Dynamic class for main content margin based on sidebar state
  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "lg:ml-[270px]"
    : "lg:ml-[90px]";

  return (
    <AuthGuard>
      <ProvisioningGuard>
        <div className="min-h-screen">
        {/* Sidebar and Backdrop */}
        <AppSidebar />
        <Backdrop />
        {/* Main Content Area */}
        <div
          className={`flex-1 transition-all  duration-300 ease-in-out ${mainContentMargin}`}
        >
          {/* Header */}
          <AppHeader />
          {/* Page Content */}
          <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">{children}</div>
        </div>
        </div>
      </ProvisioningGuard>
    </AuthGuard>
  );
}
