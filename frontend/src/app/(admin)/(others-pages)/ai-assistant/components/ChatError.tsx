import React from "react";

interface ChatErrorProps {
  error: string;
  lastFailedPrompt: string | null;
  onRegenerate: () => void;
}

export function ChatError({ error, lastFailedPrompt, onRegenerate }: ChatErrorProps) {
  const isPolicyViolation =
    error.toLowerCase().includes("safety") ||
    error.toLowerCase().includes("moderation") ||
    error.toLowerCase().includes("policy") ||
    error.toLowerCase().includes("violation");

  return (
    <div className="w-full px-3 sm:px-6 md:px-10 lg:px-16">
      <div className="rounded-lg px-4 py-3 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
        <div className="text-sm mb-2">{error}</div>
        {isPolicyViolation && (
          <div className="text-xs mt-2 mb-2 text-red-500 dark:text-red-400">
            This error may be caused by a policy violation. Please modify your prompt and try
            again.
          </div>
        )}
        {lastFailedPrompt && (
          <button
            onClick={onRegenerate}
            className="mt-2 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 dark:text-red-300 dark:bg-red-900/40 dark:hover:bg-red-900/60 rounded-lg transition-colors"
          >
            Regenerate
          </button>
        )}
      </div>
    </div>
  );
}
