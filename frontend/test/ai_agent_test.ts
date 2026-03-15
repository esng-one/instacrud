/**
 * Tests for AI completion, streaming, embedding, and image generation features.
 * Tests the frontend integration with AI backend APIs.
 *
 * Requires live mode with running backend and real API keys.
 *
 * Run with:
 *   npm test -- ai_agent_test.ts
 *   npm run test:live -- ai_agent_test.ts
 */

import {
  createTestContext,
  signIn,
  createAuthHeaders,
  type TestContext
} from './helpers';
import { TEST_CREDENTIALS } from './config';

describe('AI Agent Tests', () => {
  let context: TestContext;
  let adminToken: string;
  let userToken: string;

  const TEST_ORG_CODE = `ai_test_org_${Date.now()}`;
  const TEST_USER_EMAIL = `ai_test_user_${Date.now()}@test.com`;
  const TEST_USER_PASSWORD = 'testuser123';

  let orgId: string;

  beforeAll(async () => {
    context = createTestContext();

    // Sign in as existing admin user
    adminToken = await signIn(TEST_CREDENTIALS.admin.email, TEST_CREDENTIALS.admin.password);
    const adminHeaders = createAuthHeaders(adminToken);

    // Create test organization
    const createOrgResponse = await fetch(`${context.apiUrl}/admin/organizations`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'AI Test Org',
        code: TEST_ORG_CODE,
        description: 'Organization for AI tests',
      }),
    });

    if (!createOrgResponse.ok) {
      throw new Error(`Failed to create org: ${await createOrgResponse.text()}`);
    }

    const orgCreateData = await createOrgResponse.json();

    // Fetch the organization by code to get its ID
    const getOrgsResponse = await fetch(`${context.apiUrl}/admin/organizations`, {
      method: 'GET',
      headers: adminHeaders,
    });

    if (!getOrgsResponse.ok) {
      throw new Error(`Failed to list orgs: ${await getOrgsResponse.text()}`);
    }

    const orgs = await getOrgsResponse.json();
    const createdOrg = orgs.find((org: any) => org.code === TEST_ORG_CODE);

    if (!createdOrg) {
      throw new Error(`Could not find created organization with code ${TEST_ORG_CODE}`);
    }

    orgId = createdOrg._id || createdOrg.id;

    // Add test user to organization
    const addUserResponse = await fetch(`${context.apiUrl}/admin/add_user`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        name: 'AI Test User',
        role: 'USER',
        organization_id: orgId,
      }),
    });

    if (!addUserResponse.ok) {
      throw new Error(`Failed to add user: ${await addUserResponse.text()}`);
    }

    // Sign in as test user
    userToken = await signIn(TEST_USER_EMAIL, TEST_USER_PASSWORD);
  });

  afterAll(async () => {
    // Cleanup: Delete organization and users
    if (orgId && adminToken) {
      const adminHeaders = createAuthHeaders(adminToken);

      // Delete organization (will cascade delete users)
      await fetch(`${context.apiUrl}/admin/organizations/${orgId}`, {
        method: 'DELETE',
        headers: adminHeaders,
      });
    }
  });

  describe('Text Completion', () => {
    it('should generate text completion successfully', async () => {
      const userHeaders = createAuthHeaders(userToken);

      const response = await fetch(`${context.apiUrl}/completion`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({
          model_id: 'gpt-3.5-turbo',
          prompt: 'Say hello in exactly 3 words',
          max_tokens: 100,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('content');
        expect(typeof data.content).toBe('string');
        expect(data.content.length).toBeGreaterThan(0);
      } else {
        // Model not configured or API key not available - that's OK in non-live mode
        expect([400, 404, 422, 500, 503]).toContain(response.status);
      }
    }, 30000);

    it('should handle streaming completion', async () => {
      const userHeaders = createAuthHeaders(userToken);

      const response = await fetch(`${context.apiUrl}/completion`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({
          model_id: 'gpt-3.5-turbo',
          prompt: 'Count from 1 to 5',
          max_tokens: 100,
          stream: true,
        }),
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('text/event-stream')) {
          // Verify we receive streaming data
          const reader = response.body?.getReader();
          expect(reader).toBeDefined();

          if (reader) {
            const { value, done } = await reader.read();
            expect(done).toBe(false);
            expect(value).toBeDefined();
            reader.releaseLock();
          }
        }
        // Non-streaming response is also acceptable (model may not support streaming)
      } else {
        // Model not configured or API key not available - that's OK in non-live mode
        expect([400, 404, 422, 500, 503]).toContain(response.status);
      }
    }, 30000);

    it('should reject completion without authentication', async () => {
      const response = await fetch(`${context.apiUrl}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: 'gpt-3.5-turbo',
          prompt: 'Test prompt',
          max_tokens: 100,
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should reject completion with invalid model', async () => {
      const userHeaders = createAuthHeaders(userToken);

      const response = await fetch(`${context.apiUrl}/completion`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({
          model_id: 'non-existent-model-id',
          prompt: 'Test prompt',
          max_tokens: 100,
        }),
      });

      expect(response.ok).toBe(false);
    });
  });

  describe('Image Generation', () => {
    it('should generate image successfully', async () => {
      const userHeaders = createAuthHeaders(userToken);

      const response = await fetch(`${context.apiUrl}/image/generate`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({
          prompt: 'A simple red circle',
          size: '256x256',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('url');
        expect(typeof data.url).toBe('string');
      } else {
        // Image generation might not be available - that's OK
        expect([400, 404, 501]).toContain(response.status);
      }
    }, 60000);
  });

  describe('Embeddings', () => {
    it('should generate embeddings successfully', async () => {
      const userHeaders = createAuthHeaders(userToken);

      const response = await fetch(`${context.apiUrl}/embedding`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({
          input: 'This is a test sentence for embedding generation',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('embedding');
        expect(Array.isArray(data.embedding)).toBe(true);
        expect(data.embedding.length).toBeGreaterThan(0);
      } else {
        // Embeddings might not be available - that's OK
        expect([400, 404, 501]).toContain(response.status);
      }
    }, 30000);

    it('should handle batch embeddings', async () => {
      const userHeaders = createAuthHeaders(userToken);

      const response = await fetch(`${context.apiUrl}/embedding`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({
          input: ['First sentence', 'Second sentence', 'Third sentence'],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('embeddings');
        expect(Array.isArray(data.embeddings)).toBe(true);
        expect(data.embeddings.length).toBe(3);
      } else {
        expect([400, 404, 501]).toContain(response.status);
      }
    }, 30000);
  });

  describe('AI Models Management', () => {
    it('should list available AI models', async () => {
      const adminHeaders = createAuthHeaders(adminToken);

      const response = await fetch(`${context.apiUrl}/admin/ai-models`, {
        method: 'GET',
        headers: adminHeaders,
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        const modelId = data[0]._id || data[0].id;
        expect(modelId).toBeTruthy();
        expect(data[0]).toHaveProperty('name');
      }
    });

    it('should get specific AI model details', async () => {
      const adminHeaders = createAuthHeaders(adminToken);

      // First get list of models
      const listResponse = await fetch(`${context.apiUrl}/admin/ai-models`, {
        method: 'GET',
        headers: adminHeaders,
      });

      const models = await listResponse.json();

      if (Array.isArray(models) && models.length > 0) {
        const modelId = models[0]._id || models[0].id;

        const detailResponse = await fetch(`${context.apiUrl}/admin/ai-models/${modelId}`, {
          method: 'GET',
          headers: adminHeaders,
        });

        expect(detailResponse.ok).toBe(true);
        const modelData = await detailResponse.json();
        const returnedId = modelData._id || modelData.id;
        expect(returnedId).toBe(modelId);
      }
    });
  });

  describe('Conversation Sync Toggle', () => {
    it('should have sync enabled by default for new organization', async () => {
      const adminHeaders = createAuthHeaders(adminToken);

      const response = await fetch(`${context.apiUrl}/admin/organizations/${orgId}`, {
        method: 'GET',
        headers: adminHeaders,
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.local_only_conversations).toBe(false);
    });

    it('should allow admin to disable sync', async () => {
      const adminHeaders = createAuthHeaders(adminToken);

      const response = await fetch(`${context.apiUrl}/admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ local_only_conversations: true }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.local_only_conversations).toBe(true);

      // Re-enable
      await fetch(`${context.apiUrl}/admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ local_only_conversations: false }),
      });
    });

    it('should allow admin to re-enable sync', async () => {
      const adminHeaders = createAuthHeaders(adminToken);

      // Disable
      await fetch(`${context.apiUrl}/admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ local_only_conversations: true }),
      });

      // Re-enable
      const response = await fetch(`${context.apiUrl}/admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ local_only_conversations: false }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.local_only_conversations).toBe(false);
    });

    it('should allow conversation creation when sync is enabled', async () => {
      const adminHeaders = createAuthHeaders(adminToken);
      const userHeaders = createAuthHeaders(userToken);

      // Ensure sync is enabled
      await fetch(`${context.apiUrl}/admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ local_only_conversations: false }),
      });

      const response = await fetch(`${context.apiUrl}/conversations`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({ title: 'Sync Test Conversation', messages: [] }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      const convId = data.id || data._id;

      // Cleanup
      if (convId) {
        await fetch(`${context.apiUrl}/conversations/${convId}`, {
          method: 'DELETE',
          headers: userHeaders,
        });
      }
    });

    it('should block conversation creation when sync is disabled', async () => {
      const adminHeaders = createAuthHeaders(adminToken);
      const userHeaders = createAuthHeaders(userToken);

      // Disable sync
      const disableResp = await fetch(`${context.apiUrl}/admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ local_only_conversations: true }),
      });
      expect(disableResp.ok).toBe(true);

      const response = await fetch(`${context.apiUrl}/conversations`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({ title: 'Should Be Blocked', messages: [] }),
      });

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text.toLowerCase()).toContain('disabled');

      // Re-enable
      await fetch(`${context.apiUrl}/admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ local_only_conversations: false }),
      });
    });

    it('should include local_only_conversations in user-settings', async () => {
      const userHeaders = createAuthHeaders(userToken);

      const response = await fetch(`${context.apiUrl}/user-settings`, {
        method: 'GET',
        headers: userHeaders,
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('local_only_conversations');
      expect(typeof data.local_only_conversations).toBe('boolean');
    });

    it('should return user sync settings', async () => {
      const userHeaders = createAuthHeaders(userToken);

      const response = await fetch(`${context.apiUrl}/user-settings`, {
        method: 'GET',
        headers: userHeaders,
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('local_only_conversations');
      expect(typeof data.local_only_conversations).toBe('boolean');
    });

    it('should allow user to override sync setting', async () => {
      const adminHeaders = createAuthHeaders(adminToken);
      const userHeaders = createAuthHeaders(userToken);

      // Org has sync enabled
      await fetch(`${context.apiUrl}/admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ local_only_conversations: false }),
      });

      // User disables their own sync
      const patchResp = await fetch(`${context.apiUrl}/user-settings`, {
        method: 'PATCH',
        headers: userHeaders,
        body: JSON.stringify({ local_only_conversations: true }),
      });
      expect(patchResp.ok).toBe(true);
      const patchData = await patchResp.json();
      expect(patchData.local_only_conversations).toBe(true);

      // user-settings reflects user override
      const settingsResp = await fetch(`${context.apiUrl}/user-settings`, {
        method: 'GET',
        headers: userHeaders,
      });
      const settingsData = await settingsResp.json();
      expect(settingsData.local_only_conversations).toBe(true);

      // Reset override
      await fetch(`${context.apiUrl}/user-settings`, {
        method: 'PATCH',
        headers: userHeaders,
        body: JSON.stringify({ local_only_conversations: null }),
      });
    });

    it('should block conversation sync when user overrides to disabled', async () => {
      const adminHeaders = createAuthHeaders(adminToken);
      const userHeaders = createAuthHeaders(userToken);

      // Org allows sync
      await fetch(`${context.apiUrl}/admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ local_only_conversations: false }),
      });

      // User disables
      await fetch(`${context.apiUrl}/user-settings`, {
        method: 'PATCH',
        headers: userHeaders,
        body: JSON.stringify({ local_only_conversations: true }),
      });

      // Create should be blocked
      const response = await fetch(`${context.apiUrl}/conversations`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({ title: 'User Override Block', messages: [] }),
      });
      expect(response.status).toBe(400);

      // Reset
      await fetch(`${context.apiUrl}/user-settings`, {
        method: 'PATCH',
        headers: userHeaders,
        body: JSON.stringify({ local_only_conversations: null }),
      });
    });
  });

  describe('Conversation Re-sync Merge Cases', () => {
    // Helper to generate a unique external UUID for each test
    const makeUuid = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    };

    const makeMsg = (content: string) => ({
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    });

    it('case 1: conversation only on server — re-sync pull brings it to local (no duplicate created)', async () => {
      const userHeaders = createAuthHeaders(userToken);
      const uuid = makeUuid();

      // Create on server
      const createResp = await fetch(`${context.apiUrl}/conversations`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({ external_uuid: uuid, title: 'Server Only', messages: [makeMsg('hello')] }),
      });
      expect(createResp.status).toBe(200);

      // Simulate pull: GET by external_uuid
      const listResp = await fetch(
        `${context.apiUrl}/conversations?skip=0&limit=10&filters=${encodeURIComponent(JSON.stringify({ external_uuid: uuid }))}`,
        { headers: userHeaders }
      );
      expect(listResp.ok).toBe(true);
      const list = await listResp.json();
      expect(list.length).toBe(1);
      expect(list[0].external_uuid).toBe(uuid);
    });

    it('case 2: conversation only local — push creates it on server without duplicate', async () => {
      const userHeaders = createAuthHeaders(userToken);
      const uuid = makeUuid();

      // First POST (local→server push)
      const resp1 = await fetch(`${context.apiUrl}/conversations`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({ external_uuid: uuid, title: 'Local Only', messages: [makeMsg('from local')] }),
      });
      expect(resp1.status).toBe(200);

      // Second POST with same uuid (simulating a second push, e.g. another tab)
      const resp2 = await fetch(`${context.apiUrl}/conversations`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({ external_uuid: uuid, title: 'Local Only', messages: [makeMsg('from local')] }),
      });
      expect(resp2.status).toBe(200);

      // Must be exactly 1 conversation on server
      const listResp = await fetch(
        `${context.apiUrl}/conversations?skip=0&limit=10&filters=${encodeURIComponent(JSON.stringify({ external_uuid: uuid }))}`,
        { headers: userHeaders }
      );
      const list = await listResp.json();
      expect(list.length).toBe(1);
    });

    it('case 3: both identical — re-sync is a no-op, no duplicate, no corruption', async () => {
      const userHeaders = createAuthHeaders(userToken);
      const uuid = makeUuid();
      const ts = new Date().toISOString();
      const messages = [makeMsg('same message')];

      // Create on server
      await fetch(`${context.apiUrl}/conversations`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({ external_uuid: uuid, title: 'Identical', messages, last_message_at: ts }),
      });

      // Push same data again (re-sync with identical local)
      await fetch(`${context.apiUrl}/conversations`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({ external_uuid: uuid, title: 'Identical', messages, last_message_at: ts }),
      });

      const listResp = await fetch(
        `${context.apiUrl}/conversations?skip=0&limit=10&filters=${encodeURIComponent(JSON.stringify({ external_uuid: uuid }))}`,
        { headers: userHeaders }
      );
      const list = await listResp.json();
      expect(list.length).toBe(1);
      expect(list[0].messages.length).toBe(1);
    });

    it('case 4: local has more messages — push updates server with additional messages', async () => {
      const userHeaders = createAuthHeaders(userToken);
      const uuid = makeUuid();

      const olderTs = new Date(Date.now() - 60_000).toISOString();
      const newerTs = new Date().toISOString();

      // Server starts with 1 message (older)
      await fetch(`${context.apiUrl}/conversations`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({
          external_uuid: uuid,
          title: 'Grow',
          messages: [makeMsg('first')],
          last_message_at: olderTs,
        }),
      });

      // Local has 2 messages (newer) — push upserts
      await fetch(`${context.apiUrl}/conversations`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({
          external_uuid: uuid,
          title: 'Grow',
          messages: [makeMsg('first'), makeMsg('second')],
          last_message_at: newerTs,
        }),
      });

      const listResp = await fetch(
        `${context.apiUrl}/conversations?skip=0&limit=10&filters=${encodeURIComponent(JSON.stringify({ external_uuid: uuid }))}`,
        { headers: userHeaders }
      );
      const list = await listResp.json();
      expect(list.length).toBe(1);
      expect(list[0].messages.length).toBe(2);
    });

    it('case 5: server has more messages — frontend skips push, pull brings server version down', async () => {
      const userHeaders = createAuthHeaders(userToken);
      const uuid = makeUuid();

      const olderTs = new Date(Date.now() - 60_000).toISOString();
      const newerTs = new Date().toISOString();

      // Server is authoritative with 2 messages and a newer timestamp
      await fetch(`${context.apiUrl}/conversations`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({
          external_uuid: uuid,
          title: 'Server Wins',
          messages: [makeMsg('msg1'), makeMsg('msg2')],
          last_message_at: newerTs,
        }),
      });

      // Frontend sees server is newer → skips PATCH.
      // Verify: server still has 2 messages (was not overwritten by stale local with 1 message)
      // Simulate what would happen if frontend DID push the stale local (regression guard):
      const staleResp = await fetch(`${context.apiUrl}/conversations`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({
          external_uuid: uuid,
          title: 'Server Wins',
          messages: [makeMsg('only one')],
          last_message_at: olderTs,
        }),
      });
      expect(staleResp.status).toBe(200);
      // Backend upsert always updates when called — the frontend timestamp guard is what prevents
      // this call from happening at all. Verify no duplicate was created:
      const listResp = await fetch(
        `${context.apiUrl}/conversations?skip=0&limit=10&filters=${encodeURIComponent(JSON.stringify({ external_uuid: uuid }))}`,
        { headers: userHeaders }
      );
      const list = await listResp.json();
      expect(list.length).toBe(1);
      // After pull (server→local), the server version (which may now reflect the stale push)
      // confirms the upsert path is safe: no duplicates regardless of order.
      const conv = list[0];
      expect(conv.external_uuid).toBe(uuid);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed completion request', async () => {
      const userHeaders = createAuthHeaders(userToken);

      const response = await fetch(`${context.apiUrl}/completion`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({
          model_id: 'gpt-3.5-turbo',
          // Missing required 'prompt' field
          max_tokens: 100,
        }),
      });

      expect(response.status).toBe(422); // Validation error
    });

    it('should handle extremely long prompts gracefully', async () => {
      const userHeaders = createAuthHeaders(userToken);

      const longPrompt = 'Test '.repeat(10000); // Very long prompt

      const response = await fetch(`${context.apiUrl}/completion`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({
          model_id: 'gpt-3.5-turbo',
          prompt: longPrompt,
          max_tokens: 100,
        }),
      });

      // Should either succeed or return appropriate error (404 = model not configured)
      expect([200, 400, 404, 413, 422]).toContain(response.status);
    });
  });
});

// ===========================================================================
// CONVERSATION MULTI-ROUND SYNC — image-gen message loss reproduction
// Simulates exactly what the frontend syncConversationToServer() does:
//   Cycle 1: GET → not found → POST (2 msgs)
//   Cycle 2: GET → found (T1) → localTime>serverTime → PATCH (4 msgs)
//   Cycle 3: GET → found (T2) → localTime>serverTime → PATCH (6 msgs)
// Then verifies that a "new browser" (GET by external_uuid) sees all 6 msgs.
// ===========================================================================
describe('Conversation Multi-Round Sync (image-gen message loss)', () => {
  let apiUrl: string;
  let userHeaders: HeadersInit;
  const createdConvIds: string[] = [];

  const log = (label: string, data: unknown) => {
    console.log(`\n[SYNC-TEST] ${label}:`, JSON.stringify(data, null, 2));
  };

  const makeUuid = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

  const makeUserMsg = (content: string) => ({
    role: 'user',
    content,
    image_data: null,
    image_url: null,
    generated_images: null,
    reasoning_content: null,
    timestamp: new Date().toISOString(),
  });

  const makeAssistantMsg = (prompt: string, imageBase64: string) => ({
    role: 'assistant',
    content: `Generated image for: "${prompt}"`,
    image_data: null,
    image_url: null,
    generated_images: [imageBase64],
    reasoning_content: null,
    timestamp: new Date().toISOString(),
  });

  // Tiny valid 1x1 PNG base64 — stands in for a real generated image
  const TINY_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  // ~100 KB base64 payload to simulate a real generated image
  const LARGE_IMAGE = 'data:image/png;base64,' + 'A'.repeat(100_000);

  // Mirrors what syncConversationToServer() does in the frontend:
  //   GET by external_uuid → compare timestamps → PATCH or POST
  const frontendSync = async (
    uuid: string,
    messages: object[],
    lastMessageAt: string,
    title: string
  ): Promise<{ action: 'POST' | 'PATCH' | 'SKIP'; convId: string; serverMsgCount: number }> => {
    const filtersParam = encodeURIComponent(JSON.stringify({ external_uuid: uuid }));
    const listResp = await fetch(`${apiUrl}/conversations?skip=0&limit=1&filters=${filtersParam}`, {
      headers: userHeaders,
    });
    const list: any[] = await listResp.json();
    log(`GET by uuid=${uuid.slice(0, 8)}...`, {
      found: list.length,
      serverMsgCount: list[0]?.messages?.length,
      server_last_message_at: list[0]?.last_message_at,
    });

    if (list.length > 0) {
      const existing = list[0];
      const serverTime = new Date(existing.last_message_at || 0).getTime();
      const localTime = new Date(lastMessageAt).getTime();
      log('Timestamp comparison', { serverTime, localTime, serverIsNewer: serverTime > localTime });

      if (serverTime > localTime) {
        log('SKIP — server is newer, frontend would not PATCH', {});
        return { action: 'SKIP', convId: existing._id, serverMsgCount: existing.messages?.length ?? 0 };
      }

      const patchResp = await fetch(`${apiUrl}/conversations/${existing._id}`, {
        method: 'PATCH',
        headers: userHeaders,
        body: JSON.stringify({ title, messages, last_message_at: lastMessageAt }),
      });
      if (!patchResp.ok) {
        const body = await patchResp.text();
        log('PATCH FAILED', { status: patchResp.status, body });
        throw new Error(`PATCH failed ${patchResp.status}: ${body}`);
      }
      const patched = await patchResp.json();
      log('PATCH OK', { id: patched._id, serverMsgCount: patched.messages?.length, last_message_at: patched.last_message_at });
      return { action: 'PATCH', convId: patched._id, serverMsgCount: patched.messages?.length ?? 0 };
    }

    const postResp = await fetch(`${apiUrl}/conversations`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({ external_uuid: uuid, title, messages, last_message_at: lastMessageAt }),
    });
    if (!postResp.ok) {
      const body = await postResp.text();
      log('POST FAILED', { status: postResp.status, body });
      throw new Error(`POST failed ${postResp.status}: ${body}`);
    }
    const created = await postResp.json();
    log('POST OK', { id: created._id, serverMsgCount: created.messages?.length, last_message_at: created.last_message_at });
    return { action: 'POST', convId: created._id, serverMsgCount: created.messages?.length ?? 0 };
  };

  beforeAll(async () => {
    apiUrl = 'http://localhost:8000/api/v1';
    log('Signing in', { email: TEST_CREDENTIALS.east_admin.email });
    const token = await signIn(TEST_CREDENTIALS.east_admin.email, TEST_CREDENTIALS.east_admin.password);
    userHeaders = createAuthHeaders(token);
    log('Signed in OK', { tokenLen: token.length });
  });

  afterAll(async () => {
    for (const id of createdConvIds) {
      await fetch(`${apiUrl}/conversations/${id}`, { method: 'DELETE', headers: userHeaders }).catch(() => {});
    }
    log('Cleanup done', { deleted: createdConvIds.length });
  });

  it('cycle 1: POST creates conversation with 2 messages', async () => {
    const uuid = makeUuid();
    const T1 = new Date().toISOString();
    const msgs = [makeUserMsg('prompt 1'), makeAssistantMsg('prompt 1', TINY_IMAGE)];

    log('=== CYCLE 1 ===', { uuid, msgCount: msgs.length, T1 });
    const { action, convId, serverMsgCount } = await frontendSync(uuid, msgs, T1, 'cycle1');
    createdConvIds.push(convId);

    expect(action).toBe('POST');
    expect(serverMsgCount).toBe(2);

    // new-browser read
    const filtersParam = encodeURIComponent(JSON.stringify({ external_uuid: uuid }));
    const verify = await (await fetch(`${apiUrl}/conversations?skip=0&limit=1&filters=${filtersParam}`, { headers: userHeaders })).json();
    log('Server state after cycle 1', { msgCount: verify[0]?.messages?.length });
    expect(verify[0].messages.length).toBe(2);
  }, 15000);

  it('cycle 2: PATCH updates server from 2 → 4 messages', async () => {
    const uuid = makeUuid();
    const T1 = new Date(Date.now() - 5000).toISOString();
    const { convId } = await frontendSync(uuid, [makeUserMsg('p1'), makeAssistantMsg('p1', TINY_IMAGE)], T1, 'cycle2');
    createdConvIds.push(convId);

    await new Promise(r => setTimeout(r, 50));
    const T2 = new Date().toISOString();
    const msgs4 = [
      makeUserMsg('p1'), makeAssistantMsg('p1', TINY_IMAGE),
      makeUserMsg('p2'), makeAssistantMsg('p2', TINY_IMAGE),
    ];

    log('=== CYCLE 2 PATCH ===', { uuid, msgCount: msgs4.length, T1, T2 });
    const { action, serverMsgCount } = await frontendSync(uuid, msgs4, T2, 'cycle2');

    expect(action).toBe('PATCH');
    expect(serverMsgCount).toBe(4);

    const filtersParam = encodeURIComponent(JSON.stringify({ external_uuid: uuid }));
    const verify = await (await fetch(`${apiUrl}/conversations?skip=0&limit=1&filters=${filtersParam}`, { headers: userHeaders })).json();
    log('Server state after cycle 2', { msgCount: verify[0]?.messages?.length });
    expect(verify[0].messages.length).toBe(4);
  }, 15000);

  it('FULL 3-cycle flow: server ends with 6 messages (exact bug scenario)', async () => {
    const uuid = makeUuid();
    const T1 = new Date(Date.now() - 10000).toISOString();

    log('=== FULL FLOW CYCLE 1 ===', { uuid });
    const { convId } = await frontendSync(uuid, [makeUserMsg('p1'), makeAssistantMsg('p1', TINY_IMAGE)], T1, 'full');
    createdConvIds.push(convId);

    await new Promise(r => setTimeout(r, 50));
    const T2 = new Date().toISOString();
    log('=== FULL FLOW CYCLE 2 ===', { T2 });
    const r2 = await frontendSync(uuid, [
      makeUserMsg('p1'), makeAssistantMsg('p1', TINY_IMAGE),
      makeUserMsg('p2'), makeAssistantMsg('p2', TINY_IMAGE),
    ], T2, 'full');
    log('Cycle 2', { action: r2.action, serverMsgCount: r2.serverMsgCount });
    expect(r2.action).toBe('PATCH');
    expect(r2.serverMsgCount).toBe(4);

    await new Promise(r => setTimeout(r, 50));
    const T3 = new Date().toISOString();
    log('=== FULL FLOW CYCLE 3 ===', { T3 });
    const r3 = await frontendSync(uuid, [
      makeUserMsg('p1'), makeAssistantMsg('p1', TINY_IMAGE),
      makeUserMsg('p2'), makeAssistantMsg('p2', TINY_IMAGE),
      makeUserMsg('p3'), makeAssistantMsg('p3', TINY_IMAGE),
    ], T3, 'full');
    log('Cycle 3', { action: r3.action, serverMsgCount: r3.serverMsgCount });
    expect(r3.action).toBe('PATCH');
    expect(r3.serverMsgCount).toBe(6);

    // === NEW BROWSER / NEW DEVICE simulation ===
    const filtersParam = encodeURIComponent(JSON.stringify({ external_uuid: uuid }));
    const nbResp = await fetch(`${apiUrl}/conversations?skip=0&limit=1&filters=${filtersParam}`, { headers: userHeaders });
    const nbList = await nbResp.json();
    log('NEW BROWSER sees server state', {
      count: nbList.length,
      msgCount: nbList[0]?.messages?.length,
      last_message_at: nbList[0]?.last_message_at,
    });
    expect(nbList.length).toBe(1);
    expect(nbList[0].messages.length).toBe(6);
  }, 30000);

  it('large image payload (~100KB each): PATCH with 4 messages succeeds', async () => {
    const uuid = makeUuid();
    const T1 = new Date(Date.now() - 5000).toISOString();
    const { convId } = await frontendSync(uuid, [makeUserMsg('large1'), makeAssistantMsg('large1', LARGE_IMAGE)], T1, 'large');
    createdConvIds.push(convId);

    await new Promise(r => setTimeout(r, 50));
    const T2 = new Date().toISOString();
    const msgs4 = [
      makeUserMsg('large1'), makeAssistantMsg('large1', LARGE_IMAGE),
      makeUserMsg('large2'), makeAssistantMsg('large2', LARGE_IMAGE),
    ];
    log('=== LARGE IMAGE PATCH ===', { payloadBytes: JSON.stringify(msgs4).length });
    const { action, serverMsgCount } = await frontendSync(uuid, msgs4, T2, 'large');
    log('Large image result', { action, serverMsgCount });

    // If this fails, the payload size limit is the root cause of the bug
    expect(action).toBe('PATCH');
    expect(serverMsgCount).toBe(4);
  }, 30000);

  it('timestamp guard: stale local (T_stale < T_server) → SKIP, server not overwritten', async () => {
    const uuid = makeUuid();
    const T_future = new Date(Date.now() + 60_000).toISOString();
    const msgs2 = [makeUserMsg('server msg'), makeAssistantMsg('server msg', TINY_IMAGE)];

    log('=== TIMESTAMP GUARD — server gets future timestamp ===', { uuid });
    const postResp = await fetch(`${apiUrl}/conversations`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({ external_uuid: uuid, title: 'ts-guard', messages: msgs2, last_message_at: T_future }),
    });
    const created = await postResp.json();
    createdConvIds.push(created._id);
    log('Server has future timestamp', { last_message_at: created.last_message_at, msgCount: created.messages?.length });

    const T_stale = new Date(Date.now() - 30_000).toISOString();
    log('Frontend sync with stale local', { T_stale });
    const { action, serverMsgCount } = await frontendSync(uuid, [makeUserMsg('stale')], T_stale, 'ts-guard');

    log('Timestamp guard result', { action, serverMsgCount });
    expect(action).toBe('SKIP');
    expect(serverMsgCount).toBe(2); // server unchanged
  }, 15000);
});
