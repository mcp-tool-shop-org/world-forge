import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /** ED-B-009: confirmation after the user clicks "Copy error details". */
  copied: boolean;
  /** F-aa55b8da: clipboard failed — retitle the button and keep the report selectable. */
  copyFailed: boolean;
  reportText: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, copied: false, copyFailed: false, reportText: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, copied: false, copyFailed: false, reportText: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[WorldForge] Uncaught error:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, copied: false, copyFailed: false, reportText: null });
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
  private buildReportText(): string {
    const err = this.state.error;
    const projectId = (() => {
      try {
        const raw = localStorage.getItem('wf-autosave');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.project?.id ?? null;
      } catch { return null; }
    })();
    return JSON.stringify({
      message: err?.message ?? '(no message)',
      stack: err?.stack ?? null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      timestamp: new Date().toISOString(),
      projectId,
    }, null, 2);
  }

  private handleCopyDetails = async () => {
    const text = this.buildReportText();
    try {
      let ok = false;
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { ok = document.execCommand('copy'); } finally { document.body.removeChild(ta); }
      }
      if (!ok) throw new Error('clipboard write returned false');
      this.setState({ copied: true, copyFailed: false, reportText: text });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (copyErr) {
      console.warn('[WorldForge] Copy to clipboard failed:', copyErr);
      this.setState({ copied: false, copyFailed: true, reportText: text });
    }
  };

  /** F-aa55b8da: blob download so a denied clipboard is not a dead end. */
  private handleDownloadDetails = () => {
    const text = this.state.reportText ?? this.buildReportText();
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'error.json';
      a.rel = 'noopener';
      a.click();
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* ignore */ } }, 1000);
    } catch (err) {
      console.warn('[WorldForge] Download error.json failed:', err);
      this.setState({ copyFailed: true, reportText: text });
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ padding: 40, fontFamily: 'var(--wf-font-family)', color: 'var(--wf-text-primary)', background: 'var(--wf-bg-app)', minHeight: '100vh' }}>
        <img src="/mark.svg" alt="World Forge" width={32} height={32} style={{ display: 'block', marginBottom: 16 }} />
        <h1 style={{ margin: '0 0 12px', fontSize: 24 }}>Something went wrong</h1>
        <p style={{ margin: '0 0 20px', color: 'var(--wf-text-muted)' }}>
          The editor encountered an unexpected error.{' '}
          {/* EUB-015: localStorage access is wrapped in try-catch to handle SecurityError in restricted contexts */}
          {(() => { try { return typeof localStorage !== 'undefined' && localStorage.length >= 0 ? 'Your project data is preserved in local storage.' : ''; } catch { return 'Local storage is unavailable \u2014 data may not be preserved.'; } })()}
        </p>
        {(this.state.error || this.state.reportText) && (
          <pre
            data-testid="error-details-pre"
            style={{
              padding: 16, background: 'var(--wf-bg-elevated)', borderRadius: 8, overflow: 'auto', fontSize: 13, color: 'var(--wf-danger-text)', marginBottom: 20,
              userSelect: 'text', WebkitUserSelect: 'text',
            }}
          >
            {this.state.copyFailed && this.state.reportText
              ? this.state.reportText
              : (
                <>
                  {this.state.error?.message}
                  {(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV && this.state.error?.stack && (
                    <>{'\n\n'}{this.state.error.stack}</>
                  )}
                </>
              )}
          </pre>
        )}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={this.handleReset} style={{ padding: '8px 20px', background: 'var(--wf-bg-control)', color: 'var(--wf-text-primary)', border: '1px solid var(--wf-border-default)', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
            Try Again
          </button>
          <button onClick={this.handleReload} style={{ padding: '8px 20px', background: 'var(--wf-bg-control)', color: 'var(--wf-text-primary)', border: '1px solid var(--wf-border-default)', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
            Reload Page
          </button>
          {/* ED-B-009: lets users paste a structured report into a GitHub issue. */}
          <button
            onClick={this.handleCopyDetails}
            data-testid="error-copy-details"
            style={{ padding: '8px 20px', background: 'var(--wf-bg-control)', color: 'var(--wf-text-primary)', border: '1px solid var(--wf-border-default)', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
          >
            {this.state.copyFailed ? 'Copy failed — select the text below' : this.state.copied ? 'Copied!' : 'Copy error details'}
          </button>
          <button
            onClick={this.handleDownloadDetails}
            data-testid="error-download-details"
            style={{ padding: '8px 20px', background: 'var(--wf-bg-control)', color: 'var(--wf-text-primary)', border: '1px solid var(--wf-border-default)', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
          >
            Download error.json
          </button>
          <span style={{ fontSize: 12, color: 'var(--wf-text-muted)' }}>
            {this.state.copied ? '(paste into a GitHub issue)' : this.state.copyFailed ? 'Clipboard blocked — select the report or download it.' : ''}
          </span>
        </div>
      </div>
    );
  }
}
