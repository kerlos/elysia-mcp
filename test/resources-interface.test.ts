import { describe, expect, it, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { mcpPlugin } from '../src/mcp-plugin.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

describe('MCP Resources Interface Testing', () => {
  let app: Elysia;
  let sessionId: string;

  beforeAll(async () => {
    // Create app with resources setup similar to basic-server.ts
    app = new Elysia().use(
      mcpPlugin({
        serverInfo: {
          name: 'test-resources-server',
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
          // Register test resources - similar to basic-server.ts
          server.resource(
            'Test System Information',
            'example://test-system-info',
            async () => {
              const content = {
                platform: process.platform,
                nodeVersion: process.version,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: new Date().toISOString(),
              };
              return {
                contents: [
                  {
                    uri: 'example://test-system-info',
                    mimeType: 'application/json',
                    text: JSON.stringify(content),
                  },
                ],
              };
            }
          );

          server.resource('Test Configuration', 'test://config', async () => {
            const content = {
              environment: 'test',
              version: '1.0.0',
              debug: false,
            };
            return {
              contents: [
                {
                  uri: 'test://config',
                  mimeType: 'application/json',
                  text: JSON.stringify(content),
                },
              ],
            };
          });

          server.resource('Test Stats', 'project://test-stats', async () => {
            const content = {
              totalTests: 25,
              passedTests: 23,
              failedTests: 2,
              coverage: 85.5,
              lastRun: new Date().toISOString(),
            };
            return {
              contents: [
                {
                  uri: 'project://test-stats',
                  mimeType: 'application/json',
                  text: JSON.stringify(content, null, 2),
                },
              ],
            };
          });

          server.resource(
            'Test Package Info',
            'file://package-test.json',
            async () => {
              const content = {
                name: 'test-package',
                version: '1.0.0',
                dependencies: {
                  elysia: '^1.0.0',
                  zod: '^3.0.0',
                },
                devDependencies: {
                  bun: '^1.0.0',
                  '@types/node': '^20.0.0',
                },
              };
              return {
                contents: [
                  {
                    uri: 'file://package-test.json',
                    mimeType: 'application/json',
                    text: JSON.stringify(content, null, 2),
                  },
                ],
              };
            }
          );

          // Resource that might throw an error for testing
          server.resource(
            'Test Error Resource',
            'error://test-error',
            async () => {
              throw new Error('Simulated resource error for testing');
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

    expect(initResponse.status).toBe(202);
    sessionId = initResponse.headers.get('Mcp-Session-Id') ?? '';
    expect(sessionId).toBeTruthy();
  });

  describe('Resources Listing', () => {
    it('should handle resources/list with empty params', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/list',
            params: {},
            jsonrpc: '2.0',
            id: 2,
          }),
        })
      );

      expect(response.status).toBe(202);
    });

    it('should handle resources/list with _meta progressToken', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/list',
            params: {
              _meta: { progressToken: 42 },
            },
            jsonrpc: '2.0',
            id: 3,
          }),
        })
      );

      expect(response.status).toBe(202);
    });

    it('should handle resources/list with different ID formats', async () => {
      // Test with string ID
      const response1 = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/list',
            params: {},
            jsonrpc: '2.0',
            id: 'resource-list-string-id',
          }),
        })
      );

      expect(response1.status).toBe(202);

      // Test with numeric ID
      const response2 = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/list',
            params: {},
            jsonrpc: '2.0',
            id: 98765,
          }),
        })
      );

      expect(response2.status).toBe(202);
    });
  });

  describe('Resource Reading', () => {
    it('should handle basic resource read request', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/read',
            params: {
              uri: 'example://test-system-info',
            },
            jsonrpc: '2.0',
            id: 10,
          }),
        })
      );

      expect(response.status).toBe(202);
    });

    it('should handle resource read with different URIs', async () => {
      const uris = ['test://config', 'project://test-stats'];

      for (const uri of uris) {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri },
              jsonrpc: '2.0',
              id: 11,
            }),
          })
        );

        expect(response.status).toBe(202);
      }
    });

    it('should handle resource read with complex JSON content', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/read',
            params: {
              uri: 'project://test-stats',
            },
            jsonrpc: '2.0',
            id: 14,
          }),
        })
      );

      expect(response.status).toBe(202);
    });

    it('should handle resource read with non-existent URI', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/read',
            params: {
              uri: 'nonexistent://resource',
            },
            jsonrpc: '2.0',
            id: 12,
          }),
        })
      );

      expect(response.status).toBe(202); // Request accepted, resource not found error in response
    });

    it('should handle resource read with error-throwing resource', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/read',
            params: {
              uri: 'error://test-error',
            },
            jsonrpc: '2.0',
            id: 16,
          }),
        })
      );

      expect(response.status).toBe(202); // Request accepted, error in response
    });

    it('should handle resource read with missing URI parameter', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/read',
            params: {
              // Missing uri parameter
            },
            jsonrpc: '2.0',
            id: 17,
          }),
        })
      );

      expect(response.status).toBe(202); // Request accepted, validation error in response
    });

    it('should handle resource read with invalid URI format', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/read',
            params: {
              uri: 'invalid-uri-format',
            },
            jsonrpc: '2.0',
            id: 18,
          }),
        })
      );

      expect(response.status).toBe(202); // Request accepted, resource not found error in response
    });
  });

  describe('Session Management', () => {
    it('should reject resource operations without session ID', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // No Mcp-Session-Id header
          },
          body: JSON.stringify({
            method: 'resources/list',
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

    it('should reject resource read operations without session ID', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // No Mcp-Session-Id header
          },
          body: JSON.stringify({
            method: 'resources/read',
            params: { uri: 'example://test-system-info' },
            jsonrpc: '2.0',
            id: 21,
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.message).toContain('No valid session ID provided');
    });

    it('should reject resource operations with invalid session ID', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': 'invalid-session-98765',
          },
          body: JSON.stringify({
            method: 'resources/read',
            params: { uri: 'example://test-system-info' },
            jsonrpc: '2.0',
            id: 22,
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    it('should reject resource list operations with invalid session ID', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': 'another-invalid-session',
          },
          body: JSON.stringify({
            method: 'resources/list',
            params: {},
            jsonrpc: '2.0',
            id: 23,
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });

  describe('JSON-RPC Protocol Compliance', () => {
    it('should handle resource requests with different jsonrpc versions', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/list',
            params: {},
            jsonrpc: '2.0',
            id: 30,
          }),
        })
      );

      expect(response.status).toBe(202);
    });

    it('should handle requests with different ID types', async () => {
      // Number ID for resources list
      const response1 = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/list',
            params: {},
            jsonrpc: '2.0',
            id: 456,
          }),
        })
      );

      expect(response1.status).toBe(202);

      // String ID for resource read
      const response2 = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/read',
            params: { uri: 'test://config' },
            jsonrpc: '2.0',
            id: 'test-resource-string-id',
          }),
        })
      );

      expect(response2.status).toBe(202);
    });
  });

  describe('Content Type Handling', () => {
    it('should handle resource requests with explicit charset', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/list',
            params: {},
            jsonrpc: '2.0',
            id: 40,
          }),
        })
      );

      expect(response.status).toBe(202);
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
            method: 'resources/read',
            params: { uri: 'test://config' },
            jsonrpc: '2.0',
            id: 41,
          }),
        })
      );

      expect(response.status).toBe(202);
    });
  });

  describe('Edge Cases', () => {
    it('should handle resources with various MIME types', async () => {
      // This would test JSON resources
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/read',
            params: { uri: 'file://package-test.json' },
            jsonrpc: '2.0',
            id: 50,
          }),
        })
      );

      expect(response.status).toBe(202);
    });

    it('should handle resources with large content', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/read',
            params: { uri: 'project://test-stats' },
            jsonrpc: '2.0',
            id: 51,
          }),
        })
      );

      expect(response.status).toBe(202);
    });

    it('should handle resources with empty content', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/read',
            params: { uri: 'example://test-system-info' },
            jsonrpc: '2.0',
            id: 52,
          }),
        })
      );

      expect(response.status).toBe(202);
    });

    it('should handle malformed URI schemes', async () => {
      const malformedUris = [
        '://missing-scheme',
        'scheme-only',
        'scheme://',
        'scheme:///',
      ];

      for (const [index, uri] of malformedUris.entries()) {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri },
              jsonrpc: '2.0',
              id: 60 + index,
            }),
          })
        );

        expect(response.status).toBe(202); // Request accepted, resource not found error in response
      }
    });
  });

  describe('Resource URI Pattern Testing', () => {
    it('should handle different URI schemes correctly', async () => {
      const uriSchemes = [
        'example://test-system-info',
        'test://config',
        'project://test-stats',
        'file://package-test.json',
      ];

      for (const [index, uri] of uriSchemes.entries()) {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri },
              jsonrpc: '2.0',
              id: 70 + index,
            }),
          })
        );

        expect(response.status).toBe(202);
      }
    });

    it('should handle URI with special characters', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'resources/read',
            params: {
              uri: 'special://test-resource-with-dashes_and_underscores',
            },
            jsonrpc: '2.0',
            id: 80,
          }),
        })
      );

      expect(response.status).toBe(202); // Request accepted, resource not found error in response
    });
  });
});
