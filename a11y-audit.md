# Accessibility audit — World Forge editor

Living list. Handbook page: `site/src/content/docs/handbook/accessibility.md`.

Last reviewed: 2026-08-27 (v4.8.0 leftover pass, F-375df619).

## Shipped

| Surface | Support |
|---------|---------|
| Modal dialogs | `role="dialog"`, `aria-modal`, labelled, focus trap, Escape |
| Icon-only toolbar buttons | `aria-label` |
| Unsaved-changes indicator | `role="status"` |
| Toasts | `role="status"` |
| Canvas | `role="img"`, `aria-label="World map canvas"`, `tabIndex={0}` |
| Object List rows | keyboard select (Tab / Enter / Space) |
| Tool switching | V Z C E L S T O N I |
| Save | Ctrl+S (plus click) |
| Search | Ctrl+K |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y |

## Pointer-only (accepted)

| Operation | Keyboard alternative |
|-----------|----------------------|
| Zone / entity / landmark / spawn / tile / prop / encounter / item placement | none for the click coordinate; tools are keyboard-switchable |
| Box-select | Ctrl+A, Ctrl+K, object tree |
| Zone resize handles | none |
| Connection rubber-band | none (C selects the tool) |
| Canvas pan | none (wheel / space-drag / right-drag) |
| Speed Panel | none (double-right-click) |

## Open

- No skip-to-content link.
- Canvas `role="img"` does not expose a live object summary to the accessibility tree.
- Color is used for validation health; text labels sit next to the color chip.
