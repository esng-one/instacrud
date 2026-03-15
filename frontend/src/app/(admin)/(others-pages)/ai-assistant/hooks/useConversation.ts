// app/(admin)/(others-pages)/ai-assistant/hooks/useConversation.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ConversationsService } from "@/api/services/ConversationsService";
import { conversationStorage, syncStorage } from "@/db/conversationStorage";
import type { LocalConversation, Message } from "@/db/conversationsDb";
import {
  syncConversationToServer,
  syncConversationFromServer,
  convertServerToLocal,
  syncAllConversationsFromServer,
  syncAllLocalConversationsToServer,
} from "../utils/serverSync";
import { getToken } from "@/lib/tokenStorage";

interface UseConversationOptions {
  conversationId: string;
  chatModelId: string | null;
  setChatModelId: (id: string | null) => void;
  mode: "chat" | "image-gen";
}

interface UseConversationReturn {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  conversationTitle: string;
  setConversationTitle: (title: string) => void;
  allConversations: LocalConversation[];
  setAllConversations: React.Dispatch<React.SetStateAction<LocalConversation[]>>;
  isTempMode: boolean;
  setIsTempMode: (mode: boolean) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  shouldScrollToBottomRef: React.MutableRefObject<boolean>;
  saveConversation: (shouldUpdateTimestamp?: boolean, syncToServer?: boolean) => Promise<void>;
  handleNewChat: (mode: "chat" | "image-gen") => void;
  handleDeleteConversation: (id: string) => Promise<void>;
  handleDeleteAllConversations: () => Promise<void>;
  handleResyncData: () => Promise<void>;
  handleTempModeToggle: (mode: "chat" | "image-gen") => void;
}

export function useConversation({
  conversationId,
  chatModelId,
  setChatModelId,
  mode,
}: UseConversationOptions): UseConversationReturn {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationTitle, setConversationTitle] = useState<string>("");
  const [allConversations, setAllConversations] = useState<LocalConversation[]>([]);
  const [isTempMode, setIsTempMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottomRef = useRef<boolean>(false);

  // Load conversation on mount
  useEffect(() => {
    const loadConversation = async () => {
      setIsTempMode(false);

      const localConversation = await conversationStorage.get(conversationId);

      if (localConversation) {
        const messagesWithDataUrls = localConversation.messages.map((msg) => {
          if (msg.imageData && (!msg.imageUrl || msg.imageUrl.startsWith("blob:"))) {
            return { ...msg, imageUrl: `data:image/png;base64,${msg.imageData}` };
          }
          return msg;
        });

        setMessages(messagesWithDataUrls);
        setConversationTitle(localConversation.title);
        if (localConversation.modelId) {
          setChatModelId(localConversation.modelId);
        }

        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        }, 100);
      }

      try {
        const serverConversation = await syncConversationFromServer(conversationId);

        if (serverConversation && localConversation) {
          const serverTime = new Date(serverConversation.last_message_at || 0).getTime();
          const localTime = new Date(localConversation.lastMessageAt).getTime();

          if (serverTime > localTime) {
            const updatedConversation = convertServerToLocal(serverConversation, conversationId);
            const messagesWithDataUrls = updatedConversation.messages.map((msg) => {
              if (msg.imageData && (!msg.imageUrl || msg.imageUrl.startsWith("blob:"))) {
                return { ...msg, imageUrl: `data:image/png;base64,${msg.imageData}` };
              }
              return msg;
            });

            await conversationStorage.save(conversationId, updatedConversation);
            setMessages(messagesWithDataUrls);
            setConversationTitle(updatedConversation.title);
            if (updatedConversation.modelId) {
              setChatModelId(updatedConversation.modelId);
            }
          } else if (localTime > serverTime) {
            await syncConversationToServer(conversationId, localConversation);
          }
        } else if (serverConversation && !localConversation) {
          const updatedConversation = convertServerToLocal(serverConversation, conversationId);
          const messagesWithDataUrls = updatedConversation.messages.map((msg) => {
            if (msg.imageData && (!msg.imageUrl || msg.imageUrl.startsWith("blob:"))) {
              return { ...msg, imageUrl: `data:image/png;base64,${msg.imageData}` };
            }
            return msg;
          });

          await conversationStorage.save(conversationId, updatedConversation);
          setMessages(messagesWithDataUrls);
          setConversationTitle(updatedConversation.title);
          if (updatedConversation.modelId) {
            setChatModelId(updatedConversation.modelId);
          }

          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
          }, 100);
        }
      } catch (error) {
        console.log("Could not sync with server, using local version:", error);
      }
    };

    loadConversation();
  }, [conversationId]);

  // Sync all conversations on mount
  useEffect(() => {
    const syncAndReload = async () => {
      await syncAllConversationsFromServer();
      const conversations = await conversationStorage.getAll();
      setAllConversations(conversations);
    };
    syncAndReload();
  }, []);

  // Load conversations when messages change
  useEffect(() => {
    const loadConversations = async () => {
      const conversations = await conversationStorage.getAll();
      setAllConversations(conversations);
    };
    loadConversations();
  }, [conversationId, messages]);

  // Auto-scroll when user sends a message
  useEffect(() => {
    if (shouldScrollToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
      shouldScrollToBottomRef.current = false;
    }
  }, [messages]);

  // Cleanup blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      messages.forEach((msg) => {
        if (msg.imageUrl && msg.imageUrl.startsWith("blob:")) {
          URL.revokeObjectURL(msg.imageUrl);
        }
        if (msg.generatedImages) {
          msg.generatedImages.forEach((url) => {
            if (url.startsWith("blob:")) {
              URL.revokeObjectURL(url);
            }
          });
        }
      });
    };
  }, [conversationId]);

  const saveConversation = useCallback(
    async (shouldUpdateTimestamp: boolean = false, syncToServer: boolean = false) => {
      if (isTempMode) {
        return;
      }

      if (messages.length > 0) {
        const existingConversation = await conversationStorage.get(conversationId);

        let titleToUse = conversationTitle;
        if (!titleToUse || titleToUse === "New Chat") {
          if (existingConversation?.title && existingConversation.title !== "New Chat") {
            titleToUse = existingConversation.title;
          } else if (messages.length > 0 && messages[0].role === "user") {
            const firstMessage = messages[0].content;
            titleToUse = firstMessage.length > 30 ? firstMessage.substring(0, 35) + "..." : firstMessage;
          } else {
            titleToUse = "New Chat";
          }
        }

        const conversation: LocalConversation = {
          id: conversationId,
          title: titleToUse,
          messages,
          modelId: chatModelId,
          lastMessageAt: shouldUpdateTimestamp
            ? new Date().toISOString()
            : existingConversation?.lastMessageAt || new Date().toISOString(),
        };

        await conversationStorage.save(conversationId, conversation);

        if (syncToServer) {
          try {
            await syncConversationToServer(conversationId, conversation);
          } catch (error) {
            console.log("Could not sync to server, saved locally:", error);
          }
        }
      }
    },
    [conversationId, messages, conversationTitle, chatModelId, isTempMode]
  );

  // Auto-save on changes
  useEffect(() => {
    saveConversation(false, false);
  }, [messages, conversationTitle, chatModelId]);

  const handleNewChat = useCallback(
    (mode: "chat" | "image-gen") => {
      router.push(`/ai-assistant?mode=${mode}`);
    },
    [router]
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await conversationStorage.delete(id);

        try {
          const filters = JSON.stringify({ external_uuid: id });
          const serverConversations = await ConversationsService.listConversationsConversationsGet(0, 1, filters);

          if (serverConversations && serverConversations.length > 0) {
            await ConversationsService.deleteConversationConversationsItemIdDelete(
              serverConversations[0]._id as string
            );
          }
        } catch (serverError) {
          console.error("Failed to delete conversation from server:", serverError);
        }

        if (id === conversationId) {
          router.push(`/ai-assistant?mode=${mode}`);
        }

        const conversations = await conversationStorage.getAll();
        setAllConversations(conversations);
      } catch (error) {
        console.error("Failed to delete conversation:", error);
        toast.error("Failed to delete conversation");
      }
    },
    [conversationId, router, mode]
  );

  const handleDeleteAllConversations = useCallback(async () => {
    if (window.confirm("Are you sure you want to delete all conversations? This action cannot be undone.")) {
      try {
        await conversationStorage.deleteAll();

        try {
          const token = getToken();
          if (token) {
            const serverConversations = await ConversationsService.listConversationsConversationsGet(0, 500);

            if (serverConversations && serverConversations.length > 0) {
              await Promise.all(
                serverConversations.map((conv) =>
                  ConversationsService.deleteConversationConversationsItemIdDelete(conv._id as string)
                )
              );
            }
          }
        } catch (serverError) {
          console.error("Failed to delete conversations from server:", serverError);
        }

        toast.success("All conversations deleted");
        router.push(`/ai-assistant?mode=${mode}`);
        setAllConversations([]);
      } catch (error) {
        console.error("Failed to delete all conversations:", error);
        toast.error("Failed to delete all conversations");
      }
    }
  }, [router, mode]);

  const handleResyncData = useCallback(async () => {
    try {
      toast.loading("Re-syncing data...", { id: "resync" });
      syncStorage.clearLastSync();
      // Push local → server first, then pull server → local
      await syncAllLocalConversationsToServer();
      await syncAllConversationsFromServer();
      const conversations = await conversationStorage.getAll();
      setAllConversations(conversations);
      toast.success("Data re-synced successfully", { id: "resync" });
    } catch (error) {
      console.error("Failed to resync data:", error);
      toast.error("Failed to resync data", { id: "resync" });
    }
  }, []);

  const handleTempModeToggle = useCallback(
    (mode: "chat" | "image-gen") => {
      if (!isTempMode) {
        setIsTempMode(true);
        setMessages([]);
        setConversationTitle("");
      } else {
        setIsTempMode(false);
        handleNewChat(mode);
      }
    },
    [isTempMode, handleNewChat]
  );

  return {
    messages,
    setMessages,
    conversationTitle,
    setConversationTitle,
    allConversations,
    setAllConversations,
    isTempMode,
    setIsTempMode,
    messagesEndRef,
    shouldScrollToBottomRef,
    saveConversation,
    handleNewChat,
    handleDeleteConversation,
    handleDeleteAllConversations,
    handleResyncData,
    handleTempModeToggle,
  };
}
