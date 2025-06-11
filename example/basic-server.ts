import { Elysia } from 'elysia';
import { z } from 'zod';
import { mcpPlugin, type McpServer } from '../src/index.js';

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
    mcpPlugin({
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
          'Generate a personalized greeting',
          {
            name: z.string().describe('Name of the person to greet'),
            time: z
              .string()
              .optional()
              .describe('Time of day (morning, afternoon, evening)'),
          },
          async (args) => {
            const result = await exampleService.generateGreeting(
              args as {
                name: string;
                time?: string;
              }
            );
            return {
              description: 'Generate a personalized greeting',
              messages: [
                {
                  role: 'user',
                  content: {
                    type: 'text',
                    text: result,
                  },
                },
              ],
            };
          }
        );

        // Git commit message prompt following MCP documentation example
        server.prompt(
          'git-commit',
          'Generate a conventional commit message',
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
          },
          async (args) => {
            const { changes, type, scope, breaking } = args;

            let prompt = `Generate a conventional commit message for these changes:\n\n${changes}\n\n`;

            if (type) prompt += `Preferred type: ${type}\n`;
            if (scope) prompt += `Scope: ${scope}\n`;
            if (breaking) prompt += `⚠️  This is a BREAKING CHANGE\n`;

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

            return {
              description: 'Generate conventional commit message',
              messages: [
                {
                  role: 'user' as const,
                  content: {
                    type: 'text' as const,
                    text: prompt,
                  },
                },
              ],
            };
          }
        );

        console.log('✅ Enhanced prompts and tools registered successfully!');
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
      console.log('🦊 Simplified Elysia MCP Server running on port 3000');
      console.log('');
      console.log('📋 MCP Protocol Endpoints:');
      console.log(`  🔄 Core MCP:  POST ${MCP_BASE_PATH}`);
      console.log(`  🔧 Tools:     POST ${MCP_BASE_PATH}/tools`);
      console.log(`  📂 Resources: POST ${MCP_BASE_PATH}/resources`);
      console.log(`  💬 Prompts:   POST ${MCP_BASE_PATH}/prompts`);
      console.log('');
      console.log('📊 Feature Summary:');
      console.log('  • 6 Tools: calculate, add, get_time, echo, validate_user');
      console.log(
        '  • 3 Resources: System Information, Package Configuration, Project Statistics'
      );
      console.log('  • 2 Prompts: greeting, git-commit');
      console.log('');
      console.log('🌐 Additional Endpoints:');
      console.log('  • GET /health - Server status and modular endpoint info');
      console.log('');
      console.log('✨ Key Features:');
      console.log(
        '  • Modular handler architecture with specialized endpoints'
      );
      console.log(
        '  • Simple greeting prompt demonstrating basic functionality'
      );
      console.log('  • Practical git-commit prompt with enhanced parameters');
      console.log('  • Resource integration for enhanced context');
    }
  );
