// hotkeys.ts — centralized keyboard shortcut dispatch

import {
  getCommandById,
  getHotkeyBindingsFromRegistry,
  type HotkeyBinding,
  type HotkeyContext,
  type HotkeyResult,
} from './command-registry.js';

export type { HotkeyBinding, HotkeyContext, HotkeyResult };

export const HOTKEY_BINDINGS: HotkeyBinding[] = getHotkeyBindingsFromRegistry();

/** Return a flat list of all registered hotkeys for display in a guide panel. */
export function getHotkeyList(): { key: string; label: string; description: string }[] {
  return HOTKEY_BINDINGS.map((b) => ({ key: b.key, label: b.label, description: b.description }));
}

/**
 * Match an incoming keyboard event against hotkey bindings.
 * Returns the matching action string or null.
 */
export function matchHotkey(e: KeyboardEvent): string | null {
  const ctrl = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;

  for (const binding of HOTKEY_BINDINGS) {
    if (binding.key !== e.code) continue;
    if (binding.ctrl && !ctrl) continue;
    if (!binding.ctrl && ctrl) continue;
    if (binding.shift && !shift) continue;
    if (!binding.shift && shift && binding.key !== 'Delete' && binding.key !== 'Backspace' && !binding.key.startsWith('Arrow')) continue;
    return binding.action;
  }
  return null;
}

/**
 * Dispatch a hotkey action through the central command registry. Returns whether it was handled.
 * Space and key-up events are handled separately by Canvas (they depend on refs).
 */
export function dispatchHotkey(e: KeyboardEvent, ctx: HotkeyContext): HotkeyResult {
  // F-340b4aff: never mutate the canvas while a modal or the search overlay
  // is open — those surfaces sit visually on top of the canvas, so an
  // "invisible" hotkey (Delete, Ctrl+A, tool switches, ...) would silently
  // mutate content the user can't see. This is defense-in-depth: Canvas.tsx's
  // keydown handler already checks live store state before calling
  // dispatchHotkey at all; this second gate protects any future caller that
  // forgets to (and keeps this behavior directly unit-testable here).
  if (ctx.activeModal != null || ctx.showSearch) {
    return { handled: false };
  }

  // Input-safe guard
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return { handled: false };
  }

  const action = matchHotkey(e);
  if (!action) return { handled: false };

  const cmd = getCommandById(action);
  if (!cmd || !cmd.surfaces.includes('hotkey')) return { handled: false };
  const result = cmd.run({
    hotkeyCtx: ctx,
    event: e,
    selection: ctx.selection,
    selectedConnection: ctx.selectedConnection,
    project: ctx.project,
  });
  return result.handled ? { handled: true, action: result.action ?? action } : { handled: false };
}

/**
 * F-6c1fa8ce: Space is the standard activation key for focused buttons /
 * links / menuitems. The canvas pan-on-Space chord is only legal when the
 * event is not targeting an activating control.
 */
export function isActivatingControl(target: EventTarget | object | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as {
    tagName?: string;
    isContentEditable?: boolean;
    getAttribute?: (name: string) => string | null;
    closest?: (selector: string) => { tagName?: string } | null;
  };
  const tag = el.tagName;
  if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return true;
  if (el.isContentEditable) return true;
  const role = typeof el.getAttribute === 'function' ? el.getAttribute('role') : null;
  if (role === 'button' || role === 'menuitem' || role === 'tab' || role === 'link') return true;
  try {
    if (typeof el.closest === 'function' && el.closest('button, [role="button"], a[href], [role="menuitem"], [role="tab"]')) {
      return true;
    }
  } catch { /* closest may throw on non-Element test doubles */ }
  return false;
}

/**
 * F-6c1fa8ce: only arm Space-to-pan when focus is on the canvas (or body/root
 * with nothing else focused). Never preventDefault Space for INPUT/TEXTAREA/
 * SELECT (existing skip) or for buttons / [role=button] / links / contentEditable.
 */
export function shouldArmSpacePan(
  target: EventTarget | object | null,
  activeElement: EventTarget | object | null,
  canvas: object | null,
): boolean {
  const tag = (target as { tagName?: string } | null)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
  if (isActivatingControl(target)) return false;
  if (isActivatingControl(activeElement as EventTarget | null)) return false;
  if (!activeElement) return true;
  const activeTag = (activeElement as { tagName?: string }).tagName;
  if (!activeTag || activeTag === 'BODY' || activeTag === 'HTML') return true;
  if (canvas && activeElement === canvas) return true;
  const contains = (canvas as { contains?: (node: unknown) => boolean } | null)?.contains;
  if (typeof contains === 'function' && contains.call(canvas, activeElement)) return true;
  return false;
}
