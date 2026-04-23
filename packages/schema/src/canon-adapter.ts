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
  /**
   * Opaque payload — the concrete adapter decides how the editor consumes this.
   *
   * Expected concrete shapes today:
   *   1. Starter kit JSON — a snapshot of a WorldProject subset (zones, districts, assets).
   *   2. Motif scene bundle — `{ sceneId, cues, clips }` from a scoring package.
   *   3. Game-specific canon snapshot — e.g. Star Freight station roster, faction tree.
   *
   * Consumers should narrow via their own runtime check (e.g. zod schema, shape guard)
   * before use. Do NOT assume any specific fields.
   */
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
 *
 * ── Error contract ────────────────────────────────────────
 * `loadStarterKit(gameSlug, kitId)` — REJECTS the returned promise with an Error
 *   when either `gameSlug` or `kitId` is unknown, when the kit payload cannot be
 *   read (I/O error), or when the payload fails structural parsing. Callers MUST
 *   handle rejection. A successful resolve always returns a fully populated
 *   `CanonStarterKit`.
 *
 * `listMotifScenes(gameSlug)` — RESOLVES with an empty array `[]` when
 *   `gameSlug` is unknown or the game has no Motif scenes. It does NOT reject
 *   for unknown games, so callers can safely call it for any slug and treat an
 *   empty result as "no scenes available". It MAY reject for underlying I/O
 *   errors (file unreadable, permission denied).
 */
export interface CanonAdapter {
  /**
   * Load a named starter kit from a game's canon tree.
   * @throws {Error} when gameSlug or kitId is unknown, or payload is unreadable.
   */
  loadStarterKit(gameSlug: string, kitId: string): Promise<CanonStarterKit>;
  /**
   * List available Motif scene refs for a game.
   * Returns `[]` (never throws) when the game is unknown or has no scenes.
   */
  listMotifScenes(gameSlug: string): Promise<CanonMotifSceneRef[]>;
}
