import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Context } from 'elysia';
import { BaseHandler } from './base-handler.js';
import {
  type JSONRPCResponseType,
  parseJSONRPCRequest,
} from '../utils/jsonrpc.js';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * Handler for MCP resources-related requests
 * Handles requests to endpoints containing '/resources'
 */
export class ResourcesHandler extends BaseHandler {
  constructor(server: McpServer, enableLogging = false, basePath = '/mcp') {
    super(server, enableLogging, `${basePath}/resources`);
  }

  async handleRequest({
    request,
    set,
  }: {
    request: Request;
    set: Context['set'];
  }) {
    // Log resources-specific requests if logging is enabled
    if (this.enableLogging) {
      console.log(`📂 Resources Handler: ${request.method} ${request.url}`);
    }

    // For resources endpoints, we might want to add specific validation
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
      const body = await parseJSONRPCRequest(request);

      // Add resources-specific validation or preprocessing if needed
      if (this.enableLogging && body?.method) {
        console.log(`📂 Resources method: ${body.method}`);

        // Log resource URIs for debugging
        if (body.method === 'resources/read' && body.params?.uri) {
          console.log(`📂 Reading resource: ${body.params.uri}`);
        }
      }

      return await super.handlePost(request, set);
    } catch (error) {
      set.status = 400;
      return this.createErrorResponse(
        'Invalid JSON in resources request',
        ErrorCode.ParseError
      );
    }
  }

  protected async handleGet(request: Request, set: Context['set']) {
    // Resources might support direct GET requests for resource content
    // in addition to the standard MCP protocol
    const url = new URL(request.url);
    const resourcePath = url.searchParams.get('uri');

    if (this.enableLogging && resourcePath) {
      console.log(`📂 Direct resource access: ${resourcePath}`);
    }

    return await super.handleGet(request, set);
  }
}
