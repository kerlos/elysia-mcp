// Main exports for elysia-mcp
export { mcp } from './mcp-plugin.js';
export { ElysiaStreamingHttpTransport as SSEElysiaTransport } from './transport.js';
export type { MCPPluginOptions } from './mcp-plugin.js';

// Export handlers for advanced usage
export {
  BaseHandler,
  ToolsHandler,
  ResourcesHandler,
  PromptsHandler,
  getHandlerType,
} from './handlers/index.js';
export type { HandlerContext } from './handlers/index.js';

// Export content types and utilities
export type {
  TextContent,
  ImageContent,
  AudioContent,
  ResourceContent,
  PromptContent,
  PromptMessage,
} from './types.js';
export {
  createTextContent,
  createImageContent,
  createAudioContent,
  createResourceContent,
} from './types.js';

// Re-export useful types from MCP SDK
export type {
  ServerCapabilities,
  Tool,
  Resource,
  Prompt,
} from '@modelcontextprotocol/sdk/types.js';
export { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
