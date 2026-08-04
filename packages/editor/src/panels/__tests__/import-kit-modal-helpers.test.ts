// import-kit-modal-helpers.test.ts — F-005: ImportKitModal's FileReader has
// no reader.onerror / reader.onabort handling and no guard against a stale
// reader resolving out of order, unlike its sibling ImportModal.tsx (ED-B-011
// / EU-003). FileReader itself needs a DOM the 'node' vitest environment
// doesn't provide, so this extracts and tests the pure decision logic behind
// the wiring: what message (if any) should a given reader outcome produce.

import { describe, it, expect } from 'vitest';
import { readerOutcomeMessage } from '../import-kit-modal-helpers.js';

describe('readerOutcomeMessage (F-005)', () => {
  it('produces a user-visible message for a read error, including the underlying detail', () => {
    expect(readerOutcomeMessage('error', false, 'permission denied')).toBe(
      'Failed to read file: permission denied',
    );
  });

  it('falls back to a generic message when no error detail is available', () => {
    expect(readerOutcomeMessage('error', false)).toBe('Failed to read file: unknown error');
  });

  it('surfaces an abort message when the reader was not supplanted by a newer pick', () => {
    expect(readerOutcomeMessage('abort', false)).toBe('File reading was aborted.');
  });

  it('stays silent when the abort happened because a newer file pick already superseded this reader', () => {
    // This is the race from F-005: user picks file A, then quickly picks file
    // B before A finishes. Aborting A's stale reader must not surface an
    // error for the pick (B) the user is actually waiting on.
    expect(readerOutcomeMessage('abort', true)).toBeNull();
  });

  it('an error is always surfaced even if it happens to arrive after being supplanted', () => {
    // Unlike abort, a genuine read error is worth surfacing regardless —
    // supplant-suppression only applies to the abort we ourselves triggered.
    expect(readerOutcomeMessage('error', true, 'disk full')).toBe('Failed to read file: disk full');
  });
});
