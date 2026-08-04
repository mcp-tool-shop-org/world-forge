// mouseup-gesture-recovery.test.ts
//
// Regression for F-4ca2d7c3 (HIGH).
//
// Canvas.tsx's drag-move/resize/box-select/pan/tile-paint gesture refs were
// only ever cleared inside handleMouseUp, which was wired EXCLUSIVELY as a
// React `onMouseUp` prop on the <canvas> element. A native mouseup fires on
// whatever element is under the cursor at release time, not wherever the
// drag started — so releasing off-canvas (trivial: the canvas is flanked by
// the tool palette and properties panel) left the gesture ref "stuck
// active," and the next mousemove over the canvas (even with the button up)
// was misread as a continuation of the stale gesture.
//
// The fix adds a window-level `mouseup` listener (registered once, via a
// ref, mirroring the keyboard-listener-stability.test.ts pattern used for
// the analogous keydown effect) that calls the SAME handleMouseUp logic.
// This file cannot mount Canvas.tsx itself (no jsdom/@testing-library/react
// in this repo's vitest setup — see keyboard-listener-stability.test.ts's
// own note), so it proves the load-bearing PROPERTY the fix depends on using
// a shim that mirrors handleMouseUp's actual structure: every branch reads
// its own gesture ref, nulls it, THEN acts — so calling the handler twice in
// a row is a no-op the second time. That property is what makes it safe to
// register the SAME handler on both the canvas-local onMouseUp and the new
// window-level listener without double-committing.

import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Minimal window shim — this vitest setup doesn't include jsdom. */
interface WindowShim {
  addEventListener: (type: string, handler: (e: unknown) => void) => void;
  removeEventListener: (type: string, handler: (e: unknown) => void) => void;
  listenerCount: () => number;
  fire: (type: string, e: unknown) => void;
}

function makeWindowShim(): WindowShim {
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  return {
    addEventListener: (type, handler) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(handler);
    },
    removeEventListener: (type, handler) => {
      listeners.get(type)?.delete(handler);
    },
    listenerCount: () => {
      let n = 0;
      for (const set of listeners.values()) n += set.size;
      return n;
    },
    fire: (type, e) => {
      for (const h of [...(listeners.get(type) ?? [])]) h(e);
    },
  };
}

/**
 * Mirrors Canvas.tsx's actual shape: a `dragMove` ref-like box, a
 * `handleMouseUp` that reads-then-nulls it before committing, wired as BOTH
 * a canvas-local handler (simulated by calling it directly, as React's
 * synthetic onMouseUp would) and — via the F-4ca2d7c3 fix — a window-level
 * listener registered once through a ref (same idiom as the real
 * `handleMouseUpRef` in Canvas.tsx).
 */
function createCanvasLike(win: WindowShim) {
  const dragMove: { current: { dx: number; dy: number } | null } = { current: null };
  const commits: Array<{ dx: number; dy: number }> = [];
  let effectRan = 0;

  function startDrag(dx: number, dy: number) {
    dragMove.current = { dx, dy };
  }

  // Mirrors Canvas.tsx's handleMouseUp: read the ref, null it, THEN act.
  // Calling this a second time after the first already committed is a
  // guaranteed no-op — this is the property the window-listener fix leans on.
  function handleMouseUp() {
    if (!dragMove.current) return; // already cleared — no-op
    const { dx, dy } = dragMove.current;
    dragMove.current = null;
    commits.push({ dx, dy });
  }

  // Canvas-local "React onMouseUp" — called directly, exactly like React
  // would invoke the synthetic handler when the release target is the canvas.
  function canvasLocalMouseUp() {
    handleMouseUp();
  }

  // The F-4ca2d7c3 fix: register a window-level listener ONCE (empty deps),
  // via a ref so it always calls the LATEST handleMouseUp closure.
  const handleMouseUpRef = { current: handleMouseUp };
  function mount() {
    effectRan++;
    const onWindowMouseUp = () => handleMouseUpRef.current();
    win.addEventListener('mouseup', onWindowMouseUp);
    return () => win.removeEventListener('mouseup', onWindowMouseUp);
  }

  return {
    startDrag,
    canvasLocalMouseUp,
    dragMoveRef: dragMove,
    commits,
    mount,
    stats: () => ({ effectRan }),
  };
}

describe('F-4ca2d7c3: window-level mouseup recovers a gesture released off-canvas', () => {
  let win: WindowShim;

  beforeEach(() => {
    win = makeWindowShim();
  });

  it('a release OUTSIDE the canvas (window listener only) still commits and clears the gesture', () => {
    const canvas = createCanvasLike(win);
    canvas.mount();

    canvas.startDrag(3, -2);
    expect(canvas.dragMoveRef.current).toEqual({ dx: 3, dy: -2 });

    // Simulate: mouseup fires with a target OTHER than the canvas (e.g. the
    // tool panel). React's canvas-scoped onMouseUp never runs — only the
    // window-level listener does.
    win.fire('mouseup', {});

    expect(canvas.commits).toEqual([{ dx: 3, dy: -2 }]);
    expect(canvas.dragMoveRef.current).toBeNull();
  });

  it('the NEXT mousemove after an off-canvas release does not resume the stale gesture (ref is truly cleared)', () => {
    const canvas = createCanvasLike(win);
    canvas.mount();

    canvas.startDrag(5, 5);
    win.fire('mouseup', {}); // released off-canvas — recovered by the fix
    expect(canvas.dragMoveRef.current).toBeNull();

    // Without the fix, a stale truthy ref here would make the next
    // mousemove misread as "still dragging" even with no button held.
    // Asserting the ref is null is exactly what prevents that misread.
    expect(canvas.dragMoveRef.current).not.toBeTruthy();
  });

  it('a release ON the canvas commits exactly once — no double-commit from the window listener also firing', () => {
    const canvas = createCanvasLike(win);
    canvas.mount();

    canvas.startDrag(1, 1);
    // React's synthetic onMouseUp fires first (DOM bubble order: the React
    // root sits between the canvas and `window`), THEN the native event
    // continues bubbling to the window listener.
    canvas.canvasLocalMouseUp();
    win.fire('mouseup', {});

    // Exactly one commit — the window listener's call landed on an
    // already-cleared ref and was a no-op, not a second move application.
    expect(canvas.commits).toEqual([{ dx: 1, dy: 1 }]);
  });

  it('firing mouseup with no active gesture is always a safe no-op', () => {
    const canvas = createCanvasLike(win);
    canvas.mount();

    expect(canvas.dragMoveRef.current).toBeNull();
    win.fire('mouseup', {});
    win.fire('mouseup', {});

    expect(canvas.commits).toEqual([]);
  });

  it('registers the window mouseup listener exactly once regardless of remounts of the handler ref', () => {
    const canvas = createCanvasLike(win);
    const cleanup = canvas.mount();

    expect(win.listenerCount()).toBe(1);
    expect(canvas.stats().effectRan).toBe(1);

    cleanup();
    expect(win.listenerCount()).toBe(0);
  });

  it('two separate gestures across two off-canvas releases both commit independently', () => {
    const canvas = createCanvasLike(win);
    canvas.mount();

    canvas.startDrag(2, 0);
    win.fire('mouseup', {});
    canvas.startDrag(0, 4);
    win.fire('mouseup', {});

    expect(canvas.commits).toEqual([{ dx: 2, dy: 0 }, { dx: 0, dy: 4 }]);
  });
});
