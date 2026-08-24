import { RpcBridge } from './bridge';
import { MockHost, MockTransport } from './mockHost';
import { WebviewTransport } from './transport';

export * from './contracts';
export { RpcBridge, RpcError } from './bridge';
export { MockHost, MockTransport } from './mockHost';
export { WebviewTransport } from './transport';
export type { Transport } from './transport';

const webview = window.chrome?.webview;

export const isMockMode = webview == null;

export const rpc: RpcBridge = (() => {
  if (webview) return new RpcBridge(new WebviewTransport(webview));
  const mockHost = new MockHost();
  (globalThis as Record<string, unknown>).__mockHost = mockHost;
  return new RpcBridge(new MockTransport(mockHost));
})();
