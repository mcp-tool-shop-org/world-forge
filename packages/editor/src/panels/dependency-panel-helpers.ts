// dependency-panel-helpers.ts — pure logic extracted from DependencyPanel for
// testability (no DOM/React needed).
//
// F-010: the relink picker's open/closed state was tracked as
// `relinkEdge: DependencyEdge | null`, rendered via reference equality
// (`relinkEdge === edge`). report/issueEdges/grouped are recomputed via
// `useMemo(() => scanDependencies(project), [project])`, and scanDependencies
// is a pure function that constructs brand-new edge objects on every call —
// so ANY change to `project` (from anywhere in the app; this panel occupies
// one tab of a multi-pane editor where canvas edits happen concurrently)
// produces a new array of edge objects with new identities. Once that
// happens, the `relinkEdge` reference captured when the user clicked
// "Relink..." can never `===` any edge in the new array again, so the picker
// silently and permanently closes with no user action and no explanation.
//
// Fix: derive a stable string identity for an edge and compare THAT instead
// of the object reference, so the picker survives unrelated project edits.

import type { DependencyEdge } from '@world-forge/schema';

/** Stable string identity for a DependencyEdge, safe to compare across
 *  independent scanDependencies() calls (which never return the same object
 *  twice, even for the same underlying issue). Includes fieldName in
 *  addition to the domain/sourceType/sourceId/expectedKind recommended by
 *  the audit, so two different broken ref fields on the same source entity
 *  that happen to expect the same asset kind still resolve to distinct keys. */
export function edgeKey(edge: DependencyEdge): string {
  return `${edge.domain}:${edge.sourceType}:${edge.sourceId}:${edge.fieldName ?? ''}:${edge.expectedKind ?? ''}`;
}
