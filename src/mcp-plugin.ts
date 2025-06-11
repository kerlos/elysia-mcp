import { Elysia } from 'elysia';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  isInitializeRequest,
  type ServerCapabilities,
} from '@modelcontextprotocol/sdk/types.js';
import { ElysiaStreamingHttpTransport } from './transport.js';
import debug from 'debug';

// Plugin options
export interface MCPPluginOptions {
  path?: string;
  serverInfo?: {
    name: string;
    version: string;
  };
  capabilities?: ServerCapabilities;
  enableLogging?: boolean;
  setupServer?: (server: McpServer) => void | Promise<void>;
}

// Main MCP plugin for Elysia
export const mcpPlugin = (options: MCPPluginOptions = {}) => {
  // Map to store transports by session ID
  const transports: { [sessionId: string]: ElysiaStreamingHttpTransport } = {};

  // Create MCP server singleton
  const serverInfo = options.serverInfo || {
    name: 'elysia-mcp-server',
    version: '1.0.0',
  };

  const server = new McpServer(serverInfo, {
    capabilities: options.capabilities || {},
  });

  // Setup server with tools, resources, prompts once
  const setupPromise = (async () => {
    if (options.setupServer) {
      await options.setupServer(server);
    }
  })();

  return new Elysia({ name: `mcp-${serverInfo.name}` }).all(
    options.path || '/mcp',
    async ({ request, set }) => {
      const method = request.method;

      try {
        switch (method) {
          case 'POST': {
            // Handle JSON-RPC requests
            const body = await request.json();
            const sessionId = request.headers.get('mcp-session-id');
            const acceptHeader = request.headers.get('accept') || '';
            const supportsSSE = acceptHeader.includes('text/event-stream');

            if (sessionId && transports[sessionId]) {
              // Handle message for existing session
              const transport = transports[sessionId];

              if (supportsSSE) {
                // Return SSE stream for this request
                await transport.handleMessage(body);

                // Set SSE headers
                set.headers['Content-Type'] = 'text/event-stream';
                set.headers['Cache-Control'] = 'no-cache';

                set.headers['Connection'] = 'keep-alive';
                set.headers['Access-Control-Allow-Origin'] = '*';

                // Return the generator stream
                return transport.stream();
              }

              // Handle message and return HTTP 202 for notifications/responses
              await transport.handleMessage(body);
              set.status = 202;
              return;
            }

            if (!sessionId && isInitializeRequest(body)) {
              // New initialization request
              // Ensure server setup is complete before proceeding
              await setupPromise;

              // Create new transport
              const transport = new ElysiaStreamingHttpTransport('/mcp');
              const newSessionId = transport.sessionId;

              // Store transport by session ID
              transports[newSessionId] = transport;

              // Set up transport event handlers
              transport.onclose = () => {
                delete transports[newSessionId];
                if (options.enableLogging) {
                  console.log(`MCP session terminated: ${newSessionId}`);
                }
              };

              // Start the transport
              await transport.start();

              // Connect the singleton server to the new transport
              await server.connect(transport);

              if (options.enableLogging) {
                console.log(`MCP session initialized: ${newSessionId}`);
              }

              // Handle the initialization message through the transport
              await transport.handleMessage(body);

              // Set session ID in response header
              set.headers['Mcp-Session-Id'] = newSessionId;

              if (supportsSSE) {
                // Return SSE stream with initialization response
                set.headers['Content-Type'] = 'text/event-stream';
                set.headers['Cache-Control'] = 'no-cache';
                set.headers['Connection'] = 'keep-alive';
                set.headers['Access-Control-Allow-Origin'] = '*';

                return transport.stream();
              }

              // For non-SSE initialization, return 202 accepted
              set.status = 202;
              return;
            }
            // Invalid request
            set.status = 400;
            return {
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message:
                  'Bad Request: No valid session ID provided or invalid initialize request',
              },
            };
          }

          case 'GET': {
            // Handle Server-Sent Events streaming
            const sessionId = request.headers.get('mcp-session-id');

            if (!sessionId || !transports[sessionId]) {
              set.status = 400;
              return { error: 'Invalid or missing session ID' };
            }

            const transport = transports[sessionId];

            // Set SSE headers
            set.headers['Content-Type'] = 'text/event-stream';
            set.headers['Cache-Control'] = 'no-cache';
            set.headers['Connection'] = 'keep-alive';
            set.headers['Access-Control-Allow-Origin'] = '*';

            // Return the generator stream
            return transport.stream();
          }

          case 'DELETE': {
            // Handle session termination
            const sessionId = request.headers.get('mcp-session-id');

            if (!sessionId || !transports[sessionId]) {
              set.status = 400;
              return { error: 'Invalid or missing session ID' };
            }

            const transport = transports[sessionId];

            // Close the transport
            await transport.close();

            return { success: true, message: 'Session terminated' };
          }

          default:
            set.status = 405;
            return { error: 'Method not allowed' };
        }
      } catch (error) {
        set.status = 500;
        return {
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: `Internal error: ${error}`,
          },
          id: null,
        };
      }
    }
  );
};
