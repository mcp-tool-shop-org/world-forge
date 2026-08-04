// import-kit-modal-helpers.ts — pure logic extracted from ImportKitModal for
// testability. FileReader itself needs a DOM (this package's vitest
// environment defaults to 'node'), so the wiring stays imperative in the
// component; this extracts the branching that decides WHAT message (if any)
// a given reader outcome should produce, which has no DOM dependency at all.
//
// F-005: ImportKitModal's FileReader had no reader.onerror / reader.onabort
// handlers and no guard against a stale/superseded reader resolving out of
// order, unlike its sibling ImportModal.tsx (tagged ED-B-011 / EU-003 there).
// Concretely: (1) a read failure left the modal looking permanently stuck
// with no feedback, and (2) picking a second kit file before the first
// finished reading let whichever reader resolved LAST silently win, with no
// indication a conflict occurred.

/** Decides what user-visible error message (if any) a FileReader outcome
 *  should produce. `wasSupplanted` is true when a newer file pick has
 *  already replaced this reader (activeReaderRef points elsewhere) — in
 *  that case a stale abort must stay silent, since the new pick's result is
 *  what the user is actually waiting on. A genuine read error is always
 *  surfaced, supplanted or not. Mirrors ImportModal.tsx's proven hardening. */
export function readerOutcomeMessage(
  kind: 'error' | 'abort',
  wasSupplanted: boolean,
  errorDetail?: string,
): string | null {
  if (kind === 'abort') {
    return wasSupplanted ? null : 'File reading was aborted.';
  }
  return `Failed to read file: ${errorDetail ?? 'unknown error'}`;
}
