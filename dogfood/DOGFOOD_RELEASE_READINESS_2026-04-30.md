# Phase 6 — Release Readiness Audit

**Date:** 2026-04-30  
**Verdict: PASS**

---

## README Truth

| Claim | Status | Fix |
|-------|--------|-----|
| "(planned) Godot 4" | FALSE — fully implemented | Updated to shipped language |
| "5 shipping packages + 1 planned Godot stub" | FALSE | → "6 shipping packages" |
| export-godot "stub only" | FALSE — 16 source files | → full description |
| Export workflow step 6 only mentions ContentPack | INCOMPLETE | → mentions all 3 targets |
| Engine Compatibility mentions only ai-rpg-engine | INCOMPLETE | → lists all 3 engines |
| CLI section shows only AI RPG export | INCOMPLETE | → added UE5 CLI examples |
| Import/Export section says "one-click export to ai-rpg-engine" | INCOMPLETE | → all 3 targets + advisories |

All fixed in this commit.

---

## Package Metadata

| Package | Version | License | Repository | Engines | files | Status |
|---------|---------|---------|------------|---------|-------|--------|
| world-forge (root) | 4.4.0 | MIT | ✓ | >=20 | N/A | ✓ |
| @world-forge/schema | 4.4.0 | MIT | ✓ | >=20 | dist, !__tests__ | ✓ |
| @world-forge/export-ai-rpg | 4.4.0 | MIT | ✓ | >=20 | dist, !__tests__ | ✓ |
| @world-forge/export-unreal | 4.4.0 | MIT | ✓ | >=20 | dist, !__tests__ | ✓ |
| @world-forge/export-godot | 4.4.0 | MIT | ✓ | >=20 | dist, !__tests__ | ✓ (was 1.0.0) |
| @world-forge/renderer-2d | 4.4.0 | MIT | ✓ | >=20 | dist, !__tests__ | ✓ |
| @world-forge/editor | 4.4.0 | MIT | ✓ | N/A | dist, public, src | ✓ |

### Fixes Applied

- **export-godot version:** 1.0.0 → 4.4.0 (aligned with monorepo)
- **export-godot metadata:** added homepage, bugs, keywords, LICENSE in files
- **editor deps:** added `@world-forge/export-godot: "*"` (was alias-only)
- **workspace protocol:** `workspace:^` → `*` across all packages (npm 10 compat) — done in Phase 7 commit

---

## Version Consistency

| Source | Version |
|--------|---------|
| Root package.json | 4.4.0 |
| All 6 packages | 4.4.0 |
| CHANGELOG.md heading | [4.4.0] - 2026-04-23 |
| README version line | v4.4.0 |

✓ All aligned.

---

## Install-from-Clone

```bash
npm install       # ✓ (6s, 205 packages)
npm run build     # ✓ (tsc --build, exit 0)
npm test          # ✓ (2067 tests, 4.2s)
npm run dev --workspace=@world-forge/editor  # ✓ (Vite on localhost:5173)
```

Required: Node >=20, npm >=10.

---

## CLI Truth

| CLI | Command | Status |
|-----|---------|--------|
| AI RPG export | `npx world-forge-export --help` | ✓ Works |
| AI RPG validate | `npx world-forge-export project.json --validate-only` | ✓ Documented |
| UE5 export | `npx world-forge-export-unreal --help` | ✓ Works |
| UE5 summary | `npx world-forge-export-unreal --summary <dir>` | ✓ Works |
| Godot export | No CLI (browser editor only) | N/A — accurate |

---

## Package Contents (npm pack --dry-run)

| Package | Size | Files | Junk |
|---------|------|-------|------|
| schema | 1.4 MB | 83 | None (logo.png is intentional) |
| export-ai-rpg | ~1.4 MB | ~83 | None |
| export-unreal | 55 kB | 71 | None |
| renderer-2d | ~1.4 MB | ~79 | None |
| export-godot | private (not published) | — | — |
| editor | private (not published) | — | — |

**Fix applied:** `!dist/__tests__` negation in `files` array excludes compiled test files from all tarballs.

---

## Verdict

**PASS** — README claims now match reality, all versions aligned, install path verified, CLI commands work, package contents are clean.
