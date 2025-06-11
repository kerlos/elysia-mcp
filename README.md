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

## Starter Template

To quickly get started with a pre-configured Elysia MCP project, you can use our starter template:

```bash
# Create a new project from the starter template
bun create https://github.com/kerlos/elysia-mcp-starter my-mcp-project

# Navigate to the project
cd my-mcp-project

# Install dependencies
bun install

# Start development server
bun run dev
```

The [elysia-mcp-starter](https://github.com/kerlos/elysia-mcp-starter) template includes:

- Pre-configured Elysia setup with MCP plugin
- TypeScript configuration
- Development scripts
- Basic project structure
- Example MCP server implementation

## Quick Start

```typescript
import { Elysia } from 'elysia';
import { mcp, McpServer } from 'elysia-mcp';
import { z } from 'zod';

const app = new Elysia()
  .use(
    mcp({
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

### Running the Examples

**Basic Example:**

```bash
# Run the basic example server (port 3000)
bun run example

# Or with development mode (auto-restart)
bun run dev
```

The basic example now includes comprehensive prompts functionality with advanced MCP prompt patterns:

- **Git commit message generation** with conventional commits support
- **Advanced code review** with complexity analysis integration
- **Project documentation generation** with resource integration
- **Interactive debugging workflows** with multi-step conversations
- **Educational explanations** with customizable depth and format

The basic example now also showcases the complete modular handler architecture:

- **Separate endpoints** for tools (`/mcp/tools`), resources (`/mcp/resources`), and prompts (`/mcp/prompts`)
- **Specialized logging** for each capability type
- **Backward compatibility** with general `/mcp` endpoint
- **Enhanced debugging** with handler-specific error messages
- **Scalable architecture** for large applications

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

### Modular Handler Architecture

The plugin supports a modular handler architecture that allows you to create specialized endpoints for different MCP capabilities:

```typescript
import {
  mcp,
  ToolsHandler,
  ResourcesHandler,
  PromptsHandler,
} from 'elysia-mcp';

const app = new Elysia().use(
  mcp({
    /* config */
  })
);

// This automatically creates the following endpoints:
// - POST /mcp          - General endpoint (backward compatible)
// - POST /mcp/tools    - Tools-specific endpoint
// - POST /mcp/resources - Resources-specific endpoint
// - POST /mcp/prompts  - Prompts-specific endpoint
```

**Benefits:**

- **Separation of concerns**: Each handler focuses on specific capability
- **Enhanced debugging**: Handler-specific logging and error messages
- **Scalability**: Easier to maintain and extend large applications
- **Specialized processing**: Custom validation and preprocessing per handler type
- **Backward compatibility**: General `/mcp` endpoint remains functional

**Handler Features:**

- `ToolsHandler`: Enhanced tool execution logging and validation
- `ResourcesHandler`: Resource URI tracking and caching optimization
- `PromptsHandler`: Prompt argument validation and template debugging
- `BaseHandler`: Core MCP protocol handling shared by all handlers

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

Register reusable prompt templates following MCP best practices:

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

#### Advanced Prompt Patterns

The plugin supports sophisticated prompt patterns:

**Multi-step workflows:**

```typescript
server.prompt(
  'debug-session',
  'Interactive debugging',
  {
    /* args */
  },
  async (args) => {
    return {
      messages: [
        { role: 'user', content: { type: 'text', text: 'Error description' } },
        { role: 'assistant', content: { type: 'text', text: 'Analysis...' } },
        { role: 'user', content: { type: 'text', text: 'Next steps...' } },
      ],
    };
  }
);
```

**Resource integration:**

```typescript
server.prompt(
  'analyze-project',
  'Project analysis',
  {
    /* args */
  },
  async (args) => {
    const projectData = await getProjectStats();
    return {
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: 'Analyze this project:' },
        },
        {
          role: 'user',
          content: {
            type: 'resource',
            resource: {
              uri: 'project://stats',
              text: JSON.stringify(projectData),
              mimeType: 'application/json',
            },
          },
        },
      ],
    };
  }
);
```

**Conditional logic:**

```typescript
server.prompt(
  'code-review',
  'Smart code review',
  {
    focus: z.enum(['security', 'performance', 'all']).optional(),
  },
  async (args) => {
    const { focus = 'all' } = args;
    let reviewPrompt = `Review this code focusing on: ${focus}`;

    // Customize prompt based on focus area
    switch (focus) {
      case 'security':
        reviewPrompt += '\n- Check for vulnerabilities\n- Validate inputs';
        break;
      case 'performance':
        reviewPrompt += '\n- Optimize algorithms\n- Check memory usage';
        break;
    }

    return {
      messages: [
        { role: 'user', content: { type: 'text', text: reviewPrompt } },
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
