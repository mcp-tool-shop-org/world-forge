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
  packId?: string;        // references AssetPack.id
}

/** Version compatibility metadata for an asset pack. */
export interface PackCompatibility {
  minSchemaVersion?: string;  // e.g. '1.8.0'
  engineVersion?: string;     // e.g. '2.0.0'
}

/** A named, versioned grouping of assets for portability. */
export interface AssetPack {
  id: string;
  label: string;
  version: string;            // semver: '1.0.0'
  description?: string;
  tags: string[];
  theme?: string;             // e.g. 'dark-fantasy'
  source?: string;            // 'hand-drawn' | 'ai-generated' | 'stock'
  license?: string;           // e.g. 'CC-BY-4.0'
  author?: string;
  compatibility?: PackCompatibility;
}
