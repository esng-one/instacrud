import React from "react";
import { useRouter } from "next/navigation";
import { ClockIcon } from "@heroicons/react/24/outline";
import type { LocalConversation } from "@/db/conversationsDb";

interface ConversationHistoryProps {
  show: boolean;
  onToggle: () => void;
  conversations: LocalConversation[];
  currentConversationId: string;
  onDeleteConversation: (id: string) => void;
  onDeleteAll: () => void;
  onResyncData: () => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  localOnlyConversations?: boolean;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  show,
  onToggle,
  conversations,
  currentConversationId,
  onDeleteConversation,
  onDeleteAll,
  onResyncData,
  dropdownRef,
  localOnlyConversations = false,
}) => {
  const router = useRouter();
  const [showAll, setShowAll] = React.useState(false);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className="h-8 w-8 sm:w-20 text-sm font-medium rounded-md bg-brand-500 text-white hover:bg-brand-600 shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/20 flex items-center justify-center gap-1"
        title="History"
      >
        <ClockIcon className="w-4 h-4 sm:hidden" />
        <span className="hidden sm:inline">History</span>
        <svg className="w-3 h-3 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {show && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
          <div className="p-2">
            {conversations.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 p-2 text-center">
                No conversation history
              </div>
            ) : (
              <>
                {(showAll ? conversations : conversations.slice(0, 7)).map((conv) => (
                  <div
                    key={conv.id}
                    className={`flex items-center justify-between p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      conv.id === currentConversationId ? "bg-gray-100 dark:bg-gray-700" : ""
                    }`}
                  >
                    <button
                      onClick={() => {
                        router.push(`/ai-assistant/${conv.id}`);
                        onToggle();
                      }}
                      className="flex-1 text-left text-sm text-gray-800 dark:text-white truncate"
                    >
                      {conv.title}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                      className="ml-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      title="Delete conversation"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </>
            )}
            <div className="flex gap-3 justify-center items-center mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              {conversations.length > 7 && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  {showAll ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                  {showAll ? 'collapse' : 'show all'}
                </button>
              )}
              <button
                onClick={localOnlyConversations ? undefined : onResyncData}
                disabled={localOnlyConversations}
                className={`text-xs transition-colors flex items-center gap-1 ${
                  localOnlyConversations
                    ? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    : "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                }`}
                title={localOnlyConversations ? "Sync is disabled (local only mode)" : "Re-sync with server"}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {localOnlyConversations ? "sync disabled" : "re-sync"}
              </button>
              {conversations.length > 0 && (
                <button
                  onClick={onDeleteAll}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  delete all
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
