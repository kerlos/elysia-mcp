import { Elysia } from "elysia";
import type { Context } from "elysia";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ErrorCode,
  isInitializeRequest,
  type ServerCapabilities,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "./utils/logger";
import { createJSONRPCError } from "./utils/jsonrpc";
import { ElysiaStreamingHttpTransport } from "./transport";

// Plugin options
export interface MCPPluginOptions {
  basePath?: string;
  serverInfo?: {
    name: string;
    version: string;
  };
  capabilities?: ServerCapabilities;
  enableLogging?: boolean;
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
  const app = new Elysia({ name: `mcp-${serverInfo.name}` });

  // Shared handler function
  const mcpHandler = async (context: Context) => {
    const { request, set } = context;

    await setupPromise;

    logger.log(`${request.method} ${request.url}`);

    try {
      const sessionId = request.headers.get("mcp-session-id");
      if (sessionId && transports[sessionId]) {
        return await transports[sessionId].handleRequest(context);
      }

      if (!sessionId && isInitializeRequest(await request.json())) {
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

        return await transport.handleRequest(context);
      }
    } catch (error) {
      set.status = 500;
      logger.error("Error handling MCP request", JSON.stringify(error));
      return createJSONRPCError(
        error instanceof Error ? error.message : "Internal error",
        undefined,
        ErrorCode.InternalError
      );
    }
  };

  // Register both routes
  app.all(`${basePath}/*`, mcpHandler);
  app.all(basePath, mcpHandler);

  return app;
};
