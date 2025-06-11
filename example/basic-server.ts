import { Elysia } from 'elysia';
import { mcpPlugin, type McpServer } from '../src/index.js';
import { z } from 'zod';
import debug from 'debug';

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

// Initialize the service
const exampleService = new ExampleService();

// Create the Elysia app with MCP plugin
const app = new Elysia()
  .use(
    mcpPlugin({
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

        // Register prompts directly
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

        server.prompt(
          'code_review',
          {
            language: z.string().describe('Programming language'),
            code: z.string().describe('Code to review'),
          },
          async (args) => {
            const { language, code } = args as {
              language: string;
              code: string;
            };
            const template = `Please review the following ${language} code:

\`\`\`${language}
${code}
\`\`\`

Focus on:
- Code quality
- Best practices
- Potential bugs
- Performance considerations`;

            return {
              description: 'Generate a code review prompt',
              messages: [
                {
                  role: 'user',
                  content: {
                    type: 'text',
                    text: template,
                  },
                },
              ],
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
      console.log('🦊 Elysia MCP Server is running at port 3000');
    }
  );
