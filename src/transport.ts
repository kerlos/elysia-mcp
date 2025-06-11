import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  JSONRPCMessageSchema,
  type JSONRPCMessage,
} from '@modelcontextprotocol/sdk/types.js';
import { debug } from 'debug';

export class ElysiaStreamingHttpTransport implements Transport {
  private _sessionId: string;
  private _isConnected = false;
  private _messageQueue: string[] = [];

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(private _endpoint: string) {
    this._sessionId = Bun.randomUUIDv7();
  }

  async start(): Promise<void> {
    console.log(`[Transport:${this._sessionId}] Starting transport`);

    // If already started, don't do anything
    if (this._isConnected) {
      console.log(`[Transport:${this._sessionId}] Already started`);
      return;
    }

    try {
      // Mark as connected
      this._isConnected = true;
      console.log(`[Transport:${this._sessionId}] Transport connected`);

      console.log(`[Transport:${this._sessionId}] Endpoint event sent`);
    } catch (error) {
      console.error(
        `[Transport:${this._sessionId}] Error starting transport:`,
        error
      );
      this._isConnected = false;
      this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private _sendEvent(event: string, data: string): void {
    if (!this._isConnected) {
      console.error(
        `[Transport:${this._sessionId}] Cannot send event, not connected`
      );
      return;
    }

    try {
      // Queue the event for streaming
      this._messageQueue.push(`event: ${event}\ndata: ${data}\n\n`);
    } catch (error) {
      console.error(
        `[Transport:${this._sessionId}] Error sending event:`,
        error
      );
      this._isConnected = false;
      this.onerror?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Generator function for Elysia streaming
  async *stream() {
    // Send initial endpoint event
    yield `event: endpoint\ndata: ${encodeURI(this._endpoint)}?sessionId=${
      this._sessionId
    }\n\n`;

    while (this._isConnected) {
      if (this._messageQueue.length > 0) {
        const message = this._messageQueue.shift();
        if (message) {
          yield message;
        }
      }
      // Small delay to prevent tight loop
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  async handlePostMessage(
    body: unknown
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`[Transport:${this._sessionId}] Received message`);

    if (!this._isConnected) {
      console.error(`[Transport:${this._sessionId}] Not connected`);
      return { success: false, error: 'SSE connection not established' };
    }

    try {
      // Handle the message
      await this.handleMessage(body);

      // Return success
      return { success: true };
    } catch (error) {
      console.error(
        `[Transport:${this._sessionId}] Error handling message:`,
        error
      );
      return { success: false, error: String(error) };
    }
  }

  async handleMessage(message: unknown): Promise<void> {
    console.log(`[Transport:${this._sessionId}] Parsing message`);

    let parsedMessage: JSONRPCMessage;
    try {
      parsedMessage = JSONRPCMessageSchema.parse(message);
    } catch (error) {
      console.error(
        `[Transport:${this._sessionId}] Invalid message format:`,
        error
      );
      this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }

    console.log(`[Transport:${this._sessionId}] Forwarding message to handler`);
    this.onmessage?.(parsedMessage);
  }

  async close(): Promise<void> {
    console.log(`[Transport:${this._sessionId}] Closing transport`);

    this._isConnected = false;
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    console.log(
      `[Transport:${this._sessionId}] Sending message: ${JSON.stringify(
        message
      )}`
    );

    if (!this._isConnected) {
      console.error(`[Transport:${this._sessionId}] Not connected`);
      throw new Error('Not connected');
    }

    this._sendEvent('message', JSON.stringify(message));
    console.log(
      `[Transport:${this._sessionId}] Message queued, queue length: ${this._messageQueue.length}`
    );
  }

  get sessionId(): string {
    return this._sessionId;
  }
}
