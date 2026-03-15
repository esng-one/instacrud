import React from "react";

export function LoadingIndicator() {
  return (
    <div className="w-full px-3 sm:px-6 md:px-10 lg:px-16">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <div
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: "0ms" }}
        ></div>
        <div
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: "150ms" }}
        ></div>
        <div
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: "300ms" }}
        ></div>
      </div>
    </div>
  );
}
