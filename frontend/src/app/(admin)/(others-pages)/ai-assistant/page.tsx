"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

export default function AiAssistantPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Generate a new UUID for the conversation
    const conversationId = uuidv4();

    // Get mode from search params if provided
    const mode = searchParams.get("mode");

    // Redirect to the new conversation, preserving mode if provided
    const url = mode ? `/ai-assistant/${conversationId}?mode=${mode}` : `/ai-assistant/${conversationId}`;
    router.push(url);
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-gray-500 dark:text-gray-400">Creating new conversation...</div>
    </div>
  );
}
