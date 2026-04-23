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
 * Classified error codes for concrete CanonAdapter implementations.
 *
 * SCH-B-004 (v4.4): Callers (editor, CLI tools) previously had to string-match
 * or try/catch without structure to distinguish a typo (NOT_FOUND) from a
 * corrupt file (PARSE_ERROR) or filesystem failure (IO_ERROR). Providing a
 * structured code lets the UI show the RIGHT recovery hint:
 *   - NOT_FOUND   → "Did you mean <similar slug>?"
 *   - IO_ERROR    → "Check file permissions or retry"
 *   - PARSE_ERROR → "Kit payload is malformed; regenerate or report"
 *   - INVALID_ARG → "Arguments failed validation before any I/O"
 */
export type CanonAdapterErrorCode =
  | 'NOT_FOUND'
  | 'IO_ERROR'
  | 'PARSE_ERROR'
  | 'INVALID_ARG';

/**
 * Structured error thrown by CanonAdapter implementations.
 *
 * Message format is `[code] what went wrong — gameSlug=<slug> kitId=<id>` so
 * that log output includes the context a user needs to file a bug report or
 * fix the call site, without callers needing to reconstruct it.
 */
export class CanonAdapterError extends Error {
  readonly code: CanonAdapterErrorCode;
  readonly gameSlug: string;
  readonly kitId?: string;

  constructor(
    code: CanonAdapterErrorCode,
    message: string,
    context: { gameSlug: string; kitId?: string; cause?: unknown },
  ) {
    const ctx = context.kitId
      ? `gameSlug=${context.gameSlug} kitId=${context.kitId}`
      : `gameSlug=${context.gameSlug}`;
    super(`[${code}] ${message} — ${ctx}`);
    this.name = 'CanonAdapterError';
    this.code = code;
    this.gameSlug = context.gameSlug;
    this.kitId = context.kitId;
    if (context.cause !== undefined) {
      // Preserve cause chain for structured loggers.
      (this as { cause?: unknown }).cause = context.cause;
    }
  }
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
 *   Concrete implementations SHOULD throw {@link CanonAdapterError} so callers
 *   can branch on `err.code` (NOT_FOUND vs IO_ERROR vs PARSE_ERROR vs
 *   INVALID_ARG) and surface the right recovery hint.
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
