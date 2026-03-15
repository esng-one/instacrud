// db/conversationsDb.ts
import Dexie, { Table } from 'dexie';

// Message interface
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageData?: string; // Base64 encoded image data (for vision input)
  imageUrl?: string; // Image URL (for display or API)
  generatedImages?: string[]; // Generated image URLs or base64 data
  reasoningContent?: string; // Chain of thought content (for reasoning-enabled models)
}

// Conversation interface for IndexedDB storage
export interface LocalConversation {
  id: string; // Primary key - external_uuid
  title: string;
  messages: Message[];
  modelId: string | null;
  lastMessageAt: string;
}

// Database class
export class ConversationsDatabase extends Dexie {
  conversations!: Table<LocalConversation, string>;

  constructor(userId: string) {
    super(`ConversationsDB_${userId}`);

    this.version(1).stores({
      conversations: 'id, lastMessageAt' // Index on id (primary) and lastMessageAt for sorting
    });
  }
}

// Cache for database instances per user
const dbInstances = new Map<string, ConversationsDatabase>();

// Get or create a database instance for a specific user
function getDb(userId: string): ConversationsDatabase {
  if (!dbInstances.has(userId)) {
    dbInstances.set(userId, new ConversationsDatabase(userId));
  }
  return dbInstances.get(userId)!;
}

// Get current user_id from localStorage
function getCurrentUserId(): string | null {
  try {
    const userInfoStr = localStorage.getItem("user.info");
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      if (userInfo.user_id) {
        return userInfo.user_id;
      }
    }
  } catch (error) {
    console.error("Error getting user_id:", error);
  }
  return null;
}

// Database utilities
export const conversationDb = {
  // Get all conversations sorted by last message time
  async getAll(): Promise<LocalConversation[]> {
    const userId = getCurrentUserId();
    if (!userId) return [];
    const db = getDb(userId);
    return await db.conversations.orderBy('lastMessageAt').reverse().toArray();
  },

  // Get a single conversation by ID
  async get(id: string): Promise<LocalConversation | undefined> {
    const userId = getCurrentUserId();
    if (!userId) return undefined;
    const db = getDb(userId);
    return await db.conversations.get(id);
  },

  // Save or update a conversation
  async save(conversation: LocalConversation): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) return;
    const db = getDb(userId);
    await db.conversations.put(conversation);
  },

  // Delete a conversation
  async delete(id: string): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) return;
    const db = getDb(userId);
    await db.conversations.delete(id);
  },

  // Delete all conversations
  async deleteAll(): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) return;
    const db = getDb(userId);
    await db.conversations.clear();
  },

  // Get conversations modified after a certain date
  async getModifiedAfter(date: Date): Promise<LocalConversation[]> {
    const userId = getCurrentUserId();
    if (!userId) return [];
    const db = getDb(userId);
    const isoDate = date.toISOString();
    return await db.conversations
      .where('lastMessageAt')
      .above(isoDate)
      .toArray();
  },

  // Check if database is available (for migration)
  async isAvailable(): Promise<boolean> {
    try {
      const userId = getCurrentUserId();
      if (!userId) return false;
      const db = getDb(userId);
      await db.open();
      return true;
    } catch (error) {
      console.error('IndexedDB is not available:', error);
      return false;
    }
  },

  // Count total conversations
  async count(): Promise<number> {
    const userId = getCurrentUserId();
    if (!userId) return 0;
    const db = getDb(userId);
    return await db.conversations.count();
  }
};
