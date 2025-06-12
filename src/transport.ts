import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  JSONRPCMessageSchema,
  type JSONRPCMessage,
} from '@modelcontextprotocol/sdk/types.js';
import { Logger } from './utils/logger';

export class ElysiaStreamingHttpTransport implements Transport {
  private _sessionId: string;
  private _isConnected = false;
  private _messageQueue: string[] = [];
  private logger: Logger;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(private _endpoint: string, enableLogging = false) {
    this._sessionId = Bun.randomUUIDv7();
    this.logger = new Logger(enableLogging);
  }

  async start(): Promise<void> {
    this.logger.log(`[Transport:${this._sessionId}] Starting transport`);

    // If already started, don't do anything
    if (this._isConnected) {
      this.logger.log(`[Transport:${this._sessionId}] Already started`);
      return;
    }

    try {
      // Mark as connected
      this._isConnected = true;
      this.logger.log(`[Transport:${this._sessionId}] Transport connected`);

      this.logger.log(`[Transport:${this._sessionId}] Endpoint event sent`);
    } catch (error) {
      this.logger.error(
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
      this.logger.error(
        `[Transport:${this._sessionId}] Cannot send event, not connected`
      );
      return;
    }

    try {
      // Queue the event for streaming
      this._messageQueue.push(`event: ${event}\ndata: ${data}\n\n`);
    } catch (error) {
      this.logger.error(
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
    body: JSONRPCMessage
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`[Transport:${this._sessionId}] Received message`);

    if (!this._isConnected) {
      this.logger.error(`[Transport:${this._sessionId}] Not connected`);
      return { success: false, error: 'SSE connection not established' };
    }

    try {
      // Handle the message
      await this.handleMessage(body);

      // Return success
      return { success: true };
    } catch (error) {
      this.logger.error(
        `[Transport:${this._sessionId}] Error handling message:`,
        error
      );
      return { success: false, error: String(error) };
    }
  }

  async handleMessage(message: JSONRPCMessage): Promise<void> {
    this.logger.log(`[Transport:${this._sessionId}] Parsing message`);

    try {
    } catch (error) {
      this.logger.error(
        `[Transport:${this._sessionId}] Invalid message format:`,
        error
      );
      this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }

    this.logger.log(
      `[Transport:${this._sessionId}] Forwarding message to handler`
    );
    this.onmessage?.(message);
  }

  async close(): Promise<void> {
    this.logger.log(`[Transport:${this._sessionId}] Closing transport`);

    this._isConnected = false;
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.logger.log(
      `[Transport:${this._sessionId}] Sending message: ${JSON.stringify(
        message
      )}`
    );

    if (!this._isConnected) {
      this.logger.error(`[Transport:${this._sessionId}] Not connected`);
      throw new Error('Not connected');
    }

    this._sendEvent('message', JSON.stringify(message));
    this.logger.log(
      `[Transport:${this._sessionId}] Message queued, queue length: ${this._messageQueue.length}`
    );
  }

  get sessionId(): string {
    return this._sessionId;
  }
}
