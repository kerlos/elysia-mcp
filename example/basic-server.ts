import { Elysia } from 'elysia';
import { z } from 'zod';
import {
  mcp,
} from '../src/index.js';
import type { PromptMessage } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createTextContent, createResourceContent, createImageContent, createAudioContent } from '../src/types.js';

// Example service class
class ExampleService {
  async calculate(args: { operation: string; a: number; b: number }) {
    const { operation, a, b } = args;

    // Basic validation
    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new Error('Both a and b must be numbers');
    }
    if (!['add', 'subtract', 'multiply', 'divide'].includes(operation)) {
      throw new Error(
        'Invalid operation. Must be add, subtract, multiply, or divide'
      );
    }

    switch (operation) {
      case 'add':
        return a + b;
      case 'subtract':
        return a - b;
      case 'multiply':
        return a * b;
      case 'divide':
        if (b === 0) throw new Error('Division by zero');
        return a / b;
      default:
        throw new Error('Unknown operation');
    }
  }

  async getSystemInfo() {
    return {
      platform: process.platform,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
  }

  async generateGreeting(args: { name: string; time?: string }) {
    if (!args.name || typeof args.name !== 'string') {
      throw new Error('Name is required and must be a string');
    }
    const timeOfDay = args.time || 'day';
    return `Good ${timeOfDay}, ${args.name}! How can I assist you today?`;
  }
}

// Enhanced service for advanced prompts functionality
class PromptDemoService {
  async getProjectStats() {
    return {
      totalFiles: 15,
      linesOfCode: 2543,
      dependencies: 8,
      devDependencies: 12,
      lastModified: new Date().toISOString(),
      languages: ['TypeScript', 'JavaScript', 'Markdown'],
      frameworks: ['Elysia', 'Bun'],
    };
  }

  async analyzeCodeComplexity(code: string) {
    // Simple complexity analysis (demo purposes)
    const lines = code.split('\n').length;
    const functions = (code.match(/function|const.*=.*=>|\w+\s*\(/g) || [])
      .length;
    const branches = (code.match(/if|else|switch|case|for|while|\?/g) || [])
      .length;

    return {
      lines,
      functions,
      branches,
      complexity: Math.ceil(((functions + branches) / lines) * 100),
      rating: branches > 10 ? 'complex' : branches > 5 ? 'moderate' : 'simple',
    };
  }
}

// Initialize the services
const exampleService = new ExampleService();
const demoService = new PromptDemoService();

// Configuration
const MCP_BASE_PATH = '/mcp'; // Configurable base path for MCP endpoints
// Change this to customize endpoint paths, e.g., '/hello' would create:
// /hello, /hello/tools, /hello/resources, /hello/prompts

// Create the Elysia app with MCP plugin
const app = new Elysia()
  .use(
    mcp({
      basePath: MCP_BASE_PATH,
      serverInfo: {
        name: 'elysia-mcp-demo-server',
        version: '1.0.0',
      },
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
        logging: {},
      },
      enableLogging: true,
      setupServer: async (server: McpServer) => {
        // Register tools directly using MCP SDK patterns with Zod schemas
        server.tool(
          'calculate',
          {
            operation: z
              .enum(['add', 'subtract', 'multiply', 'divide'])
              .describe('The arithmetic operation to perform'),
            a: z.number().describe('First number'),
            b: z.number().describe('Second number'),
          },
          async (args) => {
            const result = await exampleService.calculate(
              args as {
                operation: string;
                a: number;
                b: number;
              }
            );
            return {
              content: [{ type: 'text', text: String(result) }],
            };
          }
        );

        // Simple add tool following MCP SDK pattern with Zod schema
        server.tool(
          'add',
          {
            a: z.number().describe('First number'),
            b: z.number().describe('Second number'),
          },
          async (args) => {
            const { a, b } = args;

            // Basic validation
            if (typeof a !== 'number' || typeof b !== 'number') {
              throw new Error('Both a and b must be numbers');
            }

            return {
              content: [{ type: 'text', text: String(a + b) }],
            };
          }
        );

        server.tool('get_time', {}, async () => {
          return {
            content: [{ type: 'text', text: new Date().toISOString() }],
          };
        });

        server.tool(
          'echo',
          {
            text: z.string().min(1).describe('Text to echo back'),
          },
          async (args) => {
            const { text } = args;

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

        // Advanced tool with complex validation using Zod schema
        server.tool(
          'validate_user',
          {
            user: z.object({
              name: z
                .string()
                .min(2)
                .describe('User name with at least 2 characters'),
              email: z.string().email().describe('Valid email address'),
              age: z.number().min(0).max(150).describe('Age between 0 and 150'),
              preferences: z
                .object({
                  theme: z
                    .enum(['light', 'dark'])
                    .describe('UI theme preference'),
                  notifications: z
                    .boolean()
                    .describe('Notification preference'),
                })
                .optional(),
            }),
          },
          async (args) => {
            const { user } = args;
            // Basic validation is now handled by Zod, but keeping additional checks for demonstration
            if (!user || typeof user !== 'object') {
              throw new Error('User object is required');
            }
            if (
              !user.name ||
              typeof user.name !== 'string' ||
              user.name.length < 2
            ) {
              throw new Error(
                'Name must be a string with at least 2 characters'
              );
            }
            if (
              !user.email ||
              typeof user.email !== 'string' ||
              !user.email.includes('@')
            ) {
              throw new Error('Valid email is required');
            }
            if (
              typeof user.age !== 'number' ||
              user.age < 0 ||
              user.age > 150
            ) {
              throw new Error('Age must be a number between 0 and 150');
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    valid: true,
                    user: user,
                    message: 'User data is valid',
                  }),
                },
              ],
            };
          }
        );

        // Register resources directly
        server.resource(
          'System Information',
          'example://system-info',
          async () => {
            const content = await exampleService.getSystemInfo();
            return {
              contents: [
                {
                  uri: 'example://system-info',
                  mimeType: 'application/json',
                  text: JSON.stringify(content),
                },
              ],
            };
          }
        );

        server.resource(
          'Package Configuration',
          'file://package.json',
          async () => {
            try {
              const content = await Bun.file('./package.json').text();
              return {
                contents: [
                  {
                    uri: 'file://package.json',
                    mimeType: 'application/json',
                    text: content,
                  },
                ],
              };
            } catch (error) {
              throw new Error(`Failed to read package.json: ${error}`);
            }
          }
        );

        // Add project stats resource
        server.resource('Project Statistics', 'project://stats', async () => {
          const stats = await demoService.getProjectStats();
          return {
            contents: [
              {
                uri: 'project://stats',
                mimeType: 'application/json',
                text: JSON.stringify(stats, null, 2),
              },
            ],
          };
        });

        // Register prompts directly - Enhanced examples following MCP best practices
        server.prompt(
          'greeting',
          'Generate a personalized greeting with multimedia content',
          {
            name: z.string().describe('Name of the person to greet'),
            time: z
              .string()
              .optional()
              .describe('Time of day (morning, afternoon, evening)'),
            includeSystemInfo: z
              .string()
              .optional()
              .describe(
                'Include system information as embedded resource (true/false)'
              ),
          },
          async (args) => {
            const result = await exampleService.generateGreeting(
              args as {
                name: string;
                time?: string;
              }
            );

            const messages: PromptMessage[] = [
              {
                role: 'user',
                content: createTextContent(result),
              },
            ];

            // Add embedded resource if requested
            if (args.includeSystemInfo === 'true') {
              const systemInfo = await exampleService.getSystemInfo();
              messages.push({
                role: 'assistant',
                content: createResourceContent(
                  'example://system-info',
                  JSON.stringify(systemInfo, null, 2),
                  'application/json'
                ),
              });
            }

            return {
              description:
                'Generate a personalized greeting with optional system info',
              messages,
            };
          }
        );

        // Comprehensive prompt demonstrating all PromptMessage content types
        server.prompt(
          'multimedia-demo',
          'Demonstrate all PromptMessage content types: text, image, audio, and embedded resources',
          {
            includeImage: z
              .string()
              .optional()
              .describe('Include sample image content (true/false)'),
            includeAudio: z
              .string()
              .optional()
              .describe('Include sample audio content (true/false)'),
            includeResource: z
              .string()
              .optional()
              .describe('Include embedded resource (true/false)'),
            customText: z
              .string()
              .optional()
              .describe('Custom text content to include'),
          },
          async (args) => {
            const messages: PromptMessage[] = [];

            // Always include text content
            const textContent =
              args.customText ||
              'This is a demonstration of MCP PromptMessage content types.';
            messages.push({
              role: 'user',
              content: createTextContent(textContent),
            });

            // Include image content if requested
            if (args.includeImage === 'true') {
              // Sample 1x1 PNG pixel in base64 (transparent)
              const sampleImageData =
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
              messages.push({
                role: 'assistant',
                content: createImageContent(sampleImageData, 'image/png'),
              });
            }

            // Include audio content if requested
            if (args.includeAudio === 'true') {
              // Sample minimal WAV header (silence) in base64
              const sampleAudioData =
                'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
              messages.push({
                role: 'assistant',
                content: createAudioContent(sampleAudioData, 'audio/wav'),
              });
            }

            // Include embedded resource if requested
            if (args.includeResource === 'true') {
              const projectStats = await demoService.getProjectStats();
              messages.push({
                role: 'assistant',
                content: createResourceContent(
                  'project://stats',
                  JSON.stringify(projectStats, null, 2),
                  'application/json'
                ),
              });
            }

            return {
              description:
                'Multimedia demonstration showing all PromptMessage content types',
              messages,
            };
          }
        );

        // Git commit message prompt following MCP documentation example
        server.prompt(
          'git-commit',
          'Generate a conventional commit message with optional code analysis',
          {
            changes: z
              .string()
              .describe(
                'Git diff, file changes, or description of modifications'
              ),
            type: z
              .enum([
                'feat',
                'fix',
                'docs',
                'style',
                'refactor',
                'test',
                'chore',
                'build',
                'ci',
              ])
              .optional()
              .describe(
                'Conventional commit type (auto-detected if not specified)'
              ),
            scope: z
              .string()
              .optional()
              .describe('Commit scope (component, feature area)'),
            breaking: z
              .string()
              .optional()
              .describe('Whether this is a breaking change (true/false)'),
            includeAnalysis: z
              .string()
              .optional()
              .describe(
                'Include code complexity analysis as embedded resource (true/false)'
              ),
          },
          async (args) => {
            const { changes, type, scope, breaking, includeAnalysis } = args;

            let prompt = `Generate a conventional commit message for these changes:\n\n${changes}\n\n`;

            if (type) prompt += `Preferred type: ${type}\n`;
            if (scope) prompt += `Scope: ${scope}\n`;
            if (breaking === 'true')
              prompt += `⚠️  This is a BREAKING CHANGE\n`;

            prompt += `
Requirements:
- Follow conventional commits format: type(scope): description
- Use present tense ("add" not "added")
- Keep subject line under 50 characters
- Include body for complex changes
- Add BREAKING CHANGE footer if needed
- Reference issue numbers if applicable

Examples:
- feat(auth): add OAuth2 integration
- fix(api): resolve timeout in user endpoints
- docs: update installation instructions`;

            const messages: PromptMessage[] = [
              {
                role: 'user',
                content: createTextContent(prompt),
              },
            ];

            // Include code analysis as embedded resource if requested
            if (includeAnalysis === 'true' && changes) {
              try {
                const analysis = await demoService.analyzeCodeComplexity(
                  changes
                );
                messages.push({
                  role: 'assistant',
                  content: createResourceContent(
                    'analysis://code-complexity',
                    JSON.stringify(analysis, null, 2),
                    'application/json'
                  ),
                });
              } catch (error) {
                // Silently skip analysis if it fails
              }
            }

            return {
              description:
                'Generate conventional commit message with optional code analysis',
              messages,
            };
          }
        );
      },
    })
  )
  .get('/health', () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  }))
  .listen(
    {
      port: 3000,
      idleTimeout: 255, // Maximum timeout for Bun (255 seconds = ~4.25 minutes)
      reusePort: true,
    },
    () => {
      console.log('🦊 Elysia MCP Server running on port 3000');
    }
  );
