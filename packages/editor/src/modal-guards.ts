// modal-guards.ts — utilities for guarding destructive modal actions

const DEFAULT_DISCARD_MESSAGE = 'You have unsaved changes. Discard?';

/**
 * Prompt the user to confirm discarding unsaved changes.
 * Returns true if the user confirms, false otherwise.
 */
export function confirmDiscard(message?: string): boolean {
  return window.confirm(message ?? DEFAULT_DISCARD_MESSAGE);
}
