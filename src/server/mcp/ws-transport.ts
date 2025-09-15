import type { Transport, TransportSendOptions } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage, MessageExtraInfo } from '@modelcontextprotocol/sdk/types.js';
import WebSocket from 'ws';

// Minimal WebSocket transport implementing the MCP Transport interface for the Server SDK
export class WsServerTransport implements Transport {
  private ws: WebSocket;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;

  constructor(ws: WebSocket) {
    this.ws = ws;
  }

  async start(): Promise<void> {
    this.ws.on('message', (data: WebSocket.RawData) => {
      try {
        const str = typeof data === 'string' ? data : data.toString('utf8');
        const msg = JSON.parse(str) as JSONRPCMessage;
        this.onmessage?.(msg);
      } catch (err: any) {
        this.onerror?.(err instanceof Error ? err : new Error('Invalid message'));
      }
    });
    this.ws.on('error', (err: Error) => this.onerror?.(err));
    this.ws.on('close', () => this.onclose?.());
  }

  async send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.ws.send(JSON.stringify(message));
  }

  async close(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CLOSING) {
      this.ws.close();
    }
    this.onclose?.();
  }
}
