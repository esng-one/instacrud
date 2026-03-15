import OAuthCallbackClient from "@/components/auth/OAuthCallbackClient";
import { Suspense } from "react";

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackClient />
    </Suspense>
  );
}