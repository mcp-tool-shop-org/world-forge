// file-load.ts — helpers for the hidden <input type="file"> Load path.

/**
 * F-5c713675: always clear the file input so choosing the same .json again
 * fires onChange (the natural "revert from disk" path after accidental edits).
 */
export function resetFileInput(input: { value: string } | null | undefined): void {
  if (input) input.value = '';
}
