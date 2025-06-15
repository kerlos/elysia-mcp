import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  isInitializeRequest,
  isJSONRPCError,
  isJSONRPCRequest,
  isJSONRPCResponse,
  JSONRPCMessageSchema,
  SUPPORTED_PROTOCOL_VERSIONS,
  type JSONRPCMessage,
  type RequestId,
} from '@modelcontextprotocol/sdk/types.js';
import { Logger } from './utils/logger';
import type { Context } from 'elysia';
import type {
  JSONRPCError,
  McpContext,
  StreamableHTTPServerTransportOptions,
} from './types';
import type { EventStore } from './types';

/**
 * Configuration options for StreamableHTTPServerTransport
 */
export class ElysiaStreamingHttpTransport implements Transport {
  private _started = false;
  private _initialized = false;
  private _streamMapping = new Map<
    string,
    {
      ctx: McpContext;
      stream?: AsyncGenerator<string>;
      resolve?: (data: JSONRPCMessage | JSONRPCMessage[] | null) => void;
    }
  >();
  private _requestToStreamMapping = new Map<RequestId, string>();
  private _requestResponseMap = new Map<RequestId, JSONRPCMessage>();
  private _standaloneSseStreamId = '_GET_stream';
  private logger: Logger;

  sessionId?: string;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage, extra?: { authInfo?: unknown }) => void;
  sessionIdGenerator: (() => string) | undefined;
  _enableJsonResponse: boolean;
  _eventStore: EventStore | undefined;
  _onsessioninitialized: ((sessionId: string) => void) | undefined;

  private _messageQueue: string[] = [];
  private _eventIdToMessageMap: Map<string, JSONRPCMessage> = new Map();
  private _streamIdToEventIdsMap: Map<string, string[]> = new Map();

  constructor(options: StreamableHTTPServerTransportOptions) {
    this.sessionIdGenerator = options.sessionIdGenerator;
    this._enableJsonResponse = options.enableJsonResponse ?? false;
    this._eventStore = options.eventStore;
    this._onsessioninitialized = options.onsessioninitialized;
    this.logger = new Logger(options.enableLogging ?? false);
  }

  async start(): Promise<void> {
    if (this._started) {
      throw new Error('Transport already started');
    }
    this._started = true;
    this.logger.log(`[Transport] Starting transport`);
  }

  private writeSSEEvent(
    stream: AsyncGenerator<string>,
    message: JSONRPCMessage,
    eventId?: string
  ): boolean {
    try {
      let eventData = `event: message\n`;
      if (eventId) {
        eventData += `id: ${eventId}\n`;
      }
      eventData += `data: ${JSON.stringify(message)}\n\n`;

      // Queue the event for streaming
      this._messageQueue.push(eventData);
      return true;
    } catch (error) {
      this.logger.error(`[Transport] Error writing SSE event:`, error);
      this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  // Generator function for Elysia streaming
  async *stream(): AsyncGenerator<string, void, unknown> {
    while (this._started) {
      if (this._messageQueue.length > 0) {
        const messagesToSend: string[] = [];
        do {
          const message = this._messageQueue.shift();
          if (message) {
            messagesToSend.push(message);
          }
        } while (this._messageQueue.length > 0);
        if (messagesToSend.length === 1) {
          yield messagesToSend[0];
        }
        yield JSON.stringify(messagesToSend);
      }
      // Small delay to prevent tight loop
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  async handleRequest(context: McpContext) {
    const { request } = context;
    const method = request.method;
    switch (method) {
      case 'GET':
        return this.handleGetRequest(context);
      case 'POST':
        return this.handlePostRequest(context);
      case 'DELETE':
        return this.handleDeleteRequest(context);
      default:
        return this.handleUnsupportedRequest(context);
    }
  }

  protected async handleGetRequest(context: McpContext) {
    const { set, headers } = context;
    const acceptHeader = headers['accept'];
    if (!acceptHeader?.includes('text/event-stream')) {
      set.status = 406;
      return {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Not Acceptable: Client must accept text/event-stream',
        },
        id: null,
      };
    }

    const { valid, status, response } = this.validateSession(context);
    if (!valid) {
      set.status = status;
      return response;
    }

    // Handle resumability: check for Last-Event-ID header
    if (this._eventStore) {
      const lastEventId = headers['last-event-id'] as string | undefined;
      if (lastEventId) {
        await this.replayEvents(lastEventId, context);
        return;
      }
    }

    const path = context.request.url;
    const url = new URL(path);

    if (path.includes('/resources')) {
      const resourcePath = url.searchParams.get('uri');
      if (resourcePath) {
        this.logger.log(`Direct resource access: ${resourcePath}`);
      }
    } else if (path.includes('/prompts')) {
      const promptName = url.searchParams.get('name');
      if (promptName) {
        this.logger.log(`Direct prompt access: ${promptName}`);
      } else {
        this.logger.log(`Direct prompts listing`);
      }
    }

    set.headers = {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    };

    if (this.sessionId !== undefined) {
      set.headers['mcp-session-id'] = this.sessionId;
    }

    if (this._streamMapping.get(this._standaloneSseStreamId) !== undefined) {
      set.status = 409;
      return {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Conflict: Only one SSE stream is allowed per session',
        },
        id: null,
      };
    }

    set.status = 200;

    const stream = this.stream();
    this._streamMapping.set(this._standaloneSseStreamId, {
      ctx: context,
      stream,
    });
    return stream;
  }

  protected async handlePostRequest(context: McpContext) {
    const { request, set, headers, body } = context;

    try {
      const acceptHeader = headers['accept'];

      if (
        !acceptHeader?.includes('text/event-stream') ||
        !acceptHeader?.includes('application/json')
      ) {
        set.status = 406;
        return {
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message:
              'Not Acceptable: Client must accept both application/json and text/event-stream',
          },
          id: null,
        };
      }

      const ct = request.headers.get('content-type');
      if (!ct || !ct.includes('application/json')) {
        set.status = 415;
        return {
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message:
              'Unsupported Media Type: Content-Type must be application/json',
          },
          id: null,
        };
      }
      const authInfo = context.store.authInfo;
      const rawMessage = body;

      const messages: JSONRPCMessage[] = Array.isArray(rawMessage)
        ? rawMessage.map((msg) => JSONRPCMessageSchema.parse(msg))
        : [JSONRPCMessageSchema.parse(rawMessage)];

      const isInitializationRequest = messages.some(isInitializeRequest);
      if (isInitializationRequest) {
        if (this._initialized && this.sessionId !== undefined) {
          set.status = 400;
          return {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Invalid Request: Server already initialized',
            },
            id: null,
          };
        }
        if (messages.length > 1) {
          set.status = 400;
          return {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message:
                'Invalid Request: Only one initialization request is allowed',
            },
            id: null,
          };
        }
        this.sessionId = this.sessionIdGenerator?.();
        if (this.sessionId) {
          this._onsessioninitialized?.(this.sessionId);
        }
        this._initialized = true;
      }

      const { valid, status, response } = this.validateSession(context);
      if (!isInitializationRequest && !valid) {
        set.status = status;
        return response;
      }

      const hasRequests = messages.some(isJSONRPCRequest);
      if (!hasRequests) {
        // if it only contains notifications or responses, return 202
        set.status = 202;
        for (const message of messages) {
          this.logMessage(message);
          this.onmessage?.(message, { authInfo });
        }
        return;
      }

      const streamId = Bun.randomUUIDv7();

      if (this._enableJsonResponse) {
        // Set headers for JSON response
        set.headers = {
          'content-type': 'application/json',
        };
        if (this.sessionId !== undefined) {
          set.headers['mcp-session-id'] = this.sessionId;
        }
        set.status = 200;

        const resultPromise = new Promise<
          JSONRPCMessage | JSONRPCMessage[] | null
        >((resolve) => {
          this._streamMapping.set(streamId, {
            ctx: context,
            resolve: resolve,
          });
        });

        for (const message of messages) {
          if (isJSONRPCRequest(message)) {
            this._requestToStreamMapping.set(message.id, streamId);
          }
          this.logMessage(message);
          this.onmessage?.(message, { authInfo });
        }
        return resultPromise;
      }

      // Else (if _enableJsonResponse is false), handle as SSE stream
      set.headers = {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      };
      if (this.sessionId !== undefined) {
        set.headers['mcp-session-id'] = this.sessionId;
      }
      set.status = 200;

      const stream = this.stream();
      this._streamMapping.set(streamId, { ctx: context, stream });

      for (const message of messages) {
        if (isJSONRPCRequest(message)) {
          this._requestToStreamMapping.set(message.id, streamId);
        }
        this.logMessage(message);
        this.onmessage?.(message, { authInfo });
      }

      const keepAlive = setInterval(() => {
        const currentStream = this._streamMapping.get(streamId)?.stream;
        if (this._started && currentStream) {
          this.writeSSEEvent(currentStream, {
            jsonrpc: '2.0',
            method: 'ping',
            params: {},
            id: 'ping',
          });
        }
      }, 30000);
      this.onclose = () => {
        clearInterval(keepAlive);
      };
      return stream;
    } catch (error) {
      set.status = 400;
      this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      this.logger.error('Error handling MCP request', JSON.stringify(error));
      return {
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: 'Parse error',
          data: String(error),
        },
        id: null,
      };
    }
  }

  protected async handleDeleteRequest(context: McpContext) {
    const { request, set } = context;
    const { valid, status, response } = this.validateSession(context);
    if (!valid) {
      set.status = status;
      return response;
    }
    await this.close();
    set.status = 200;
  }

  protected async handleUnsupportedRequest({
    set,
  }: Context): Promise<JSONRPCError> {
    set.status = 405;
    set.headers = {
      Allow: 'GET, POST, DELETE',
    };
    return {
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.',
      },
      id: null,
    };
  }

  private validateSession({ request }: Context): {
    valid: boolean;
    status?: number;
    response?: JSONRPCError;
  } {
    if (this.sessionIdGenerator === undefined) {
      return { valid: true, status: 200 };
    }
    if (!this._initialized) {
      return {
        valid: false,
        status: 400,
        response: {
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Server not initialized',
          },
          id: null,
        },
      };
    }

    const sessionId = request.headers.get('mcp-session-id');

    if (!sessionId) {
      return {
        valid: false,
        status: 400,
        response: {
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Mcp-Session-Id header is required',
          },
          id: null,
        },
      };
    }

    if (Array.isArray(sessionId)) {
      return {
        valid: false,
        status: 400,
        response: {
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message:
              'Bad Request: Mcp-Session-Id header must be a single value',
          },
          id: null,
        },
      };
    }

    if (sessionId !== this.sessionId) {
      return {
        valid: false,
        status: 404,
        response: {
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Session not found',
          },
          id: null,
        },
      };
    }

    const protocolVersion = request.headers.get('mcp-protocol-version');

    if (
      protocolVersion &&
      !SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion)
    ) {
      return {
        valid: false,
        status: 400,
        response: {
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Unsupported protocol version',
          },
          id: null,
        },
      };
    }

    return { valid: true, status: 200 };
  }

  async close(): Promise<void> {
    this._streamMapping.clear();
    this._requestResponseMap.clear();
    this._requestToStreamMapping.clear();
    this._eventIdToMessageMap.clear();
    this._streamIdToEventIdsMap.clear();
    this._started = false;
    this.onclose?.();
  }

  async send(
    message: JSONRPCMessage,
    options?: { relatedRequestId?: RequestId }
  ): Promise<void> {
    const requestId =
      options?.relatedRequestId ??
      (isJSONRPCResponse(message) || isJSONRPCError(message)
        ? (message as { id?: RequestId }).id
        : undefined);

    if (requestId === undefined) {
      if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
        throw new Error('Cannot send a response on a standalone SSE stream');
      }
      const standaloneSse = this._streamMapping.get(
        this._standaloneSseStreamId
      );
      if (standaloneSse === undefined) {
        return;
      }

      // Generate and store event ID if event store is provided
      const eventId = await this.storeEvent(
        this._standaloneSseStreamId,
        message
      );
      this.logger.debug(
        `sending message RequestId: ${requestId} EventId: ${eventId} Message: ${JSON.stringify(
          message
        )}`
      );
      if (standaloneSse.stream) {
        this.writeSSEEvent(standaloneSse.stream, message, eventId);
      }
      return;
    }

    const streamId = this._requestToStreamMapping.get(requestId);
    if (!streamId) {
      throw new Error(
        `No connection established for request ID: ${String(requestId)}`
      );
    }

    const stream = this._streamMapping.get(streamId);
    if (!stream) {
      throw new Error(`No stream found for stream ID: ${streamId}`);
    }

    if (!this._enableJsonResponse) {
      // Generate and store event ID if event store is provided
      const eventId = await this.storeEvent(streamId, message);
      if (stream.stream) {
        this.writeSSEEvent(stream.stream, message, eventId);
      }
    }

    if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
      this._requestResponseMap.set(requestId, message);
      const relatedIds = Array.from(this._requestToStreamMapping.entries())
        .filter(([_, sid]) => this._streamMapping.get(sid) === stream)
        .map(([id]) => id);

      const allResponsesReady = relatedIds.every((id) =>
        this._requestResponseMap.has(id)
      );

      if (allResponsesReady) {
        if (this._enableJsonResponse) {
          // All responses ready, send as JSON
          const headers: Record<string, string> = {
            'content-type': 'application/json',
          };
          if (this.sessionId !== undefined) {
            headers['mcp-session-id'] = this.sessionId;
          }

          const responses = relatedIds
            .map((id) => this._requestResponseMap.get(id))
            .filter((response) => response !== undefined);

          if (responses.length === 0) {
            stream.resolve?.(null);
          } else if (responses.length === 1) {
            stream.resolve?.(responses[0]);
          } else {
            stream.resolve?.(responses);
          }
        } else {
          if (stream.stream) {
            stream.stream.return(null);
          }
        }
        for (const id of relatedIds) {
          this._requestResponseMap.delete(id);
          this._requestToStreamMapping.delete(id);
        }
      }
    }
  }

  private async storeEvent(
    streamId: string,
    message: JSONRPCMessage
  ): Promise<string | undefined> {
    if (!this._eventStore) {
      return undefined;
    }

    try {
      const eventId = await this._eventStore.storeEvent(streamId, message);
      this._eventIdToMessageMap.set(eventId, message);

      // Track event IDs per stream for replay
      const eventIds = this._streamIdToEventIdsMap.get(streamId) || [];
      eventIds.push(eventId);
      this._streamIdToEventIdsMap.set(streamId, eventIds);

      return eventId;
    } catch (error) {
      this.logger.error(`[Transport] Error storing event:`, error);
      this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      return undefined;
    }
  }

  private async replayEvents(
    lastEventId: string,
    context: McpContext
  ): Promise<void> {
    if (!this._eventStore) {
      return;
    }

    try {
      const setHeaders: Record<string, string> = {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      };
      if (this.sessionId !== undefined) {
        setHeaders['mcp-session-id'] = this.sessionId;
      }
      context.set.headers = setHeaders;
      context.set.status = 200;

      const stream = this.stream();
      const streamId = await this._eventStore.replayEventsAfter(lastEventId, {
        send: async (eventId: string, message: JSONRPCMessage) => {
          if (!this.writeSSEEvent(stream, message, eventId)) {
            this.onerror?.(new Error('Failed to replay events'));
            return;
          }
        },
      });

      this._streamMapping.set(streamId, { ctx: context, stream });
    } catch (error) {
      this.logger.error(`[Transport] Error replaying events:`, error);
      this.onerror?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private logMessage(message: JSONRPCMessage) {
    if ('method' in message) {
      this.logger.log(
        `method: ${message.method} ${
          message.params ? 'params: ' + JSON.stringify(message.params) : ''
        }`
      );
    }
  }
}
