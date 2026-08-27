// ids.ts — session-unique ids (timestamp + monotonic counter).
// F-ddfcddfb: `Date.now()` alone collides when two objects are minted in the
// same millisecond; generateZoneId already used a counter — this is that
// pattern for every runtime-allocated prefix.

let _seq = 0;

/** Next unique id for `prefix`. Format: `{prefix}-{timestamp}-{seq}`. */
export function nextId(prefix: string): string {
  _seq += 1;
  return `${prefix}-${Date.now()}-${_seq}`;
}

/** Zone ids — same contract as the previous Canvas.generateZoneId. */
export function generateZoneId(): string {
  return nextId('zone');
}
