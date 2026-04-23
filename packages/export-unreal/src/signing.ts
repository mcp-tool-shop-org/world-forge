/**
 * signing.ts — UE-FT-007 Pack signing (integrity hash).
 *
 * Integrity-only. Not a MAC, not a digital signature — a SHA-256 hash over a
 * canonicalized subset of the pack Meta so a loader (or CI) can detect
 * tampering between export and import.
 *
 * Design notes:
 *   - **Meta-scoped.** The hash covers pack Meta fields only. Zone/district
 *     files live on disk outside Meta; signing those is future work (would
 *     extend `signedFields` to include file hashes). For now the signature
 *     protects the fields that describe the pack itself.
 *   - **Opt-in on export.** `exportToUnreal({ signing: { algorithm: 'sha256' } })`
 *     adds the `Signature` field; omitting it keeps the current unsigned
 *     output (backward compat).
 *   - **Opt-in on verify.** Import does NOT auto-verify. `verifyPackSignature`
 *     is exported so the UE5 loader or a CI step can call it explicitly.
 *   - **Stable.** Hashing the same pack twice produces the same value. Inputs
 *     are canonicalized: sorted keys, no whitespace, stable undefined
 *     handling.
 *   - **Node built-ins only.** `crypto.createHash` — no external dep.
 */

import { createHash } from 'node:crypto';

import type { UnrealPackMeta } from './export.js';

export type SigningAlgorithm = 'sha256';

export interface PackSignature {
  algorithm: SigningAlgorithm;
  /** Hex-encoded digest. */
  value: string;
  /**
   * Meta field names covered by the hash, in the order they were hashed.
   * Excludes `Signature` itself (you cannot sign the signature). Verifiers
   * MUST re-canonicalize using this list; if a new exporter adds a field to
   * `signedFields`, an old verifier will still validate the overlap even if
   * it doesn't know the new field.
   */
  signedFields: string[];
}

/**
 * Meta field names covered by a signature, in canonical order. Deliberately
 * excludes `Signature` (self-reference is meaningless) and `FormatVersion`
 * is INCLUDED — signing a specific format version protects against pack
 * downgrade attacks.
 */
const DEFAULT_SIGNED_FIELDS: ReadonlyArray<keyof UnrealPackMeta> = [
  'Id',
  'Name',
  'Description',
  'Version',
  'Author',
  'License',
  'Category',
  'Tags',
  'SourceProjectId',
  'TileSizeCm',
  'SourceTileSizePx',
  'FormatVersion',
];

/**
 * Canonicalize a subset of Meta for hashing. Produces a stable JSON string:
 *   - Only `signedFields` are included.
 *   - `undefined` values are preserved as explicit `null` markers so two
 *     packs where one sets `Author: undefined` and the other omits Author
 *     hash identically (both represent "no author").
 *   - Arrays preserve order — order is semantic for `Tags`.
 *   - Object keys are iterated in the DEFAULT_SIGNED_FIELDS order (not
 *     alphabetical) so the canonical form is driven by the signed-fields
 *     contract, not JS property ordering.
 */
function canonicalize(meta: UnrealPackMeta, fields: ReadonlyArray<string>): string {
  const record = meta as unknown as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of fields) {
    const value = record[key];
    parts.push(JSON.stringify(key) + ':' + JSON.stringify(value ?? null));
  }
  return '{' + parts.join(',') + '}';
}

/**
 * Compute a signature over the given meta. The returned `PackSignature` has
 * the same shape the `Signature` Meta field will take.
 */
export function signMeta(
  meta: UnrealPackMeta,
  opts: { algorithm: SigningAlgorithm } = { algorithm: 'sha256' },
): PackSignature {
  const signedFields = DEFAULT_SIGNED_FIELDS.slice();
  const canonical = canonicalize(meta, signedFields);
  const hash = createHash(opts.algorithm);
  hash.update(canonical);
  return {
    algorithm: opts.algorithm,
    value: hash.digest('hex'),
    signedFields,
  };
}

/**
 * A MetaStep-compatible composer. Slots into `buildMeta` as the LAST step so
 * the signature covers every earlier-composed field.
 */
export function composeSignedMeta(
  meta: UnrealPackMeta,
  opts: { algorithm: SigningAlgorithm } = { algorithm: 'sha256' },
): UnrealPackMeta {
  const signature = signMeta(meta, opts);
  return { ...meta, Signature: signature };
}

export interface VerifyResult {
  valid: boolean;
  reason?: string;
}

/**
 * Recompute the signature over the claimed `signedFields` and compare. Returns
 * `{ valid: true }` if the recomputed digest matches the stored one, else
 * `{ valid: false, reason }` with a human-readable explanation.
 *
 * Does NOT throw on malformed input — returns `{ valid: false }` with a reason
 * so the loader can decide whether to refuse the pack or fall through.
 */
export function verifyPackSignature(meta: UnrealPackMeta): VerifyResult {
  const sig = meta.Signature;
  if (!sig) {
    return { valid: false, reason: 'Pack has no Signature field.' };
  }
  if (sig.algorithm !== 'sha256') {
    return { valid: false, reason: `Unsupported signature algorithm "${String(sig.algorithm)}".` };
  }
  if (typeof sig.value !== 'string' || sig.value.length === 0) {
    return { valid: false, reason: 'Signature value is empty or not a string.' };
  }
  if (!Array.isArray(sig.signedFields) || sig.signedFields.length === 0) {
    return { valid: false, reason: 'Signature.signedFields is empty or missing.' };
  }

  const canonical = canonicalize(meta, sig.signedFields);
  const hash = createHash(sig.algorithm);
  hash.update(canonical);
  const expected = hash.digest('hex');
  if (expected !== sig.value) {
    return {
      valid: false,
      reason: 'Signature mismatch — a signed field has been modified since export.',
    };
  }
  return { valid: true };
}
