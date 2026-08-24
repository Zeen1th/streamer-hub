import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Streamer Hub UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex h-screen items-center justify-center bg-surface p-8 text-ink">
        <section className="slab w-full max-w-lg p-8">
          <h1 className="font-display text-xl uppercase tracking-[0.04em]">Streamer Hub needs to reload</h1>
          <p className="mt-3 font-sans text-sm leading-relaxed text-ink/70">
            The interface hit an unexpected rendering problem. Reload the app window to continue.
          </p>
          <button
            type="button"
            className="mt-6 border border-primary bg-primary px-4 py-2 font-sans text-sm font-bold uppercase tracking-[0.08em] text-on-primary"
            onClick={() => window.location.reload()}
          >
            Reload app
          </button>
          <p className="mt-4 break-words font-mono text-xs text-danger">{this.state.error.message}</p>
        </section>
      </main>
    );
  }
}
