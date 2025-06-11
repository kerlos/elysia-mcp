# Elysia MCP Plugin

A comprehensive ElysiaJS plugin for implementing
[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers
with HTTP transport support.

## Features

- **HTTP Transport**: Full HTTP-based MCP transport with Server-Sent Events (SSE)
- **Session Management**: Stateful session handling via headers
- **Type-Safe**: Built with TypeScript and Zod validation
- **Easy Integration**: Simple plugin architecture for Elysia apps
- **Comprehensive Support**: Tools, Resources, Prompts, and Logging
- **Error Handling**: Proper JSON-RPC 2.0 error responses
- **Testing**: Full unit test coverage with Bun test runner

## Installation

```bash
bun add elysia-mcp
# or
npm install elysia-mcp
```

## Quick Start

```typescript
import { Elysia } from 'elysia';
import { mcpPlugin, McpServer } from 'elysia-mcp';
import { z } from 'zod';

const app = new Elysia()
  .use(
    mcpPlugin({
      serverInfo: {
        name: 'my-mcp-server',
        version: '1.0.0',
      },
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
        logging: {},
      },
      setupServer: async (server: McpServer) => {
        // Register your MCP tools, resources, and prompts here
        server.tool(
          'echo',
          {
            text: z.string().describe('Text to echo back'),
          },
          async (args) => {
            return {
              content: [{ type: 'text', text: `Echo: ${args.text}` }],
            };
          }
        );
      },
    })
  )
  .listen(3000);
```

## Usage

### Running the Example

```bash
# Run the example server
bun run example

# Or with development mode (auto-restart)
bun run dev
```

### Testing with MCP Inspector

1. Install MCP Inspector:

   ```bash
   npx @modelcontextprotocol/inspector
   ```

2. Connect to your server:
   - Transport: `streamable-http`
   - URL: `http://localhost:3000/mcp`

### Configuration Options

- `serverInfo`: Server identification and version
- `capabilities`: MCP capabilities to advertise
- `enableLogging`: Enable debug logging (default: false)
- `setupServer`: Callback to register tools, resources, and prompts

### Session Management

The plugin automatically handles session management via the `Mcp-Session-Id`
header. Each session maintains its own state and can be terminated cleanly.

## API Reference

### Tools

Register tools using the MCP Server instance:

```typescript
server.tool(
  'tool-name',
  {
    param: z.string().describe('Parameter description'),
  },
  async (args) => {
    // Tool implementation
    return {
      content: [{ type: 'text', text: 'Tool result' }],
    };
  }
);
```

### Resources

Register resources for file or data access:

```typescript
server.resource('Resource Name', 'resource://uri', async () => {
  return {
    contents: [
      {
        uri: 'resource://uri',
        mimeType: 'text/plain',
        text: 'Resource content',
      },
    ],
  };
});
```

### Prompts

Register prompt templates:

```typescript
server.prompt(
  'prompt-name',
  'Prompt description',
  {
    param: z.string().describe('Parameter description'),
  },
  async (args) => {
    return {
      description: 'Generated prompt',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Generated prompt with ${args.param}`,
          },
        },
      ],
    };
  }
);
```

## Example

Check out the [complete example](./example/basic-server.ts) that demonstrates:

- Multiple tool types (calculation, validation, system info)
- Resource handling (file access, system information)
- Prompt templates (greeting, code review)
- Error handling and validation
- Service class integration

## Testing

Run the comprehensive test suite:

```bash
bun test
```

The plugin includes 34+ unit tests covering:

- MCP protocol compliance
- Session management
- Error handling
- Tool registration and execution
- HTTP transport functionality

## Requirements

- Bun >= 1.0.0
- Elysia >= 1.0.0
- TypeScript >= 5.0.0

## License

MIT - see [LICENSE](./LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [ElysiaJS](https://elysiajs.com/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

## Unit Testing

The plugin includes a comprehensive unit test suite with 34 tests covering:

### Running Tests

```bash
bun test
```

### Test Coverage

#### Core Plugin Tests (`test/mcp-plugin.test.ts`)

- **Initialization**: Session creation, clientInfo validation, proper JSON-RPC responses
- **Tools Operations**: tools/list, tools/call with various parameter combinations
- **SSE Streaming**: Event-stream headers, session validation, real-time responses
- **Session Management**: Creation, validation, termination
- **HTTP Method Validation**: POST/GET/DELETE support, method rejection
- **Error Handling**: Malformed JSON, missing headers, transport errors

#### Tools Interface Tests (`test/tools-interface.test.ts`)

- **Tools Listing**: Empty params, progressToken metadata, different ID formats
- **Tool Calls**: Basic calls, string/number arguments, missing parameters,
  non-existent tools
- **Session Management**: Header validation, invalid session handling
- **JSON-RPC Compliance**: Different ID types (string/number), protocol version handling
- **Content Type Handling**: Charset variations, case-insensitive headers

### Test Features

- Uses [Elysia's unit testing patterns](https://elysiajs.com/patterns/unit-test)
- **Bun test runner** with Jest-like API
- **Request/Response simulation** using Web Standard APIs
- **Session lifecycle testing** from initialization to termination
- **Error scenario coverage** for robust error handling
- **Type safety validation** with official MCP SDK types

### Example Test Output

```bash
✓ MCP Plugin > POST /mcp - Initialization > should successfully initialize MCP session
✓ MCP Plugin > POST /mcp - Tools Operations > should handle tools/list request
✓ MCP Plugin > GET /mcp - SSE Streaming > should return SSE stream for valid session
✓ MCP Tools Interface Testing > Tool Calls > should handle basic tool call
  request format
✓ MCP Tools Interface Testing > Session Management > should reject tool
  operations without session ID

 34 pass
 0 fail
 59 expect() calls
```

## Plugin Configuration

### Plugin Options

```typescript
interface MCPPluginOptions {
  serverInfo?: {
    name: string;
    version: string;
  };
  capabilities?: ServerCapabilities;
  enableLogging?: boolean;
  setupServer?: (server: McpServer) => void | Promise<void>;
}
```

### Endpoints

- **POST `/mcp`** - JSON-RPC 2.0 interface (initialize + method calls)
- **GET `/mcp`** - Server-Sent Events streaming
- **DELETE `/mcp`** - Session termination

### Headers

- **Request**: `Mcp-Session-Id` (required except for initialize)
- **Response**: `Mcp-Session-Id` (provided on successful initialize)

## Dependencies

- `@modelcontextprotocol/sdk` - Official MCP TypeScript SDK
- `zod` - Schema validation and type safety
- `elysia` - Fast web framework

## Technical Details

- **Protocol Version**: 2024-11-05
- **Session Identification**: UUID-based via `Mcp-Session-Id` header
- **Tool Registration**: `server.tool(name, zodSchema, handler)`
- **Resource Registration**: `server.resource(name, uri, handler)`
- **Prompt Registration**: `server.prompt(name, description, zodSchema, handler)`
- **EventSource Streaming**: For server-to-client notifications
- **JSON-RPC 2.0 Error Handling**: Proper error codes and messages

## Architecture

```text
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   HTTP Client   │───▶│ Elysia HTTP  │───▶│    MCP Plugin   │
│                 │    │   Handler    │    │                 │
└─────────────────┘    └──────────────┘    └─────────────────┘
                                                     │
                                                     │
                                            ┌─────────────────┐
                                            │    McpServer    │
                                            │   (Singleton)   │
                                            └─────────────────┘
                                                     │
                                    ┌────────────────┼────────────────┐
                                    │                │                │
                            ┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
                            │    Tools     │ │  Resources  │ │   Prompts   │
                            │              │ │             │ │             │
                            └──────────────┘ └─────────────┘ └─────────────┘
```

## Examples

See `src/index.ts` for a complete working example with:

- Mathematical tools (add, calculate, divide)
- String manipulation tools (echo)
- Utility tools (get_time)
- Complex validation tools (validate_user with Zod)
- System resources and prompts

The example demonstrates best practices for tool registration, error handling,
and response formatting using the official MCP SDK patterns.
