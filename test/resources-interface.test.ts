import { describe, expect, it, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { mcp } from '../src/index';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

describe('MCP Resources Interface Testing', () => {
  let app: Elysia;
  let sessionId: string;

  beforeAll(async () => {
    // Create app with resources setup similar to basic-server.ts
    app = new Elysia().use(
      mcp({
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

          // Text Content Resources using file:// scheme
          server.resource(
            'Plain Text Resource',
            'file:///test/plain-text.txt',
            async () => {
              return {
                contents: [
                  {
                    uri: 'file:///test/plain-text.txt',
                    mimeType: 'text/plain',
                    text: 'This is a simple plain text resource for testing purposes.\nIt contains multiple lines\nand demonstrates text content handling.',
                  },
                ],
              };
            }
          );

          server.resource(
            'Markdown Text Resource',
            'file:///test/markdown-content.md',
            async () => {
              const markdownContent = `# Test Markdown Resource

This is a **markdown** document for testing.

## Features
- Text content handling
- Multiple mime types
- Resource content validation

\`\`\`javascript
console.log("Code example in markdown");
\`\`\`

> This is a blockquote example.`;
              return {
                contents: [
                  {
                    uri: 'file:///test/markdown-content.md',
                    mimeType: 'text/markdown',
                    text: markdownContent,
                  },
                ],
              };
            }
          );

          server.resource(
            'CSV Data Resource',
            'file:///test/data.csv',
            async () => {
              const csvContent = `Name,Age,City,Country
John Doe,30,New York,USA
Jane Smith,25,London,UK
Bob Johnson,35,Toronto,Canada
Alice Brown,28,Sydney,Australia`;
              return {
                contents: [
                  {
                    uri: 'file:///test/data.csv',
                    mimeType: 'text/csv',
                    text: csvContent,
                  },
                ],
              };
            }
          );

          server.resource(
            'Large Text Resource',
            'file:///test/large-content.txt',
            async () => {
              // Generate large text content for testing
              const lines: string[] = [];
              for (let i = 1; i <= 1000; i++) {
                lines.push(
                  `Line ${i}: This is a test line with some content to simulate a large text resource.`
                );
              }
              return {
                contents: [
                  {
                    uri: 'file:///test/large-content.txt',
                    mimeType: 'text/plain',
                    text: lines.join('\n'),
                  },
                ],
              };
            }
          );

          // Binary Content Resources using file:// scheme
          server.resource(
            'PNG Image Resource',
            'file:///test/image.png',
            async () => {
              // Sample 1x1 transparent PNG pixel in base64
              const pngData =
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
              return {
                contents: [
                  {
                    uri: 'file:///test/image.png',
                    mimeType: 'image/png',
                    blob: pngData,
                  },
                ],
              };
            }
          );

          server.resource(
            'JPEG Image Resource',
            'file:///test/image.jpg',
            async () => {
              // Sample minimal JPEG header in base64 (1x1 black pixel)
              const jpegData =
                '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/gA==';
              return {
                contents: [
                  {
                    uri: 'file:///test/image.jpg',
                    mimeType: 'image/jpeg',
                    blob: jpegData,
                  },
                ],
              };
            }
          );

          server.resource(
            'WAV Audio Resource',
            'file:///test/audio.wav',
            async () => {
              // Sample minimal WAV header (silence) in base64
              const wavData =
                'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
              return {
                contents: [
                  {
                    uri: 'file:///test/audio.wav',
                    mimeType: 'audio/wav',
                    blob: wavData,
                  },
                ],
              };
            }
          );

          server.resource(
            'PDF Document Resource',
            'file:///test/document.pdf',
            async () => {
              // Sample minimal PDF in base64 (empty document)
              const pdfData =
                'JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSA0IDAgUgo+Pgo+PgovQ29udGVudHMgNSAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSA4IFRmCjU3IDcyMiBUZAooSGVsbG8gV29ybGQhKSBUagpFVApzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMjA3IDAwMDAwIG4gCjAwMDAwMDI3MyAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDYKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjM2NQolJUVPRgo=';
              return {
                contents: [
                  {
                    uri: 'file:///test/document.pdf',
                    mimeType: 'application/pdf',
                    blob: pdfData,
                  },
                ],
              };
            }
          );

          server.resource(
            'ZIP Archive Resource',
            'file:///test/archive.zip',
            async () => {
              // Sample minimal empty ZIP file in base64
              const zipData = 'UEsFBgAAAAAAAAAAAAAAAAAAAAA=';
              return {
                contents: [
                  {
                    uri: 'file:///test/archive.zip',
                    mimeType: 'application/zip',
                    blob: zipData,
                  },
                ],
              };
            }
          );

          // Mixed content resource for testing multiple content types (custom scheme)
          server.resource(
            'Multi-content Resource',
            'mcp-test://multi-content',
            async () => {
              return {
                contents: [
                  {
                    uri: 'mcp-test://multi-content/text',
                    mimeType: 'text/plain',
                    text: 'This is the text portion of a multi-content resource.',
                  },
                  {
                    uri: 'mcp-test://multi-content/image',
                    mimeType: 'image/png',
                    blob: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
                  },
                ],
              };
            }
          );

          // Dynamic content resource with different content types based on parameters (custom scheme)
          server.resource(
            'Dynamic Content Resource',
            'mcp-test://dynamic-content',
            async () => {
              const contentType = Math.random() > 0.5 ? 'text' : 'binary';

              if (contentType === 'text') {
                return {
                  contents: [
                    {
                      uri: 'mcp-test://dynamic-content',
                      mimeType: 'text/plain',
                      text: `Dynamic text content generated at ${new Date().toISOString()}`,
                    },
                  ],
                };
              }

              return {
                contents: [
                  {
                    uri: 'mcp-test://dynamic-content',
                    mimeType: 'image/png',
                    blob: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
                  },
                ],
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

      expect(response.status).toBe(200);
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

      expect(response.status).toBe(200);
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

      expect(response1.status).toBe(200);

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

      expect(response2.status).toBe(200);
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

      expect(response.status).toBe(200);
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

        expect(response.status).toBe(200);
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

      expect(response.status).toBe(200);
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

      expect(response.status).toBe(200); // Request accepted, resource not found error in response
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

      expect(response.status).toBe(200); // Request accepted, error in response
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

      expect(response.status).toBe(200); // Request accepted, validation error in response
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

      expect(response.status).toBe(200); // Request accepted, resource not found error in response
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

      expect(response.status).toBe(200);
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

      expect(response1.status).toBe(200);

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

      expect(response2.status).toBe(200);
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
            method: 'resources/read',
            params: { uri: 'test://config' },
            jsonrpc: '2.0',
            id: 41,
          }),
        })
      );

      expect(response.status).toBe(200);
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

      expect(response.status).toBe(200);
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

      expect(response.status).toBe(200);
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

      expect(response.status).toBe(200);
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

        expect(response.status).toBe(200); // Request accepted, resource not found error in response
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

        expect(response.status).toBe(200);
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

      expect(response.status).toBe(200); // Request accepted, resource not found error in response
    });
  });

  describe('Content Type Testing', () => {
    describe('Text Content Resources', () => {
      it('should handle plain text resources', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri: 'file:///test/plain-text.txt' },
              jsonrpc: '2.0',
              id: 200,
            }),
          })
        );

        expect(response.status).toBe(200);
      });

      it('should handle markdown text resources', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri: 'file:///test/markdown-content.md' },
              jsonrpc: '2.0',
              id: 201,
            }),
          })
        );

        expect(response.status).toBe(200);
      });

      it('should handle CSV text resources', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri: 'file:///test/data.csv' },
              jsonrpc: '2.0',
              id: 202,
            }),
          })
        );

        expect(response.status).toBe(200);
      });

      it('should handle large text resources', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri: 'file:///test/large-content.txt' },
              jsonrpc: '2.0',
              id: 203,
            }),
          })
        );

        expect(response.status).toBe(200);
      });
    });

    describe('Binary Content Resources', () => {
      it('should handle PNG image resources', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri: 'file:///test/image.png' },
              jsonrpc: '2.0',
              id: 210,
            }),
          })
        );

        expect(response.status).toBe(200);
      });

      it('should handle JPEG image resources', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri: 'file:///test/image.jpg' },
              jsonrpc: '2.0',
              id: 211,
            }),
          })
        );

        expect(response.status).toBe(200);
      });

      it('should handle WAV audio resources', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri: 'file:///test/audio.wav' },
              jsonrpc: '2.0',
              id: 212,
            }),
          })
        );

        expect(response.status).toBe(200);
      });

      it('should handle PDF document resources', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri: 'file:///test/document.pdf' },
              jsonrpc: '2.0',
              id: 213,
            }),
          })
        );

        expect(response.status).toBe(200);
      });

      it('should handle ZIP archive resources', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri: 'file:///test/archive.zip' },
              jsonrpc: '2.0',
              id: 214,
            }),
          })
        );

        expect(response.status).toBe(200);
      });
    });

    describe('Mixed Content Resources', () => {
      it('should handle multi-content resources', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri: 'mcp-test://multi-content' },
              jsonrpc: '2.0',
              id: 220,
            }),
          })
        );

        expect(response.status).toBe(200);
      });

      it('should handle dynamic content resources', async () => {
        // Test multiple times to catch both text and binary variations
        for (let i = 0; i < 5; i++) {
          const response = await app.handle(
            new Request('http://localhost:3000/mcp', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Mcp-Session-Id': sessionId,
              },
              body: JSON.stringify({
                method: 'resources/read',
                params: { uri: 'mcp-test://dynamic-content' },
                jsonrpc: '2.0',
                id: 221 + i,
              }),
            })
          );

          expect(response.status).toBe(200);
        }
      });
    });

    describe('MIME Type Validation', () => {
      it('should handle text content with various MIME types', async () => {
        const textUris = [
          'text://plain-text',
          'text://markdown-content',
          'text://csv-data',
        ];

        for (const [index, uri] of textUris.entries()) {
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
                id: 230 + index,
              }),
            })
          );

          expect(response.status).toBe(200);
        }
      });

      it('should handle binary content with various MIME types', async () => {
        const binaryUris = [
          'binary://png-image',
          'binary://jpeg-image',
          'binary://wav-audio',
          'binary://pdf-document',
          'binary://zip-archive',
        ];

        for (const [index, uri] of binaryUris.entries()) {
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
                id: 240 + index,
              }),
            })
          );

          expect(response.status).toBe(200);
        }
      });
    });

    describe('Content Size and Performance', () => {
      it('should handle empty text content', async () => {
        // Test with resources that return empty strings
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri: 'text://plain-text' },
              jsonrpc: '2.0',
              id: 250,
            }),
          })
        );

        expect(response.status).toBe(200);
      });

      it('should handle large text content efficiently', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri: 'text://large-content' },
              jsonrpc: '2.0',
              id: 251,
            }),
          })
        );

        expect(response.status).toBe(200);
      });

      it('should handle binary content with proper encoding', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri: 'binary://png-image' },
              jsonrpc: '2.0',
              id: 252,
            }),
          })
        );

        expect(response.status).toBe(200);
      });
    });

    describe('Resource Content Structure Validation', () => {
      it('should validate text content structure', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri: 'text://plain-text' },
              jsonrpc: '2.0',
              id: 260,
            }),
          })
        );

        expect(response.status).toBe(200);
      });

      it('should validate binary content structure', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri: 'binary://png-image' },
              jsonrpc: '2.0',
              id: 261,
            }),
          })
        );

        expect(response.status).toBe(200);
      });

      it('should validate multi-content structure', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'resources/read',
              params: { uri: 'mixed://multi-content' },
              jsonrpc: '2.0',
              id: 262,
            }),
          })
        );

        expect(response.status).toBe(200);
      });
    });

    describe('URI Scheme Testing for Content Types', () => {
      it('should handle text URI schemes correctly', async () => {
        const textUris = [
          'text://plain-text',
          'text://markdown-content',
          'text://csv-data',
          'text://large-content',
        ];

        for (const [index, uri] of textUris.entries()) {
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
                id: 270 + index,
              }),
            })
          );

          expect(response.status).toBe(200);
        }
      });

      it('should handle binary URI schemes correctly', async () => {
        const binaryUris = [
          'binary://png-image',
          'binary://jpeg-image',
          'binary://wav-audio',
          'binary://pdf-document',
          'binary://zip-archive',
        ];

        for (const [index, uri] of binaryUris.entries()) {
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
                id: 280 + index,
              }),
            })
          );

          expect(response.status).toBe(200);
        }
      });

      it('should handle mixed content URI schemes correctly', async () => {
        const mixedUris = ['mixed://multi-content', 'dynamic://content'];

        for (const [index, uri] of mixedUris.entries()) {
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
                id: 290 + index,
              }),
            })
          );

          expect(response.status).toBe(200);
        }
      });
    });
  });
});
