import {
  EventStore,
  EventId,
  StreamId,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolResult,
  JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import Elysia from "elysia";
import { mcp } from "../src";
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  spyOn,
  mock,
} from "bun:test";
import { ElysiaStreamingHttpTransport } from "../src/transport";

/**
 * Test server configuration for ElysiaStreamingHttpTransport tests
 */
interface TestServerConfig {
  sessionIdGenerator: (() => string) | undefined;
  enableJsonResponse?: boolean;
  customRequestHandler?: (
    req: Request,
    res: Response,
    parsedBody?: unknown
  ) => Promise<void>;
  eventStore?: EventStore;
  mcpServer?: McpServer;
}

/**
 * Helper to create and start test HTTP server with MCP setup
 */
async function createTestServer(
  config: TestServerConfig = { sessionIdGenerator: () => Bun.randomUUIDv7() }
) {
  const transport = new ElysiaStreamingHttpTransport({
    sessionIdGenerator: config.sessionIdGenerator,
    enableJsonResponse: config.enableJsonResponse ?? false,
    eventStore: config.eventStore,
  });

  const server = new Elysia()
    .use(
      mcp({
        basePath: "/mcp",
        serverInfo: {
          name: "elysia-mcp-demo-server",
          version: "1.0.0",
        },
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
          logging: {},
        },
        enableLogging: true,
        mcpServer: config.mcpServer,
        setupServer: async (mcpServer: McpServer) => {
          mcpServer.tool(
            "greet",
            "A simple greeting tool",
            { name: z.string().describe("Name to greet") },
            async ({ name }): Promise<CallToolResult> => {
              return { content: [{ type: "text", text: `Hello, ${name}!` }] };
            }
          );

          await mcpServer.connect(transport);
        },
      })
    )
    .listen(3000);

  const baseUrl = new URL(`http://localhost:3000/mcp`);

  return { server, transport, baseUrl };
}

type ElysiaServer = Awaited<ReturnType<typeof createTestServer>>["server"];

/**
 * Helper to create and start authenticated test HTTP server with MCP setup
 */
async function createTestAuthServer(
  config: TestServerConfig = { sessionIdGenerator: () => Bun.randomUUIDv7() }
) {
  const transport = new ElysiaStreamingHttpTransport({
    sessionIdGenerator: config.sessionIdGenerator,
    enableJsonResponse: config.enableJsonResponse ?? false,
    eventStore: config.eventStore,
  });

  const server = new Elysia()
    .use(
      mcp({
        basePath: "/mcp",
        serverInfo: {
          name: "elysia-mcp-demo-server",
          version: "1.0.0",
        },
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
          logging: {},
        },
        enableLogging: true,
        authentication: async ({ headers }) => {
          return {
            authInfo: {
              token: headers["authorization"]?.split(" ")[1],
            },
          };
        },
        setupServer: async (mcpServer: McpServer) => {
          mcpServer.tool(
            "profile",
            "A user profile data tool",
            { active: z.boolean().describe("Profile status") },
            async ({ active }, { authInfo }): Promise<CallToolResult> => {
              return {
                content: [
                  {
                    type: "text",
                    text: `${
                      active ? "Active" : "Inactive"
                    } profile from token: ${authInfo?.token}!`,
                  },
                ],
              };
            }
          );

          await mcpServer.connect(transport);
        },
      })
    )
    .listen(3000);

  const baseUrl = new URL(`http://127.0.0.1:3000`);
  return { server, transport, baseUrl };
}

/**
 * Helper to stop test server
 */
async function stopTestServer({
  server,
  transport,
}: {
  server: ElysiaServer;
  transport: ElysiaStreamingHttpTransport;
}): Promise<void> {
  // First close the transport to ensure all SSE streams are closed
  await transport.close();

  // Close the server without waiting indefinitely
  server.stop(true);
}

/**
 * Common test messages
 */
const TEST_MESSAGES = {
  initialize: {
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      clientInfo: { name: "test-client", version: "1.0" },
      protocolVersion: "2025-03-26",
      capabilities: {},
    },

    id: "init-1",
  } as JSONRPCMessage,

  toolsList: {
    jsonrpc: "2.0",
    method: "tools/list",
    params: {},
    id: "tools-1",
  } as JSONRPCMessage,
};

/**
 * Helper to extract text from SSE response
 * Note: Can only be called once per response stream. For multiple reads,
 * get the reader manually and read multiple times.
 */
async function readSSEEvent(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  const { value } = await reader!.read();
  return new TextDecoder().decode(value);
}

/**
 * Helper to send JSON-RPC request
 */
async function sendPostRequest(
  baseUrl: URL,
  message: JSONRPCMessage | JSONRPCMessage[],
  sessionId?: string,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...extraHeaders,
  };

  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
    // After initialization, include the protocol version header
    headers["mcp-protocol-version"] = "2025-03-26";
  }

  return fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
  });
}

function expectErrorResponse(
  data: unknown,
  expectedCode: number,
  expectedMessagePattern: RegExp
): void {
  expect(data).toMatchObject({
    jsonrpc: "2.0",
    error: expect.objectContaining({
      code: expectedCode,
      message: expect.stringMatching(expectedMessagePattern),
    }),
  });
}

describe("ElysiaStreamingHttpTransport", () => {
  let server: ElysiaServer;
  let transport: ElysiaStreamingHttpTransport;
  let baseUrl: URL;
  let sessionId: string;

  beforeEach(async () => {
    const result = await createTestServer();
    server = result.server;
    transport = result.transport;
    baseUrl = result.baseUrl;
  });

  afterEach(async () => {
    await stopTestServer({ server, transport });
  });

  async function initializeServer(): Promise<string> {
    const response = await sendPostRequest(baseUrl, TEST_MESSAGES.initialize);

    expect(response.status).toBe(200);
    const newSessionId = response.headers.get("mcp-session-id");
    expect(newSessionId).toBeDefined();
    return newSessionId as string;
  }

  it("should initialize server and generate session ID", async () => {
    const response = await sendPostRequest(baseUrl, TEST_MESSAGES.initialize);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("mcp-session-id")).toBeDefined();
  });

  it("should reject second initialization request", async () => {
    // First initialize
    const sessionId = await initializeServer();
    expect(sessionId).toBeDefined();

    // Try second initialize
    const secondInitMessage = {
      ...TEST_MESSAGES.initialize,
      id: "second-init",
    };

    const response = await sendPostRequest(baseUrl, secondInitMessage);

    expect(response.status).toBe(400);
    const errorData = await response.json();
    expectErrorResponse(errorData, -32600, /Server already initialized/);
  });

  it("should reject batch initialize request", async () => {
    const batchInitMessages: JSONRPCMessage[] = [
      TEST_MESSAGES.initialize,
      {
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          clientInfo: { name: "test-client-2", version: "1.0" },
          protocolVersion: "2025-03-26",
        },
        id: "init-2",
      },
    ];

    const response = await sendPostRequest(baseUrl, batchInitMessages);

    expect(response.status).toBe(400);
    const errorData = await response.json();
    expectErrorResponse(
      errorData,
      -32600,
      /Only one initialization request is allowed/
    );
  });

  it("should handle post requests via sse response correctly", async () => {
    sessionId = await initializeServer();

    const response = await sendPostRequest(
      baseUrl,
      TEST_MESSAGES.toolsList,
      sessionId
    );

    expect(response.status).toBe(200);

    // Read the SSE stream for the response
    const text = await readSSEEvent(response);

    // Parse the SSE event
    const eventLines = text.split("\n");
    const dataLine = eventLines.find((line) => line.startsWith("data:"));
    expect(dataLine).toBeDefined();

    const eventData = JSON.parse(dataLine!.substring(5));
    expect(eventData).toMatchObject({
      jsonrpc: "2.0",
      result: expect.objectContaining({
        tools: expect.arrayContaining([
          expect.objectContaining({
            name: "greet",
            description: "A simple greeting tool",
          }),
        ]),
      }),
      id: "tools-1",
    });
  });

  it("should call a tool and return the result", async () => {
    sessionId = await initializeServer();

    const toolCallMessage: JSONRPCMessage = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "greet",
        arguments: {
          name: "Test User",
        },
      },
      id: "call-1",
    };

    const response = await sendPostRequest(baseUrl, toolCallMessage, sessionId);
    expect(response.status).toBe(200);

    const text = await readSSEEvent(response);
    const eventLines = text.split("\n");
    const dataLine = eventLines.find((line) => line.startsWith("data:"));
    expect(dataLine).toBeDefined();

    const eventData = JSON.parse(dataLine!.substring(5));
    expect(eventData).toMatchObject({
      jsonrpc: "2.0",
      result: {
        content: [
          {
            type: "text",
            text: "Hello, Test User!",
          },
        ],
      },
      id: "call-1",
    });
  });

  it("should reject requests without a valid session ID", async () => {
    const response = await sendPostRequest(baseUrl, TEST_MESSAGES.toolsList);

    expect(response.status).toBe(400);
    const errorData = await response.json();
    expectErrorResponse(errorData, -32000, /Bad Request/);
    expect(errorData.id).toBeNull();
  });

  it("should reject invalid session ID", async () => {
    // First initialize to be in valid state
    await initializeServer();

    // Now try with invalid session ID
    const response = await sendPostRequest(
      baseUrl,
      TEST_MESSAGES.toolsList,
      "invalid-session-id"
    );

    expect(response.status).toBe(404);
    const errorData = await response.json();
    expectErrorResponse(errorData, -32001, /Session not found/);
  });

  it("should establish standalone SSE stream and receive server-initiated messages", async () => {
    // First initialize to get a session ID
    sessionId = await initializeServer();

    // Open a standalone SSE stream
    const sseResponse = await fetch(baseUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "mcp-session-id": sessionId,
        "mcp-protocol-version": "2025-03-26",
      },
    });

    expect(sseResponse.status).toBe(200);
    expect(sseResponse.headers.get("content-type")).toBe("text/event-stream");

    // Send a notification (server-initiated message) that should appear on SSE stream
    const notification: JSONRPCMessage = {
      jsonrpc: "2.0",
      method: "notifications/message",
      params: { level: "info", data: "Test notification" },
    };

    // Send the notification via transport
    await transport.send(notification);

    // Read from the stream and verify we got the notification
    const text = await readSSEEvent(sseResponse);

    const eventLines = text.split("\n");
    const dataLine = eventLines.find((line) => line.startsWith("data:"));
    expect(dataLine).toBeDefined();

    const eventData = JSON.parse(dataLine!.substring(5));
    expect(eventData).toMatchObject({
      jsonrpc: "2.0",
      method: "notifications/message",
      params: { level: "info", data: "Test notification" },
    });
  });

  it("should not close GET SSE stream after sending multiple server notifications", async () => {
    sessionId = await initializeServer();

    // Open a standalone SSE stream
    const sseResponse = await fetch(baseUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "mcp-session-id": sessionId,
        "mcp-protocol-version": "2025-03-26",
      },
    });

    expect(sseResponse.status).toBe(200);
    const reader = sseResponse.body?.getReader();

    // Send multiple notifications
    const notification1: JSONRPCMessage = {
      jsonrpc: "2.0",
      method: "notifications/message",
      params: { level: "info", data: "First notification" },
    };

    // Just send one and verify it comes through - then the stream should stay open
    await transport.send(notification1);

    const { value, done } = await reader!.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("First notification");
    expect(done).toBe(false); // Stream should still be open
  });

  it("should reject second SSE stream for the same session", async () => {
    sessionId = await initializeServer();

    // Open first SSE stream
    const firstStream = await fetch(baseUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "mcp-session-id": sessionId,
        "mcp-protocol-version": "2025-03-26",
      },
    });

    expect(firstStream.status).toBe(200);

    // Try to open a second SSE stream with the same session ID
    const secondStream = await fetch(baseUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "mcp-session-id": sessionId,
        "mcp-protocol-version": "2025-03-26",
      },
    });

    // Should be rejected
    expect(secondStream.status).toBe(409); // Conflict
    const errorData = await secondStream.json();
    expectErrorResponse(
      errorData,
      -32000,
      /Only one SSE stream is allowed per session/
    );
  });

  it("should reject GET requests without Accept: text/event-stream header", async () => {
    sessionId = await initializeServer();

    // Try GET without proper Accept header
    const response = await fetch(baseUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "mcp-session-id": sessionId,
        "mcp-protocol-version": "2025-03-26",
      },
    });

    expect(response.status).toBe(406);
    const errorData = await response.json();
    expectErrorResponse(
      errorData,
      -32000,
      /Client must accept text\/event-stream/
    );
  });

  it("should reject POST requests without proper Accept header", async () => {
    sessionId = await initializeServer();

    // Try POST without Accept: text/event-stream
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json", // Missing text/event-stream
        "mcp-session-id": sessionId,
      },
      body: JSON.stringify(TEST_MESSAGES.toolsList),
    });

    expect(response.status).toBe(406);
    const errorData = await response.json();
    expectErrorResponse(
      errorData,
      -32000,
      /Client must accept both application\/json and text\/event-stream/
    );
  });

  it("should reject unsupported Content-Type", async () => {
    sessionId = await initializeServer();

    // Try POST with text/plain Content-Type
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId,
      },
      body: "This is plain text",
    });

    expect(response.status).toBe(415);
    const errorData = await response.json();
    expectErrorResponse(
      errorData,
      -32000,
      /Content-Type must be application\/json/
    );
  });

  it("should handle JSON-RPC batch notification messages with 202 response", async () => {
    sessionId = await initializeServer();

    // Send batch of notifications (no IDs)
    const batchNotifications: JSONRPCMessage[] = [
      { jsonrpc: "2.0", method: "someNotification1", params: {} },
      { jsonrpc: "2.0", method: "someNotification2", params: {} },
    ];
    const response = await sendPostRequest(
      baseUrl,
      batchNotifications,
      sessionId
    );

    expect(response.status).toBe(202);
  });

  it("should handle batch request messages with SSE stream for responses", async () => {
    sessionId = await initializeServer();

    // Send batch of requests
    const batchRequests: JSONRPCMessage[] = [
      { jsonrpc: "2.0", method: "tools/list", params: {}, id: "req-1" },
      {
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: "greet", arguments: { name: "BatchUser" } },
        id: "req-2",
      },
    ];
    const response = await sendPostRequest(baseUrl, batchRequests, sessionId);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");

    const reader = response.body?.getReader();

    // The responses may come in any order or together in one chunk
    const { value } = await reader!.read();
    const text = new TextDecoder().decode(value);

    // Check that both responses were sent on the same stream
    expect(text).toContain('"id":"req-1"');
    expect(text).toContain('"tools"'); // tools/list result
    expect(text).toContain('"id":"req-2"');
    expect(text).toContain("Hello, BatchUser"); // tools/call result
  });

  it("should properly handle invalid JSON data", async () => {
    sessionId = await initializeServer();

    // Send invalid JSON
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId,
      },
      body: "This is not valid JSON",
    });

    expect(response.status).toBe(400);
    const errorData = await response.json();
    expectErrorResponse(errorData, -32700, /Parse error/);
  });

  it("should return 400 error for invalid JSON-RPC messages", async () => {
    sessionId = await initializeServer();

    // Invalid JSON-RPC (missing required jsonrpc version)
    const invalidMessage = { method: "tools/list", params: {}, id: 1 }; // missing jsonrpc version
    const response = await sendPostRequest(
      baseUrl,
      invalidMessage as JSONRPCMessage,
      sessionId
    );

    expect(response.status).toBe(400);
    const errorData = await response.json();
    expect(errorData).toMatchObject({
      jsonrpc: "2.0",
      error: expect.anything(),
    });
  });

  it("should reject requests to uninitialized server", async () => {
    // Create a new HTTP server and transport without initializing
    const {
      server: uninitializedServer,
      transport: uninitializedTransport,
      baseUrl: uninitializedUrl,
    } = await createTestServer();
    // Transport not used in test but needed for cleanup

    // No initialization, just send a request directly
    const uninitializedMessage: JSONRPCMessage = {
      jsonrpc: "2.0",
      method: "tools/list",
      params: {},
      id: "uninitialized-test",
    };

    // Send a request to uninitialized server
    const response = await sendPostRequest(
      uninitializedUrl,
      uninitializedMessage,
      "any-session-id"
    );

    expect(response.status).toBe(400);
    const errorData = await response.json();
    expectErrorResponse(errorData, -32000, /Server not initialized/);

    // Cleanup
    await stopTestServer({
      server: uninitializedServer,
      transport: uninitializedTransport,
    });
  });

  it("should send response messages to the connection that sent the request", async () => {
    sessionId = await initializeServer();

    const message1: JSONRPCMessage = {
      jsonrpc: "2.0",
      method: "tools/list",
      params: {},
      id: "req-1",
    };

    const message2: JSONRPCMessage = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "greet",
        arguments: { name: "Connection2" },
      },
      id: "req-2",
    };

    // Make two concurrent fetch connections for different requests
    const req1 = sendPostRequest(baseUrl, message1, sessionId);
    const req2 = sendPostRequest(baseUrl, message2, sessionId);

    // Get both responses
    const [response1, response2] = await Promise.all([req1, req2]);
    const reader1 = response1.body?.getReader();
    const reader2 = response2.body?.getReader();

    // Read responses from each stream (requires each receives its specific response)
    const { value: value1 } = await reader1!.read();
    const text1 = new TextDecoder().decode(value1);
    expect(text1).toContain('"id":"req-1"');
    expect(text1).toContain('"tools"'); // tools/list result

    const { value: value2 } = await reader2!.read();
    const text2 = new TextDecoder().decode(value2);
    expect(text2).toContain('"id":"req-2"');
    expect(text2).toContain("Hello, Connection2"); // tools/call result
  });

  it("should keep stream open after sending server notifications", async () => {
    sessionId = await initializeServer();

    // Open a standalone SSE stream
    const sseResponse = await fetch(baseUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "mcp-session-id": sessionId,
        "mcp-protocol-version": "2025-03-26",
      },
    });

    // Send several server-initiated notifications
    await transport.send({
      jsonrpc: "2.0",
      method: "notifications/message",
      params: { level: "info", data: "First notification" },
    });

    await transport.send({
      jsonrpc: "2.0",
      method: "notifications/message",
      params: { level: "info", data: "Second notification" },
    });

    // Stream should still be open - it should not close after sending notifications
    expect(sseResponse.bodyUsed).toBe(false);
  });

  // The current implementation will close the entire transport for DELETE
  // Creating a temporary transport/server where we don't care if it gets closed
  it("should properly handle DELETE requests and close session", async () => {
    // Setup a temporary server for this test
    const tempResult = await createTestServer();
    const tempServer = tempResult.server;
    const tempUrl = tempResult.baseUrl;

    // Initialize to get a session ID
    const initResponse = await sendPostRequest(
      tempUrl,
      TEST_MESSAGES.initialize
    );
    const tempSessionId = initResponse.headers.get("mcp-session-id");

    // Now DELETE the session
    const deleteResponse = await fetch(tempUrl, {
      method: "DELETE",
      headers: {
        "mcp-session-id": tempSessionId || "",
        "mcp-protocol-version": "2025-03-26",
      },
    });

    expect(deleteResponse.status).toBe(200);

    // Clean up - don't wait indefinitely for server close
    tempServer.stop(true);
  });

  it("should reject DELETE requests with invalid session ID", async () => {
    // Initialize the server first to activate it
    sessionId = await initializeServer();

    // Try to delete with invalid session ID
    const response = await fetch(baseUrl, {
      method: "DELETE",
      headers: {
        "mcp-session-id": "invalid-session-id",
        "mcp-protocol-version": "2025-03-26",
      },
    });

    expect(response.status).toBe(404);
    const errorData = await response.json();
    expectErrorResponse(errorData, -32001, /Session not found/);
  });

  describe("protocol version header validation", () => {
    it("should accept requests with matching protocol version", async () => {
      sessionId = await initializeServer();

      // Send request with matching protocol version
      const response = await sendPostRequest(
        baseUrl,
        TEST_MESSAGES.toolsList,
        sessionId
      );

      expect(response.status).toBe(200);
    });

    it("should accept requests without protocol version header", async () => {
      sessionId = await initializeServer();

      // Send request without protocol version header
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "mcp-session-id": sessionId,
          // No mcp-protocol-version header
        },
        body: JSON.stringify(TEST_MESSAGES.toolsList),
      });

      expect(response.status).toBe(200);
    });

    it("should reject requests with unsupported protocol version", async () => {
      sessionId = await initializeServer();

      // Send request with unsupported protocol version
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "mcp-session-id": sessionId,
          "mcp-protocol-version": "1999-01-01", // Unsupported version
        },
        body: JSON.stringify(TEST_MESSAGES.toolsList),
      });

      expect(response.status).toBe(400);
      const errorData = await response.json();
      expectErrorResponse(
        errorData,
        -32000,
        /Bad Request: Unsupported protocol version \(supported versions: .+\)/
      );
    });

    it("should accept when protocol version differs from negotiated version", async () => {
      sessionId = await initializeServer();

      // Spy on console.warn to verify warning is logged
      const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

      // Send request with different but supported protocol version
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "mcp-session-id": sessionId,
          "mcp-protocol-version": "2024-11-05", // Different but supported version
        },
        body: JSON.stringify(TEST_MESSAGES.toolsList),
      });

      // Request should still succeed
      expect(response.status).toBe(200);

      warnSpy.mockRestore();
    });

    it("should handle protocol version validation for GET requests", async () => {
      sessionId = await initializeServer();

      // GET request with unsupported protocol version
      const response = await fetch(baseUrl, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          "mcp-session-id": sessionId,
          "mcp-protocol-version": "invalid-version",
        },
      });

      expect(response.status).toBe(400);
      const errorData = await response.json();
      expectErrorResponse(
        errorData,
        -32000,
        /Bad Request: Unsupported protocol version \(supported versions: .+\)/
      );
    });

    it("should handle protocol version validation for DELETE requests", async () => {
      sessionId = await initializeServer();

      // DELETE request with unsupported protocol version
      const response = await fetch(baseUrl, {
        method: "DELETE",
        headers: {
          "mcp-session-id": sessionId,
          "mcp-protocol-version": "invalid-version",
        },
      });

      expect(response.status).toBe(400);
      const errorData = await response.json();
      expectErrorResponse(
        errorData,
        -32000,
        /Bad Request: Unsupported protocol version \(supported versions: .+\)/
      );
    });
  });
});

describe("ElysiaStreamingHttpTransport with AuthInfo", () => {
  let server: ElysiaServer;
  let transport: ElysiaStreamingHttpTransport;
  let baseUrl: URL;
  let sessionId: string;

  beforeEach(async () => {
    const result = await createTestAuthServer();
    server = result.server;
    transport = result.transport;
    baseUrl = result.baseUrl;
  });

  afterEach(async () => {
    await stopTestServer({ server, transport });
  });

  async function initializeServer(): Promise<string> {
    const response = await sendPostRequest(baseUrl, TEST_MESSAGES.initialize);

    expect(response.status).toBe(200);
    const newSessionId = response.headers.get("mcp-session-id");
    expect(newSessionId).toBeDefined();
    return newSessionId as string;
  }

  it("should call a tool with authInfo", async () => {
    sessionId = await initializeServer();

    const toolCallMessage: JSONRPCMessage = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "profile",
        arguments: { active: true },
      },
      id: "call-1",
    };

    const response = await sendPostRequest(
      baseUrl,
      toolCallMessage,
      sessionId,
      { authorization: "Bearer test-token" }
    );
    expect(response.status).toBe(200);

    const text = await readSSEEvent(response);
    const eventLines = text.split("\n");
    const dataLine = eventLines.find((line) => line.startsWith("data:"));
    expect(dataLine).toBeDefined();

    const eventData = JSON.parse(dataLine!.substring(5));
    expect(eventData).toMatchObject({
      jsonrpc: "2.0",
      result: {
        content: [
          {
            type: "text",
            text: "Active profile from token: test-token!",
          },
        ],
      },
      id: "call-1",
    });
  });

  it("should calls tool without authInfo when it is optional", async () => {
    sessionId = await initializeServer();

    const toolCallMessage: JSONRPCMessage = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "profile",
        arguments: { active: false },
      },
      id: "call-1",
    };

    const response = await sendPostRequest(baseUrl, toolCallMessage, sessionId);
    expect(response.status).toBe(200);

    const text = await readSSEEvent(response);
    const eventLines = text.split("\n");
    const dataLine = eventLines.find((line) => line.startsWith("data:"));
    expect(dataLine).toBeDefined();

    const eventData = JSON.parse(dataLine!.substring(5));
    expect(eventData).toMatchObject({
      jsonrpc: "2.0",
      result: {
        content: [
          {
            type: "text",
            text: "Inactive profile from token: undefined!",
          },
        ],
      },
      id: "call-1",
    });
  });
});

// Test JSON Response Mode
describe("ElysiaStreamingHttpTransport with JSON Response Mode", () => {
  let server: ElysiaServer;
  let transport: ElysiaStreamingHttpTransport;
  let baseUrl: URL;
  let sessionId: string;

  beforeEach(async () => {
    const result = await createTestServer({
      sessionIdGenerator: () => Bun.randomUUIDv7(),
      enableJsonResponse: true,
    });
    server = result.server;
    transport = result.transport;
    baseUrl = result.baseUrl;

    // Initialize and get session ID
    const initResponse = await sendPostRequest(
      baseUrl,
      TEST_MESSAGES.initialize
    );

    sessionId = initResponse.headers.get("mcp-session-id") as string;
  });

  afterEach(async () => {
    await stopTestServer({ server, transport });
  });

  it("should return JSON response for a single request", async () => {
    const toolsListMessage: JSONRPCMessage = {
      jsonrpc: "2.0",
      method: "tools/list",
      params: {},
      id: "json-req-1",
    };

    const response = await sendPostRequest(
      baseUrl,
      toolsListMessage,
      sessionId
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");

    const result = await response.json();
    expect(result).toMatchObject({
      jsonrpc: "2.0",
      result: expect.objectContaining({
        tools: expect.arrayContaining([
          expect.objectContaining({ name: "greet" }),
        ]),
      }),
      id: "json-req-1",
    });
  });

  it("should return JSON response for batch requests", async () => {
    const batchMessages: JSONRPCMessage[] = [
      { jsonrpc: "2.0", method: "tools/list", params: {}, id: "batch-1" },
      {
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: "greet", arguments: { name: "JSON" } },
        id: "batch-2",
      },
    ];

    const response = await sendPostRequest(baseUrl, batchMessages, sessionId);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");

    const results = await response.json();
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(2);

    // Batch responses can come in any order
    const listResponse = results.find(
      (r: { id?: string }) => r.id === "batch-1"
    );
    const callResponse = results.find(
      (r: { id?: string }) => r.id === "batch-2"
    );

    expect(listResponse).toEqual(
      expect.objectContaining({
        jsonrpc: "2.0",
        id: "batch-1",
        result: expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({ name: "greet" }),
          ]),
        }),
      })
    );

    expect(callResponse).toEqual(
      expect.objectContaining({
        jsonrpc: "2.0",
        id: "batch-2",
        result: expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({ type: "text", text: "Hello, JSON!" }),
          ]),
        }),
      })
    );
  });
});

// Test resumability support
describe("ElysiaStreamingHttpTransport with resumability", () => {
  let server: ElysiaServer;
  let transport: ElysiaStreamingHttpTransport;
  let baseUrl: URL;
  let sessionId: string;
  let mcpServer: McpServer;
  const storedEvents: Map<
    string,
    { eventId: string; message: JSONRPCMessage }
  > = new Map();

  // Simple implementation of EventStore
  const eventStore: EventStore = {
    async storeEvent(
      streamId: string,
      message: JSONRPCMessage
    ): Promise<string> {
      const eventId = `${streamId}_${Bun.randomUUIDv7()}`;
      storedEvents.set(eventId, { eventId, message });
      return eventId;
    },

    async replayEventsAfter(
      lastEventId: EventId,
      {
        send,
      }: {
        send: (eventId: EventId, message: JSONRPCMessage) => Promise<void>;
      }
    ): Promise<StreamId> {
      const streamId = lastEventId.split("_")[0];
      // Extract stream ID from the event ID
      // For test simplicity, just return all events with matching streamId that aren't the lastEventId
      for (const [eventId, { message }] of storedEvents.entries()) {
        if (eventId.startsWith(streamId) && eventId !== lastEventId) {
          await send(eventId, message);
        }
      }
      return streamId;
    },
  };

  beforeEach(async () => {
    storedEvents.clear();
    mcpServer = new McpServer({
      name: "elysia-mcp-test-server",
      version: "1.0.0",
    });
    const result = await createTestServer({
      sessionIdGenerator: () => Bun.randomUUIDv7(),
      eventStore,
      mcpServer,
    });

    server = result.server;
    transport = result.transport;
    baseUrl = result.baseUrl;

    // Verify resumability is enabled on the transport
    expect(transport["_eventStore"]).toBeDefined();

    // Initialize the server
    const initResponse = await sendPostRequest(
      baseUrl,
      TEST_MESSAGES.initialize
    );
    sessionId = initResponse.headers.get("mcp-session-id") as string;
    expect(sessionId).toBeDefined();
  });

  afterEach(async () => {
    await stopTestServer({ server, transport });
    storedEvents.clear();
  });

  it("should store and include event IDs in server SSE messages", async () => {
    // Open a standalone SSE stream
    const sseResponse = await fetch(baseUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "mcp-session-id": sessionId,
        "mcp-protocol-version": "2025-03-26",
      },
    });

    expect(sseResponse.status).toBe(200);
    expect(sseResponse.headers.get("content-type")).toBe("text/event-stream");

    // Send a notification that should be stored with an event ID
    const notification: JSONRPCMessage = {
      jsonrpc: "2.0",
      method: "notifications/message",
      params: { level: "info", data: "Test notification with event ID" },
    };

    // Send the notification via transport
    await transport.send(notification);

    // Read from the stream and verify we got the notification with an event ID
    const reader = sseResponse.body?.getReader();
    const { value } = await reader!.read();
    const text = new TextDecoder().decode(value);

    // The response should contain an event ID
    expect(text).toContain("id: ");
    expect(text).toContain('"method":"notifications/message"');

    // Extract the event ID
    const idMatch = text.match(/id: ([^\n]+)/);
    expect(idMatch).toBeTruthy();

    // Verify the event was stored
    const eventId = idMatch![1];
    expect(storedEvents.has(eventId)).toBe(true);
    const storedEvent = storedEvents.get(eventId);
    expect(eventId.startsWith("_GET_stream")).toBe(true);
    expect(storedEvent?.message).toMatchObject(notification);
  });

  it("should store and replay MCP server tool notifications", async () => {
    // Establish a standalone SSE stream
    const sseResponse = await fetch(baseUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "mcp-session-id": sessionId,
      },
    });
    expect(sseResponse.status).toBe(200); // Send a server notification through the MCP server
    await mcpServer.server.sendLoggingMessage({
      level: "info",
      data: "First notification from MCP server",
    });

    // Read the notification from the SSE stream
    const reader = sseResponse.body?.getReader();
    const { value } = await reader!.read();
    const text = new TextDecoder().decode(value);

    // Verify the notification was sent with an event ID
    expect(text).toContain("id: ");
    expect(text).toContain("First notification from MCP server");

    // Extract the event ID
    const idMatch = text.match(/id: ([^\n]+)/);
    expect(idMatch).toBeTruthy();
    const firstEventId = idMatch![1];

    // Send a second notification
    await mcpServer.server.sendLoggingMessage({
      level: "info",
      data: "Second notification from MCP server",
    });

    // Close the first SSE stream to simulate a disconnect
    await reader!.cancel();

    // Reconnect with the Last-Event-ID to get missed messages
    const reconnectResponse = await fetch(baseUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "mcp-session-id": sessionId,
        "mcp-protocol-version": "2025-03-26",
        "last-event-id": firstEventId,
      },
    });

    expect(reconnectResponse.status).toBe(200);

    // Read the replayed notification
    const reconnectReader = reconnectResponse.body?.getReader();
    const reconnectData = await reconnectReader!.read();
    const reconnectText = new TextDecoder().decode(reconnectData.value);

    // Verify we received the second notification that was sent after our stored eventId
    expect(reconnectText).toContain("Second notification from MCP server");
    expect(reconnectText).toContain("id: ");
  });
});

// Test stateless mode
describe("ElysiaStreamingHttpTransport in stateless mode", () => {
  let server: ElysiaServer;
  let transport: ElysiaStreamingHttpTransport;
  let baseUrl: URL;

  beforeEach(async () => {
    const result = await createTestServer({ sessionIdGenerator: undefined });
    server = result.server;
    transport = result.transport;
    baseUrl = result.baseUrl;
  });

  afterEach(async () => {
    await stopTestServer({ server, transport });
  });

  it("should operate without session ID validation", async () => {
    // Initialize the server first
    const initResponse = await sendPostRequest(
      baseUrl,
      TEST_MESSAGES.initialize
    );

    expect(initResponse.status).toBe(200);
    // Should NOT have session ID header in stateless mode
    expect(initResponse.headers.get("mcp-session-id")).toBeNull();

    // Try request without session ID - should work in stateless mode
    const toolsResponse = await sendPostRequest(
      baseUrl,
      TEST_MESSAGES.toolsList
    );

    expect(toolsResponse.status).toBe(200);
  });

  it("should handle POST requests with various session IDs in stateless mode", async () => {
    await sendPostRequest(baseUrl, TEST_MESSAGES.initialize);

    // Try with a random session ID - should be accepted
    const response1 = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": "random-id-1",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/list",
        params: {},
        id: "t1",
      }),
    });
    expect(response1.status).toBe(200);

    // Try with another random session ID - should also be accepted
    const response2 = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": "different-id-2",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/list",
        params: {},
        id: "t2",
      }),
    });
    expect(response2.status).toBe(200);
  });

  it("should reject second SSE stream even in stateless mode", async () => {
    // Despite no session ID requirement, the transport still only allows
    // one standalone SSE stream at a time

    // Initialize the server first
    await sendPostRequest(baseUrl, TEST_MESSAGES.initialize);

    // Open first SSE stream
    const stream1 = await fetch(baseUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "mcp-protocol-version": "2025-03-26",
      },
    });
    expect(stream1.status).toBe(200);

    // Open second SSE stream - should still be rejected, stateless mode still only allows one
    const stream2 = await fetch(baseUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "mcp-protocol-version": "2025-03-26",
      },
    });
    expect(stream2.status).toBe(409); // Conflict - only one stream allowed
  });
});
