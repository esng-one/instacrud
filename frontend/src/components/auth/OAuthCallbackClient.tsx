// components/auth/OAuthCallbackClient.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OauthService } from "@/api/services/OauthService";
import AuthLoader from "@/components/auth/AuthLoader";
import { setToken } from "@/lib/tokenStorage";

export default function OAuthCallbackClient() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const sessionCode = params.get("session_code");

    if (!sessionCode) {
      router.replace("/signin");
      return;
    }

    OauthService.getSessionTokenSessionGet(sessionCode)
      .then((token) => {
        setToken(token.access_token, true);
        router.replace("/");
      })
      .catch(() => {
        router.replace("/signin?status=error&message=Session%20exchange%20failed");
      });
  }, []);

  return <AuthLoader />;
}
