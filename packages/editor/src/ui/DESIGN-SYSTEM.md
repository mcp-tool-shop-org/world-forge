# Editor Design System

This document describes the design token system used by the World Forge editor.

## Architecture

The editor uses a two-layer approach:

1. **CSS custom properties** ([theme.css](theme.css)) — the single source of truth for all visual decisions (colors, spacing, typography, z-indices). Imported once in `main.tsx`.
2. **TypeScript style objects** ([styles.ts](styles.ts)) — reusable `CSSProperties` objects that reference the CSS variables. Import selectively into components.

This keeps theming easy (swap CSS variables) without turning every style into a JavaScript ceremony.

## Token reference

### Colors

| Token | Usage |
|---|---|
| `--wf-bg-app` | Page background (`#0d1117`) |
| `--wf-bg-panel` | Panel / card background (`#161b22`) |
| `--wf-bg-control` | Button / widget fill (`#21262d`) |
| `--wf-bg-hover` | Hover state fill (`#30363d`) |
| `--wf-bg-input` | Text input background (`#0d1117`) |
| `--wf-bg-overlay` | Modal backdrop (`rgba(0,0,0,0.7)`) |
| `--wf-text-primary` | Main text (`#c9d1d9`) |
| `--wf-text-muted` | Secondary text (`#8b949e`) |
| `--wf-text-hint` | Disabled / placeholder (`#484f58`) |
| `--wf-accent` | Links / highlights (`#58a6ff`) |
| `--wf-success` | Green states (`#238636`) |
| `--wf-danger` | Red / destructive (`#da3633`) |
| `--wf-warning` | Orange / caution (`#d29922`) |
| `--wf-border-default` | Standard borders (`#30363d`) |
| `--wf-border-subtle` | Lighter separators (`#21262d`) |

### Spacing

4 px grid:  `--wf-space-1` (4) through `--wf-space-6` (24).

### Typography

`--wf-font-xs` (10) through `--wf-font-3xl` (20).

### Z-index layers

| Token | Value | Layer |
|---|---|---|
| `--wf-z-panel` | 1 | Normal panels |
| `--wf-z-speed` | 90 | Speed panel |
| `--wf-z-modal` | 100 | Modals |
| `--wf-z-search` | 200 | Search overlay |
| `--wf-z-drag` | 1000 | Drag operations |

## Style primitives (`styles.ts`)

Import selectively:

```ts
import { buttonBase, buttonPrimary, inputBase, modalFooter } from '../ui/styles.js';
```

### Layout
- `panelShell` — left-rail panel container
- `inspectorShell` — right-rail inspector container
- `sectionHeader` — section title with underline
- `toolbarRow` — horizontal toolbar strip
- `scrollArea` — `{ overflowY: 'auto', flex: 1 }`

### Buttons
- `buttonBase` — default control button
- `buttonPrimary` — green action (export, create)
- `buttonDanger` — red destructive
- `buttonAccent` — blue link-style action
- `buttonGhost` — chromeless (close × buttons)

### Form controls
- `inputBase` — standard text input
- `inputCompact` — tight inspector input (less padding)
- `selectBase` — dropdown select
- `labelText` — form label

### Modal
- `overlayBackdrop` — full-screen dimmed background
- `modalCard(width)` — centered card container
- `modalTitleRow` — flex row with title + close
- `modalTitle` — h2/h3 inside modal
- `modalFooter` — bottom action row
- `closeButton` — × dismiss button

### Misc
- `badgePill` — small count / tag badge
- `cardItem` — list item card
- `hintText` — italic helper text

## ModalFrame component

For standard modals (title + close + body), use `<ModalFrame>`:

```tsx
import { ModalFrame } from '../ui/ModalFrame.js';
import { buttonBase, modalFooter } from '../ui/styles.js';

function MyModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalFrame title="My Modal" width={480} onClose={onClose}>
      {/* body content */}
      <div style={modalFooter}>
        <button onClick={onClose} style={buttonBase}>Cancel</button>
      </div>
    </ModalFrame>
  );
}
```

## Conventions

- **New panels**: start from `panelShell` or `inspectorShell`, use `sectionHeader` for sections.
- **New buttons**: use `buttonBase` as the starting point, spread overrides for size tweaks.
- **New modals**: use `<ModalFrame>`. Only bypass it if the modal has non-standard layout (like ExportModal).
- **Colors**: always reference `var(--wf-*)` tokens. Never introduce new hex values.
- **Shared.tsx**: still exports legacy style objects (`sectionTitle`, `addBtnStyle`, etc.) that internally use CSS variables. Prefer `styles.ts` for new code.
