// assets.ts — asset manifest entry types

/** The kind of visual asset. */
export type AssetKind = 'portrait' | 'sprite' | 'background' | 'icon' | 'tileset';

/** Provenance metadata for an asset. */
export interface AssetProvenance {
  source?: string;       // 'hand-drawn' | 'ai-generated' | 'stock' | 'screenshot'
  author?: string;
  license?: string;
  createdAt?: string;    // ISO 8601
}

/** A single entry in the project's asset manifest. */
export interface AssetEntry {
  id: string;
  kind: AssetKind;
  label: string;
  path: string;          // relative path or URI
  version?: string;
  tags: string[];
  provenance?: AssetProvenance;
}
