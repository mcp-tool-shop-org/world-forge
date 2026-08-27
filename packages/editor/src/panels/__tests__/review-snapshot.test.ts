import { describe, it, expect } from 'vitest';
import { buildReviewSnapshot } from '@world-forge/schema';
import { enrichReviewSnapshot } from '../ReviewPanel.js';
import { SAMPLE_WORLDS } from '../../templates/samples.js';

const chapel = SAMPLE_WORLDS[2].project;

describe('F-b6d9c980: enrichReviewSnapshot uses the kit display name', () => {
  it('prefers kitName over the opaque activeKitId', () => {
    const snap = buildReviewSnapshot(chapel);
    const enriched = enrichReviewSnapshot(snap, {
      activeKitId: 'kit-import-1710000000000-1',
      kitName: 'Forgotten Vault',
      kitSource: 'imported',
      importSourceFormat: null,
      projectBundleSource: null,
      importFidelityPercent: null,
      hasExported: false,
    });
    expect(enriched.kitName).toBe('Forgotten Vault');
    expect(enriched.kitName).not.toBe('kit-import-1710000000000-1');
    expect(enriched.kitSource).toBe('imported');
  });
});
