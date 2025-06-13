import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { mcp } from '../src/index';
import { z } from 'zod';

describe('MCP Plugin', () => {
  let app: Elysia;
  let sessionId: string;

  beforeAll(() => {
    // Create test app with MCP plugin
    app = new Elysia().use(
      mcp({
        serverInfo: {
          name: 'test-mcp-server',
          version: '1.0.0',
        },
        basePath: '/mcp',
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
          logging: {},
        },
        enableLogging: false, // Disable logging for tests
        setupServer: async (server: McpServer) => {
          // Register test tools
          server.tool(
            'greet',
            'A simple greeting tool',
            { name: z.string().describe('Name to greet') },
            async ({ name }): Promise<CallToolResult> => {
              return { content: [{ type: 'text', text: `Hello, ${name}!` }] };
            }
          );

          server.tool(
            'profile',
            'A user profile data tool',
            { active: z.boolean().describe('Profile status') },
            async ({ active }, { authInfo }): Promise<CallToolResult> => {
              return { content: [{ type: 'text', text: `${active ? 'Active' : 'Inactive'} profile from token: ${authInfo?.token}!` }] };
            }
          );
        },
      })
    );
  });

  describe('POST /mcp - Initialization', () => {
    it('should initialize server and generate session ID', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'initialize',
            params: {
              clientInfo: { name: 'test-client', version: '1.0' },
              protocolVersion: '2025-03-26',
              capabilities: {},
            },
            id: 'init-1',
          }),
        })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
      expect(response.headers.get('mcp-session-id')).toBeDefined();
    });

    it('should reject second initialization request', async () => {
      // First initialize
      const initResponse = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'initialize',
            params: {
              clientInfo: { name: 'test-client', version: '1.0' },
              protocolVersion: '2025-03-26',
              capabilities: {},
            },
            id: 'init-1',
          }),
        })
      );

      sessionId = initResponse.headers.get('mcp-session-id') ?? '';

      // Try second initialize
      const secondInitResponse = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'initialize',
            params: {
              clientInfo: { name: 'test-client', version: '1.0' },
              protocolVersion: '2025-03-26',
              capabilities: {},
            },
            id: 'second-init',
          }),
        })
      );

      expect(secondInitResponse.status).toBe(400);
      const errorData = await secondInitResponse.json();
      expect(errorData).toMatchObject({
        jsonrpc: '2.0',
        error: expect.objectContaining({
          code: -32600,
          message: expect.stringMatching(/Server already initialized/),
        }),
      });
    });

    it('should reject batch initialize request', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
          },
          body: JSON.stringify([
            {
              jsonrpc: '2.0',
              method: 'initialize',
              params: {
                clientInfo: { name: 'test-client', version: '1.0' },
                protocolVersion: '2025-03-26',
                capabilities: {},
              },
              id: 'init-1',
            },
            {
              jsonrpc: '2.0',
              method: 'initialize',
              params: {
                clientInfo: { name: 'test-client-2', version: '1.0' },
                protocolVersion: '2025-03-26',
                capabilities: {},
              },
              id: 'init-2',
            },
          ]),
        })
      );

      expect(response.status).toBe(400);
      const errorData = await response.json();
      expect(errorData).toMatchObject({
        jsonrpc: '2.0',
        error: expect.objectContaining({
          code: -32600,
          message: expect.stringMatching(/Only one initialization request is allowed/),
        }),
      });
    });
  });

  describe('POST /mcp - Tools Operations', () => {
    it('should handle post requests via sse response correctly', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'mcp-session-id': sessionId,
            'mcp-protocol-version': '2025-03-26',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/list',
            params: {},
            id: 'tools-1',
          }),
        })
      );

      expect(response.status).toBe(200);
      const text = await response.text();
      const eventLines = text.split('\n');
      const dataLine = eventLines.find(line => line.startsWith('data:')) ?? '';
      expect(dataLine).toBeDefined();

      const eventData = JSON.parse(dataLine.substring(5));
      expect(eventData).toMatchObject({
        jsonrpc: '2.0',
        result: expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({
              name: 'greet',
              description: 'A simple greeting tool',
            }),
          ]),
        }),
        id: 'tools-1',
      });
    });

    it('should call a tool and return the result', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'mcp-session-id': sessionId,
            'mcp-protocol-version': '2025-03-26',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'greet',
              arguments: {
                name: 'Test User',
              },
            },
            id: 'call-1',
          }),
        })
      );

      expect(response.status).toBe(200);
      const text = await response.text();
      const eventLines = text.split('\n');
      const dataLine = eventLines.find(line => line.startsWith('data:')) ?? '';
      expect(dataLine).toBeDefined();

      const eventData = JSON.parse(dataLine.substring(5));
      expect(eventData).toMatchObject({
        jsonrpc: '2.0',
        result: {
          content: [
            {
              type: 'text',
              text: 'Hello, Test User!',
            },
          ],
        },
        id: 'call-1',
      });
    });

    it('should reject requests without a valid session ID', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/list',
            params: {},
            id: 'tools-1',
          }),
        })
      );

      expect(response.status).toBe(400);
      const errorData = await response.json();
      expect(errorData).toMatchObject({
        jsonrpc: '2.0',
        error: expect.objectContaining({
          code: -32000,
          message: expect.stringMatching(/Bad Request/),
        }),
        id: null,
      });
    });

    it('should reject invalid session ID', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'mcp-session-id': 'invalid-session-id',
            'mcp-protocol-version': '2025-03-26',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/list',
            params: {},
            id: 'tools-1',
          }),
        })
      );

      expect(response.status).toBe(404);
      const errorData = await response.json();
      expect(errorData).toMatchObject({
        jsonrpc: '2.0',
        error: expect.objectContaining({
          code: -32001,
          message: expect.stringMatching(/Session not found/),
        }),
      });
    });
  });

  describe('GET /mcp - SSE Streaming', () => {
    it('should establish standalone SSE stream and receive server-initiated messages', async () => {
      const sseResponse = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream',
            'mcp-session-id': sessionId,
            'mcp-protocol-version': '2025-03-26',
          },
        })
      );

      expect(sseResponse.status).toBe(200);
      expect(sseResponse.headers.get('content-type')).toBe('text/event-stream');

      // Send a notification (server-initiated message) that should appear on SSE stream
      const notification = {
        jsonrpc: '2.0',
        method: 'notifications/message',
        params: { level: 'info', data: 'Test notification' },
      };

      // Send the notification via transport
      await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'mcp-session-id': sessionId,
            'mcp-protocol-version': '2025-03-26',
          },
          body: JSON.stringify(notification),
        })
      );

      // Read from the stream and verify we got the notification
      const text = await sseResponse.text();
      const eventLines = text.split('\n');
      const dataLine = eventLines.find(line => line.startsWith('data:')) ?? '';
      expect(dataLine).toBeDefined();

      const eventData = JSON.parse(dataLine.substring(5));
      expect(eventData).toMatchObject({
        jsonrpc: '2.0',
        method: 'notifications/message',
        params: { level: 'info', data: 'Test notification' },
      });
    });

    it('should reject second SSE stream for the same session', async () => {
      // Open first SSE stream
      const firstStream = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream',
            'mcp-session-id': sessionId,
            'mcp-protocol-version': '2025-03-26',
          },
        })
      );

      expect(firstStream.status).toBe(200);

      // Try to open a second SSE stream with the same session ID
      const secondStream = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream',
            'mcp-session-id': sessionId,
            'mcp-protocol-version': '2025-03-26',
          },
        })
      );

      // Should be rejected
      expect(secondStream.status).toBe(409); // Conflict
      const errorData = await secondStream.json();
      expect(errorData).toMatchObject({
        jsonrpc: '2.0',
        error: expect.objectContaining({
          code: -32000,
          message: expect.stringMatching(/Only one SSE stream is allowed per session/),
        }),
      });
    });

    it('should reject GET requests without Accept: text/event-stream header', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'mcp-session-id': sessionId,
            'mcp-protocol-version': '2025-03-26',
          },
        })
      );

      expect(response.status).toBe(406);
      const errorData = await response.json();
      expect(errorData).toMatchObject({
        jsonrpc: '2.0',
        error: expect.objectContaining({
          code: -32000,
          message: expect.stringMatching(/Client must accept text\/event-stream/),
        }),
      });
    });
  });

  describe('DELETE /mcp - Session Termination', () => {
    it('should properly handle DELETE requests and close session', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'DELETE',
          headers: {
            'mcp-session-id': sessionId,
            'mcp-protocol-version': '2025-03-26',
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({
        jsonrpc: '2.0',
        id: 0,
        result: {
          success: true,
          message: 'Session terminated',
        },
      });
    });

    it('should reject DELETE requests with invalid session ID', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'DELETE',
          headers: {
            'mcp-session-id': 'invalid-session-id',
            'mcp-protocol-version': '2025-03-26',
          },
        })
      );

      expect(response.status).toBe(404);
      const errorData = await response.json();
      expect(errorData).toMatchObject({
        jsonrpc: '2.0',
        error: expect.objectContaining({
          code: -32001,
          message: expect.stringMatching(/Session not found/),
        }),
      });
    });
  });

  describe('Protocol Version Header Validation', () => {
    it('should accept requests with matching protocol version', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'mcp-session-id': sessionId,
            'mcp-protocol-version': '2025-03-26',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/list',
            params: {},
            id: 'tools-1',
          }),
        })
      );

      expect(response.status).toBe(200);
    });

    it('should accept requests without protocol version header', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'mcp-session-id': sessionId,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/list',
            params: {},
            id: 'tools-1',
          }),
        })
      );

      expect(response.status).toBe(200);
    });

    it('should reject requests with unsupported protocol version', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'mcp-session-id': sessionId,
            'mcp-protocol-version': '1999-01-01', // Unsupported version
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/list',
            params: {},
            id: 'tools-1',
          }),
        })
      );

      expect(response.status).toBe(400);
      const errorData = await response.json();
      expect(errorData).toMatchObject({
        jsonrpc: '2.0',
        error: expect.objectContaining({
          code: -32000,
          message: expect.stringMatching(/Bad Request: Unsupported protocol version/),
        }),
      });
    });
  });

  describe('Auth Info Handling', () => {
    it('should call a tool with authInfo', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'mcp-session-id': sessionId,
            'mcp-protocol-version': '2025-03-26',
            'authorization': 'Bearer test-token',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'profile',
              arguments: { active: true },
            },
            id: 'call-1',
          }),
        })
      );

      expect(response.status).toBe(200);
      const text = await response.text();
      const eventLines = text.split('\n');
      const dataLine = eventLines.find(line => line.startsWith('data:')) ?? '';
      expect(dataLine).toBeDefined();

      const eventData = JSON.parse(dataLine.substring(5));
      expect(eventData).toMatchObject({
        jsonrpc: '2.0',
        result: {
          content: [
            {
              type: 'text',
              text: 'Active profile from token: test-token!',
            },
          ],
        },
        id: 'call-1',
      });
    });

    it('should call tool without authInfo when it is optional', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'mcp-session-id': sessionId,
            'mcp-protocol-version': '2025-03-26',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'profile',
              arguments: { active: false },
            },
            id: 'call-1',
          }),
        })
      );

      expect(response.status).toBe(200);
      const text = await response.text();
      const eventLines = text.split('\n');
      const dataLine = eventLines.find(line => line.startsWith('data:')) ?? '';
      expect(dataLine).toBeDefined();

      const eventData = JSON.parse(dataLine.substring(5));
      expect(eventData).toMatchObject({
        jsonrpc: '2.0',
        result: {
          content: [
            {
              type: 'text',
              text: 'Inactive profile from token: undefined!',
            },
          ],
        },
        id: 'call-1',
      });
    });
  });
});
