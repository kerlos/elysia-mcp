import { Elysia } from 'elysia';
import { z } from 'zod';
import { mcp, type ILogger } from '../src/index.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Multiple Server Example with Custom Logger
 * 
 * This example shows how to set up multiple MCP servers on different paths.
 * Each server can have its own logger configuration.
 */

// Math Operations Plugin
const mathPlugin = mcp({
  basePath: '/math',
  serverInfo: {
    name: 'math-operations-server',
    version: '1.0.0',
  },
  capabilities: {
    tools: {},
  },
  enableLogging: true,
  setupServer: async (server: McpServer) => {
    // Addition tool
    server.registerTool(
      'add',
      {
        description: 'Add two numbers',
        inputSchema: {
          a: z.number().describe('First number'),
          b: z.number().describe('Second number'),
        },
      },
      async (args) => {
        const { a, b } = args;
        const result = a + b;
        return {
          content: [{ type: 'text', text: `${a} + ${b} = ${result}` }],
        };
      }
    );

    // Multiplication tool
    server.registerTool(
      'multiply',
      {
        description: 'Multiply two numbers',
        inputSchema: {
          a: z.number().describe('First number'),
          b: z.number().describe('Second number'),
        },
      },
      async (args) => {
        const { a, b } = args;
        const result = a * b;
        return {
          content: [{ type: 'text', text: `${a} × ${b} = ${result}` }],
        };
      }
    );

    // Power tool
    server.registerTool(
      'power',
      {
        description: 'Calculate base to the power of exponent',
        inputSchema: {
          base: z.number().describe('Base number'),
          exponent: z.number().describe('Exponent'),
        },
      },
      async (args) => {
        const { base, exponent } = args;
        const result = base ** exponent;
        return {
          content: [{ type: 'text', text: `${base}^${exponent} = ${result}` }],
        };
      }
    );
  },
});

// Text Utilities Plugin
const textPlugin = mcp({
  basePath: '/text',
  serverInfo: {
    name: 'text-utilities-server',
    version: '1.0.0',
  },
  capabilities: {
    tools: {},
  },
  enableLogging: true,
  setupServer: async (server: McpServer) => {
    // Uppercase tool
    server.registerTool(
      'uppercase',
      {
        description: 'Convert text to uppercase',
        inputSchema: {
          text: z.string().describe('Text to convert to uppercase'),
        },
      },
      async (args) => {
        const { text } = args;
        const result = text.toUpperCase();
        return {
          content: [{ type: 'text', text: result }],
        };
      }
    );

    // Word count tool
    server.registerTool(
      'word_count',
      {
        description: 'Count words in text',
        inputSchema: {
          text: z.string().describe('Text to count words in'),
        },
      },
      async (args) => {
        const { text } = args;
        const wordCount = text.trim().split(/\s+/).length;
        return {
          content: [{ type: 'text', text: `Word count: ${wordCount}` }],
        };
      }
    );

    // Reverse text tool
    server.registerTool(
      'reverse',
      {
        description: 'Reverse text characters',
        inputSchema: {
          text: z.string().describe('Text to reverse'),
        },
      },
      async (args) => {
        const { text } = args;
        const result = text.split('').reverse().join('');
        return {
          content: [{ type: 'text', text: result }],
        };
      }
    );

    // Replace text tool
    server.registerTool(
      'replace',
      {
        description: 'Replace text with global matching',
        inputSchema: {
          text: z.string().describe('Original text'),
          search: z.string().describe('Text to search for'),
          replace: z.string().describe('Text to replace with'),
        },
      },
      async (args) => {
        const { text, search, replace } = args;
        const result = text.replace(new RegExp(search, 'g'), replace);
        return {
          content: [{ type: 'text', text: result }],
        };
      }
    );
  },
});

// Create the main Elysia app with both plugins
const app = new Elysia().use(mathPlugin).use(textPlugin).listen(3000);

console.log('🚀 Multiple MCP Server is running at http://localhost:3000');
console.log('📊 Math operations available at: http://localhost:3000/math');
console.log('📝 Text utilities available at: http://localhost:3000/text');
