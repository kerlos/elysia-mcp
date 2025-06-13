import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Context } from 'elysia';
import { ElysiaStreamingHttpTransport } from '../transport';
import {
  ErrorCode,
  isInitializeRequest,
  type JSONRPCMessage,
} from '@modelcontextprotocol/sdk/types.js';
import {
  createJSONRPCError,
  createJSONRPCResponse,
  type JSONRPCResponseType,
  parseJSONRPCMessage,
} from '../utils/jsonrpc';
import { Logger } from '../utils/logger';

// Session management
export const transports: Record<string, ElysiaStreamingHttpTransport> = {};

// Handler context type
export interface HandlerContext {
  request: Request;
  set: Context['set'];
  server: McpServer;
  enableLogging?: boolean;
  basePath: string;
}

// Helper functions
const setSSEHeaders = (set: Context['set']) => {
  set.headers['Content-Type'] = 'text/event-stream';
  set.headers['Cache-Control'] = 'no-cache';
  set.headers['Connection'] = 'keep-alive';
  set.headers['Access-Control-Allow-Origin'] = '*';
};

const createErrorResponse = (
  error: unknown,
  code: ErrorCode = ErrorCode.InternalError,
  id: number | string = 0
) => {
  return createJSONRPCError(
    error instanceof Error ? error.message : String(error),
    id,
    code
  );
};

// Main handler functions
export const handleRequest = async ({
  request,
  set,
  server,
  enableLogging = false,
  basePath = '/mcp',
}: HandlerContext): Promise<
  AsyncGenerator<string, void, unknown> | JSONRPCResponseType | undefined
> => {
  const logger = new Logger(enableLogging);
  const method = request.method;

  logger.log(`${method} ${request.url}`);

  try {
    const ctx = {
      request,
      set,
      server,
      enableLogging,
      basePath,
    };
    switch (method) {
      case 'POST':
        return await handlePost(ctx);
      case 'GET':
        return await handleGet(ctx);
      case 'DELETE':
        return await handleDelete(ctx);
      default:
        set.status = 405;
        return createErrorResponse(
          'Method not allowed',
          ErrorCode.MethodNotFound
        );
    }
  } catch (error) {
    set.status = 500;
    return createErrorResponse(error);
  }
};

const handlePost = async ({
  request,
  set,
  server,
  enableLogging = false,
  basePath,
}: HandlerContext): Promise<
  AsyncGenerator<string, void, unknown> | JSONRPCResponseType | undefined
> => {
  const logger = new Logger(enableLogging);

  try {
    const body = await parseJSONRPCMessage(request, logger);

    if ('method' in body) {
      logger.log(`Method: ${body.method}`);

      if (
        body.method === 'resources/read' &&
        'params' in body &&
        body.params?.uri
      ) {
        logger.log(`Reading resource: ${body.params.uri}`);
      } else if (
        body.method === 'prompts/get' &&
        'params' in body &&
        body.params?.name
      ) {
        logger.log(`Getting prompt: ${body.params.name}`);
        if (body.params.arguments) {
          logger.log(`With arguments:`, Object.keys(body.params.arguments));
        }
      } else if (body.method === 'prompts/list') {
        logger.log(`Listing available prompts`);
      }
    }

    const sessionId = request.headers.get('mcp-session-id');
    const acceptHeader = request.headers.get('accept') || '';
    const supportsSSE = acceptHeader.includes('text/event-stream');

    if (sessionId && transports[sessionId]) {
      return await handleExistingSession(body, sessionId, supportsSSE, set);
    }

    if (isInitializeRequest(body)) {
      return await handleInitialization(
        body,
        supportsSSE,
        set,
        server,
        basePath,
        enableLogging
      );
    }

    set.status = 400;
    return createErrorResponse(
      'No valid session ID provided or invalid initialize request',
      ErrorCode.InvalidRequest
    );
  } catch (error) {
    set.status = 500;
    return createErrorResponse('Invalid JSON in request', ErrorCode.ParseError);
  }
};

const handleGet = async ({
  request,
  set,
  enableLogging = false,
}: HandlerContext) => {
  const logger = new Logger(enableLogging);
  const url = new URL(request.url);
  const path = url.pathname;

  if (path.includes('/resources')) {
    const resourcePath = url.searchParams.get('uri');
    if (resourcePath) {
      logger.log(`Direct resource access: ${resourcePath}`);
    }
  } else if (path.includes('/prompts')) {
    const promptName = url.searchParams.get('name');
    if (promptName) {
      logger.log(`Direct prompt access: ${promptName}`);
    } else {
      logger.log(`Direct prompts listing`);
    }
  }

  const sessionId = request.headers.get('mcp-session-id');

  if (!sessionId || !transports[sessionId]) {
    set.status = 400;
    return { error: 'Invalid or missing session ID' };
  }

  const transport = transports[sessionId];
  setSSEHeaders(set);
  return transport.stream();
};

const handleDelete = async ({
  request,
  set,
}: HandlerContext): Promise<JSONRPCResponseType> => {
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
};

const handleExistingSession = async (
  body: JSONRPCMessage,
  sessionId: string,
  supportsSSE: boolean,
  set: Context['set']
) => {
  const transport = transports[sessionId];

  if (supportsSSE) {
    //await transport.handleMessage(body);
    setSSEHeaders(set);
    return transport.stream();
  }

  set.status = 202;
  return;
};

const handleInitialization = async (
  body: JSONRPCMessage,
  supportsSSE: boolean,
  set: Context['set'],
  server: McpServer,
  basePath: string,
  enableLogging: boolean
) => {
  const logger = new Logger(enableLogging);

  // Create new transport
  const transport = new ElysiaStreamingHttpTransport(basePath, enableLogging);
  const newSessionId = transport.sessionId;

  // Store transport by session ID
  transports[newSessionId] = transport;

  // Set up transport event handlers
  transport.onclose = () => {
    delete transports[newSessionId];
    logger.log(`MCP session terminated: ${newSessionId}`);
  };

  // Start the transport
  await transport.start();

  // Connect the server to the new transport
  await server.connect(transport);

  logger.log(`MCP session initialized: ${newSessionId}`);

  // Set session ID in response header
  set.headers['Mcp-Session-Id'] = newSessionId;

  if (supportsSSE) {
    setSSEHeaders(set);
    return transport.stream();
  }

  // For non-SSE initialization, return 202 accepted
  set.status = 202;
  return;
};
