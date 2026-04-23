// diagnostics.ts — shared observability shape for the 5 renderers.
// INF-B-008: every renderer (and the viewport) exposes getDiagnostics() so
// external tooling can inspect lifecycle state without reaching into private
// fields or toggling debug builds. Pure read-only — never mutate state.

export interface DiagnosticInfo {
  /** The renderer's class name (e.g. "TileLayerRenderer"). */
  className: string;
  /** True once destroy() has been called. */
  destroyed: boolean;
  /** Number of children currently attached to the renderer's root container. */
  childCount: number;
}
