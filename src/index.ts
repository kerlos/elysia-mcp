// Main exports for elysia-mcp
export { mcp } from './mcp-plugin';
export { ElysiaStreamingHttpTransport as SSEElysiaTransport } from './transport';
export type { MCPPluginOptions } from './mcp-plugin';

// Export handlers for advanced usage
export {
  BaseHandler,
  ToolsHandler,
  ResourcesHandler,
  PromptsHandler,
  getHandlerType,
} from './handlers/index';
export type { HandlerContext } from './handlers/index';

// Export content types and utilities
export type {
  TextContent,
  ImageContent,
  AudioContent,
  ResourceContent,
  PromptContent,
  PromptMessage,
} from './types';
export {
  createTextContent,
  createImageContent,
  createAudioContent,
  createResourceContent,
} from './types';

// Re-export useful types from MCP SDK
export type {
  ServerCapabilities,
  Tool,
  Resource,
  Prompt,
} from '@modelcontextprotocol/sdk/types.js';
export { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
