import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Context } from 'elysia';
import { BaseHandler } from './base-handler.js';
import {
  type JSONRPCResponseType,
  parseJSONRPCRequest,
} from '../utils/jsonrpc.js';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * Handler for MCP prompts-related requests
 * Handles requests to endpoints containing '/prompts'
 */
export class PromptsHandler extends BaseHandler {
  constructor(server: McpServer, enableLogging = false, basePath = '/mcp') {
    super(server, enableLogging, `${basePath}/prompts`);
  }

  async handleRequest({
    request,
    set,
  }: {
    request: Request;
    set: Context['set'];
  }) {
    // Log prompts-specific requests if logging is enabled
    if (this.enableLogging) {
      console.log(`💬 Prompts Handler: ${request.method} ${request.url}`);
    }

    // For prompts endpoints, we might want to add specific validation
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

      // Add prompts-specific validation or preprocessing if needed
      if (this.enableLogging && body?.method) {
        console.log(`💬 Prompts method: ${body.method}`);

        // Log prompt names and arguments for debugging
        if (body.method === 'prompts/get' && body.params?.name) {
          console.log(`💬 Getting prompt: ${body.params.name}`);
          if (body.params.arguments) {
            console.log(
              `💬 With arguments:`,
              Object.keys(body.params.arguments)
            );
          }
        }

        if (body.method === 'prompts/list') {
          console.log(`💬 Listing available prompts`);
        }
      }

      return await super.handlePost(request, set);
    } catch (error) {
      set.status = 400;
      return this.createErrorResponse(
        'Invalid JSON in prompts request',
        ErrorCode.ParseError
      );
    }
  }

  protected async handleGet(request: Request, set: Context['set']) {
    // Prompts might support direct GET requests for listing prompts
    // in addition to the standard MCP protocol
    const url = new URL(request.url);
    const promptName = url.searchParams.get('name');

    if (this.enableLogging) {
      if (promptName) {
        console.log(`💬 Direct prompt access: ${promptName}`);
      } else {
        console.log(`💬 Direct prompts listing`);
      }
    }

    return await super.handleGet(request, set);
  }
}
