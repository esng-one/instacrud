import React, { RefObject } from "react";
import type { Message } from "@/db/conversationsDb";
import { ChatMessage } from "./ChatMessage";
import { LoadingIndicator } from "./LoadingIndicator";
import { ChatError } from "./ChatError";
import { EmptyConversation } from "./EmptyConversation";

interface MessageListProps {
  messages: Message[];
  visibleMessages: Message[];
  maxRenderedMessages: number;
  isLoading: boolean;
  isReasoning: boolean;
  streamingReasoningContent: string | undefined;
  streamingRenderKey: number;
  error: string | null;
  lastFailedPrompt: string | null;
  messagesEndRef: RefObject<HTMLDivElement>;
  onImagePreview: (imageUrl: string) => void;
  onPromptWithImage: (imageUrl: string) => void;
  onRegenerate: (messageIndex: number) => void;
  onRegenerateNew: (messageIndex: number) => void;
  onShowReasoning: (content: string) => void;
  onCopyToInput: (content: string) => void;
  onErrorRegenerate: () => void;
}

export function MessageList({
  messages,
  visibleMessages,
  maxRenderedMessages,
  isLoading,
  isReasoning,
  streamingReasoningContent,
  streamingRenderKey,
  error,
  lastFailedPrompt,
  messagesEndRef,
  onImagePreview,
  onPromptWithImage,
  onRegenerate,
  onRegenerateNew,
  onShowReasoning,
  onCopyToInput,
  onErrorRegenerate,
}: MessageListProps) {
  if (messages.length === 0) {
    return <EmptyConversation />;
  }

  return (
    <div className="p-5 space-y-4">
      {messages.length > maxRenderedMessages && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
          Showing last {maxRenderedMessages} of {messages.length} messages
        </div>
      )}
      {visibleMessages.map((message: Message, index: number) => {
        const isStreamingMessage = index === visibleMessages.length - 1 && isLoading;
        const actualIndex =
          messages.length > maxRenderedMessages
            ? messages.length - maxRenderedMessages + index
            : index;

        return (
          <ChatMessage
            key={message.id}
            message={message}
            index={actualIndex}
            onImagePreview={onImagePreview}
            onPromptWithImage={onPromptWithImage}
            onRegenerate={onRegenerate}
            onRegenerateNew={onRegenerateNew}
            onShowReasoning={onShowReasoning}
            onCopyToInput={onCopyToInput}
            isLoading={isLoading}
            isReasoning={isStreamingMessage ? isReasoning : undefined}
            streamingReasoningContent={isStreamingMessage ? streamingReasoningContent : undefined}
            renderVersion={isStreamingMessage ? streamingRenderKey : undefined}
          />
        );
      })}

      {isLoading && <LoadingIndicator />}

      {error && (
        <ChatError
          error={error}
          lastFailedPrompt={lastFailedPrompt}
          onRegenerate={onErrorRegenerate}
        />
      )}

      <div ref={messagesEndRef} className="h-24" />
    </div>
  );
}
