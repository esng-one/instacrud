// hooks/useUserRole.ts
"use client";

import { useState, useEffect } from "react";

interface UserInfo {
  name: string;
  email: string;
  role: string;
  organization_id: string;
}

export default function useUserRole() {
  const [userRole, setUserRole] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getUserRole = () => {
      try {
        const userInfoStr = localStorage.getItem("user.info");
        if (userInfoStr) {
          const userInfo: UserInfo = JSON.parse(userInfoStr);
          setUserRole(userInfo.role || "");
        }
      } catch (error) {
        console.error("Error parsing user info:", error);
        setUserRole("");
      } finally {
        setIsLoading(false);
      }
    };

    getUserRole();

    // Listen for storage changes to update role if user info changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "user.info") {
        getUserRole();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const isAdmin = userRole === "ADMIN";
  const isOrgAdmin = userRole === "ORG_ADMIN";
  const canAccessAdmin = isAdmin || isOrgAdmin;

  return { userRole, isAdmin, isOrgAdmin, canAccessAdmin, isLoading };
}