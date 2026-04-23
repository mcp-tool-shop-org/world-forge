/**
 * canon-adapter.ts — interface stub for a future read-only canon binding.
 *
 * Reserved for post-v4.3.0 work. When implemented, an adapter lets the editor
 * load canonical game data (station lists, faction rosters, Motif scene ids)
 * as starter kits or dropdown sources — without writing back to canon trees.
 *
 * Canon sources of truth live outside World Forge:
 *   - style-dataset-lab/projects/<game>/canon/
 *   - star-freight/design/
 *   - motif/packages/scene-mapper/src/
 *
 * This file intentionally ships types only; no implementation is included in v4.2.0.
 */

/** A starter kit loaded from a game's canon tree. Shape is deliberately open. */
export interface CanonStarterKit {
  gameSlug: string;
  kitId: string;
  label: string;
  description?: string;
  /** Opaque payload — the concrete adapter decides how the editor consumes this. */
  payload: unknown;
}

/** Reference to a Motif scene id discovered in a game's scoring package. */
export interface CanonMotifSceneRef {
  gameSlug: string;
  sceneId: string;
  label?: string;
}

/**
 * Read-only adapter contract. Concrete implementations live outside @world-forge/schema
 * (e.g. in the editor, wired to filesystem or CLI helpers).
 */
export interface CanonAdapter {
  loadStarterKit(gameSlug: string, kitId: string): Promise<CanonStarterKit>;
  listMotifScenes(gameSlug: string): Promise<CanonMotifSceneRef[]>;
}
