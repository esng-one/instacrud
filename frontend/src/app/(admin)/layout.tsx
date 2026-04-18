"use client";

import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import AuthGuard from "@/components/auth/AuthGuard";
import ProvisioningGuard from "@/components/auth/ProvisioningGuard";
import { MeProvider } from "@/context/MeContext";
import Backdrop from "@/layout/Backdrop";
import React, { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { logout } from "@/app/lib/util";
import { AiPanelProvider, useAiPanel } from "@/context/AiPanelContext";
import { ResizablePanel } from "@/components/ai-panel/ResizablePanel";
import { InPageChat } from "@/components/ai-panel/InPageChat";

/** Inner layout that can read the AiPanel context (must be a child of AiPanelProvider). */
function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const { isPanelOpen, closePanel, newPanelConversation } = useAiPanel();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locationKey = `${pathname}?${searchParams.toString()}`;

  // Close the panel and start a fresh conversation whenever the user navigates
  useEffect(() => {
    closePanel();
    newPanelConversation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationKey]);

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

  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "lg:ml-[270px]"
    : "lg:ml-[90px]";

  return (
    <div className="min-h-screen">
      {/* Sidebar and Backdrop */}
      <AppSidebar />
      <Backdrop />
      {/* Main Content Area */}
      <div
        className={`transition-all duration-300 ease-in-out ${mainContentMargin} ${isPanelOpen ? "flex flex-col h-screen overflow-hidden" : ""}`}
      >
        {/* Header */}
        <AppHeader />
        {/* Page Content — split when AI panel is open */}
        {isPanelOpen ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <ResizablePanel
              left={
                <div className="p-4 md:p-6 h-full overflow-y-auto">
                  {children}
                </div>
              }
              right={<InPageChat />}
            />
          </div>
        ) : (
          <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <MeProvider>
      <ProvisioningGuard>
        <AiPanelProvider>
          <AdminLayoutInner>{children}</AdminLayoutInner>
        </AiPanelProvider>
      </ProvisioningGuard>
      </MeProvider>
    </AuthGuard>
  );
}
