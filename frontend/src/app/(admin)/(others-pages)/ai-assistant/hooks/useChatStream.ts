// app/(admin)/(others-pages)/ai-assistant/hooks/useChatStream.ts
import { useState, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { AiModel_Input as AiModel } from "@/api/models/AiModel_Input";
import { conversationStorage } from "@/db/conversationStorage";
import type { LocalConversation, Message } from "@/db/conversationsDb";
import { syncConversationToServer } from "../utils/serverSync";
import { imageToBase64 } from "../utils/imageUtils";
import { getToken } from "@/lib/tokenStorage";

interface UseChatStreamOptions {
  conversationId: string;
  mode: "chat" | "image-gen";
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setConversationTitle: (title: string) => void;
  conversationTitle: string;
  shouldScrollToBottomRef: React.MutableRefObject<boolean>;
  setAllConversations: React.Dispatch<React.SetStateAction<LocalConversation[]>>;
  aiModelsRef: React.MutableRefObject<AiModel[]>;
  selectedModelIdRef: React.MutableRefObject<string | null>;
  imageResolutionRef: React.MutableRefObject<string>;
  imageQualityRef: React.MutableRefObject<string>;
  imageCountRef: React.MutableRefObject<number>;
  reasoningRef: React.MutableRefObject<boolean>;
  selectedModelId: string | null;
  selectedModel: AiModel | null;
}

interface UseChatStreamReturn {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  lastFailedPrompt: string | null;
  lastFailedImage: { data: string; url: string } | null;
  attachedImage: { data: string; url: string } | null;
  setAttachedImage: (image: { data: string; url: string } | null) => void;
  isReasoning: boolean;
  streamingReasoningContent: string | undefined;
  streamingRenderKey: number;
  isRegeneratingRef: React.MutableRefObject<boolean>;
  sendMessage: (messageContent: string, image: { data: string; url: string } | null) => Promise<void>;
  handleRegenerate: (messageIndex: number) => void;
  handleRegenerateNew: (messageIndex: number) => void;
  handleStopGeneration: () => void;
  handleErrorRegenerate: () => Promise<void>;
}

export function useChatStream({
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
}: UseChatStreamOptions): UseChatStreamReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [lastFailedImage, setLastFailedImage] = useState<{ data: string; url: string } | null>(null);
  const [attachedImage, setAttachedImage] = useState<{ data: string; url: string } | null>(null);
  const [isReasoning, setIsReasoning] = useState(false);
  const [streamingReasoningContent, setStreamingReasoningContent] = useState<string | undefined>(undefined);
  const [streamingRenderKey, setStreamingRenderKey] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isRegeneratingRef = useRef<boolean>(false);

  const handleError = useCallback(
    (err: any, messageContent?: string, image?: { data: string; url: string } | null) => {
      if (err.name === "AbortError") {
        console.log("Generation stopped by user");
        if (mode === "image-gen") {
          setMessages((prev) => prev.slice(0, -1));
        }
      } else {
        console.error("Chat error:", err);
        const errorMessage = err instanceof Error ? err.message : "An error occurred";
        setError(errorMessage);

        if (messageContent !== undefined) {
          setLastFailedPrompt(messageContent);
          setLastFailedImage(image || null);
        }

        toast.error("Failed to get response from AI");
      }
    },
    [mode, setMessages]
  );

  const generateImage = useCallback(
    async (messageContent: string, image: { data: string; url: string } | null, token: string) => {
      const currentModelId = selectedModelIdRef.current || selectedModelId;
      const currentModel = aiModelsRef.current.find((m) => m._id === currentModelId);
      const modelIdentifier = currentModel?.model_identifier;

      if (!modelIdentifier) {
        throw new Error("Model identifier not found");
      }

      const currentResolution = imageResolutionRef.current;
      const currentQuality = imageQualityRef.current;
      const currentCount = imageCountRef.current;

      const requestBody: any = {
        model_id: modelIdentifier,
        prompt: messageContent,
        size: currentResolution,
        quality: currentQuality,
        n: currentCount,
        response_format: "url",
      };

      if (image) {
        requestBody.image_data = image.data;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/api/v1/images/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current?.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        const errorMessage = errorData.detail || errorData.error?.message || response.statusText;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Generated image for: "${messageContent}"`,
        generatedImages: data.images,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      shouldScrollToBottomRef.current = true;
      setIsLoading(false);

      setTimeout(async () => {
        const latestConversation = await conversationStorage.get(conversationId);
        if (latestConversation) {
          const conversationToSync: LocalConversation = {
            ...latestConversation,
            lastMessageAt: new Date().toISOString(),
          };
          await conversationStorage.save(conversationId, conversationToSync);

          const conversations = await conversationStorage.getAll();
          setAllConversations(conversations);

          try {
            await syncConversationToServer(conversationId, conversationToSync);
          } catch (error) {
            console.log("Could not sync to server, saved locally:", error);
          }
        }
      }, 200);
    },
    [conversationId, selectedModelId, setMessages, shouldScrollToBottomRef, setAllConversations]
  );

  const streamChatCompletion = useCallback(
    async (
      messageContent: string,
      image: { data: string; url: string } | null,
      contextMessages: Message[],
      token: string
    ) => {
      const conversationHistory = contextMessages
        .slice(0, -1)
        .map((msg) => {
          let text = `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`;
          if (msg.imageData && msg.role === "user") {
            text = `${msg.role === "user" ? "User" : "Assistant"}: [Image attached] ${msg.content}`;
          } else if (msg.generatedImages && msg.generatedImages.length > 0) {
            text = `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content} [${msg.generatedImages.length} generated image(s)]`;
          }
          return text;
        })
        .join("\n\n");

      const fullPrompt = conversationHistory
        ? `${conversationHistory}\n\nUser: ${messageContent}\n\nAssistant:`
        : `User: ${messageContent}\n\nAssistant:`;

      const hasHistoricalImages = contextMessages.some(
        (msg) => msg.imageData || (msg.generatedImages && msg.generatedImages.length > 0)
      );
      const useImageEndpoint = image || hasHistoricalImages;

      let imageToSend = image;
      if (!imageToSend && hasHistoricalImages) {
        for (let i = contextMessages.length - 1; i >= 0; i--) {
          if (contextMessages[i].imageData && contextMessages[i].role === "user") {
            imageToSend = { data: contextMessages[i].imageData!, url: contextMessages[i].imageUrl! };
            break;
          }
          if (contextMessages[i].generatedImages && contextMessages[i].generatedImages!.length > 0) {
            const generatedImageUrl = contextMessages[i].generatedImages![0];
            try {
              const response = await fetch(generatedImageUrl);
              const blob = await response.blob();
              const base64Data = await imageToBase64(new File([blob], "generated.png", { type: blob.type }));
              imageToSend = { data: base64Data, url: generatedImageUrl };
              break;
            } catch (err) {
              console.error("Failed to fetch generated image for context:", err);
            }
          }
        }
      }

      const currentModelId = selectedModelIdRef.current || selectedModelId;
      const currentModel = aiModelsRef.current.find((m) => m._id === currentModelId);
      const modelIdentifier = currentModel?.model_identifier;

      if (!modelIdentifier) {
        throw new Error("Model identifier not found");
      }

      const endpoint = useImageEndpoint ? "/completion/image" : "/completion";
      const currentModelForReasoning = aiModelsRef.current.find((m) => m._id === currentModelId);
      const shouldUseReasoning = reasoningRef.current && currentModelForReasoning?.reasoning;

      const requestBody =
        useImageEndpoint && imageToSend
          ? {
              model_id: modelIdentifier,
              prompt: fullPrompt,
              image_data: imageToSend.data,
              image_detail: "auto",
              stream: true,
              reasoning: shouldUseReasoning,
            }
          : {
              model_id: modelIdentifier,
              prompt: fullPrompt,
              stream: true,
              reasoning: shouldUseReasoning,
            };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/api/v1${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current?.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        const errorMessage = errorData.detail || errorData.error?.message || response.statusText;
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      const assistantMessageId = (Date.now() + 1).toString();
      const MAX_MESSAGE_SIZE = 500000;

      const streamingMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        reasoningContent: undefined,
      };

      setMessages((prev) => [...prev, streamingMessage]);

      let lastUpdateTime = Date.now();
      const UPDATE_INTERVAL = 50;
      let rafId: number | null = null;

      let inReasoningBlock = false;
      let reasoningBuffer = "";
      let contentBuffer = "";

      if (shouldUseReasoning) {
        setIsReasoning(true);
        setStreamingReasoningContent("");
      }

      const triggerUpdate = () => {
        if (rafId !== null) return;

        rafId = requestAnimationFrame(() => {
          rafId = null;
          setStreamingRenderKey((k) => k + 1);
        });
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          if (streamingMessage.content.length + chunk.length > MAX_MESSAGE_SIZE) {
            streamingMessage.content += "\n\n[Message truncated - exceeded maximum size]";
            break;
          }

          if (shouldUseReasoning) {
            contentBuffer += chunk;

            while (contentBuffer.length > 0) {
              if (!inReasoningBlock) {
                const reasoningStart = contentBuffer.indexOf("[REASONING]");
                if (reasoningStart === -1) {
                  if (contentBuffer.length > 11) {
                    const safeContent = contentBuffer.slice(0, -11);
                    streamingMessage.content += safeContent;
                    contentBuffer = contentBuffer.slice(-11);
                  }
                  break;
                } else {
                  if (reasoningStart > 0) {
                    streamingMessage.content += contentBuffer.slice(0, reasoningStart);
                  }
                  contentBuffer = contentBuffer.slice(reasoningStart + 11);
                  inReasoningBlock = true;
                  setIsReasoning(true);
                }
              } else {
                const reasoningEnd = contentBuffer.indexOf("[/REASONING]");
                if (reasoningEnd === -1) {
                  if (contentBuffer.length > 12) {
                    const safeReasoning = contentBuffer.slice(0, -12);
                    reasoningBuffer += safeReasoning;
                    setStreamingReasoningContent(reasoningBuffer);
                    contentBuffer = contentBuffer.slice(-12);
                  }
                  break;
                } else {
                  reasoningBuffer += contentBuffer.slice(0, reasoningEnd);
                  streamingMessage.reasoningContent = reasoningBuffer;
                  setStreamingReasoningContent(reasoningBuffer);
                  contentBuffer = contentBuffer.slice(reasoningEnd + 12);
                  inReasoningBlock = false;
                  setIsReasoning(false);
                }
              }
            }
          } else {
            streamingMessage.content += chunk;
          }

          const now = Date.now();
          if (now - lastUpdateTime >= UPDATE_INTERVAL) {
            lastUpdateTime = now;
            triggerUpdate();
          }
        }

        if (shouldUseReasoning && contentBuffer.length > 0) {
          if (inReasoningBlock) {
            reasoningBuffer += contentBuffer;
            streamingMessage.reasoningContent = reasoningBuffer;
          } else {
            streamingMessage.content += contentBuffer;
          }
        }

        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }

        setIsReasoning(false);
        setStreamingReasoningContent(undefined);
        setStreamingRenderKey((k) => k + 1);

        const finalMessage: Message = { ...streamingMessage };

        let finalMessagesForSync: Message[] = [];
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          if (lastIndex >= 0 && newMessages[lastIndex].id === assistantMessageId) {
            newMessages[lastIndex] = finalMessage;
          }
          finalMessagesForSync = newMessages;
          return newMessages;
        });

        await new Promise((resolve) => setTimeout(resolve, 50));

        const existingConversation = await conversationStorage.get(conversationId);
        if (existingConversation) {
          const conversationToSync: LocalConversation = {
            ...existingConversation,
            messages: finalMessagesForSync,
            lastMessageAt: new Date().toISOString(),
          };
          await conversationStorage.save(conversationId, conversationToSync);

          const conversations = await conversationStorage.getAll();
          setAllConversations(conversations);

          try {
            await syncConversationToServer(conversationId, conversationToSync);
          } catch (error) {
            console.log("Could not sync to server, saved locally:", error);
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("Generation stopped by user");
        } else {
          throw err;
        }
      } finally {
        reader.releaseLock();
      }
    },
    [conversationId, selectedModelId, setMessages, setAllConversations]
  );

  const sendMessage = useCallback(
    async (messageContent: string, image: { data: string; url: string } | null) => {
      if (!messageContent.trim() || !selectedModelId || isLoading) return;

      if (mode === "chat" && image && !selectedModel?.image_completion) {
        toast.error("Selected model does not support image input. Please select a vision-capable model.");
        return;
      }

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: messageContent,
        imageData: image?.data,
        imageUrl: image?.url,
      };

      setMessages((prev) => [...prev, userMessage]);
      shouldScrollToBottomRef.current = true;

      if (messages.length === 0 && !conversationTitle) {
        const title = messageContent.length > 50 ? messageContent.substring(0, 35) + "..." : messageContent;
        setConversationTitle(title);
      }

      setIsLoading(true);
      setError(null);
      abortControllerRef.current = new AbortController();

      try {
        const token = getToken();
        if (!token) {
          throw new Error("Not authenticated");
        }

        if (mode === "image-gen") {
          await generateImage(messageContent, image, token);
          return;
        }

        await streamChatCompletion(messageContent, image, [...messages, userMessage], token);
      } catch (err: any) {
        handleError(err, messageContent, image);
      } finally {
        setIsLoading(false);
      }
    },
    [
      selectedModelId,
      selectedModel,
      isLoading,
      mode,
      messages,
      conversationTitle,
      setMessages,
      shouldScrollToBottomRef,
      setConversationTitle,
      generateImage,
      streamChatCompletion,
      handleError,
    ]
  );

  const regenerateResponse = useCallback(
    async (
      messageContent: string,
      image: { data: string; url: string } | null,
      contextMessages: Message[]
    ) => {
      const currentModelId = selectedModelIdRef.current || selectedModelId;
      if (!messageContent.trim() || !currentModelId || isLoading) {
        isRegeneratingRef.current = false;
        return;
      }

      const currentModel = aiModelsRef.current.find((m) => m._id === currentModelId);
      if (mode === "chat" && image && !currentModel?.image_completion) {
        toast.error("Selected model does not support image input. Please select a vision-capable model.");
        isRegeneratingRef.current = false;
        return;
      }

      setIsLoading(true);
      setError(null);
      abortControllerRef.current = new AbortController();

      try {
        const token = getToken();
        if (!token) {
          throw new Error("Not authenticated");
        }

        if (mode === "image-gen") {
          await generateImage(messageContent, image, token);
          return;
        }

        await streamChatCompletion(messageContent, image, contextMessages, token);
      } catch (err: any) {
        handleError(err, messageContent, image);
      } finally {
        setIsLoading(false);
        isRegeneratingRef.current = false;
      }
    },
    [selectedModelId, isLoading, mode, generateImage, streamChatCompletion, handleError]
  );

  const handleRegenerate = useCallback(
    (messageIndex: number) => {
      if (isLoading || isRegeneratingRef.current) {
        return;
      }

      isRegeneratingRef.current = true;

      let messageContent: string | null = null;
      let image: { data: string; url: string } | null = null;
      let truncatedMessages: Message[] = [];

      setMessages((currentMessages) => {
        let userMessageIndex = -1;

        for (let i = messageIndex - 1; i >= 0; i--) {
          if (currentMessages[i].role === "user") {
            userMessageIndex = i;
            break;
          }
        }

        if (userMessageIndex === -1) {
          isRegeneratingRef.current = false;
          return currentMessages;
        }

        const userMessage = currentMessages[userMessageIndex];
        messageContent = userMessage.content;
        image =
          userMessage.imageData && userMessage.imageUrl
            ? { data: userMessage.imageData, url: userMessage.imageUrl }
            : null;

        truncatedMessages = currentMessages.slice(0, messageIndex);
        return truncatedMessages;
      });

      requestAnimationFrame(() => {
        if (messageContent) {
          regenerateResponse(messageContent, image, truncatedMessages);
        } else {
          isRegeneratingRef.current = false;
        }
      });
    },
    [isLoading, setMessages, regenerateResponse]
  );

  const handleRegenerateNew = useCallback(
    (messageIndex: number) => {
      if (isLoading || isRegeneratingRef.current) return;

      isRegeneratingRef.current = true;

      let messageContent: string | null = null;
      let image: { data: string; url: string } | null = null;
      let contextMessages: Message[] = [];

      setMessages((currentMessages) => {
        let userMessageIndex = -1;
        for (let i = messageIndex - 1; i >= 0; i--) {
          if (currentMessages[i].role === "user") {
            userMessageIndex = i;
            break;
          }
        }

        if (userMessageIndex === -1) {
          isRegeneratingRef.current = false;
          return currentMessages;
        }

        const userMessage = currentMessages[userMessageIndex];
        messageContent = userMessage.content;
        image =
          userMessage.imageData && userMessage.imageUrl
            ? { data: userMessage.imageData, url: userMessage.imageUrl }
            : null;

        contextMessages = currentMessages.slice(0, messageIndex + 1);
        return currentMessages;
      });

      requestAnimationFrame(() => {
        if (messageContent) {
          regenerateResponse(messageContent!, image, contextMessages);
        } else {
          isRegeneratingRef.current = false;
        }
      });
    },
    [isLoading, setMessages, regenerateResponse]
  );

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  const handleErrorRegenerate = useCallback(async () => {
    if (!lastFailedPrompt || isLoading) return;

    setError(null);

    if (messages.length > 0 && messages[messages.length - 1].role === "user") {
      setMessages((prev) => prev.slice(0, -1));
    }

    await sendMessage(lastFailedPrompt, lastFailedImage);
  }, [lastFailedPrompt, lastFailedImage, isLoading, messages, setMessages, sendMessage]);

  return {
    isLoading,
    setIsLoading,
    error,
    setError,
    lastFailedPrompt,
    lastFailedImage,
    attachedImage,
    setAttachedImage,
    isReasoning,
    streamingReasoningContent,
    streamingRenderKey,
    isRegeneratingRef,
    sendMessage,
    handleRegenerate,
    handleRegenerateNew,
    handleStopGeneration,
    handleErrorRegenerate,
  };
}
