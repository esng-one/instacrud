// db/conversationStorage.ts
import { conversationDb, LocalConversation } from './conversationsDb';

// Constants for localStorage keys
const LAST_CONVERSATION_SYNC_KEY = "last_conversation_sync";

// Storage utilities - new IndexedDB-based implementations
export const conversationStorage = {
  // Get all conversations (sorted by lastMessageAt descending)
  async getAll(): Promise<LocalConversation[]> {
    try {
      return await conversationDb.getAll();
    } catch (error) {
      console.error('Failed to get conversations from IndexedDB:', error);
      return [];
    }
  },

  // Get a single conversation
  async get(id: string): Promise<LocalConversation | undefined> {
    try {
      return await conversationDb.get(id);
    } catch (error) {
      console.error(`Failed to get conversation ${id} from IndexedDB:`, error);
      return undefined;
    }
  },

  // Save a conversation
  async save(id: string, conversation: LocalConversation): Promise<void> {
    try {
      await conversationDb.save(conversation);
    } catch (error) {
      console.error(`Failed to save conversation ${id} to IndexedDB:`, error);
      throw error;
    }
  },

  // Delete a conversation
  async delete(id: string): Promise<void> {
    try {
      await conversationDb.delete(id);
    } catch (error) {
      console.error(`Failed to delete conversation ${id} from IndexedDB:`, error);
      throw error;
    }
  },

  // Delete all conversations
  async deleteAll(): Promise<void> {
    try {
      await conversationDb.deleteAll();
    } catch (error) {
      console.error('Failed to delete all conversations from IndexedDB:', error);
      throw error;
    }
  },

  // Get conversations modified after a date
  async getModifiedAfter(date: Date): Promise<LocalConversation[]> {
    try {
      return await conversationDb.getModifiedAfter(date);
    } catch (error) {
      console.error('Failed to get modified conversations from IndexedDB:', error);
      return [];
    }
  }
};

// Sync timestamp utilities (still using localStorage for simplicity)
export const syncStorage = {
  getLastSync(): Date | null {
    try {
      const stored = localStorage.getItem(LAST_CONVERSATION_SYNC_KEY);
      return stored ? new Date(stored) : null;
    } catch (error) {
      console.error("Failed to load last conversation sync time:", error);
      return null;
    }
  },

  setLastSync(date: Date): void {
    try {
      localStorage.setItem(LAST_CONVERSATION_SYNC_KEY, date.toISOString());
    } catch (error) {
      console.error("Failed to save last conversation sync time:", error);
    }
  },

  clearLastSync(): void {
    try {
      localStorage.removeItem(LAST_CONVERSATION_SYNC_KEY);
    } catch (error) {
      console.error("Failed to clear last conversation sync time:", error);
    }
  }
};
