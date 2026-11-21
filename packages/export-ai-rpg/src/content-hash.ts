// content-hash.ts — the content hash the engine's load gate verifies.
//
// The engine computes this same hash at load and REFUSES a pack whose content
// does not match the value its manifest records (Factorio's mod-checksum shape;
// Paradox hashes only sim-affecting files so a comment or an asset path does not
// invalidate a save).
//
// ⚠ THIS IS A DELIBERATE DUPLICATE, and duplication across repos is
// defended by a live cross-repo equivalence check rather than trust:
//
//   1. Why it stays duplicated after 3.12.1 published `@ai-rpg-engine/content-schema`'s
//      `computeContentHash` (`gate.ts`): the engine's `gate.ts` imports
//      `createHash` from `'node:crypto'`, whereas `exportToEngine` (and
//      `computeContentHash` here) is the AIR-FT-005 browser-safe path
//      (`f-1d037344-browser-safe-hash.test.ts` asserts `node:crypto` is never
//      imported). So world-forge keeps its own sync FIPS 180-4 implementation.
//   2. It is CHECKED, not trusted. `__tests__/engine-deps-3x.test.ts` (Node)
//      asserts that this implementation produces the identical digest as
//      `@ai-rpg-engine/content-schema`'s `computeContentHash` across the empty
//      project, vocabulary-coverage, and both dogfood worlds, and the engine
//      repo's `packages/cli/src/c1-gate.test.ts` checks the committed fixture
//      the other way.
//
// Any change here must stay identical to the engine's gate.ts, and the
// equivalence test is what will say so.
//
// F-1d037344: hashing MUST NOT import `node:crypto`. `exportToEngine` (re-exported
// from the public `index.ts` entry) is the AIR-FT-005 browser-safe path —
// `resolveSchemaVersion` already documents "no node:module dependency" — so a
// top-level Node builtin here made any non-Node consumer throw after an
// otherwise-valid export. SHA-256 below is a sync FIPS 180-4 implementation;
// the digest prefix stays `sha256:` so the engine load gate still matches.

/**
 * The pack keys whose contents can change what the simulation computes.
 *
 * Must stay identical to `SIM_AFFECTING_KEYS` in the engine's gate.ts.
 * Deliberately EXCLUDES `schemaVersion` (metadata), `buildCatalog` /
 * `progressionTrees` (session-scoped — consumed before a world exists, so they
 * cannot change a simulation), and world-forge-only / uncarried keys.
 */
// A key joins the hash only when the engine carries it: engine first, then
// this mirror, then the measurement, in the same cycle.
export const SIM_AFFECTING_KEYS = [
  'entities',
  'zones',
  'dialogues',
  'quests',
  'abilities',
  'statuses',
  'verbs',
  'itemUseEffects',
  'districts',
  'placements',
  'encounterAnchors',
  'hazardDefinitions',
] as const;

/**
 * Deterministic JSON: object keys sorted at every depth, array order preserved.
 * Array order is content, not formatting — reordering zones can change which one
 * a fallback picks — so it is inside the hash on purpose.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string, unknown>;
  // ⚠ `undefined`-valued keys are SKIPPED, matching JSON.stringify. This side
  // hashes an IN-MEMORY pack; the engine hashes the same pack after a JSON
  // round-trip, which drops those keys. Without this filter the two could never
  // agree — the exporter stamped one hash and the loader computed another, for
  // byte-identical content. Caught by the engine's cross-repo equivalence test.
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`)
    .join(',')}}`;
}

/** SHA-256 over the pack's sim-affecting subset. Absent keys are omitted. */
export function computeContentHash(pack: unknown): string {
  const raw = (pack ?? {}) as Record<string, unknown>;
  const subset: Record<string, unknown> = {};
  for (const key of SIM_AFFECTING_KEYS) {
    if (raw[key] !== undefined) subset[key] = raw[key];
  }
  // UTF-8, matching Node `createHash('sha256').update(string)` default encoding
  // — TextEncoder is WHATWG (browsers + Node 11+), not a Node builtin.
  return `sha256:${sha256Hex(new TextEncoder().encode(canonicalize(subset)))}`;
}

// FIPS 180-4 SHA-256, sync, no Node / Web-Crypto dependency. `exportToEngine`
// is a synchronous API so `crypto.subtle.digest` (async) is not an option.
function sha256Hex(message: Uint8Array): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const bitLen = message.length * 8;
  const padLen = (message.length + 9 + 63) & ~63;
  const padded = new Uint8Array(padLen);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(padLen - 4, bitLen >>> 0, false);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return Array.from(H, (x) => x.toString(16).padStart(8, '0')).join('');
}
