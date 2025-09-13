import { EventEmitter } from 'events';

export interface StreamEvent {
  type: string;
  sessionId: string;
  payload?: any;
  ts: number;
}

const emitter = new EventEmitter();

export function emitSessionEvent(sessionId: string, type: string, payload?: any) {
  const evt: StreamEvent = { type, sessionId, payload, ts: Date.now() };
  emitter.emit(`session:${sessionId}`, evt);
}

export function subscribeSession(
  sessionId: string,
  handler: (event: StreamEvent) => void
): () => void {
  const channel = `session:${sessionId}`;
  emitter.on(channel, handler);
  return () => {
    emitter.off(channel, handler);
  };
}

