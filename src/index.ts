import { Elysia, status } from "elysia";
import type { Context } from "elysia";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ErrorCode,
  isInitializeRequest,
  type ServerCapabilities,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "./utils/logger";
import { ElysiaStreamingHttpTransport } from "./transport";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types";

// Plugin options
export interface MCPPluginOptions {
  basePath?: string;
  serverInfo?: {
    name: string;
    version: string;
  };
  capabilities?: ServerCapabilities;
  enableLogging?: boolean;
  authentication?: (
    context: Context
  ) => Promise<{ authInfo?: AuthInfo; response?: unknown }>;
  setupServer?: (server: McpServer) => void | Promise<void>;
}

export const transports: Record<string, ElysiaStreamingHttpTransport> = {};

// Main MCP plugin for Elysia
export const mcp = (options: MCPPluginOptions = {}) => {
  // Create MCP server singleton
  const serverInfo = options.serverInfo || {
    name: "elysia-mcp-server",
    version: "1.0.0",
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

  const basePath = options.basePath || "/mcp";
  const enableLogging = options.enableLogging ?? false;
  const logger = new Logger(enableLogging);

   // Shared handler function
   const mcpHandler = async (context: Context) => {
    const { request, set, body } = context;
    await setupPromise;

    logger.log(
      `${request.method} ${request.url} ${body ? JSON.stringify(body) : ""}`
    );

    try {
      const sessionId = request.headers.get("mcp-session-id");
      if (sessionId && transports[sessionId]) {
        return await transports[sessionId].handleRequest(context);
      }

      if (!sessionId && isInitializeRequest(body)) {
        const transport = new ElysiaStreamingHttpTransport({
          sessionIdGenerator: () => Bun.randomUUIDv7(),
          onsessioninitialized: (sessionId) => {
            transports[sessionId] = transport;
          },
          enableLogging,
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
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      };
    } catch (error) {
      set.status = 500;
      logger.error("Error handling MCP request", JSON.stringify(error));
      return {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Internal error",
        },
        id: null,
      };
    }
  };

  const app = new Elysia({ name: `mcp-${serverInfo.name}` })
    .state("authInfo", undefined as AuthInfo | undefined)
    .onBeforeHandle(async (context) => {
      if (options.authentication) {
        const { authInfo, response } = await options.authentication(context);
        if (authInfo) {
          context.store.authInfo = authInfo;
          return;
        }
        if (response) {
          return response;
        }
        throw new Error(
          "Invalid authentication, no authInfo or response provided"
        );
      }
    })
    .all(`${basePath}/*`, mcpHandler)
    .all(basePath, mcpHandler);

  return app;
};
