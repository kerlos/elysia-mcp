import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Context } from 'elysia';
import { ElysiaStreamingHttpTransport } from '../transport';
import {
  ErrorCode,
  isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';
import {
  createJSONRPCError,
  createJSONRPCResponse,
  type JSONRPCResponseType,
  parseJSONRPCRequest,
} from '../utils/jsonrpc';
import { Logger } from '../utils/logger';

// Session management
export const transports: { [sessionId: string]: ElysiaStreamingHttpTransport } =
  {};

// Base handler interface
export interface HandlerContext {
  request: Request;
  set: Context['set'];
  server: McpServer;
  enableLogging?: boolean;
  basePath: string;
}

// Common handler functionality
export class BaseHandler {
  protected logger: Logger;

  constructor(
    protected server: McpServer,
    protected enableLogging = false,
    protected basePath = '/mcp'
  ) {
    this.logger = new Logger(enableLogging);
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
    const method = request.method;

    try {
      switch (method) {
        case 'POST':
          return await this.handlePost(request, set);
        case 'GET':
          return await this.handleGet(request, set);
        case 'DELETE':
          return await this.handleDelete(request, set);
        default:
          set.status = 405;
          return { error: 'Method not allowed' };
      }
    } catch (error) {
      set.status = 500;
      return this.createErrorResponse(error);
    }
  }

  protected async handlePost(
    request: Request,
    set: Context['set']
  ): Promise<
    AsyncGenerator<string, void, unknown> | JSONRPCResponseType | undefined
  > {
    const body = await parseJSONRPCRequest(request, this.logger);
    const sessionId = request.headers.get('mcp-session-id');
    const acceptHeader = request.headers.get('accept') || '';
    const supportsSSE = acceptHeader.includes('text/event-stream');

    if (sessionId && transports[sessionId]) {
      return await this.handleExistingSession(
        body,
        sessionId,
        supportsSSE,
        set
      );
    }

    if (!sessionId && isInitializeRequest(body)) {
      return await this.handleInitialization(body, supportsSSE, set);
    }

    // Invalid request
    set.status = 400;
    return this.createErrorResponse(
      'No valid session ID provided or invalid initialize request'
    );
  }

  protected async handleGet(request: Request, set: Context['set']) {
    const sessionId = request.headers.get('mcp-session-id');

    if (!sessionId || !transports[sessionId]) {
      set.status = 400;
      return { error: 'Invalid or missing session ID' };
    }

    const transport = transports[sessionId];
    this.setSSEHeaders(set);
    return transport.stream();
  }

  protected async handleDelete(
    request: Request,
    set: Context['set']
  ): Promise<JSONRPCResponseType> {
    const sessionId = request.headers.get('mcp-session-id');

    if (!sessionId || !transports[sessionId]) {
      set.status = 400;
      return { error: 'Invalid or missing session ID' };
    }

    const transport = transports[sessionId];
    await transport.close();
    return createJSONRPCResponse(0, {
      success: true,
      message: 'Session terminated',
    });
  }

  protected async handleExistingSession(
    body: unknown,
    sessionId: string,
    supportsSSE: boolean,
    set: Context['set']
  ) {
    const transport = transports[sessionId];

    if (supportsSSE) {
      await transport.handleMessage(body);
      this.setSSEHeaders(set);
      return transport.stream();
    }

    await transport.handleMessage(body);
    set.status = 202;
    return;
  }

  protected async handleInitialization(
    body: unknown,
    supportsSSE: boolean,
    set: Context['set']
  ) {
    // Create new transport
    const transport = new ElysiaStreamingHttpTransport(
      this.basePath,
      this.enableLogging
    );
    const newSessionId = transport.sessionId;

    // Store transport by session ID
    transports[newSessionId] = transport;

    // Set up transport event handlers
    transport.onclose = () => {
      delete transports[newSessionId];
      this.logger.log(`MCP session terminated: ${newSessionId}`);
    };

    // Start the transport
    await transport.start();

    // Connect the server to the new transport
    await this.server.connect(transport);

    this.logger.log(`MCP session initialized: ${newSessionId}`);

    // Handle the initialization message through the transport
    await transport.handleMessage(body);

    // Set session ID in response header
    set.headers['Mcp-Session-Id'] = newSessionId;

    if (supportsSSE) {
      this.setSSEHeaders(set);
      return transport.stream();
    }

    // For non-SSE initialization, return 202 accepted
    set.status = 202;
    return;
  }

  protected setSSEHeaders(set: Context['set']) {
    set.headers['Content-Type'] = 'text/event-stream';
    set.headers['Cache-Control'] = 'no-cache';
    set.headers['Connection'] = 'keep-alive';
    set.headers['Access-Control-Allow-Origin'] = '*';
  }

  protected createErrorResponse(
    error: unknown,
    code: ErrorCode = ErrorCode.InternalError,
    id: number | string = 0
  ) {
    return createJSONRPCError(
      error instanceof Error ? error.message : String(error),
      id,
      code
    );
  }
}

// Utility function to determine handler type from URL
export function getHandlerType(
  urlString: string
): 'tools' | 'resources' | 'prompts' | 'general' {
  try {
    const url = new URL(urlString);
    const pathname = url.pathname;

    if (pathname.includes('/tools')) return 'tools';
    if (pathname.includes('/resources')) return 'resources';
    if (pathname.includes('/prompts')) return 'prompts';

    return 'general';
  } catch {
    // Fallback for invalid URLs
    if (urlString.includes('/tools')) return 'tools';
    if (urlString.includes('/resources')) return 'resources';
    if (urlString.includes('/prompts')) return 'prompts';
    return 'general';
  }
}
