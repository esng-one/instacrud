"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { usePathname } from "next/navigation";
import { useAiPanel } from "@/context/AiPanelContext";
import { useAiModels } from "@/app/(admin)/(others-pages)/ai-assistant/hooks/useAiModels";
import { useConversation } from "@/app/(admin)/(others-pages)/ai-assistant/hooks/useConversation";
import { useChatStream } from "@/app/(admin)/(others-pages)/ai-assistant/hooks/useChatStream";
import { MessageList } from "@/app/(admin)/(others-pages)/ai-assistant/components/MessageList";
import {
  ChatInput,
  ChatInputHandle,
} from "@/app/(admin)/(others-pages)/ai-assistant/components/ChatInput";
import { ModelSelect } from "@/app/(admin)/(others-pages)/ai-assistant/components/ModelSelect";
import { ReasoningModal } from "@/components/common/ReasoningModal";
import { SparklesIcon } from "@heroicons/react/24/outline";

/** System prompt sent when the page hasn't provided its own. */
const GENERIC_SYSTEM_PROMPT =
  "You are an AI assistant embedded in the InstaCRUD application. " +
  "The user is currently on $PATH. " +
  "The current page content is:\n$CONTEXT\n\n" +
  "Help the user understand, navigate, or act on what they see.";

const MAX_RENDERED_MESSAGES = 50;

export function InPageChat() {
  const {
    closePanel,
    pageContext,
    pageSystemPrompt,
    panelConversationId,
    newPanelConversation,
  } = useAiPanel();

  const pathname = usePathname();

  const [input, setInput] = useState("");
  const [reasoningContent, setReasoningContent] = useState<string | null>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);

  // ── Effective AI parameters ─────────────────────────────────────────────
  // Plain expression — no useMemo — so we don't change the hook call order
  // below. useMemo would shift every subsequent hook to a different slot in
  // React's internal linked list, which silently corrupts state.
  const effectiveSystemPrompt = pageSystemPrompt?.trim()
    ? pageSystemPrompt
    : GENERIC_SYSTEM_PROMPT;

  // ── Models ──────────────────────────────────────────────────────────────
  const {
    aiModels,
    aiModelsRef,
    selectedModel,
    selectedModelId,
    selectedModelIdRef,
    chatModelId,
    setChatModelId,
    isInitialLoad,
    isLoadingModels,
    // image-gen params – defaults are fine, panel is chat-only
    imageResolutionRef,
    imageQualityRef,
    imageCountRef,
    reasoningRef,
    handleModelChange,
  } = useAiModels({ mode: "chat", userTier: null });

  // ── Conversation (global history) ───────────────────────────────────────
  // Pass page-level AI params as initial values so they get persisted on the
  // conversation record. The global assistant will then read them back when
  // opening the same conversation.
  const {
    messages,
    setMessages,
    conversationTitle,
    setConversationTitle,
    allConversations,
    setAllConversations,
    messagesEndRef,
    shouldScrollToBottomRef,
    updateAiParams,
  } = useConversation({
    conversationId: panelConversationId,
    chatModelId,
    setChatModelId,
    mode: "chat",
    initialSystemPrompt: effectiveSystemPrompt,
    initialPath: pathname,
    initialContext: pageContext || null,
    initialTools: "*",
  });

  // ── Sync live page context into the conversation ─────────────────────────
  // pageContext / pathname are set asynchronously by the page's useEffect, so
  // useState(initialContext) in useConversation captures an empty string on
  // the first render.  This effect keeps the conversation params up-to-date
  // so the stored context (synced to the server) always reflects the current
  // page, which is what the generic /ai-assistant/[id] view restores.
  useEffect(() => {
    updateAiParams({
      systemPrompt: effectiveSystemPrompt,
      path: pathname,
      context: pageContext || null,
    });
  }, [pageContext, pathname, effectiveSystemPrompt, updateAiParams]);

  // ── Chat stream ──────────────────────────────────────────────────────────
  const {
    isLoading,
    error,
    lastFailedPrompt,
    attachedImage,
    setAttachedImage,
    isReasoning,
    streamingReasoningContent,
    streamingRenderKey,
    sendMessage,
    handleRegenerate,
    handleRegenerateNew,
    handleStopGeneration,
    handleErrorRegenerate,
  } = useChatStream({
    conversationId: panelConversationId,
    mode: "chat",
    messages,
    setMessages,
    setConversationTitle,
    conversationTitle,
    shouldScrollToBottomRef,
    setAllConversations,
    aiModelsRef,
    selectedModelIdRef,
    imageResolutionRef,
    imageQualityRef,
    imageCountRef,
    reasoningRef,
    selectedModelId,
    selectedModel,
    // Page-aware parameters
    systemPrompt: effectiveSystemPrompt,
    path: pathname,
    context: pageContext || null,
    tools: "*",
  });

  // Trim oldest messages to keep panel light
  const visibleMessages = useMemo(
    () =>
      messages.length > MAX_RENDERED_MESSAGES
        ? messages.slice(-MAX_RENDERED_MESSAGES)
        : messages,
    [messages]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedModelId || isLoading) return;
    const content = input;
    const img = attachedImage;
    setInput("");
    setAttachedImage(null);
    await sendMessage(content, img);
  };

  // Focus input on open
  useEffect(() => {
    const t = setTimeout(() => chatInputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [panelConversationId]);

  // Re-focus after AI finishes
  const prevLoadingRef = useRef(isLoading);
  useEffect(() => {
    if (prevLoadingRef.current && !isLoading) {
      chatInputRef.current?.focus();
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading]);

  // ── Callbacks ────────────────────────────────────────────────────────────
  const handleCopyToInput = useCallback((content: string) => setInput(content), []);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleImagePreview = useCallback((_url: string) => {}, []);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handlePromptWithImage = useCallback((_url: string) => {}, []);

  // ── Render ───────────────────────────────────────────────────────────────
  const isBooting = isInitialLoad && isLoadingModels;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <SparklesIcon className="w-5 h-5 text-brand-500 dark:text-brand-400 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          {!isBooting && aiModels.length > 0 && (
            <ModelSelect
              models={aiModels}
              selectedModelId={selectedModelId}
              userTier={null}
              onChange={handleModelChange}
            />
          )}
        </div>

        <button
          onClick={newPanelConversation}
          title="New conversation"
          className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-md bg-brand-500 text-white hover:bg-brand-600 shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <button
          onClick={closePanel}
          title="Close AI panel"
          className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      {isBooting ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Loading…
        </div>
      ) : aiModels.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400 text-center px-4">
          No AI models available. Contact your administrator.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <MessageList
            messages={messages}
            visibleMessages={visibleMessages}
            maxRenderedMessages={MAX_RENDERED_MESSAGES}
            isLoading={isLoading}
            isReasoning={isReasoning}
            streamingReasoningContent={streamingReasoningContent}
            streamingRenderKey={streamingRenderKey}
            error={error}
            lastFailedPrompt={lastFailedPrompt}
            messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
            onImagePreview={handleImagePreview}
            onPromptWithImage={handlePromptWithImage}
            onRegenerate={handleRegenerate}
            onRegenerateNew={handleRegenerateNew}
            onShowReasoning={setReasoningContent}
            onCopyToInput={handleCopyToInput}
            onErrorRegenerate={handleErrorRegenerate}
          />
        </div>
      )}

      {/* Input */}
      <ChatInput
        ref={chatInputRef}
        input={input}
        attachedImage={attachedImage}
        isLoading={isLoading}
        selectedModelId={selectedModelId}
        selectedModel={selectedModel}
        mode="chat"
        compact
        onInputChange={setInput}
        onSubmit={handleSubmit}
        onStopGeneration={handleStopGeneration}
        onImageAttach={setAttachedImage}
        onImageRemove={() => setAttachedImage(null)}
      />

      <ReasoningModal
        open={!!reasoningContent}
        onClose={() => setReasoningContent(null)}
        reasoningContent={reasoningContent}
        title="Chain of Thoughts"
      />
    </div>
  );
}
