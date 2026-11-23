// OptionsModal.tsx — editor options dialog for Speed Panel triggers and thresholds

import { useEffect, useState } from 'react';
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
import { useSpeedPanelPins } from '../store/speed-panel-store.js';

export const TRIGGER_KEY_ERROR_ID = 'wf-opt-trigger-key-error';

export interface KeyCaptureEventLike {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
}

/** Parse a threshold numeric draft without mid-typing clamping; returns null for blank or non-finite input. */
export function parseThresholdDraft(draft: string): number | null {
  const trimmed = draft.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Clamp a numeric threshold value to `[min, max]` matching store persistence rules. */
export function clampThresholdDraftValue(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Commit a threshold numeric draft, clamping out-of-range inputs and restoring invalid blanks. */
export function commitThresholdDraft(
  draft: string,
  storedValue: number,
  min: number,
  max: number,
  onCommit: (value: number) => void,
): string {
  const parsed = parseThresholdDraft(draft);
  if (parsed === null) {
    return String(storedValue);
  }
  const clamped = clampThresholdDraftValue(parsed, min, max);
  onCommit(clamped);
  return String(clamped);
}

/** Handle Enter (commit) and Escape (revert dirty draft) on a numeric threshold field. */
export function handleThresholdFieldKeyDown(
  e: { key: string; preventDefault: () => void; stopPropagation: () => void },
  draft: string,
  storedValue: number,
  onCommitDraft: () => void,
  onResetDraft: (value: string) => void,
): void {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    onCommitDraft();
  } else if (e.key === 'Escape') {
    const stored = String(storedValue);
    if (draft !== stored) {
      e.preventDefault();
      e.stopPropagation();
      onResetDraft(stored);
    }
  }
}

/** Process a keydown event on the trigger-key capture field and return an updated error state or `'ignored'`. */
export function applyKeyCaptureEvent(
  e: KeyCaptureEventLike,
  setTriggerKey: (input: string) => { ok: true; code: string } | { ok: false; reason: string },
): { handled: false } | { handled: true; error: string | null } {
  if (e.key === 'Tab' || e.key === 'Escape') {
    return { handled: false };
  }
  e.preventDefault();
  e.stopPropagation();
  if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
    return { handled: false };
  }
  if (e.ctrlKey || e.metaKey || e.altKey) {
    return { handled: true, error: 'Choose a single unmodified key (no Ctrl, Alt, or Meta).' };
  }
  const candidate = e.key === 'Dead' ? 'Dead' : (e.code || e.key);
  const res = setTriggerKey(candidate);
  return { handled: true, error: res.ok ? null : res.reason };
}

interface Props {
  onClose: () => void;
  initialKeyError?: string | null;
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

interface ThresholdFieldProps {
  label: string;
  testId: string;
  min: number;
  max: number;
  value: number;
  resetToken: number;
  onCommit: (value: number) => void;
}

function ThresholdNumberField({
  label,
  testId,
  min,
  max,
  value,
  resetToken,
  onCommit,
}: ThresholdFieldProps) {
  const [draft, setDraft] = useState(() => String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value, resetToken]);

  const commit = () => {
    setDraft(commitThresholdDraft(draft, value, min, max, onCommit));
  };

  return (
    <label style={ROW_STYLE}>
      <span style={LABEL_STYLE}>{label}</span>
      <input
        type="number"
        data-testid={testId}
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) =>
          handleThresholdFieldKeyDown(e, draft, value, commit, (restored) => setDraft(restored))
        }
        style={NUMBER_INPUT_STYLE}
      />
    </label>
  );
}

export function OptionsModal({ onClose, initialKeyError = null }: Props) {
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
  const showRecents = useSpeedPanelPins((s) => s.showRecents);
  const setShowRecents = useSpeedPanelPins((s) => s.setShowRecents);

  const [keyError, setKeyError] = useState<string | null>(initialKeyError);
  const [resetToken, setResetToken] = useState(0);
  const penThresholds = resolveGestureThresholds(options, 'pen');
  const footerPreview = formatSpeedPanelTriggerFooter(options);

  const handleKeyCapture = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const outcome = applyKeyCaptureEvent(e, setTriggerKey);
    if (outcome.handled) {
      setKeyError(outcome.error);
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
            aria-invalid={keyError ? true : undefined}
            aria-describedby={keyError ? TRIGGER_KEY_ERROR_ID : undefined}
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
            id={TRIGGER_KEY_ERROR_ID}
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

        <label style={ROW_STYLE}>
          <span style={LABEL_STYLE}>Show recent commands in Speed Panel</span>
          <input
            type="checkbox"
            data-testid="wf-opt-show-recents"
            checked={showRecents}
            onChange={(e) => setShowRecents(e.target.checked)}
          />
        </label>

        <div style={{ borderTop: '1px solid var(--wf-border-subtle)', paddingTop: 8 }}>
          <div style={{ ...HINT_STYLE, marginBottom: 4 }}>
            Right-click thresholds (pen adjusts automatically to {penThresholds.driftPx} px drift / {penThresholds.radiusPx} px radius / {penThresholds.windowMs} ms window)
          </div>

          <ThresholdNumberField
            label={`Per-press click drift (${CLICK_DRIFT_RANGE.min}–${CLICK_DRIFT_RANGE.max} px)`}
            testId="wf-opt-click-drift"
            min={CLICK_DRIFT_RANGE.min}
            max={CLICK_DRIFT_RANGE.max}
            value={options.clickDriftPx}
            resetToken={resetToken}
            onCommit={setClickDriftPx}
          />

          <ThresholdNumberField
            label={`Double right-click radius (${DOUBLE_CLICK_RADIUS_RANGE.min}–${DOUBLE_CLICK_RADIUS_RANGE.max} px)`}
            testId="wf-opt-dbl-radius"
            min={DOUBLE_CLICK_RADIUS_RANGE.min}
            max={DOUBLE_CLICK_RADIUS_RANGE.max}
            value={options.doubleClickRadiusPx}
            resetToken={resetToken}
            onCommit={setDoubleClickRadiusPx}
          />

          <ThresholdNumberField
            label={`Double right-click window (${DOUBLE_CLICK_WINDOW_RANGE.min}–${DOUBLE_CLICK_WINDOW_RANGE.max} ms)`}
            testId="wf-opt-dbl-window"
            min={DOUBLE_CLICK_WINDOW_RANGE.min}
            max={DOUBLE_CLICK_WINDOW_RANGE.max}
            value={options.doubleClickWindowMs}
            resetToken={resetToken}
            onCommit={setDoubleClickWindowMs}
          />
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
              setShowRecents(true);
              setKeyError(null);
              setResetToken((n) => n + 1);
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
