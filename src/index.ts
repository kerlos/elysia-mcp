import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ErrorCode,
  isInitializeRequest,
  SUPPORTED_PROTOCOL_VERSIONS,
  type ServerCapabilities,
} from '@modelcontextprotocol/sdk/types.js';
import { Elysia } from 'elysia';
import { ElysiaStreamingHttpTransport } from './transport';
import type { McpContext } from './types';
import { Logger } from './utils/logger';
// Plugin options
export interface MCPPluginOptions {
  basePath?: string;
  serverInfo?: {
    name: string;
    version: string;
  };
  capabilities?: ServerCapabilities;
  enableLogging?: boolean;
  enableJsonResponse?: boolean;
  authentication?: (
    context: McpContext
  ) => Promise<{ authInfo?: AuthInfo; response?: unknown }>;
  setupServer?: (server: McpServer) => void | Promise<void>;
  mcpServer?: McpServer;
}

export const transports: Record<string, ElysiaStreamingHttpTransport> = {};

// Main MCP plugin for Elysia
export const mcp = (options: MCPPluginOptions = {}) => {
  // Create MCP server singleton
  const serverInfo = options.serverInfo || {
    name: 'elysia-mcp-server',
    version: '1.0.0',
  };

  const server =
    options.mcpServer ||
    new McpServer(serverInfo, {
      capabilities: options.capabilities || {},
    });

  // Setup server with tools, resources, prompts once
  const setupPromise = (async () => {
    if (options.setupServer) {
      await options.setupServer(server);
    }
  })();

  const basePath = options.basePath || '/mcp';
  const enableLogging = options.enableLogging ?? false;
  const logger = new Logger(enableLogging);
  // Shared handler function
  const mcpHandler = async (context: McpContext) => {
    const { request, set, body } = context;
    await setupPromise;

    logger.log(
      `${request.method} ${request.url} ${body ? JSON.stringify(body) : ''}`
    );

    try {
      const sessionId = request.headers.get('mcp-session-id');
      if (sessionId) {
        if (isInitializeRequest(body)) {
          set.status = 400;
          return {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Invalid Request: Server already initialized',
            },
            id: null,
          };
        }
        const transport = transports[sessionId];
        if (!transport) {
          set.status = 404;
          return {
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Session not found' },
          };
        }
        return await transport.handleRequest(context);
      }

      const isInitialize =
        (Array.isArray(body) && body.some(isInitializeRequest)) ||
        isInitializeRequest(body);
      if (!sessionId && isInitialize) {
        const transport = new ElysiaStreamingHttpTransport({
          sessionIdGenerator: () => Bun.randomUUIDv7(),
          onsessioninitialized: (sessionId) => {
            transports[sessionId] = transport;
          },
          enableLogging,
          enableJsonResponse: options.enableJsonResponse,
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId];
          }
        };

        await server.connect(transport);

        return await transport.handleRequest(context);
      }

      // Invalid request
      set.status = 400;
      return {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      };
    } catch (error) {
      set.status = 500;
      logger.error('Error handling MCP request', JSON.stringify(error));
      return {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Internal error',
        },
        id: null,
      };
    }
  };

  const app = new Elysia({ name: `mcp-${serverInfo.name}` })
    .state('authInfo', undefined as AuthInfo | undefined)
    .onBeforeHandle(async (context) => {
      const protocolVersion = context.request.headers.get(
        'mcp-protocol-version'
      );
      if (protocolVersion) {
        if (!SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion)) {
          context.set.status = 400;
          return {
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: `Bad Request: Unsupported protocol version (supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(
                ', '
              )})`,
            },
            id: null,
          };
        }
      }

      if (context.request.method === 'POST') {
        const contentType = context.request.headers.get('content-type');
        if (contentType !== 'application/json') {
          context.set.status = 415;
          return {
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message:
                'Unsupported Media Type: Content-Type must be application/json',
            },
            id: null,
          };
        }
      }

      if (options.authentication) {
        const { authInfo, response } = await options.authentication(context);
        // if authInfo is provided, store it in the context
        if (authInfo) {
          context.store.authInfo = authInfo;
          return;
        }
        // if response is provided, return response and do not continue
        if (response) {
          return response;
        }
        // if no authInfo or response is provided, continue
      }
    })
    .onError(({ error, code, set }) => {
      if (code === 'PARSE') {
        set.status = 400;
        return {
          jsonrpc: '2.0',
          error: {
            code: ErrorCode.ParseError,
            message: 'Parse error',
            data: String(error),
          },
          id: null,
        };
      }
    })
    .onAfterResponse(({ response }) => {
      logger.log('response', JSON.stringify(response));
    })
    .all(`${basePath}/*`, mcpHandler)
    .all(basePath, mcpHandler);

  return app;
};
