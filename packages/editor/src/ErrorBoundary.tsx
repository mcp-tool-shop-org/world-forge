import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[WorldForge] Uncaught error:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif', color: '#e4e4e7', background: '#18181b', minHeight: '100vh' }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 24 }}>Something went wrong</h1>
        <p style={{ margin: '0 0 20px', color: '#a1a1aa' }}>
          The editor encountered an unexpected error. Your project data is preserved in local storage.
        </p>
        {this.state.error && (
          <pre style={{ padding: 16, background: '#27272a', borderRadius: 8, overflow: 'auto', fontSize: 13, color: '#f87171', marginBottom: 20 }}>
            {this.state.error.message}
          </pre>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={this.handleReset} style={{ padding: '8px 20px', background: '#3f3f46', color: '#e4e4e7', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
            Try Again
          </button>
          <button onClick={this.handleReload} style={{ padding: '8px 20px', background: '#3f3f46', color: '#e4e4e7', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}
