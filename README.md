# Elysia MCP Plugin

A comprehensive ElysiaJS plugin for implementing
[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers
with HTTP transport support.

## Features

- **HTTP Transport**: Full HTTP-based MCP transport with Streamable HTTP
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

### Testing with MCP Inspector

1. Install MCP Inspector:

   ```bash
   npx @modelcontextprotocol/inspector
   ```

2. Connect to your server:
   - Transport: `http`
   - URL: `http://localhost:3000/mcp`

### Configuration Options

- `serverInfo`: Server information
- `capabilities`: MCP capabilities to advertise
- `enableLogging`: Enable debug logging (default: false)
- `setupServer`: Callback to register tools, resources, and prompts

### Session Management

The plugin automatically handles session management via the `Mcp-Session-Id`
header. Each session maintains its own state and can be terminated cleanly.

### Modular Handler Architecture

The plugin supports a modular handler architecture that allows you to create specialized endpoints for different MCP capabilities:

````typescript
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
````

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

## Testing

Run the comprehensive test suite:

```bash
bun test
```

## License

MIT - see [LICENSE](./LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [ElysiaJS](https://elysiajs.com/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

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
```
