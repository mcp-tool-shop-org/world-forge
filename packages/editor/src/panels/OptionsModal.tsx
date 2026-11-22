// OptionsModal.tsx — editor options dialog for Speed Panel triggers and thresholds

import { useState } from 'react';
import { ModalFrame } from '../ui/ModalFrame.js';
import { buttonBase } from '../ui/styles.js';
import {
  CLICK_DRIFT_RANGE,
  DOUBLE_CLICK_RADIUS_RANGE,
  DOUBLE_CLICK_WINDOW_RANGE,
  formatSpeedPanelTriggerFooter,
  formatTriggerKeyLabel,
  resolveGestureThresholds,
  useSpeedPanelOptions,
} from '../store/speed-panel-options-store.js';

interface Props {
  onClose: () => void;
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '6px 0',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--wf-font-md)',
  color: 'var(--wf-text-primary)',
};

const HINT_STYLE: React.CSSProperties = {
  fontSize: 'var(--wf-font-xs)',
  color: 'var(--wf-text-muted)',
};

const NUMBER_INPUT_STYLE: React.CSSProperties = {
  width: 72,
  padding: '4px 6px',
  background: 'var(--wf-bg-app)',
  color: 'var(--wf-text-primary)',
  border: '1px solid var(--wf-border-default)',
  borderRadius: 'var(--wf-radius-sm)',
  fontSize: 'var(--wf-font-md)',
  textAlign: 'right',
};

export function OptionsModal({ onClose }: Props) {
  const {
    options,
    setKeyTriggerEnabled,
    setTriggerKey,
    setDoubleRightClickEnabled,
    setClickDriftPx,
    setDoubleClickRadiusPx,
    setDoubleClickWindowMs,
    resetOptions,
  } = useSpeedPanelOptions();

  const [keyError, setKeyError] = useState<string | null>(null);
  const penThresholds = resolveGestureThresholds(options, 'pen');
  const footerPreview = formatSpeedPanelTriggerFooter(options);

  const handleKeyCapture = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' || e.key === 'Escape') {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) {
      setKeyError('Choose a single unmodified key (no Ctrl, Alt, or Meta).');
      return;
    }
    const candidate = e.key === 'Dead' ? 'Dead' : (e.code || e.key);
    const res = setTriggerKey(candidate);
    if (res.ok) {
      setKeyError(null);
    } else {
      setKeyError(res.reason);
    }
  };

  return (
    <ModalFrame title="Options" width={480} onClose={onClose}>
      <div data-testid="wf-options-modal" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 'var(--wf-font-sm)', color: 'var(--wf-text-muted)' }}>
          Configure how the Speed Panel opens at the pointer over the map canvas.
        </div>

        <label style={ROW_STYLE}>
          <span style={LABEL_STYLE}>Open Speed Panel on single key</span>
          <input
            type="checkbox"
            data-testid="wf-opt-key-trigger-enabled"
            checked={options.keyTriggerEnabled}
            onChange={(e) => setKeyTriggerEnabled(e.target.checked)}
          />
        </label>

        <div style={ROW_STYLE}>
          <div>
            <div style={LABEL_STYLE}>Trigger key</div>
            <div style={HINT_STYLE}>Focus and press an unused key (default: Q)</div>
          </div>
          <input
            type="text"
            readOnly
            aria-label="Speed Panel trigger key"
            data-testid="wf-opt-trigger-key"
            value={formatTriggerKeyLabel(options.triggerKey)}
            onKeyDown={handleKeyCapture}
            style={{
              ...NUMBER_INPUT_STYLE,
              width: 96,
              textAlign: 'center',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          />
        </div>

        {keyError && (
          <div
            role="alert"
            data-testid="wf-opt-trigger-key-error"
            style={{
              fontSize: 'var(--wf-font-sm)',
              color: 'var(--wf-danger-text)',
              background: 'color-mix(in srgb, var(--wf-danger) 14%, var(--wf-bg-app))',
              border: '1px solid var(--wf-danger)',
              borderRadius: 'var(--wf-radius-sm)',
              padding: '6px 8px',
            }}
          >
            {keyError}
          </div>
        )}

        <label style={ROW_STYLE}>
          <span style={LABEL_STYLE}>Grow compact menu on double right-click</span>
          <input
            type="checkbox"
            data-testid="wf-opt-dbl-right-enabled"
            checked={options.doubleRightClickEnabled}
            onChange={(e) => setDoubleRightClickEnabled(e.target.checked)}
          />
        </label>

        <div style={{ borderTop: '1px solid var(--wf-border-subtle)', paddingTop: 8 }}>
          <div style={{ ...HINT_STYLE, marginBottom: 4 }}>
            Right-click thresholds (pen adjusts automatically to {penThresholds.driftPx} px drift / {penThresholds.radiusPx} px radius / {penThresholds.windowMs} ms window)
          </div>

          <label style={ROW_STYLE}>
            <span style={LABEL_STYLE}>
              Per-press click drift ({CLICK_DRIFT_RANGE.min}–{CLICK_DRIFT_RANGE.max} px)
            </span>
            <input
              type="number"
              data-testid="wf-opt-click-drift"
              min={CLICK_DRIFT_RANGE.min}
              max={CLICK_DRIFT_RANGE.max}
              value={options.clickDriftPx}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setClickDriftPx(n);
              }}
              style={NUMBER_INPUT_STYLE}
            />
          </label>

          <label style={ROW_STYLE}>
            <span style={LABEL_STYLE}>
              Double right-click radius ({DOUBLE_CLICK_RADIUS_RANGE.min}–{DOUBLE_CLICK_RADIUS_RANGE.max} px)
            </span>
            <input
              type="number"
              data-testid="wf-opt-dbl-radius"
              min={DOUBLE_CLICK_RADIUS_RANGE.min}
              max={DOUBLE_CLICK_RADIUS_RANGE.max}
              value={options.doubleClickRadiusPx}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setDoubleClickRadiusPx(n);
              }}
              style={NUMBER_INPUT_STYLE}
            />
          </label>

          <label style={ROW_STYLE}>
            <span style={LABEL_STYLE}>
              Double right-click window ({DOUBLE_CLICK_WINDOW_RANGE.min}–{DOUBLE_CLICK_WINDOW_RANGE.max} ms)
            </span>
            <input
              type="number"
              data-testid="wf-opt-dbl-window"
              min={DOUBLE_CLICK_WINDOW_RANGE.min}
              max={DOUBLE_CLICK_WINDOW_RANGE.max}
              value={options.doubleClickWindowMs}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setDoubleClickWindowMs(n);
              }}
              style={NUMBER_INPUT_STYLE}
            />
          </label>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--wf-border-subtle)',
            paddingTop: 10,
            marginTop: 4,
          }}
        >
          <span style={HINT_STYLE} data-testid="wf-opt-footer-preview">
            Compact menu footer: {footerPreview}
          </span>
          <button
            type="button"
            data-testid="wf-opt-reset"
            onClick={() => {
              resetOptions();
              setKeyError(null);
            }}
            style={buttonBase}
          >
            Reset defaults
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}
