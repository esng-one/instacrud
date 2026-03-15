"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import useCurrentUser from "@/hooks/useCurrentUser";
import { SystemService } from "@/api/services/SystemService";
import toast from "react-hot-toast";
import { ImagePreviewModal } from "@/components/common/ImagePreviewModal";
import { ReasoningModal } from "@/components/common/ReasoningModal";
import { ChatHeader } from "../components/ChatHeader";
import { ChatInput, ChatInputHandle } from "../components/ChatInput";
import { MessageList } from "../components/MessageList";
import { useConversation } from "../hooks/useConversation";
import { useAiModels, getAvailableResolutions, getAvailableQuality } from "../hooks/useAiModels";
import { useChatStream } from "../hooks/useChatStream";
import { fetchAndConvertImage } from "../utils/imageUtils";

export default function AiAssistantChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const conversationId = params.id as string;

  const [mode, setMode] = useState<"chat" | "image-gen">(() => {
    const modeParam = searchParams.get("mode");
    return modeParam === "image-gen" ? "image-gen" : "chat";
  });

  const [input, setInput] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [reasoningModalContent, setReasoningModalContent] = useState<string | null>(null);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [localOnlyConversations, setLocalOnlyConversations] = useState(false);

  const historyDropdownRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);

  // Get user tier from useCurrentUser hook
  const { currentUser, isLoading: isLoadingUser } = useCurrentUser();
  const userTier = isLoadingUser ? undefined : (currentUser?.tier ?? null);

  // Use custom hooks
  const aiModelsHook = useAiModels({ mode, userTier });
  const {
    aiModels,
    aiModelsRef,
    selectedModel,
    selectedModelId,
    selectedModelIdRef,
    chatModelId,
    setChatModelId,
    isLoadingModels,
    isInitialLoad,
    imageResolution,
    setImageResolution,
    imageResolutionRef,
    imageQuality,
    setImageQuality,
    imageQualityRef,
    imageCount,
    setImageCount,
    imageCountRef,
    reasoning,
    setReasoning,
    reasoningRef,
    handleModelChange,
  } = aiModelsHook;

  const conversationHook = useConversation({
    conversationId,
    chatModelId,
    setChatModelId,
    mode,
  });
  const {
    messages,
    setMessages,
    conversationTitle,
    setConversationTitle,
    allConversations,
    setAllConversations,
    isTempMode,
    messagesEndRef,
    shouldScrollToBottomRef,
    handleNewChat,
    handleDeleteConversation,
    handleDeleteAllConversations,
    handleResyncData,
    handleTempModeToggle,
  } = conversationHook;

  const chatStreamHook = useChatStream({
    conversationId,
    mode,
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
  });
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
  } = chatStreamHook;

  // Limit rendered messages to prevent memory overflow
  const MAX_RENDERED_MESSAGES = 100;
  const MAX_KEPT_IMAGE_DATA = 20;

  // Remove image data from old messages to save memory
  const optimizedMessages = useMemo(() => {
    if (messages.length <= MAX_KEPT_IMAGE_DATA) return messages;

    return messages.map((msg, idx) => {
      if (idx < messages.length - MAX_KEPT_IMAGE_DATA && msg.imageData) {
        return { ...msg, imageData: undefined };
      }
      return msg;
    });
  }, [messages]);

  const visibleMessages =
    optimizedMessages.length > MAX_RENDERED_MESSAGES
      ? optimizedMessages.slice(-MAX_RENDERED_MESSAGES)
      : optimizedMessages;

  // Memoize callback functions to prevent unnecessary re-renders
  const handleImagePreview = useCallback((imageUrl: string) => {
    setPreviewImage(imageUrl);
  }, []);

  const handleCopyToInput = useCallback((content: string) => {
    setInput(content);
  }, []);

  const handlePromptWithImage = useCallback(
    async (imageUrl: string) => {
      try {
        const { data, url } = await fetchAndConvertImage(imageUrl);
        setAttachedImage({ data, url });

        if (mode === "chat" && !selectedModel?.image_completion) {
          toast.error("Please select a vision-capable model to analyze this image");
        }
      } catch (err) {
        console.error("Failed to attach image:", err);
        toast.error("Failed to attach image");
      }
    },
    [mode, selectedModel?.image_completion, setAttachedImage]
  );

  // Load sync settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const s = await SystemService.getUserSettingsUserSettingsGet();
        setLocalOnlyConversations(s.local_only_conversations ?? false);
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      }
    };
    fetchSettings();
  }, []);

  // Focus input when chat opens (on mount)
  useEffect(() => {
    const timer = setTimeout(() => {
      chatInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [conversationId]);

  // Focus input when AI finishes responding
  const prevIsLoadingRef = useRef(isLoading);
  useEffect(() => {
    if (prevIsLoadingRef.current && !isLoading) {
      chatInputRef.current?.focus();
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading]);

  // Handle click outside history dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyDropdownRef.current && !historyDropdownRef.current.contains(event.target as Node)) {
        setShowHistoryDropdown(false);
      }
    };

    if (showHistoryDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showHistoryDropdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedModelId || isLoading) return;

    const messageContent = input;
    const currentImage = attachedImage;

    setInput("");
    setAttachedImage(null);

    await sendMessage(messageContent, currentImage);
  };

  if (isInitialLoad && isLoadingModels) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500 dark:text-gray-400">Loading AI models...</div>
      </div>
    );
  }

  if (!isInitialLoad && aiModels.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500 dark:text-gray-400">
          No AI models available. Please contact your administrator.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-120px)] bg-white dark:bg-gray-900 -m-4 md:-m-6">
      <ChatHeader
        isTempMode={isTempMode}
        conversationTitle={conversationTitle}
        mode={mode}
        aiModels={aiModels}
        selectedModelId={selectedModelId}
        selectedModel={selectedModel}
        imageResolution={imageResolution}
        imageQuality={imageQuality}
        imageCount={imageCount}
        reasoning={reasoning}
        attachedImage={attachedImage}
        conversations={allConversations}
        conversationId={conversationId}
        showHistoryDropdown={showHistoryDropdown}
        historyDropdownRef={historyDropdownRef}
        userTier={userTier}
        onModeToggle={() => setMode(mode === "chat" ? "image-gen" : "chat")}
        onModelChange={handleModelChange}
        onResolutionChange={setImageResolution}
        onQualityChange={setImageQuality}
        onCountChange={setImageCount}
        onReasoningChange={setReasoning}
        onNewChat={() => handleNewChat(mode)}
        onTempModeToggle={() => handleTempModeToggle(mode)}
        onHistoryToggle={() => setShowHistoryDropdown(!showHistoryDropdown)}
        onDeleteConversation={handleDeleteConversation}
        onDeleteAllConversations={handleDeleteAllConversations}
        onResyncData={handleResyncData}
        getAvailableResolutions={getAvailableResolutions}
        getAvailableQuality={getAvailableQuality}
        localOnlyConversations={localOnlyConversations}
      />

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
          onShowReasoning={(content) => setReasoningModalContent(content)}
          onCopyToInput={handleCopyToInput}
          onErrorRegenerate={handleErrorRegenerate}
        />
      </div>

      <ChatInput
        ref={chatInputRef}
        input={input}
        attachedImage={attachedImage}
        isLoading={isLoading}
        selectedModelId={selectedModelId}
        selectedModel={selectedModel}
        mode={mode}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        onStopGeneration={handleStopGeneration}
        onImageAttach={setAttachedImage}
        onImageRemove={() => setAttachedImage(null)}
      />

      <ImagePreviewModal
        open={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage}
        title="Image Preview"
      />

      <ReasoningModal
        open={!!reasoningModalContent}
        onClose={() => setReasoningModalContent(null)}
        reasoningContent={reasoningModalContent}
        title="Chain of Thoughts"
      />
    </div>
  );
}
