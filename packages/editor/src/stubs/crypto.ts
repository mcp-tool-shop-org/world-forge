/**
 * Browser stub for node:crypto — signing.ts uses createHash (CLI-only).
 * This stub lets the module load without crashing; signing is never called in-editor.
 */
export function createHash() {
  throw new Error('node:crypto is not available in the browser. Use CLI for signing.');
}
