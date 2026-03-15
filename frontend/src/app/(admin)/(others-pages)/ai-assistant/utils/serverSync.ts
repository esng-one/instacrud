// app/(admin)/(others-pages)/ai-assistant/utils/serverSync.ts
import { ConversationsService } from "@/api/services/ConversationsService";
import { Conversation_Output } from "@/api/models/Conversation_Output";
import { ConversationMessage } from "@/api/models/ConversationMessage";
import { MessageRole } from "@/api/models/MessageRole";
import { conversationStorage, syncStorage } from "@/db/conversationStorage";
import type { LocalConversation, Message } from "@/db/conversationsDb";
import { getToken } from "@/lib/tokenStorage";

// Track ongoing syncs to prevent duplicates
const ongoingSyncs = new Set<string>();

// Server sync utilities
export async function syncConversationToServer(
  externalUuid: string,
  conversation: LocalConversation
): Promise<boolean> {
  // Prevent duplicate syncs for the same conversation
  if (ongoingSyncs.has(externalUuid)) {
    console.log("[ServerSync] Sync already in progress for:", externalUuid, "- skipping");
    return false;
  }

  ongoingSyncs.add(externalUuid);

  try {
    const token = getToken();
    if (!token) {
      ongoingSyncs.delete(externalUuid);
      return false;
    }

    console.log("[ServerSync] Syncing conversation:", externalUuid, "Title:", conversation.title);

    // Convert messages to server format
    const serverMessages: ConversationMessage[] = conversation.messages.map(msg => ({
      role: msg.role === "user" ? MessageRole.USER : MessageRole.ASSISTANT,
      content: msg.content,
      image_data: msg.imageData || null,
      image_url: msg.imageUrl || null,
      generated_images: msg.generatedImages || null,
      reasoning_content: msg.reasoningContent || null,
      timestamp: new Date().toISOString(),
    }));

    // Try to find existing conversation by external_uuid
    const filters = JSON.stringify({ external_uuid: externalUuid });
    const existing = await ConversationsService.listConversationsConversationsGet(0, 1, filters);

    if (existing && existing.length > 0) {
      const existingConv = existing[0];
      const serverTime = new Date(existingConv.last_message_at || 0).getTime();
      const localTime = new Date(conversation.lastMessageAt).getTime();

      if (serverTime > localTime) {
        // Server has a newer version — don't overwrite it
        console.log("[ServerSync] Server version is newer, skipping PATCH:", externalUuid);
        return true;
      }

      console.log("[ServerSync] Updating existing conversation, ID:", existingConv._id);
      await ConversationsService.patchConversationConversationsItemIdPatch(
        existingConv._id as string,
        {
          title: conversation.title,
          messages: serverMessages,
          model_id: conversation.modelId,
          last_message_at: conversation.lastMessageAt,
        }
      );
    } else {
      // Create new conversation
      console.log("[ServerSync] Creating new conversation with external_uuid:", externalUuid);
      await ConversationsService.createConversationConversationsPost({
        external_uuid: externalUuid,
        title: conversation.title,
        messages: serverMessages,
        model_id: conversation.modelId,
        last_message_at: conversation.lastMessageAt,
      });
    }

    console.log("[ServerSync] Sync successful");
    return true;
  } catch (error) {
    console.error("[ServerSync] Failed to sync conversation to server:", error);
    return false;
  } finally {
    // Always remove from ongoing syncs when done
    ongoingSyncs.delete(externalUuid);
  }
}

export async function syncConversationFromServer(
  externalUuid: string
): Promise<Conversation_Output | null> {
  try {
    const filters = JSON.stringify({ external_uuid: externalUuid });
    const result = await ConversationsService.listConversationsConversationsGet(0, 1, filters);

    if (result && result.length > 0) {
      return result[0];
    }
    return null;
  } catch (error) {
    console.error("Failed to sync conversation from server:", error);
    return null;
  }
}

export function convertServerToLocal(
  serverConv: Conversation_Output,
  externalUuid: string
): LocalConversation {
  const messages: Message[] = (serverConv.messages || []).map((msg, idx) => ({
    id: `${Date.now()}-${idx}`,
    role: msg.role === MessageRole.USER ? "user" : "assistant",
    content: msg.content,
    imageData: msg.image_data || undefined,
    imageUrl: msg.image_url || undefined,
    generatedImages: msg.generated_images || undefined,
    reasoningContent: msg.reasoning_content || undefined,
  }));

  return {
    id: externalUuid,
    title: serverConv.title || "New Chat",
    messages,
    modelId: serverConv.model_id || null,
    lastMessageAt: serverConv.last_message_at || new Date().toISOString(),
  };
}

// Push all local conversations to server (used on manual re-sync)
export async function syncAllLocalConversationsToServer(): Promise<void> {
  try {
    const token = getToken();
    if (!token) return;

    const localConversationsArray = await conversationStorage.getAll();
    if (localConversationsArray.length === 0) return;

    console.log("[ConversationSync] Pushing", localConversationsArray.length, "local conversations to server");

    let pushedCount = 0;
    for (const localConv of localConversationsArray) {
      const success = await syncConversationToServer(localConv.id, localConv);
      if (success) pushedCount++;
    }

    console.log("[ConversationSync] Pushed", pushedCount, "conversations to server");
  } catch (error) {
    console.error("[ConversationSync] Failed to push local conversations to server:", error);
  }
}

// Sync all conversations from server to IndexedDB
export async function syncAllConversationsFromServer(): Promise<void> {
  try {
    const token = getToken();
    if (!token) {
      console.log("[ConversationSync] No token found, skipping sync");
      return;
    }

    const lastSync = syncStorage.getLastSync();
    const now = new Date();

    console.log("[ConversationSync] Starting sync, lastSync:", lastSync);

    // Calculate sync threshold (15 minutes before last sync)
    let filters = {};
    if (lastSync) {
      const syncThreshold = new Date(lastSync.getTime() - 15 * 60 * 1000);
      filters = {
        last_message_at: { $gte: syncThreshold.toISOString() }
      };
      console.log("[ConversationSync] Using filter:", filters);
    } else {
      console.log("[ConversationSync] No lastSync, fetching all conversations");
    }

    // Fetch conversations from server
    const serverConversations = await ConversationsService.listConversationsConversationsGet(
      0,
      500,
      Object.keys(filters).length > 0 ? JSON.stringify(filters) : undefined
    );

    console.log("[ConversationSync] Fetched", serverConversations?.length || 0, "conversations from server");

    if (!serverConversations || serverConversations.length === 0) {
      syncStorage.setLastSync(now);
      console.log("[ConversationSync] No conversations to sync");
      return;
    }

    // Get local conversations
    const localConversationsArray = await conversationStorage.getAll();
    const localConversations = new Map(localConversationsArray.map(conv => [conv.id, conv]));
    console.log("[ConversationSync] Local conversations count:", localConversations.size);

    // Merge conversations
    let mergedCount = 0;
    for (const serverConv of serverConversations) {
      if (!serverConv.external_uuid) continue;

      const externalUuid = serverConv.external_uuid;
      const localConv = localConversations.get(externalUuid);

      // Convert server timestamps to Date objects for comparison
      const serverLastMessageAt = new Date(serverConv.last_message_at || 0);
      const localLastMessageAt = localConv
        ? new Date(localConv.lastMessageAt)
        : new Date(0);

      // Only merge if server version is newer or local doesn't exist
      if (!localConv || serverLastMessageAt > localLastMessageAt) {
        const convertedConv = convertServerToLocal(serverConv, externalUuid);
        await conversationStorage.save(externalUuid, convertedConv);
        mergedCount++;
        console.log("[ConversationSync] Merged conversation:", externalUuid, "Title:", serverConv.title);
      }
    }

    console.log("[ConversationSync] Merged", mergedCount, "conversations");

    // Update last sync timestamp
    syncStorage.setLastSync(now);
    console.log("[ConversationSync] Sync complete, new lastSync:", now.toISOString());
  } catch (error) {
    console.error("[ConversationSync] Failed to sync conversations from server:", error);
  }
}
