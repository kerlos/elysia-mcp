import { Elysia } from 'elysia';
import type { Context } from 'elysia';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ErrorCode,
  type ServerCapabilities,
} from '@modelcontextprotocol/sdk/types.js';
import { handleRequest } from './handlers';
import { Logger } from './utils/logger';
import { createJSONRPCError } from './utils/jsonrpc';

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

// Main MCP plugin for Elysia
export const mcp = (options: MCPPluginOptions = {}) => {
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

  const basePath = options.basePath || '/mcp';
  const enableLogging = options.enableLogging ?? false;

  const app = new Elysia({ name: `mcp-${serverInfo.name}` });

  // Shared handler function
  const mcpHandler = async ({ request, set }: Context) => {
    try {
      await setupPromise;
      return await handleRequest({
        request,
        set,
        server,
        enableLogging,
        basePath,
      });
    } catch (error) {
      return createJSONRPCError(
        error instanceof Error ? error.message : 'Internal error',
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
