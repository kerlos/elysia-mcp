import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Context } from 'elysia';
import { BaseHandler } from './base-handler.js';

/**
 * Handler for MCP tools-related requests
 * Handles requests to endpoints containing '/tools'
 */
export class ToolsHandler extends BaseHandler {
  constructor(server: McpServer, enableLogging = false, basePath = '/mcp') {
    super(server, enableLogging, `${basePath}/tools`);
  }

  async handleRequest({
    request,
    set,
  }: {
    request: Request;
    set: Context['set'];
  }) {
    // Log tools-specific requests if logging is enabled
    if (this.enableLogging) {
      console.log(`🔧 Tools Handler: ${request.method} ${request.url}`);
    }

    // For tools endpoints, we might want to add specific validation
    // or preprocessing before handling the request
    return await super.handleRequest({ request, set });
  }

  protected async handlePost(request: Request, set: Context['set']) {
    try {
      const body = await request.json();

      // Add tools-specific validation or preprocessing if needed
      if (this.enableLogging && body?.method) {
        console.log(`🔧 Tools method: ${body.method}`);
      }

      return await super.handlePost(request, set);
    } catch (error) {
      set.status = 400;
      return this.createErrorResponse('Invalid JSON in tools request');
    }
  }

  protected createErrorResponse(error: unknown, id: unknown = null) {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: `Tools Handler Error: ${error}`,
      },
      id,
    };
  }
}
