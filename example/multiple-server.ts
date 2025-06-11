import { Elysia } from 'elysia';
import { z } from 'zod';
import { mcp, type McpServer } from '../src/index.js';

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
    server.tool(
      'add',
      {
        a: z.number().describe('First number'),
        b: z.number().describe('Second number'),
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
    server.tool(
      'multiply',
      {
        a: z.number().describe('First number'),
        b: z.number().describe('Second number'),
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
    server.tool(
      'power',
      {
        base: z.number().describe('Base number'),
        exponent: z.number().describe('Exponent'),
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
    server.tool(
      'uppercase',
      {
        text: z.string().describe('Text to convert to uppercase'),
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
    server.tool(
      'word_count',
      {
        text: z.string().describe('Text to count words in'),
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
    server.tool(
      'reverse',
      {
        text: z.string().describe('Text to reverse'),
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
    server.tool(
      'replace',
      {
        text: z.string().describe('Original text'),
        search: z.string().describe('Text to search for'),
        replace: z.string().describe('Text to replace with'),
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
