// components/common/ReasoningModal.tsx
"use client";
import { Modal } from "@/components/ui/modal";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";

export function ReasoningModal({
  open,
  onClose,
  reasoningContent,
  title = "Chain of Thoughts",
}: {
  open: boolean;
  onClose: () => void;
  reasoningContent?: string | null;
  title?: string;
}) {
  const handleCopyContent = async () => {
    if (!reasoningContent) return;

    try {
      await navigator.clipboard.writeText(reasoningContent);
      toast.success('Reasoning copied to clipboard');
    } catch (err) {
      console.error('Failed to copy reasoning:', err);
      toast.error('Failed to copy reasoning');
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      className="!w-[90vw] !max-w-3xl !h-[80vh] p-0 bg-white dark:bg-gray-900 rounded-xl flex flex-col"
      showCloseButton
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
        <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </span>
        <button
          onClick={handleCopyContent}
          className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded p-1.5 transition-colors"
          title="Copy reasoning"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {reasoningContent ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{reasoningContent}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">
            No reasoning content available
          </div>
        )}
      </div>
    </Modal>
  );
}
