import { describe, it, expect } from 'vitest';

import { exportToUnreal } from '../export.js';
import {
  signMeta, composeSignedMeta, verifyPackSignature,
} from '../signing.js';
import type { UnrealPackMeta } from '../export.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';

function exportSigned() {
  const result = exportToUnreal(minimalProject);
  if (!result.success) throw new Error('export failed');
  return {
    ...result,
    contentPack: {
      ...result.contentPack,
      Meta: composeSignedMeta(result.contentPack.Meta),
    },
  };
}

function baseMeta(): UnrealPackMeta {
  return {
    Id: 'pack-x',
    Name: 'Pack X',
    Description: 'x',
    Version: '1.0.0',
    SourceProjectId: 'pack-x',
    TileSizeCm: 100,
    SourceTileSizePx: 32,
    FormatVersion: '1.1.0',
  };
}

describe('signMeta', () => {
  it('produces a stable hex digest for the same meta', () => {
    const meta = baseMeta();
    const a = signMeta(meta);
    const b = signMeta(meta);
    expect(a.algorithm).toBe('sha256');
    expect(a.value).toBe(b.value);
    expect(a.value).toMatch(/^[0-9a-f]{64}$/);
    expect(a.signedFields.length).toBeGreaterThan(0);
    expect(a.signedFields).not.toContain('Signature');
  });

  it('produces a different digest when any signed field changes', () => {
    const a = signMeta(baseMeta());
    const b = signMeta({ ...baseMeta(), Name: 'Pack Y' });
    expect(a.value).not.toBe(b.value);
  });
});

describe('composeSignedMeta', () => {
  it('attaches a Signature field that matches signMeta', () => {
    const meta = baseMeta();
    const composed = composeSignedMeta(meta);
    expect(composed.Signature).toBeDefined();
    expect(composed.Signature?.algorithm).toBe('sha256');
    expect(composed.Signature?.value).toBe(signMeta(meta).value);
  });

  it('is deterministic — composing twice yields the same signature value', () => {
    const meta = baseMeta();
    const a = composeSignedMeta(meta);
    const b = composeSignedMeta(meta);
    expect(a.Signature?.value).toBe(b.Signature?.value);
  });
});

describe('verifyPackSignature', () => {
  it('returns valid=true on an untouched signed meta', () => {
    const signed = composeSignedMeta(baseMeta());
    const result = verifyPackSignature(signed);
    expect(result.valid).toBe(true);
  });

  it('returns valid=false with a reason on tampered meta', () => {
    const signed = composeSignedMeta(baseMeta());
    // Tamper: change the name after signing.
    const tampered: UnrealPackMeta = { ...signed, Name: 'Tampered Name' };
    const result = verifyPackSignature(tampered);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('mismatch');
  });

  it('returns valid=false when there is no Signature', () => {
    const result = verifyPackSignature(baseMeta());
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('no Signature');
  });

  it('rejects unsupported algorithm', () => {
    const signed = composeSignedMeta(baseMeta());
    const weird = {
      ...signed,
      Signature: { ...signed.Signature!, algorithm: 'md5' as unknown as 'sha256' },
    } as UnrealPackMeta;
    const result = verifyPackSignature(weird);
    expect(result.valid).toBe(false);
  });
});

describe('exportToUnreal signing integration', () => {
  it('has no Signature when signing option is omitted (backward compat)', () => {
    const result = exportToUnreal(minimalProject);
    if (!result.success) throw new Error('export failed');
    expect(result.contentPack.Meta.Signature).toBeUndefined();
  });

  it('attaches a Signature when composeSignedMeta is applied after export (F-36785d5f)', () => {
    const result = exportSigned();
    const sig = result.contentPack.Meta.Signature;
    expect(sig).toBeDefined();
    expect(sig?.algorithm).toBe('sha256');
    expect(sig?.value).toMatch(/^[0-9a-f]{64}$/);
    expect(sig?.signedFields.length).toBeGreaterThan(0);
  });

  it('verifyPackSignature succeeds on a freshly exported signed pack', () => {
    const result = exportSigned();
    expect(verifyPackSignature(result.contentPack.Meta).valid).toBe(true);
  });

  it('tampering with an exported signed pack fails verification', () => {
    const result = exportSigned();
    const tampered: UnrealPackMeta = { ...result.contentPack.Meta, Name: 'Different Name' };
    expect(verifyPackSignature(tampered).valid).toBe(false);
  });

  it('signature shape is stable across two exports of the same project', () => {
    const a = exportSigned();
    const b = exportSigned();
    expect(a.contentPack.Meta.Signature?.value).toBe(b.contentPack.Meta.Signature?.value);
  });

  it('F-36785d5f: exportToUnreal itself does not attach a Signature (browser-safe)', () => {
    const result = exportToUnreal(minimalProject, { signing: { algorithm: 'sha256' } });
    if (!result.success) throw new Error('export failed');
    expect(result.contentPack.Meta.Signature).toBeUndefined();
    expect(result.warnings.some((w) => w.includes('signing'))).toBe(true);
  });
});
