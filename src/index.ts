// Main exports for elysia-mcp
export { mcpPlugin } from './mcp-plugin.js';
export { ElysiaStreamingHttpTransport as SSEElysiaTransport } from './transport.js';
export type { MCPPluginOptions } from './mcp-plugin.js';

// Re-export useful types from MCP SDK
export type {
  ServerCapabilities,
  Tool,
  Resource,
  Prompt,
} from '@modelcontextprotocol/sdk/types.js';
export { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
