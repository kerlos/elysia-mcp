import {
  type JSONRPCRequest,
  type JSONRPCResponse,
  type JSONRPCError,
  type JSONRPCMessage,
  JSONRPCRequestSchema,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * JSON-RPC response types
 */
export type JSONRPCResponseType =
  | JSONRPCResponse
  | JSONRPCError
  | {
      error: string;
    };

/**
 * Parse and validate a JSON body as JSON-RPC request
 */
export async function parseJSONRPCRequest(
  request: Request
): Promise<JSONRPCRequest> {
  if (request.method !== 'POST') {
    throw new Error(
      'Method not allowed. Only POST requests are supported for MCP endpoints.'
    );
  }

  try {
    const rawBody = await request.json();

    // Validate against JSON-RPC request schema
    const jsonrpcRequest = JSONRPCRequestSchema.parse(rawBody);

    return jsonrpcRequest as JSONRPCRequest;
  } catch (error) {
    throw new Error(
      `Invalid JSON-RPC request format: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Create a properly typed JSON-RPC success response
 */
export function createJSONRPCResponse(
  id: string | number,
  result: Record<string, unknown>
): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      ...result,
    },
  };
}

/**
 * Create a properly typed JSON-RPC error response
 */
export function createJSONRPCError(
  message: string,
  id: string | number = 0,
  code: ErrorCode = ErrorCode.InternalError,
  data?: unknown
): JSONRPCError {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data,
    },
  };
}

/**
 * Create a pong response for ping requests
 */
export function createPongResponse(
  pingRequest: JSONRPCRequest
): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id: pingRequest.id,
    result: {},
  };
}

/**
 * Type guard to check if a request is a ping request
 */
export function isPingRequest(request: JSONRPCRequest): boolean {
  return request.method === 'ping';
}
