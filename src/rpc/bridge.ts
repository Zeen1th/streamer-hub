import type { EventMap, EventName, HostApi, RpcEnvelope } from './contracts';
import { PROTOCOL_VERSION } from './contracts';
import type { Transport } from './transport';

export class RpcError extends Error {
  constructor(
    public readonly channel: string,
    message: string,
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

type EventHandler<T> = (payload: T) => void;

interface PendingCall {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timer: number;
}

export class RpcBridge {
  private readonly pending = new Map<string, PendingCall>();
  private readonly handlers = new Map<string, Set<EventHandler<unknown>>>();

  constructor(private readonly transport: Transport) {
    this.transport.onMessage((message) => this.handleMessage(message));
  }

  invoke<K extends keyof HostApi>(
    channel: K,
    request: HostApi[K]['request'] = undefined,
    timeoutMs = 8000,
  ): Promise<HostApi[K]['response']> {
    const id = crypto.randomUUID();
    return new Promise<HostApi[K]['response']>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new RpcError(String(channel), `TIMEOUT AFTER ${timeoutMs}MS`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (payload) => resolve(payload as HostApi[K]['response']),
        reject,
        timer,
      });
      this.transport.postMessage({
        v: PROTOCOL_VERSION,
        id,
        kind: 'request',
        channel: String(channel),
        payload: request,
      });
    });
  }

  on<K extends EventName>(event: K, handler: EventHandler<EventMap[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as EventHandler<unknown>);
    return () => {
      set.delete(handler as EventHandler<unknown>);
    };
  }

  private handleMessage(message: RpcEnvelope): void {
    if (message.v !== PROTOCOL_VERSION) return;
    if (message.kind === 'response') {
      const call = this.pending.get(message.id);
      if (!call) return;
      this.pending.delete(message.id);
      window.clearTimeout(call.timer);
      if (message.error) {
        call.reject(new RpcError(message.channel, message.error));
      } else {
        call.resolve(message.payload);
      }
      return;
    }
    if (message.kind === 'event') {
      const set = this.handlers.get(message.channel);
      if (set) {
        for (const handler of set) handler(message.payload);
      }
    }
  }
}
