import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types";
import type {
  JSONRPCError as JSONRPCErrorRaw,
  JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js";
import type { Context } from "elysia";
// Content types based on MCP specification and FastMCP patterns
export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image";
  data: string;
  mimeType: string;
};

export type AudioContent = {
  type: "audio";
  data: string;
  mimeType: string;
};

export type ResourceContent = {
  type: "resource";
  resource: {
    uri: string;
    mimeType: string;
    text: string;
  };
};

// Resource link content type from MCP specification
export type ResourceLinkContent = {
  type: "resource_link";
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
};

// Union type for all possible content types in tool results
export type ToolContent =
  | TextContent
  | ImageContent
  | AudioContent
  | ResourceContent
  | ResourceLinkContent;

// Tool result type that matches MCP specification exactly
export type ToolResult = {
  content?: ToolContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

// Legacy type for backward compatibility
export type PromptContent =
  | TextContent
  | ImageContent
  | AudioContent
  | ResourceContent;

export type PromptMessage = {
  role: "user" | "assistant";
  content: PromptContent;
};

// Tool definition types from MCP specification
export type ToolInputSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

export type ToolOutputSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

export type Tool = {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  outputSchema?: ToolOutputSchema;
  annotations?: Record<string, unknown>;
};

// Utility function inspired by FastMCP for creating image content
export const createImageContent = (
  data: string,
  mimeType = "image/png"
): ImageContent => ({
  type: "image" as const,
  data,
  mimeType,
});

// Utility function for creating audio content
export const createAudioContent = (
  data: string,
  mimeType = "audio/wav"
): AudioContent => ({
  type: "audio" as const,
  data,
  mimeType,
});

// Utility function for creating resource content
export const createResourceContent = (
  uri: string,
  text: string,
  mimeType = "application/json"
): ResourceContent => ({
  type: "resource" as const,
  resource: {
    uri,
    mimeType,
    text,
  },
});

// Utility function for creating resource link content
export const createResourceLinkContent = (
  uri: string,
  name?: string,
  description?: string,
  mimeType?: string
): ResourceLinkContent => ({
  type: "resource_link" as const,
  uri,
  ...(name && { name }),
  ...(description && { description }),
  ...(mimeType && { mimeType }),
});

// Utility function for creating text content
export const createTextContent = (text: string): TextContent => ({
  type: "text" as const,
  text,
});

// Utility function for creating a successful tool result
export const createToolResult = (
  content: ToolContent[],
  structuredContent?: Record<string, unknown>
): ToolResult => ({
  content,
  ...(structuredContent && { structuredContent }),
  isError: false,
});

// Utility function for creating an error tool result
export const createErrorToolResult = (
  errorMessage: string,
  structuredContent?: Record<string, unknown>
): ToolResult => ({
  content: [createTextContent(errorMessage)],
  ...(structuredContent && { structuredContent }),
  isError: true,
});

// Utility function for creating a tool result with structured content
export const createStructuredToolResult = (
  structuredContent: Record<string, unknown>,
  textContent?: string
): ToolResult => ({
  content: textContent ? [createTextContent(textContent)] : undefined,
  structuredContent,
  isError: false,
});

export type StreamId = string;
export type EventId = string;

export interface EventStore {
  /**
   * Stores an event for later retrieval
   * @param streamId ID of the stream the event belongs to
   * @param message The JSON-RPC message to store
   * @returns The generated event ID for the stored event
   */
  storeEvent(streamId: StreamId, message: JSONRPCMessage): Promise<EventId>;

  replayEventsAfter(
    lastEventId: EventId,
    {
      send,
    }: {
      send: (eventId: EventId, message: JSONRPCMessage) => Promise<void>;
    }
  ): Promise<StreamId>;
}
export interface StreamableHTTPServerTransportOptions {
  /**
   * Function that generates a session ID for the transport.
   * The session ID SHOULD be globally unique and cryptographically secure (e.g., a securely generated UUID, a JWT, or a cryptographic hash)
   *
   * Return undefined to disable session management.
   */
  sessionIdGenerator: (() => string) | undefined;

  /**
   * A callback for session initialization events
   * This is called when the server initializes a new session.
   * Useful in cases when you need to register multiple mcp sessions
   * and need to keep track of them.
   * @param sessionId The generated session ID
   */
  onsessioninitialized?: (sessionId: string) => void;

  /**
   * If true, the server will return JSON responses instead of starting an SSE stream.
   * This can be useful for simple request/response scenarios without streaming.
   * Default is false (SSE streams are preferred).
   */
  enableJsonResponse?: boolean;

  /**
   * Event store for resumability support
   * If provided, resumability will be enabled, allowing clients to reconnect and resume messages
   */
  eventStore?: EventStore;

  enableLogging?: boolean;
}

export type JSONRPCError = Omit<JSONRPCErrorRaw, "id"> & { id: null };

export type McpContext = Context & { store: { authInfo?: AuthInfo } }