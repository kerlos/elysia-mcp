import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  CallToolResult,
  JSONRPCMessage,
} from '@modelcontextprotocol/sdk/types.js';
import Elysia from 'elysia';
import { z } from 'zod';
import { mcp, transports } from '../src';
import { ElysiaStreamingHttpTransport } from '../src/transport';
import type { EventStore, McpContext } from '../src/types';

export async function readSSEEvent(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No reader found');
  }
  const { value } = await reader.read();
  return new TextDecoder().decode(value);
}

/**
 * Common test messages
 */
export const TEST_MESSAGES = {
  initialize: {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      clientInfo: { name: 'test-client', version: '1.0' },
      protocolVersion: '2025-03-26',
      capabilities: {},
    },

    id: 'init-1',
  } as JSONRPCMessage,

  toolsList: {
    jsonrpc: '2.0',
    method: 'tools/list',
    params: {},
    id: 'tools-1',
  } as JSONRPCMessage,
};

export async function createMultipleServer() {
  const mathPlugin = mcp({
    basePath: '/math',
    serverInfo: {
      name: 'math-operations-server',
      version: '1.0.0',
    },
    capabilities: {
      tools: {},
    },
    enableLogging: true,
    setupServer: async (server: McpServer) => {
      // Addition tool
      server.tool(
        'add',
        {
          a: z.number().describe('First number'),
          b: z.number().describe('Second number'),
        },
        async (args) => {
          const { a, b } = args;
          const result = a + b;
          return {
            content: [{ type: 'text', text: `${a} + ${b} = ${result}` }],
          };
        }
      );

      // Multiplication tool
      server.tool(
        'multiply',
        {
          a: z.number().describe('First number'),
          b: z.number().describe('Second number'),
        },
        async (args) => {
          const { a, b } = args;
          const result = a * b;
          return {
            content: [{ type: 'text', text: `${a} × ${b} = ${result}` }],
          };
        }
      );

      // Power tool
      server.tool(
        'power',
        {
          base: z.number().describe('Base number'),
          exponent: z.number().describe('Exponent'),
        },
        async (args) => {
          const { base, exponent } = args;
          const result = base ** exponent;
          return {
            content: [
              { type: 'text', text: `${base}^${exponent} = ${result}` },
            ],
          };
        }
      );
    },
  });
  const textPlugin = mcp({
    basePath: '/text',
    serverInfo: {
      name: 'text-utilities-server',
      version: '1.0.0',
    },
    capabilities: {
      tools: {},
    },
    enableLogging: true,
    setupServer: async (server: McpServer) => {
      // Uppercase tool
      server.tool(
        'uppercase',
        {
          text: z.string().describe('Text to convert to uppercase'),
        },
        async (args) => {
          const { text } = args;
          const result = text.toUpperCase();
          return {
            content: [{ type: 'text', text: result }],
          };
        }
      );

      // Word count tool
      server.tool(
        'word_count',
        {
          text: z.string().describe('Text to count words in'),
        },
        async (args) => {
          const { text } = args;
          const wordCount = text.trim().split(/\s+/).length;
          return {
            content: [{ type: 'text', text: `Word count: ${wordCount}` }],
          };
        }
      );

      // Reverse text tool
      server.tool(
        'reverse',
        {
          text: z.string().describe('Text to reverse'),
        },
        async (args) => {
          const { text } = args;
          const result = text.split('').reverse().join('');
          return {
            content: [{ type: 'text', text: result }],
          };
        }
      );

      // Replace text tool
      server.tool(
        'replace',
        {
          text: z.string().describe('Original text'),
          search: z.string().describe('Text to search for'),
          replace: z.string().describe('Text to replace with'),
        },
        async (args) => {
          const { text, search, replace } = args;
          const result = text.replace(new RegExp(search, 'g'), replace);
          return {
            content: [{ type: 'text', text: result }],
          };
        }
      );
    },
  });
  const server = new Elysia().use(mathPlugin).use(textPlugin);

  return server;
}

interface TestServerConfig {
  sessionIdGenerator: (() => string) | undefined;
  enableJsonResponse?: boolean;
  customRequestHandler?: (
    req: Request,
    res: Response,
    parsedBody?: unknown
  ) => Promise<void>;
  eventStore?: EventStore;
  stateless?: boolean;
  authentication?: (
    context: McpContext
  ) => Promise<{ authInfo?: AuthInfo; response?: unknown }>;
}

export type TestServer =
  | Awaited<ReturnType<typeof createTestServer>>['server']
  | Awaited<ReturnType<typeof createTestAuthServer>>['server']
  | Awaited<ReturnType<typeof createMultipleServer>>;

/**
 * Helper to create and start test HTTP server with MCP setup
 */
export async function createTestServer(config?: TestServerConfig) {
  const mcpServer = new McpServer(
    { name: 'test-server', version: '1.0.0' },
    { capabilities: { logging: {} } }
  );

  mcpServer.tool(
    'greet',
    'A simple greeting tool',
    { name: z.string().describe('Name to greet') },
    async ({ name }): Promise<CallToolResult> => {
      return { content: [{ type: 'text', text: `Hello, ${name}!` }] };
    }
  );

  const enableJson = config?.enableJsonResponse ?? false;
  const transport = new ElysiaStreamingHttpTransport({
    sessionIdGenerator: config?.sessionIdGenerator ?? Bun.randomUUIDv7,
    enableJsonResponse: enableJson,
    eventStore: config?.eventStore,
  });

  await mcpServer.connect(transport);

  const server = new Elysia().use(
    mcp({
      mcpServer,
      basePath: '/mcp',
      enableLogging: true,
      enableJsonResponse: enableJson,
      stateless: config?.stateless ?? false,
      eventStore: config?.eventStore,
      serverInfo: {
        name: 'test-server',
        version: '1.0.0',
      },
    }).post('/sendNotification', async ({ body, headers }) => {
      const mcpSessionId = headers['mcp-session-id'];
      if (!mcpSessionId) {
        throw new Error('mcp-session-id is required');
      }
      const notiTransport = transports[mcpSessionId];
      if (!notiTransport) {
        throw new Error('mcp-session-id is not valid');
      }
      await notiTransport.send(body as JSONRPCMessage);
    })
  );
  return { server, transport, mcpServer };
}

/**
 * Helper to create and start authenticated test HTTP server with MCP setup
 */
export async function createTestAuthServer(
  config: TestServerConfig = { sessionIdGenerator: () => Bun.randomUUIDv7() }
) {
  const mcpServer = new McpServer(
    { name: 'test-server', version: '1.0.0' },
    { capabilities: { logging: {} } }
  );

  mcpServer.tool(
    'profile',
    'A user profile data tool',
    { active: z.boolean().describe('Profile status') },
    async ({ active }, { authInfo }): Promise<CallToolResult> => {
      return {
        content: [
          {
            type: 'text',
            text: `${active ? 'Active' : 'Inactive'} profile from token: ${
              authInfo?.token
            }!`,
          },
        ],
      };
    }
  );

  const server = new Elysia().use(
    mcp({
      mcpServer,
      basePath: '/mcp',
      serverInfo: {
        name: 'test-server',
        version: '1.0.0',
      },
      authentication: config.authentication,
    })
  );

  const transport = new ElysiaStreamingHttpTransport({
    sessionIdGenerator: config.sessionIdGenerator,
    enableJsonResponse: config.enableJsonResponse ?? false,
    eventStore: config.eventStore,
  });

  await mcpServer.connect(transport);
  return { server, transport, mcpServer };
}

/**
 * Helper to stop test server
 */
export async function stopTestServer({
  server,
  transport,
}: {
  server: TestServer;
  transport: ElysiaStreamingHttpTransport;
}): Promise<void> {
  // First close the transport to ensure all SSE streams are closed
  await transport.close();

  // Close the server without waiting indefinitely
  //server.stop(true);
}
