import { Elysia } from 'elysia';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import {
  BaseHandler,
  ToolsHandler,
  ResourcesHandler,
  PromptsHandler,
  getHandlerType,
} from './handlers/index.js';

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
export const mcpPlugin = (options: MCPPluginOptions = {}) => {
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

  // Create handlers for different request types
  const createHandlers = (basePath: string, enableLogging: boolean) => ({
    general: new BaseHandler(server, enableLogging, basePath),
    tools: new ToolsHandler(server, enableLogging, basePath),
    resources: new ResourcesHandler(server, enableLogging, basePath),
    prompts: new PromptsHandler(server, enableLogging, basePath),
  });

  const basePath = options.basePath || '/mcp';
  const handlers = createHandlers(basePath, options.enableLogging || false);

  return new Elysia({ name: `mcp-${serverInfo.name}` })
    .all(basePath, async ({ request, set }) => {
      // Ensure server setup is complete before proceeding
      await setupPromise;

      // Determine handler type and use appropriate handler
      const handlerType = getHandlerType(request.url);
      const handler = handlers[handlerType];

      return await handler.handleRequest({ request, set });
    })
    .all(`${basePath}/tools`, async ({ request, set }) => {
      // Ensure server setup is complete before proceeding
      await setupPromise;

      if (options.enableLogging) {
        console.log(`🔧 Tools endpoint: ${request.method} ${request.url}`);
      }

      return await handlers.tools.handleRequest({ request, set });
    })
    .all(`${basePath}/resources`, async ({ request, set }) => {
      // Ensure server setup is complete before proceeding
      await setupPromise;

      if (options.enableLogging) {
        console.log(`📂 Resources endpoint: ${request.method} ${request.url}`);
      }

      return await handlers.resources.handleRequest({ request, set });
    })
    .all(`${basePath}/prompts`, async ({ request, set }) => {
      // Ensure server setup is complete before proceeding
      await setupPromise;

      if (options.enableLogging) {
        console.log(`💬 Prompts endpoint: ${request.method} ${request.url}`);
      }

      return await handlers.prompts.handleRequest({ request, set });
    });
};
