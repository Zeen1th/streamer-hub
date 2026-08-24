declare global {
  interface WebviewMessageEvent extends Event {
    readonly data: unknown;
  }

  interface Webview2HostObject {
    postMessage(message: unknown): void;
    addEventListener(type: 'message', listener: (event: WebviewMessageEvent) => void): void;
    removeEventListener(type: 'message', listener: (event: WebviewMessageEvent) => void): void;
    startDragging(): void;
  }

  interface Window {
    chrome?: {
      webview?: Webview2HostObject;
    };
  }
}

export {};
