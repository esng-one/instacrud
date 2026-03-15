//components/common/MenuLink.tsx
"use client";
import Link from "next/link";
import { useSidebar } from "@/context/SidebarContext";
import React from "react";

interface MenuLinkProps extends React.ComponentProps<typeof Link> {
  children: React.ReactNode;
}

/**
 * A Link that automatically closes the mobile sidebar when clicked.
 */
export default function MenuLink({ children, ...props }: MenuLinkProps) {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar();

  const handleClick = () => {
    if (isMobileOpen) toggleMobileSidebar();
  };

  return (
    <Link
      {...props}
      onClick={(e) => {
        handleClick();
        props.onClick?.(e);
      }}
    >
      {children}
    </Link>
  );
}
