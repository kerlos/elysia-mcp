import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mcp } from '../src/mcp-plugin';
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
            'add',
            {
              a: z.number().describe('First number'),
              b: z.number().describe('Second number'),
            },
            async (args) => {
              const { a, b } = args as { a: number; b: number };
              if (typeof a !== 'number' || typeof b !== 'number') {
                throw new Error('Both a and b must be numbers');
              }
              return {
                content: [{ type: 'text', text: String(a + b) }],
              };
            }
          );

          server.tool(
            'echo',
            {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  minLength: 1,
                  description: 'Text to echo back',
                },
              },
              required: ['text'],
            },
            async (args) => {
              const { text } = args as { text: string };
              if (!text || typeof text !== 'string') {
                throw new Error(
                  'Text is required and must be a non-empty string'
                );
              }
              return {
                content: [{ type: 'text', text: `Echo: ${text}` }],
              };
            }
          );

          server.tool(
            'get_time',
            {
              type: 'object',
              properties: {},
              required: [],
            },
            async () => {
              return {
                content: [{ type: 'text', text: new Date().toISOString() }],
              };
            }
          );
        },
      })
    );
  });

  describe('POST /mcp - Initialization', () => {
    it('should reject requests without proper initialize method', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'invalid',
            params: {},
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.message).toContain('No valid session ID provided');
    });

    it('should successfully initialize MCP session with proper clientInfo', async () => {
      const response = await app.handle(
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

      expect(response.status).toBe(202);
      expect(response.headers.get('Mcp-Session-Id')).toBeTruthy();

      // Store session ID for later tests
      sessionId = response.headers.get('Mcp-Session-Id') ?? '';
      expect(sessionId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });

    it('should reject initialization without clientInfo', async () => {
      const response = await app.handle(
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
              // Missing clientInfo
            },
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.message).toContain('No valid session ID provided');
    });
  });

  describe('POST /mcp - Tools Operations', () => {
    it('should handle tools/list request', async () => {
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
              _meta: { progressToken: 3 },
            },
            jsonrpc: '2.0',
            id: 3,
          }),
        })
      );

      expect(response.status).toBe(202); // Accepted, response will be in SSE
    });

    it('should handle tools/call request for add tool', async () => {
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
              name: 'add',
              arguments: { a: 5, b: 3 },
            },
            jsonrpc: '2.0',
            id: 4,
          }),
        })
      );

      expect(response.status).toBe(202); // Accepted, response will be in SSE
    });

    it('should handle tools/call request for echo tool', async () => {
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
              name: 'echo',
              arguments: { text: 'Hello, World!' },
            },
            jsonrpc: '2.0',
            id: 5,
          }),
        })
      );

      expect(response.status).toBe(202); // Accepted, response will be in SSE
    });

    it('should handle tools/call request for get_time tool', async () => {
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
              name: 'get_time',
              arguments: {},
            },
            jsonrpc: '2.0',
            id: 6,
          }),
        })
      );

      expect(response.status).toBe(202); // Accepted, response will be in SSE
    });

    it('should reject requests with invalid session ID', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': 'invalid-session-id',
          },
          body: JSON.stringify({
            method: 'tools/list',
            params: {},
            jsonrpc: '2.0',
            id: 7,
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    it('should reject requests without session ID for non-initialize methods', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            method: 'tools/list',
            params: {},
            jsonrpc: '2.0',
            id: 8,
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.message).toContain('No valid session ID provided');
    });
  });

  describe('GET /mcp - SSE Streaming', () => {
    it('should return SSE stream for valid session', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            'Mcp-Session-Id': sessionId,
          },
        })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain(
        'text/event-stream'
      );
      expect(response.headers.get('Cache-Control')).toContain('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');
    });

    it('should reject SSE requests without session ID', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
          },
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Invalid or missing session ID');
    });

    it('should reject SSE requests with invalid session ID', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            'Mcp-Session-Id': 'invalid-session-id',
          },
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Invalid or missing session ID');
    });
  });

  describe('DELETE /mcp - Session Termination', () => {
    it('should terminate session successfully', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'DELETE',
          headers: {
            'Mcp-Session-Id': sessionId,
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

    it('should reject termination requests without session ID', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'DELETE',
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Invalid or missing session ID');
    });

    it('should reject termination requests with invalid session ID', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'DELETE',
          headers: {
            'Mcp-Session-Id': 'invalid-session-id',
          },
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Invalid or missing session ID');
    });
  });

  describe('HTTP Method Validation', () => {
    it('should reject unsupported HTTP methods', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(405);
      const body = await response.json();
      expect(body.error.message).toBe('Method not allowed');
    });

    it('should handle PATCH method as unsupported', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(405);
      const body = await response.json();
      expect(body.error.message).toBe('Method not allowed');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON in POST requests', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: 'invalid json',
        })
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.jsonrpc).toBe('2.0');
    });

    it('should handle missing Content-Type header', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {},
          }),
        })
      );

      // Should still work, as Elysia can handle JSON without explicit Content-Type
      expect([400, 500, 202]).toContain(response.status);
    });
  });

  describe('Custom BasePath Configuration', () => {
    let customApp: Elysia;
    let customSessionId: string;

    beforeAll(() => {
      // Create test app with custom basePath
      customApp = new Elysia().use(
        mcp({
          basePath: '/other-path',
          serverInfo: {
            name: 'test-custom-path-server',
            version: '1.0.0',
          },
          capabilities: {
            resources: {},
            tools: {},
            prompts: {},
            logging: {},
          },
          enableLogging: false,
          setupServer: async (server: McpServer) => {
            // Register test tools for custom path testing
            server.tool(
              'add',
              {
                a: z.number().describe('First number'),
                b: z.number().describe('Second number'),
              },
              async (args) => {
                const { a, b } = args as { a: number; b: number };
                return {
                  content: [{ type: 'text', text: String(a + b) }],
                };
              }
            );

            server.tool(
              'echo',
              {
                type: 'object',
                properties: {
                  text: {
                    type: 'string',
                    minLength: 1,
                    description: 'Text to echo back',
                  },
                },
                required: ['text'],
              },
              async (args) => {
                const { text } = args as { text: string };
                return {
                  content: [{ type: 'text', text: `Echo: ${text}` }],
                };
              }
            );
          },
        })
      );
    });

    it('should initialize MCP session with custom basePath', async () => {
      const response = await customApp.handle(
        new Request('http://localhost:3000/other-path', {
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
                name: 'test-custom-path-client',
                version: '1.0.0',
              },
            },
          }),
        })
      );

      expect(response.status).toBe(202);
      expect(response.headers.get('Mcp-Session-Id')).toBeTruthy();

      // Store session ID for later tests
      customSessionId = response.headers.get('Mcp-Session-Id') ?? '';
      expect(customSessionId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });

    it('should handle tools/list request with custom basePath', async () => {
      const response = await customApp.handle(
        new Request('http://localhost:3000/other-path', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': customSessionId,
          },
          body: JSON.stringify({
            method: 'tools/list',
            params: {
              _meta: { progressToken: 3 },
            },
            jsonrpc: '2.0',
            id: 3,
          }),
        })
      );

      expect(response.status).toBe(202); // Accepted, response will be in SSE
    });

    it('should handle tools/call request with custom basePath', async () => {
      const response = await customApp.handle(
        new Request('http://localhost:3000/other-path', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': customSessionId,
          },
          body: JSON.stringify({
            method: 'tools/call',
            params: {
              name: 'add',
              arguments: { a: 10, b: 5 },
            },
            jsonrpc: '2.0',
            id: 4,
          }),
        })
      );

      expect(response.status).toBe(202); // Accepted, response will be in SSE
    });

    it('should handle echo tool call with custom basePath', async () => {
      const response = await customApp.handle(
        new Request('http://localhost:3000/other-path', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': customSessionId,
          },
          body: JSON.stringify({
            method: 'tools/call',
            params: {
              name: 'echo',
              arguments: { text: 'Custom path test!' },
            },
            jsonrpc: '2.0',
            id: 5,
          }),
        })
      );

      expect(response.status).toBe(202); // Accepted, response will be in SSE
    });

    it('should return SSE stream for custom basePath', async () => {
      const response = await customApp.handle(
        new Request('http://localhost:3000/other-path', {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            'Mcp-Session-Id': customSessionId,
          },
        })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain(
        'text/event-stream'
      );
      expect(response.headers.get('Cache-Control')).toContain('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');
    });

    it('should terminate session with custom basePath', async () => {
      const response = await customApp.handle(
        new Request('http://localhost:3000/other-path', {
          method: 'DELETE',
          headers: {
            'Mcp-Session-Id': customSessionId,
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

    it('should reject requests to default path when using custom basePath', async () => {
      const response = await customApp.handle(
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

      expect(response.status).toBe(404); // Not found because custom app only handles /other-path
    });

    it('should test specialized endpoints with custom basePath', async () => {
      // Test that specialized endpoints are properly registered by checking they return a valid response (not 404)
      // Even if they return 400 for missing session, it means the endpoint exists

      // Test tools endpoint - should exist and respond (even with error is ok)
      const toolsResponse = await customApp.handle(
        new Request('http://localhost:3000/other-path/tools', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            method: 'tools/list',
            params: {},
            jsonrpc: '2.0',
            id: 10,
          }),
        })
      );

      // Should not be 404 (endpoint exists) and not 405 (method is allowed)
      expect(toolsResponse.status).toBeGreaterThanOrEqual(200);
      expect(toolsResponse.status).not.toBe(404);
      expect(toolsResponse.status).not.toBe(405);

      // Test resources endpoint
      const resourcesResponse = await customApp.handle(
        new Request('http://localhost:3000/other-path/resources', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            method: 'resources/list',
            params: {},
            jsonrpc: '2.0',
            id: 11,
          }),
        })
      );

      // Should not be 404 (endpoint exists) and not 405 (method is allowed)
      expect(resourcesResponse.status).toBeGreaterThanOrEqual(200);
      expect(resourcesResponse.status).not.toBe(404);
      expect(resourcesResponse.status).not.toBe(405);

      // Test prompts endpoint
      const promptsResponse = await customApp.handle(
        new Request('http://localhost:3000/other-path/prompts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            method: 'prompts/list',
            params: {},
            jsonrpc: '2.0',
            id: 12,
          }),
        })
      );

      // Should not be 404 (endpoint exists) and not 405 (method is allowed)
      expect(promptsResponse.status).toBeGreaterThanOrEqual(200);
      expect(promptsResponse.status).not.toBe(404);
      expect(promptsResponse.status).not.toBe(405);
    });
  });
});
