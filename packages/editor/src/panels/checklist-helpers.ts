// checklist-helpers.ts — pure logic extracted from ChecklistPanel for
// testability (no DOM/React needed — this package's vitest config sets no
// `environment`, which defaults to 'node', so components can't be rendered
// in tests at all; pure helpers like this one are the only testable surface).
//
// F-002: the onboarding checklist's 'review' step was hardcoded
// isComplete: false with no backing state (no hasReviewedProject-style flag
// exists anywhere in the store), so `completed === steps.length` could never
// be true for ANY project — the "All steps complete!" message and the
// celebratory "Go to Export" button were permanently unreachable dead code.
//
// Fix: steps with no real backing completion signal are marked `advisory`
// and excluded from the completed/total denominator and the allDone gate,
// instead of permanently blocking it. They still render in the list (so the
// user still sees "Review project" as a suggestion) — they just can't be a
// hard gate on "you're done" when nothing can ever set them complete.

export interface ChecklistStepLike {
  isComplete: boolean;
  /** Non-gating step: shown in the list, but excluded from completed/total
   *  and from the allDone check. Use for steps with no backing completion
   *  state (e.g. "review your work") that would otherwise permanently block
   *  100% completion. */
  advisory?: boolean;
}

export interface ChecklistProgress {
  completed: number;
  total: number;
  allDone: boolean;
}

/** Computes checklist completion stats, excluding advisory (non-gating)
 *  steps from both the denominator and the allDone gate. */
export function computeChecklistProgress(steps: ChecklistStepLike[]): ChecklistProgress {
  const gating = steps.filter((s) => !s.advisory);
  const completed = gating.filter((s) => s.isComplete).length;
  const total = gating.length;
  return { completed, total, allDone: total > 0 && completed === total };
}
