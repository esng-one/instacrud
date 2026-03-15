import React, { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import toast from "react-hot-toast";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "@/context/ThemeContext";
import type { Message } from "@/db/conversationsDb";
import { handleCopyImage, handleSaveImage } from "../utils/imageUtils";

interface ChatMessageProps {
  message: Message;
  index: number;
  onImagePreview: (imageUrl: string) => void;
  onPromptWithImage: (imageUrl: string) => void;
  onRegenerate: (index: number) => void;
  onRegenerateNew: (index: number) => void;
  onShowReasoning?: (reasoningContent: string) => void;
  onCopyToInput?: (content: string) => void;
  isLoading: boolean;
  isReasoning?: boolean; // True when model is currently outputting reasoning
  streamingReasoningContent?: string; // Live reasoning content during streaming
  renderVersion?: number; // Used to force re-render during streaming
}

export const ChatMessage: React.FC<ChatMessageProps> = React.memo(({
  message,
  index,
  onImagePreview,
  onPromptWithImage,
  onRegenerate,
  onRegenerateNew,
  onShowReasoning,
  onCopyToInput,
  isLoading,
  isReasoning,
  streamingReasoningContent,
  renderVersion,
}) => {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [reasoningExpanded, setReasoningExpanded] = useState(true); // Expanded by default during streaming
  const [userMessageExpanded, setUserMessageExpanded] = useState(false); // Collapsed by default for long messages
  const userMessageRef = React.useRef<HTMLDivElement>(null);
  const [isUserMessageLong, setIsUserMessageLong] = useState(false);

  // Check if user message exceeds 3 lines
  useEffect(() => {
    if (message.role === "user" && userMessageRef.current) {
      const lineHeight = parseFloat(getComputedStyle(userMessageRef.current).lineHeight) || 24;
      const maxHeight = lineHeight * 3;
      setIsUserMessageLong(userMessageRef.current.scrollHeight > maxHeight + 5); // 5px tolerance
    }
  }, [message.content, message.role, mounted]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-collapse reasoning when streaming completes
  useEffect(() => {
    if (!isReasoning && streamingReasoningContent === undefined && message.reasoningContent) {
      setReasoningExpanded(false);
    }
  }, [isReasoning, streamingReasoningContent, message.reasoningContent]);

  const isDark = mounted && theme === "dark";

  // Preprocess LaTeX: convert \[...\] and \(...\) to $$...$$ and $...$
  const preprocessLaTeX = (content: string): string => {
    // Convert display math \[...\] to $$...$$
    let result = content.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `$$${math}$$`);
    // Convert inline math \(...\) to $...$
    result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math}$`);
    return result;
  };

  // Memoize the markdown content to avoid re-parsing on every parent render
  // renderVersion is used to force re-render during streaming without remounting
  const messageContent = useMemo(() => {
    // For extremely long messages, truncate during streaming to prevent memory overflow
    const MAX_DISPLAY_LENGTH = 200000; // 200KB display limit
    let content = message.content;
    if (content.length > MAX_DISPLAY_LENGTH) {
      content = content.substring(0, MAX_DISPLAY_LENGTH) + '\n\n...[Content truncated for performance]';
    }
    return preprocessLaTeX(content);
  }, [message.content, renderVersion]);

  const components: Components = useMemo(() => ({
    code({ inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || "");
      const language = match ? match[1] : "";
      const codeString = String(children).replace(/\n$/, "");

      return !inline && language ? (
        <div className="relative group my-2">
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              onClick={() => {
                navigator.clipboard.writeText(codeString);
                toast.success("Code copied to clipboard");
              }}
              className="bg-gray-700/80 hover:bg-gray-700 text-white rounded px-2 py-1 text-xs shadow-sm transition-colors flex items-center gap-1"
              title="Copy code"
            >
              Copy
            </button>
          </div>

          {language && (
            <div className={`absolute top-2 left-2 text-xs font-mono px-2 py-1 rounded ${
              isDark
                ? "text-gray-400 bg-gray-700/50"
                : "text-gray-700 bg-gray-200/80"
            }`}>
              {language}
            </div>
          )}

          <SyntaxHighlighter
            style={isDark ? oneDark : oneLight}
            language={language}
            PreTag="div"
            customStyle={{
              margin: 0,
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              padding: "1rem",
              paddingTop: language ? "2.5rem" : "1rem",
            }}
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  }), [isDark]);

  if (message.role === "user") {
    return (
      <div className="flex sm:justify-end justify-center">
        <div className="max-w-full sm:max-w-[80%] rounded-2xl px-4 py-3 bg-brand-500 text-white group relative">
          <div className="space-y-2">
            {message.imageUrl && (
              <img
                src={message.imageUrl}
                alt="Uploaded"
                className="max-w-full h-auto max-h-64 object-contain cursor-pointer rounded-lg"
                onClick={() => onImagePreview(message.imageUrl!)}
              />
            )}
            <div
              ref={userMessageRef}
              className={`text-base whitespace-pre-wrap ${
                isUserMessageLong && !userMessageExpanded ? 'line-clamp-3' : ''
              }`}
            >
              {message.content}
            </div>
            {isUserMessageLong && (
              <button
                onClick={() => setUserMessageExpanded(!userMessageExpanded)}
                className="text-xs text-white/80 hover:text-white transition-colors flex items-center gap-1"
              >
                {userMessageExpanded ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
                {userMessageExpanded ? 'collapse' : 'show all'}
              </button>
            )}
          </div>
          {message.content && message.content.trim().length > 0 && (
            <div className="flex justify-end mt-2 gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(message.content);
                  toast.success('Message copied to clipboard');
                }}
                className="text-white/70 hover:text-white transition-colors flex-shrink-0"
                title="Copy message"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              {onCopyToInput && (
                <button
                  onClick={() => onCopyToInput(message.content)}
                  className="text-white/70 hover:text-white transition-colors flex-shrink-0"
                  title="Edit message"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Determine if we have reasoning content to display
  const hasReasoningContent = message.reasoningContent || streamingReasoningContent;
  const displayReasoningContent = streamingReasoningContent || message.reasoningContent;

  return (
    <div className="w-full px-3 sm:px-6 md:px-10 lg:px-16">
      <div className="w-full space-y-2">
        {/* Collapsible Reasoning Section */}
        {hasReasoningContent && (
          <div className="mb-2">
            <button
              onClick={() => setReasoningExpanded(!reasoningExpanded)}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${reasoningExpanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="font-medium">
                {isReasoning ? 'Thinking...' : 'Reasoning'}
              </span>
              {isReasoning && (
                <span className="inline-flex">
                  <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce ml-0.5" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce ml-0.5" style={{ animationDelay: '300ms' }}></span>
                </span>
              )}
            </button>
            {reasoningExpanded && (
              <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {displayReasoningContent}
                </div>
              </div>
            )}
          </div>
        )}

        {message.generatedImages && message.generatedImages.length > 0 && (
          <div className="space-y-2">
            {message.generatedImages.map((imgUrl, idx) => (
              <div key={idx} className="relative rounded-lg overflow-hidden group inline-block">
                <img
                  src={imgUrl}
                  alt={`Generated ${idx + 1}`}
                  className="max-w-full h-auto max-h-96 object-contain cursor-pointer block"
                  onClick={() => onImagePreview(imgUrl)}
                />
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={() => handleCopyImage(imgUrl)}
                    className="bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded p-1.5 shadow-sm transition-colors"
                    title="Copy image"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleSaveImage(imgUrl, `generated-${message.id}-${idx}.png`)}
                    className="bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded p-1.5 shadow-sm transition-colors"
                    title="Save image"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onPromptWithImage(imgUrl)}
                    className="bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded p-1.5 shadow-sm transition-colors"
                    title="Prompt with image"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="relative">
          <div
            className="text-base prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100
              prose-p:my-1 prose-p:leading-relaxed
              prose-headings:font-semibold prose-headings:my-2
              prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
              prose-ul:my-2 prose-ul:list-disc prose-ul:pl-4
              prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-4
              prose-li:my-0.5
              prose-code:text-xs prose-code:bg-gray-200 prose-code:dark:bg-gray-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
              prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-0 prose-pre:shadow-none
              prose-pre:my-2 prose-pre:overflow-visible
              prose-strong:font-semibold
              prose-a:text-brand-500 prose-a:underline
              prose-img:rounded-lg prose-img:my-2"
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={components}
            >
              {messageContent}
            </ReactMarkdown>
          </div>
          {message.content && message.content.trim().length > 0 && (
            <div className="flex justify-start mt-2 gap-2">
              {message.reasoningContent && onShowReasoning && (
                <button
                  onClick={() => onShowReasoning(message.reasoningContent!)}
                  className="text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 transition-colors flex-shrink-0"
                  title="Show chain of thoughts"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(message.content);
                  toast.success('Message copied to clipboard');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors flex-shrink-0"
                title="Copy message"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={() => onRegenerateNew(index)}
                disabled={isLoading}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                title="Generate another response (+1)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={() => onRegenerate(index)}
                disabled={isLoading}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                title="Regenerate response"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render)
  // Return false if props changed (do re-render)

  // If renderVersion changed, always re-render
  if (prevProps.renderVersion !== nextProps.renderVersion) {
    return false;
  }

  // Otherwise check if other props changed
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.imageUrl === nextProps.message.imageUrl &&
    prevProps.message.generatedImages === nextProps.message.generatedImages &&
    prevProps.message.reasoningContent === nextProps.message.reasoningContent &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.isReasoning === nextProps.isReasoning &&
    prevProps.streamingReasoningContent === nextProps.streamingReasoningContent &&
    prevProps.index === nextProps.index
  );
});
