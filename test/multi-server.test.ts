import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { beforeEach, describe, expect, it } from 'bun:test';
import {
  createMultipleServer,
  readSSEEvent,
  TEST_MESSAGES,
  type TestServer,
} from './test-utils';

async function sendPostRequest(
  server: TestServer,
  path: string,
  message: JSONRPCMessage | JSONRPCMessage[],
  sessionId?: string,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    ...extraHeaders,
  };

  if (sessionId) {
    headers['mcp-session-id'] = sessionId;
    // After initialization, include the protocol version header
    headers['mcp-protocol-version'] = '2025-03-26';
  }

  return await server.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
    })
  );
}

describe('Multi-Server Tests', () => {
  let server: TestServer;

  async function initializeServer(path: string): Promise<string> {
    const response = await sendPostRequest(
      server,
      path,
      TEST_MESSAGES.initialize
    );

    expect(response.status).toBe(200);
    const newSessionId = response.headers.get('mcp-session-id');
    expect(newSessionId).toBeDefined();
    return newSessionId as string;
  }

  beforeEach(async () => {
    server = await createMultipleServer();
  });

  it('should initialize successfully', async () => {
    const mathSessionId = await initializeServer('/math');
    expect(mathSessionId).toBeDefined();
    const textSessionId = await initializeServer('/text');
    expect(textSessionId).toBeDefined();
  });

  it('should list math tools successfully on path math', async () => {
    const mathSessionId = await initializeServer('/math');
    expect(mathSessionId).toBeDefined();

    const response = await sendPostRequest(
      server,
      '/math',
      TEST_MESSAGES.toolsList,
      mathSessionId
    );
    expect(response.status).toBe(200);

    const text = await readSSEEvent(response);
    expect(text).toContain('"tools"');
    expect(text).toContain('"add"');
    expect(text).toContain('"multiply"');
    expect(text).toContain('"power"');
  });

  it('should list text tools successfully on path text', async () => {
    const textSessionId = await initializeServer('/text');
    expect(textSessionId).toBeDefined();

    const response = await sendPostRequest(
      server,
      '/text',
      TEST_MESSAGES.toolsList,
      textSessionId
    );

    expect(response.status).toBe(200);
    const text = await readSSEEvent(response);
    expect(text).toContain('"tools"');
    expect(text).toContain('"uppercase"');
    expect(text).toContain('"word_count"');
    expect(text).toContain('"reverse"');
    expect(text).toContain('"replace"');
  });

  // Add more test cases here
});
