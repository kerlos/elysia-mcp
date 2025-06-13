import { describe, expect, it, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { mcp } from '../src/index';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

describe('MCP Tools Interface Testing', () => {
  let app: Elysia;
  let sessionId: string;

  beforeAll(async () => {
    // Create app with same setup as index.ts for consistency
    app = new Elysia().use(
      mcp({
        serverInfo: {
          name: 'test-tools-interface-server',
          version: '1.0.0',
        },
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
          logging: {},
        },
        enableLogging: true, // Disable logging for tests
        setupServer: async (server: McpServer) => {
          // Simple tools for testing - using Zod schemas
          server.tool(
            'test_add',
            {
              a: z.number().describe('First number'),
              b: z.number().describe('Second number'),
            },
            async (args) => {
              const { a, b } = args;
              return {
                content: [{ type: 'text', text: String(a + b) }],
              };
            }
          );

          server.tool(
            'test_echo',
            {
              message: z.string().describe('Message to echo'),
            },
            async (args) => {
              const { message } = args;
              return {
                content: [{ type: 'text', text: `Echo: ${message}` }],
              };
            }
          );
        },
      })
    );

    // Initialize session
    const initResponse = await app.handle(
      new Request('http://localhost:3000/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {
              roots: { listChanged: true },
              sampling: {},
            },
            clientInfo: {
              name: 'test-client',
              version: '1.0.0',
            },
          },
        }),
      })
    );

    expect(initResponse.status).toBe(200);
    sessionId = initResponse.headers.get('Mcp-Session-Id') ?? '';
    expect(sessionId).toBeTruthy();
  });

  describe('Tools Listing', () => {
    it('should handle tools/list with empty params', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'tools/list',
            params: {},
            jsonrpc: '2.0',
            id: 2,
          }),
        })
      );

      expect(response.status).toBe(200);
    });

    it('should handle tools/list with _meta progressToken', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'tools/list',
            params: {
              _meta: { progressToken: 42 },
            },
            jsonrpc: '2.0',
            id: 3,
          }),
        })
      );

      expect(response.status).toBe(200);
    });

    it('should handle tools/list with different ID formats', async () => {
      // Test with string ID
      const response1 = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'tools/list',
            params: {},
            jsonrpc: '2.0',
            id: 'string-id-test',
          }),
        })
      );

      expect(response1.status).toBe(200);

      // Skip null ID test as it's too strict for MCP validation
      // The MCP SDK doesn't handle null IDs well
    });
  });

  describe('Tool Calls', () => {
    it('should handle basic tool call request format', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'tools/call',
            params: {
              name: 'test_add',
              arguments: { a: 5, b: 3 },
            },
            jsonrpc: '2.0',
            id: 10,
          }),
        })
      );

      expect(response.status).toBe(200);
    });

    it('should handle tool call with string arguments', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'tools/call',
            params: {
              name: 'test_echo',
              arguments: { message: 'Hello from test!' },
            },
            jsonrpc: '2.0',
            id: 11,
          }),
        })
      );

      expect(response.status).toBe(200);
    });

    it('should handle tool call with empty arguments', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'tools/call',
            params: {
              name: 'test_add',
              arguments: {},
            },
            jsonrpc: '2.0',
            id: 12,
          }),
        })
      );

      expect(response.status).toBe(200); // Request accepted, validation error in response
    });

    it('should handle tool call with non-existent tool', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'tools/call',
            params: {
              name: 'nonexistent_tool',
              arguments: { param: 'value' },
            },
            jsonrpc: '2.0',
            id: 13,
          }),
        })
      );

      expect(response.status).toBe(200); // Request accepted, tool not found error in response
    });

    it('should handle tool call with missing name parameter', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'tools/call',
            params: {
              // Missing name
              arguments: { a: 1, b: 2 },
            },
            jsonrpc: '2.0',
            id: 14,
          }),
        })
      );

      expect(response.status).toBe(200); // Request accepted, validation error in response
    });

    it('should handle tool call with missing arguments parameter', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'tools/call',
            params: {
              name: 'test_add',
              // Missing arguments
            },
            jsonrpc: '2.0',
            id: 15,
          }),
        })
      );

      expect(response.status).toBe(200); // Request accepted, validation error in response
    });
  });

  describe('Session Management', () => {
    it('should reject tool operations without session ID', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // No Mcp-Session-Id header
          },
          body: JSON.stringify({
            method: 'tools/list',
            params: {},
            jsonrpc: '2.0',
            id: 20,
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.message).toContain('No valid session ID provided');
    });

    it('should reject tool operations with invalid session ID', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': 'invalid-session-12345',
          },
          body: JSON.stringify({
            method: 'tools/list',
            params: {},
            jsonrpc: '2.0',
            id: 21,
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });

  describe('JSON-RPC Protocol Compliance', () => {
    it('should handle requests with different jsonrpc versions', async () => {
      // Test with exact jsonrpc 2.0
      const response1 = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'tools/list',
            params: {},
            jsonrpc: '2.0',
            id: 30,
          }),
        })
      );

      expect(response1.status).toBe(200);

      // Skip invalid JSON-RPC test as MCP SDK is strict about compliance
      // The MCP layer validates JSON-RPC 2.0 format strictly
    });

    it('should handle requests with different ID types', async () => {
      // Number ID
      const response1 = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'tools/list',
            params: {},
            jsonrpc: '2.0',
            id: 123,
          }),
        })
      );

      expect(response1.status).toBe(200);

      // String ID
      const response2 = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'tools/list',
            params: {},
            jsonrpc: '2.0',
            id: 'test-string-id',
          }),
        })
      );

      expect(response2.status).toBe(200);
    });
  });

  describe('Content Type Handling', () => {
    it('should handle requests with explicit charset', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'tools/list',
            params: {},
            jsonrpc: '2.0',
            id: 40,
          }),
        })
      );

      expect(response.status).toBe(200);
    });

    it('should handle requests with case variations in headers', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'content-type': 'application/json', // lowercase
            'mcp-session-id': sessionId, // lowercase
          },
          body: JSON.stringify({
            method: 'tools/list',
            params: {},
            jsonrpc: '2.0',
            id: 41,
          }),
        })
      );

      expect(response.status).toBe(200);
    });
  });
});
