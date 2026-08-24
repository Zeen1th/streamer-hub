import type { RpcEnvelope } from './contracts';

export interface Transport {
  postMessage(message: RpcEnvelope): void;
  onMessage(handler: (message: RpcEnvelope) => void): () => void;
}

export class WebviewTransport implements Transport {
  constructor(private readonly webview: Webview2HostObject) {}

  postMessage(message: RpcEnvelope): void {
    this.webview.postMessage(message);
  }

  onMessage(handler: (message: RpcEnvelope) => void): () => void {
    const listener = (event: WebviewMessageEvent) => handler(event.data as RpcEnvelope);
    this.webview.addEventListener('message', listener);
    return () => this.webview.removeEventListener('message', listener);
  }
}
