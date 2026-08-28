---
title: Accessibility
description: Keyboard, dialogs, canvas, and screen-reader support in the World Forge editor
sidebar:
  order: 11
---

World Forge is a spatial canvas editor. Pointer gestures still own placement, box-select, resize, connection drawing, and pan. Everything else — tools, inspectors, save, search, undo — is keyboard-reachable.

This page is the living contract. The repo-root [`a11y-audit.md`](https://github.com/mcp-tool-shop-org/world-forge/blob/main/a11y-audit.md) tracks what is shipped versus still pointer-only.

## Keyboard

| Shortcut | Action |
|----------|--------|
| Ctrl+S | Save project (reuses the last File System Access handle when the browser supports it) |
| Ctrl+K | Search overlay |
| Ctrl+C / Ctrl+V / Ctrl+D | Copy / paste / duplicate selection |
| Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y | Undo / redo |
| Ctrl+A | Select all visible objects |
| Delete / Backspace | Delete selection |
| Escape | Clear selection, cancel an in-progress connection, close the Speed Panel |
| Arrow keys | Nudge selection one cell (Shift = 5×) |
| Enter | Open the details panel for the selection |
| P / Shift+P | Apply preset to the selected district or zone / save the current selection as a preset |
| V Z C E L S T O N I | Select, Zone, Connect, Entity, Landmark, Spawn, Tiles, Prop, Encounter, Item |

Tool keys are ignored while focus is in an `INPUT`, `TEXTAREA`, or `SELECT`. Modals and the search overlay swallow canvas hotkeys so Delete cannot mutate a map you cannot see.

## Dialogs

Export, Import, Template Manager, Save Template, and Save Kit use `role="dialog"`, `aria-modal="true"`, and `aria-label`. Focus is trapped while a dialog is open. Escape closes it. Icon-only close buttons have an accessible name.

## Canvas

The map canvas is `role="img"` with `aria-label="World map canvas"` and `tabIndex={0}` so it can take keyboard focus. Spatial operations (paint, box-select, resize, connection rubber-band, pan) stay pointer-dependent by design; the object tree, search overlay, and Ctrl+A are the keyboard alternatives.

## Status

- Unsaved-changes dot: `role="status"` + `aria-label="Unsaved changes"`
- Toasts: `role="status"`
- Theme and search toolbar buttons: `aria-label`

## Object tree

Object List rows are `tabIndex={0}` with Enter/Space to select. A filter input narrows by name or id.

## Known gaps

See [`a11y-audit.md`](https://github.com/mcp-tool-shop-org/world-forge/blob/main/a11y-audit.md). Placement, box-select, zone resize, connection drawing, canvas pan, and the Speed Panel (double-right-click) have no full keyboard equivalent yet.
