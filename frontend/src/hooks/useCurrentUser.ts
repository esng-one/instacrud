// hooks/useCurrentUser.ts
"use client";

import { useState, useEffect } from "react";

interface UserInfo {
  user_id: string;
  name: string;
  email: string;
  role: string;
  organization_id: string;
  tier?: number | null;
  token_exp?: number | null;
  has_password?: boolean;
}

export default function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getCurrentUser = () => {
      try {
        const userInfoStr = localStorage.getItem("user.info");
        if (userInfoStr) {
          const userInfo: UserInfo = JSON.parse(userInfoStr);
          setCurrentUser(userInfo);
        }
      } catch (error) {
        console.error("Error parsing user info:", error);
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    getCurrentUser();

    // Listen for storage changes to update user info if it changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "user.info") {
        getCurrentUser();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return { currentUser, isLoading };
}