import { describe, expect, it, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { mcp } from '../src/mcp-plugin.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  type PromptMessage,
  createTextContent,
  createImageContent,
  createAudioContent,
  createResourceContent,
} from '../src/index.js';

describe('MCP Prompts Interface Testing', () => {
  let app: Elysia;
  let sessionId: string;

  beforeAll(async () => {
    // Create app with prompts setup similar to basic-server.ts
    app = new Elysia().use(
      mcp({
        serverInfo: {
          name: 'test-prompts-server',
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
          // Register test prompts - similar to basic-server.ts
          server.prompt(
            'test_greeting',
            'Generate a test greeting message',
            {
              name: z.string().describe('Name of the person to greet'),
              time: z
                .string()
                .optional()
                .describe('Time of day (morning, afternoon, evening)'),
            },
            async (args) => {
              const { name, time } = args;
              const timeOfDay = time || 'day';
              const result = `Good ${timeOfDay}, ${name}! Welcome to the test environment.`;

              return {
                description: 'Generate a test greeting message',
                messages: [
                  {
                    role: 'user',
                    content: createTextContent(result),
                  },
                ],
              };
            }
          );

          server.prompt(
            'test_analysis',
            'Generate analysis prompt for testing',
            {
              data: z.string().describe('Data to analyze'),
              type: z
                .enum(['basic', 'detailed', 'summary'])
                .optional()
                .describe('Type of analysis to perform'),
              format: z
                .string()
                .optional()
                .describe('Output format preference'),
            },
            async (args) => {
              const { data, type, format } = args;

              let prompt = `Analyze the following data:\n\n${data}\n\n`;

              if (type) prompt += `Analysis type: ${type}\n`;
              if (format) prompt += `Output format: ${format}\n`;

              prompt += `
Requirements:
- Provide clear insights
- Use structured format
- Include key findings
- Suggest improvements if applicable`;

              return {
                description: 'Generate analysis prompt for testing',
                messages: [
                  {
                    role: 'user' as const,
                    content: createTextContent(prompt),
                  },
                ],
              };
            }
          );

          server.prompt(
            'test_commit_message',
            'Generate a test commit message',
            {
              changes: z.string().describe('Description of changes made'),
              type: z
                .enum([
                  'feat',
                  'fix',
                  'docs',
                  'style',
                  'refactor',
                  'test',
                  'chore',
                ])
                .optional()
                .describe('Type of commit'),
              scope: z.string().optional().describe('Scope of the changes'),
            },
            async (args) => {
              const { changes, type, scope } = args;

              let prompt = `Generate a conventional commit message for these changes:\n\n${changes}\n\n`;

              if (type) prompt += `Preferred type: ${type}\n`;
              if (scope) prompt += `Scope: ${scope}\n`;

              prompt += `
Requirements:
- Follow conventional commits format
- Use present tense
- Keep subject line under 50 characters
- Be descriptive but concise`;

              return {
                description: 'Generate a test commit message',
                messages: [
                  {
                    role: 'user' as const,
                    content: createTextContent(prompt),
                  },
                ],
              };
            }
          );

          // Test prompt for image content
          server.prompt(
            'test_image_content',
            'Test prompt with image content',
            {
              includeImage: z
                .string()
                .optional()
                .describe('Include sample image (true/false)'),
              description: z
                .string()
                .optional()
                .describe('Description for the image'),
            },
            async (args) => {
              const messages: PromptMessage[] = [
                {
                  role: 'user',
                  content: createTextContent(
                    args.description || 'Here is a sample image for testing:'
                  ),
                },
              ];

              if (args.includeImage === 'true') {
                // Sample 1x1 PNG pixel in base64 (transparent)
                const sampleImageData =
                  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
                messages.push({
                  role: 'assistant',
                  content: createImageContent(sampleImageData, 'image/png'),
                });
              }

              return {
                description: 'Test prompt with image content',
                messages,
              };
            }
          );

          // Test prompt for audio content
          server.prompt(
            'test_audio_content',
            'Test prompt with audio content',
            {
              includeAudio: z
                .string()
                .optional()
                .describe('Include sample audio (true/false)'),
              description: z
                .string()
                .optional()
                .describe('Description for the audio'),
            },
            async (args) => {
              const messages: PromptMessage[] = [
                {
                  role: 'user',
                  content: createTextContent(
                    args.description || 'Here is a sample audio for testing:'
                  ),
                },
              ];

              if (args.includeAudio === 'true') {
                // Sample minimal WAV header (silence) in base64
                const sampleAudioData =
                  'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
                messages.push({
                  role: 'assistant',
                  content: createAudioContent(sampleAudioData, 'audio/wav'),
                });
              }

              return {
                description: 'Test prompt with audio content',
                messages,
              };
            }
          );

          // Test prompt for resource content
          server.prompt(
            'test_resource_content',
            'Test prompt with embedded resource content',
            {
              includeResource: z
                .string()
                .optional()
                .describe('Include sample resource (true/false)'),
              resourceType: z
                .enum(['json', 'text', 'config'])
                .optional()
                .describe('Type of resource to include'),
            },
            async (args) => {
              const messages: PromptMessage[] = [
                {
                  role: 'user',
                  content: createTextContent(
                    'Here is the requested resource data:'
                  ),
                },
              ];

              if (args.includeResource === 'true') {
                let resourceData: string;
                let mimeType: string;
                let uri: string;

                switch (args.resourceType) {
                  case 'json':
                    resourceData = JSON.stringify({
                      test: true,
                      timestamp: new Date().toISOString(),
                      data: ['item1', 'item2', 'item3'],
                    });
                    mimeType = 'application/json';
                    uri = 'test://json-data';
                    break;
                  case 'config':
                    resourceData = `# Test Configuration
debug=true
environment=test
version=1.0.0
features=["feature1", "feature2"]`;
                    mimeType = 'text/plain';
                    uri = 'test://config-data';
                    break;
                  default:
                    resourceData =
                      'This is a sample text resource for testing purposes.';
                    mimeType = 'text/plain';
                    uri = 'test://text-data';
                }

                messages.push({
                  role: 'assistant',
                  content: createResourceContent(uri, resourceData, mimeType),
                });
              }

              return {
                description: 'Test prompt with embedded resource content',
                messages,
              };
            }
          );

          // Test prompt for mixed content types
          server.prompt(
            'test_mixed_content',
            'Test prompt with multiple content types',
            {
              includeText: z
                .string()
                .optional()
                .describe('Include text content (true/false)'),
              includeImage: z
                .string()
                .optional()
                .describe('Include image content (true/false)'),
              includeAudio: z
                .string()
                .optional()
                .describe('Include audio content (true/false)'),
              includeResource: z
                .string()
                .optional()
                .describe('Include resource content (true/false)'),
            },
            async (args) => {
              const messages: PromptMessage[] = [];

              if (args.includeText === 'true') {
                messages.push({
                  role: 'user',
                  content: createTextContent(
                    'This is a comprehensive test of all MCP PromptMessage content types.'
                  ),
                });
              }

              if (args.includeImage === 'true') {
                const sampleImageData =
                  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
                messages.push({
                  role: 'assistant',
                  content: createImageContent(sampleImageData, 'image/png'),
                });
              }

              if (args.includeAudio === 'true') {
                const sampleAudioData =
                  'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
                messages.push({
                  role: 'assistant',
                  content: createAudioContent(sampleAudioData, 'audio/wav'),
                });
              }

              if (args.includeResource === 'true') {
                const testData = {
                  mixedContentTest: true,
                  contentTypes: ['text', 'image', 'audio', 'resource'],
                  timestamp: new Date().toISOString(),
                };
                messages.push({
                  role: 'assistant',
                  content: createResourceContent(
                    'test://mixed-content',
                    JSON.stringify(testData, null, 2),
                    'application/json'
                  ),
                });
              }

              return {
                description: 'Test prompt with multiple content types',
                messages,
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

    expect(initResponse.status).toBe(202);
    sessionId = initResponse.headers.get('Mcp-Session-Id') ?? '';
    expect(sessionId).toBeTruthy();
  });

  describe('Prompts Listing', () => {
    it('should handle prompts/list with empty params', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/list',
            params: {},
            jsonrpc: '2.0',
            id: 2,
          }),
        })
      );

      expect(response.status).toBe(202);
    });

    it('should handle prompts/list with _meta progressToken', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/list',
            params: {
              _meta: { progressToken: 100 },
            },
            jsonrpc: '2.0',
            id: 3,
          }),
        })
      );

      expect(response.status).toBe(202);
    });

    it('should handle prompts/list with different ID formats', async () => {
      // Test with string ID
      const response1 = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/list',
            params: {},
            jsonrpc: '2.0',
            id: 'prompt-list-string-id',
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
            method: 'prompts/list',
            params: {},
            jsonrpc: '2.0',
            id: 12345,
          }),
        })
      );

      expect(response2.status).toBe(202);
    });
  });

  describe('Prompt Getting', () => {
    it('should handle basic prompt get request', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/get',
            params: {
              name: 'test_greeting',
              arguments: { name: 'Alice' },
            },
            jsonrpc: '2.0',
            id: 10,
          }),
        })
      );

      expect(response.status).toBe(202);
    });

    it('should handle prompt get with all parameters', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/get',
            params: {
              name: 'test_greeting',
              arguments: { name: 'Bob', time: 'morning' },
            },
            jsonrpc: '2.0',
            id: 11,
          }),
        })
      );

      expect(response.status).toBe(202);
    });

    it('should handle prompt get with complex arguments', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/get',
            params: {
              name: 'test_analysis',
              arguments: {
                data: 'Sample test data for analysis',
                type: 'detailed',
                format: 'json',
              },
            },
            jsonrpc: '2.0',
            id: 12,
          }),
        })
      );

      expect(response.status).toBe(202);
    });

    it('should handle prompt get with commit message generation', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/get',
            params: {
              name: 'test_commit_message',
              arguments: {
                changes: 'Added new user authentication system',
                type: 'feat',
                scope: 'auth',
              },
            },
            jsonrpc: '2.0',
            id: 13,
          }),
        })
      );

      expect(response.status).toBe(202);
    });

    it('should handle prompt get with empty arguments', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/get',
            params: {
              name: 'test_greeting',
              arguments: {},
            },
            jsonrpc: '2.0',
            id: 14,
          }),
        })
      );

      expect(response.status).toBe(202); // Request accepted, validation error in response
    });

    it('should handle prompt get with non-existent prompt', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/get',
            params: {
              name: 'nonexistent_prompt',
              arguments: { param: 'value' },
            },
            jsonrpc: '2.0',
            id: 15,
          }),
        })
      );

      expect(response.status).toBe(202); // Request accepted, prompt not found error in response
    });

    it('should handle prompt get with missing name parameter', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/get',
            params: {
              // Missing name
              arguments: { param: 'value' },
            },
            jsonrpc: '2.0',
            id: 16,
          }),
        })
      );

      expect(response.status).toBe(202); // Request accepted, validation error in response
    });

    it('should handle prompt get with missing arguments parameter', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/get',
            params: {
              name: 'test_greeting',
              // Missing arguments
            },
            jsonrpc: '2.0',
            id: 17,
          }),
        })
      );

      expect(response.status).toBe(202); // Request accepted, validation error in response
    });
  });

  describe('Session Management', () => {
    it('should reject prompt operations without session ID', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // No Mcp-Session-Id header
          },
          body: JSON.stringify({
            method: 'prompts/list',
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

    it('should reject prompt operations with invalid session ID', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': 'invalid-session-54321',
          },
          body: JSON.stringify({
            method: 'prompts/get',
            params: {
              name: 'test_greeting',
              arguments: { name: 'Test' },
            },
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
    it('should handle prompt requests with different jsonrpc versions', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/list',
            params: {},
            jsonrpc: '2.0',
            id: 30,
          }),
        })
      );

      expect(response.status).toBe(202);
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
            method: 'prompts/list',
            params: {},
            jsonrpc: '2.0',
            id: 456,
          }),
        })
      );

      expect(response1.status).toBe(202);

      // String ID
      const response2 = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/get',
            params: {
              name: 'test_greeting',
              arguments: { name: 'Test User' },
            },
            jsonrpc: '2.0',
            id: 'test-prompt-string-id',
          }),
        })
      );

      expect(response2.status).toBe(202);
    });
  });

  describe('Content Type Handling', () => {
    it('should handle prompt requests with explicit charset', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/list',
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
            method: 'prompts/get',
            params: {
              name: 'test_greeting',
              arguments: { name: 'Case Test' },
            },
            jsonrpc: '2.0',
            id: 41,
          }),
        })
      );

      expect(response.status).toBe(202);
    });
  });

  describe('Edge Cases', () => {
    it('should handle prompts with optional parameters correctly', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/get',
            params: {
              name: 'test_analysis',
              arguments: {
                data: 'Minimal test data',
                // Optional parameters omitted
              },
            },
            jsonrpc: '2.0',
            id: 50,
          }),
        })
      );

      expect(response.status).toBe(202);
    });

    it('should handle prompts with enum validation', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/get',
            params: {
              name: 'test_analysis',
              arguments: {
                data: 'Test data',
                type: 'summary', // Valid enum value
              },
            },
            jsonrpc: '2.0',
            id: 51,
          }),
        })
      );

      expect(response.status).toBe(202);
    });

    it('should handle prompts with invalid enum values', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/get',
            params: {
              name: 'test_analysis',
              arguments: {
                data: 'Test data',
                type: 'invalid_type', // Invalid enum value
              },
            },
            jsonrpc: '2.0',
            id: 52,
          }),
        })
      );

      expect(response.status).toBe(202); // Request accepted, validation error in response
    });
  });

  describe('Content Type Testing', () => {
    describe('Text Content', () => {
      it('should handle prompts with text content', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'prompts/get',
              params: {
                name: 'test_greeting',
                arguments: { name: 'TextTestUser' },
              },
              jsonrpc: '2.0',
              id: 100,
            }),
          })
        );

        expect(response.status).toBe(202);
      });
    });

    describe('Image Content', () => {
      it('should handle prompts with image content', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'prompts/get',
              params: {
                name: 'test_image_content',
                arguments: {
                  includeImage: 'true',
                  description: 'Testing image content functionality',
                },
              },
              jsonrpc: '2.0',
              id: 101,
            }),
          })
        );

        expect(response.status).toBe(202);
      });

      it('should handle prompts without image content', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'prompts/get',
              params: {
                name: 'test_image_content',
                arguments: {
                  includeImage: 'false',
                  description: 'Testing without image content',
                },
              },
              jsonrpc: '2.0',
              id: 102,
            }),
          })
        );

        expect(response.status).toBe(202);
      });
    });

    describe('Audio Content', () => {
      it('should handle prompts with audio content', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'prompts/get',
              params: {
                name: 'test_audio_content',
                arguments: {
                  includeAudio: 'true',
                  description: 'Testing audio content functionality',
                },
              },
              jsonrpc: '2.0',
              id: 103,
            }),
          })
        );

        expect(response.status).toBe(202);
      });

      it('should handle prompts without audio content', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'prompts/get',
              params: {
                name: 'test_audio_content',
                arguments: {
                  includeAudio: 'false',
                  description: 'Testing without audio content',
                },
              },
              jsonrpc: '2.0',
              id: 104,
            }),
          })
        );

        expect(response.status).toBe(202);
      });
    });

    describe('Resource Content', () => {
      it('should handle prompts with JSON resource content', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'prompts/get',
              params: {
                name: 'test_resource_content',
                arguments: {
                  includeResource: 'true',
                  resourceType: 'json',
                },
              },
              jsonrpc: '2.0',
              id: 105,
            }),
          })
        );

        expect(response.status).toBe(202);
      });

      it('should handle prompts with text resource content', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'prompts/get',
              params: {
                name: 'test_resource_content',
                arguments: {
                  includeResource: 'true',
                  resourceType: 'text',
                },
              },
              jsonrpc: '2.0',
              id: 106,
            }),
          })
        );

        expect(response.status).toBe(202);
      });

      it('should handle prompts with config resource content', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'prompts/get',
              params: {
                name: 'test_resource_content',
                arguments: {
                  includeResource: 'true',
                  resourceType: 'config',
                },
              },
              jsonrpc: '2.0',
              id: 107,
            }),
          })
        );

        expect(response.status).toBe(202);
      });

      it('should handle prompts without resource content', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'prompts/get',
              params: {
                name: 'test_resource_content',
                arguments: {
                  includeResource: 'false',
                },
              },
              jsonrpc: '2.0',
              id: 108,
            }),
          })
        );

        expect(response.status).toBe(202);
      });
    });

    describe('Mixed Content Types', () => {
      it('should handle prompts with all content types', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'prompts/get',
              params: {
                name: 'test_mixed_content',
                arguments: {
                  includeText: 'true',
                  includeImage: 'true',
                  includeAudio: 'true',
                  includeResource: 'true',
                },
              },
              jsonrpc: '2.0',
              id: 109,
            }),
          })
        );

        expect(response.status).toBe(202);
      });

      it('should handle prompts with selective content types', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'prompts/get',
              params: {
                name: 'test_mixed_content',
                arguments: {
                  includeText: 'true',
                  includeImage: 'false',
                  includeAudio: 'true',
                  includeResource: 'false',
                },
              },
              jsonrpc: '2.0',
              id: 110,
            }),
          })
        );

        expect(response.status).toBe(202);
      });

      it('should handle prompts with no optional content', async () => {
        const response = await app.handle(
          new Request('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
              method: 'prompts/get',
              params: {
                name: 'test_mixed_content',
                arguments: {
                  includeText: 'false',
                  includeImage: 'false',
                  includeAudio: 'false',
                  includeResource: 'false',
                },
              },
              jsonrpc: '2.0',
              id: 111,
            }),
          })
        );

        expect(response.status).toBe(202);
      });
    });
  });

  describe('Content Type Validation', () => {
    it('should handle invalid enum values for resource type', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/get',
            params: {
              name: 'test_resource_content',
              arguments: {
                includeResource: 'true',
                resourceType: 'invalid_type', // Invalid enum value
              },
            },
            jsonrpc: '2.0',
            id: 120,
          }),
        })
      );

      expect(response.status).toBe(202); // Request accepted, validation error in response
    });

    it('should handle missing optional parameters gracefully', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/get',
            params: {
              name: 'test_mixed_content',
              arguments: {
                // All parameters are optional
              },
            },
            jsonrpc: '2.0',
            id: 121,
          }),
        })
      );

      expect(response.status).toBe(202);
    });
  });

  describe('PromptMessage Structure Validation', () => {
    it('should handle prompts that return proper PromptMessage structure', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/get',
            params: {
              name: 'test_image_content',
              arguments: {
                includeImage: 'true',
                description: 'Testing PromptMessage structure',
              },
            },
            jsonrpc: '2.0',
            id: 130,
          }),
        })
      );

      expect(response.status).toBe(202);
    });

    it('should handle prompts with multiple message roles', async () => {
      const response = await app.handle(
        new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': sessionId,
          },
          body: JSON.stringify({
            method: 'prompts/get',
            params: {
              name: 'test_mixed_content',
              arguments: {
                includeText: 'true',
                includeResource: 'true',
              },
            },
            jsonrpc: '2.0',
            id: 131,
          }),
        })
      );

      expect(response.status).toBe(202);
    });
  });
});
