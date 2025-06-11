import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Context } from 'elysia';
import { BaseHandler } from './base-handler';
import {
  type JSONRPCResponseType,
  parseJSONRPCRequest,
} from '../utils/jsonrpc';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

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
  }): Promise<
    AsyncGenerator<string, void, unknown> | JSONRPCResponseType | undefined
  > {
    // Log tools-specific requests if logging is enabled
    this.logger.log(`🔧 Tools Handler: ${request.method} ${request.url}`);

    // For tools endpoints, we might want to add specific validation
    // or preprocessing before handling the request
    return await super.handleRequest({ request, set });
  }

  protected async handlePost(
    request: Request,
    set: Context['set']
  ): Promise<
    AsyncGenerator<string, void, unknown> | JSONRPCResponseType | undefined
  > {
    try {
      const body = await parseJSONRPCRequest(request, this.logger);

      // Add tools-specific validation or preprocessing if needed
      if (body?.method) {
        this.logger.log(`🔧 Tools method: ${body.method}`);
      }

      return await super.handlePost(request, set);
    } catch (error) {
      set.status = 400;
      return this.createErrorResponse(
        'Invalid JSON in tools request',
        ErrorCode.ParseError
      );
    }
  }
}
