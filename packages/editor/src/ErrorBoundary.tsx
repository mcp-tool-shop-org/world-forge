import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /** ED-B-009: confirmation after the user clicks "Copy error details". */
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, copied: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, copied: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[WorldForge] Uncaught error:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, copied: false });
  };

  private handleReload = () => {
    window.location.reload();
  };

  /**
   * ED-B-009: Copy a structured error report to the clipboard. No telemetry —
   * the user pastes this into a GitHub issue themselves. We try to pull the
   * last-known project id from localStorage without requiring it; an
   * anonymous report is still better than nothing.
   */
  private handleCopyDetails = async () => {
    const err = this.state.error;
    const projectId = (() => {
      try {
        const raw = localStorage.getItem('wf-autosave');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.project?.id ?? null;
      } catch { return null; }
    })();
    const details = {
      message: err?.message ?? '(no message)',
      stack: err?.stack ?? null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      timestamp: new Date().toISOString(),
      projectId,
    };
    const text = JSON.stringify(details, null, 2);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback: synthesize a textarea + document.execCommand('copy').
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
      }
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (copyErr) {
      console.warn('[WorldForge] Copy to clipboard failed:', copyErr);
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif', color: '#e4e4e7', background: '#18181b', minHeight: '100vh' }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 24 }}>Something went wrong</h1>
        <p style={{ margin: '0 0 20px', color: '#a1a1aa' }}>
          The editor encountered an unexpected error.{' '}
          {/* EUB-015: localStorage access is wrapped in try-catch to handle SecurityError in restricted contexts */}
          {(() => { try { return typeof localStorage !== 'undefined' && localStorage.length >= 0 ? 'Your project data is preserved in local storage.' : ''; } catch { return 'Local storage is unavailable \u2014 data may not be preserved.'; } })()}
        </p>
        {this.state.error && (
          <pre style={{ padding: 16, background: '#27272a', borderRadius: 8, overflow: 'auto', fontSize: 13, color: '#f87171', marginBottom: 20 }}>
            {this.state.error.message}
            {(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV && this.state.error.stack && (
              <>{'\n\n'}{this.state.error.stack}</>
            )}
          </pre>
        )}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={this.handleReset} style={{ padding: '8px 20px', background: '#3f3f46', color: '#e4e4e7', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
            Try Again
          </button>
          <button onClick={this.handleReload} style={{ padding: '8px 20px', background: '#3f3f46', color: '#e4e4e7', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
            Reload Page
          </button>
          {/* ED-B-009: lets users paste a structured report into a GitHub issue. */}
          <button
            onClick={this.handleCopyDetails}
            data-testid="error-copy-details"
            style={{ padding: '8px 20px', background: '#3f3f46', color: '#e4e4e7', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
          >
            {this.state.copied ? 'Copied!' : 'Copy error details'}
          </button>
          <span style={{ fontSize: 12, color: '#a1a1aa' }}>
            {this.state.copied ? '(paste into a GitHub issue)' : ''}
          </span>
        </div>
      </div>
    );
  }
}
