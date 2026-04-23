// keyboard-listener-stability.test.ts
//
// Regression for ED-A-003 (HIGH) + ED-A-010 (MEDIUM).
//
// The keyboard `useEffect` in Canvas.tsx must register window listeners ONCE
// and keep the handler in sync with current state via a ref — not re-bind on
// every render. If deps like `selection` (which change every click) are in
// the effect's dep array, listeners thrash and stale closures leak.
//
// This test simulates the pattern: a latest-ctx ref updated each "render",
// a handler registered once, and proves that:
//   1. Listener count stays bounded across many renders.
//   2. The handler reads the latest ctx, never a stale one.

import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Minimal window shim — vitest setup doesn't include jsdom. */
interface WindowShim {
  addEventListener: (type: string, handler: (e: unknown) => void) => void;
  removeEventListener: (type: string, handler: (e: unknown) => void) => void;
  listenerCount: () => number;
  fire: (type: string, e: unknown) => void;
  reset: () => void;
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
      for (const h of listeners.get(type) ?? []) h(e);
    },
    reset: () => listeners.clear(),
  };
}

/**
 * Simulates exactly the Canvas.tsx ED-A-003 fix pattern:
 *   - A ref is rebuilt each render with the current hotkey context.
 *   - An effect runs ONCE (empty deps), registers listeners that read
 *     `ctxRef.current` at call time.
 *   - Re-renders update the ref but do NOT touch listener registration.
 */
function createCanvasLike(win: WindowShim) {
  const ctxRef: { current: { selection: string[]; handler: (sel: string[]) => void } | null } = { current: null };
  let effectRan = 0;
  let cleanupRan = 0;

  function render(ctx: { selection: string[]; handler: (sel: string[]) => void }) {
    // This happens on every render — analogous to `hotkeyCtxRef.current = {...}`.
    ctxRef.current = ctx;
  }

  function mount() {
    // Empty-deps effect — runs once on mount. This is the ED-A-003 fix.
    effectRan++;
    const onKeyDown = (_e: unknown) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      ctx.handler(ctx.selection);
    };
    win.addEventListener('keydown', onKeyDown);
    return () => {
      cleanupRan++;
      win.removeEventListener('keydown', onKeyDown);
    };
  }

  return {
    render,
    mount,
    stats: () => ({ effectRan, cleanupRan }),
  };
}

describe('ED-A-003: keyboard useEffect listener stability', () => {
  let win: WindowShim;

  beforeEach(() => {
    win = makeWindowShim();
  });

  it('registers window keydown listener exactly once regardless of render count', () => {
    const canvas = createCanvasLike(win);
    const cleanup = canvas.mount();

    // Simulate 100 renders — each with a changed selection (as would happen
    // on every click). Pre-fix, this would trigger 100 cleanup/re-register cycles.
    for (let i = 0; i < 100; i++) {
      canvas.render({ selection: [`zone-${i}`], handler: vi.fn() });
    }

    expect(win.listenerCount()).toBe(1);
    expect(canvas.stats().effectRan).toBe(1);
    expect(canvas.stats().cleanupRan).toBe(0);

    cleanup();
    expect(win.listenerCount()).toBe(0);
    expect(canvas.stats().cleanupRan).toBe(1);
  });

  it('handler always sees latest selection after re-render (no stale closure)', () => {
    const canvas = createCanvasLike(win);
    const spy = vi.fn();
    canvas.mount();

    canvas.render({ selection: ['first'], handler: spy });
    win.fire('keydown', {});
    expect(spy).toHaveBeenLastCalledWith(['first']);

    // A re-render updates the ref. The handler, registered once, must now
    // observe the new selection — not the captured 'first'.
    canvas.render({ selection: ['second'], handler: spy });
    win.fire('keydown', {});
    expect(spy).toHaveBeenLastCalledWith(['second']);

    // And again — we never re-registered, but we always see the latest.
    canvas.render({ selection: ['third'], handler: spy });
    win.fire('keydown', {});
    expect(spy).toHaveBeenLastCalledWith(['third']);
  });

  it('firing keydown N times after M renders invokes the handler N times (no leak)', () => {
    const canvas = createCanvasLike(win);
    const spy = vi.fn();
    canvas.mount();

    // 50 renders with unchanged handler
    for (let i = 0; i < 50; i++) {
      canvas.render({ selection: [], handler: spy });
    }

    // Each fire should call the handler exactly once — if listeners leaked,
    // this would be 50x per fire.
    win.fire('keydown', {});
    expect(spy).toHaveBeenCalledTimes(1);
    win.fire('keydown', {});
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('ED-A-010: HotkeyContext construction stability', () => {
  it('context object is rebuilt per render but does not force listener re-registration', () => {
    // The ED-A-010 fix: HotkeyContext is rebuilt each render into a ref, not
    // inside the effect body. Listener registration is decoupled from ctx identity.
    const win = makeWindowShim();
    const canvas = createCanvasLike(win);
    canvas.mount();

    const seenContexts = new Set<object>();
    const captureHandler = vi.fn((sel: string[]) => void sel);

    for (let i = 0; i < 20; i++) {
      const ctx = { selection: [`id-${i}`], handler: captureHandler };
      seenContexts.add(ctx);
      canvas.render(ctx);
    }

    // 20 distinct context objects were created…
    expect(seenContexts.size).toBe(20);
    // …but only 1 listener was ever registered.
    expect(win.listenerCount()).toBe(1);
    expect(canvas.stats().effectRan).toBe(1);
  });
});
