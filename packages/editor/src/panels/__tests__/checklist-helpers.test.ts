// checklist-helpers.test.ts — F-002: ChecklistPanel's onboarding checklist can
// never reach "all complete" because its 'review' step is hardcoded
// isComplete: false with no backing logic. This asserts BEHAVIOR (can allDone
// ever become true?), not just registration/shape — a shape-only test (e.g.
// "steps has 8 entries") would pass on the broken code and catch nothing.

import { describe, it, expect } from 'vitest';
import { computeChecklistProgress, type ChecklistStepLike } from '../checklist-helpers.js';

/** Builds a step list shaped like ChecklistPanel's real `steps` array for a
 *  fully-populated project: every actionable step done, plus the advisory
 *  'review' step which has no backing completion signal and is never marked
 *  complete. */
function fullyActionableSteps(): ChecklistStepLike[] {
  return [
    { isComplete: true },  // district
    { isComplete: true },  // first-zone
    { isComplete: true },  // zone
    { isComplete: true },  // spawn
    { isComplete: true },  // player
    { isComplete: true },  // npc
    { isComplete: true },  // export
    { isComplete: false, advisory: true }, // review — no backing state, non-gating
  ];
}

describe('computeChecklistProgress (F-002)', () => {
  it('reaches allDone once every actionable step is complete, even though the advisory review step never is', () => {
    const progress = computeChecklistProgress(fullyActionableSteps());
    expect(progress.allDone).toBe(true);
  });

  it('excludes advisory steps from the completed/total denominator', () => {
    const progress = computeChecklistProgress(fullyActionableSteps());
    expect(progress.total).toBe(7);
    expect(progress.completed).toBe(7);
  });

  it('is not done while a real (non-advisory) actionable step is still incomplete', () => {
    const steps = fullyActionableSteps();
    steps[3] = { isComplete: false }; // spawn point not yet placed
    const progress = computeChecklistProgress(steps);
    expect(progress.allDone).toBe(false);
    expect(progress.completed).toBe(6);
    expect(progress.total).toBe(7);
  });

  it('is not done on an empty (all-incomplete) project', () => {
    const progress = computeChecklistProgress([
      { isComplete: false }, { isComplete: false }, { isComplete: false, advisory: true },
    ]);
    expect(progress.allDone).toBe(false);
    expect(progress.completed).toBe(0);
  });

  it('treats a checklist with only advisory steps as not done (never vacuously true)', () => {
    const progress = computeChecklistProgress([{ isComplete: false, advisory: true }]);
    expect(progress.allDone).toBe(false);
    expect(progress.total).toBe(0);
  });
});
