# Ship Gate

> No repo is "done" until every applicable line is checked.
> Copy this into your repo root. Check items off per-release.

**Tags:** `[all]` every repo · `[npm]` `[pypi]` `[vsix]` `[desktop]` `[container]` published artifacts · `[mcp]` MCP servers · `[cli]` CLI tools

**Detected:** `[all]` `[npm]` `[cli]`

---

## A. Security Baseline

- [x] `[all]` SECURITY.md exists (report email, supported versions, response timeline) (2026-03-08)
- [x] `[all]` README includes threat model paragraph (data touched, data NOT touched, permissions required) (2026-03-08)
- [x] `[all]` No secrets, tokens, or credentials in source or diagnostics output (2026-03-08)
- [x] `[all]` No telemetry by default — state it explicitly even if obvious (2026-03-08)

### Default safety posture

- [ ] `[cli|mcp|desktop]` SKIP: export CLI only writes to user-specified --out dir, no dangerous actions
- [ ] `[cli|mcp|desktop]` SKIP: file ops limited to reading project JSON and writing export output
- [ ] `[mcp]` SKIP: not an MCP server
- [ ] `[mcp]` SKIP: not an MCP server

## B. Error Handling

- [ ] `[all]` SKIP: monorepo with library packages — errors are typed validation results, not thrown exceptions
- [x] `[cli]` Exit codes: 0 ok · 1 user error (2026-03-08)
- [x] `[cli]` No raw stack traces without `--debug` (2026-03-08)
- [ ] `[mcp]` SKIP: not an MCP server
- [ ] `[mcp]` SKIP: not an MCP server
- [ ] `[desktop]` SKIP: not a desktop app
- [ ] `[vscode]` SKIP: not a VS Code extension

## C. Operator Docs

- [x] `[all]` README is current: what it does, install, usage, supported platforms + runtime versions (2026-03-08)
- [x] `[all]` CHANGELOG.md (Keep a Changelog format) (2026-03-08)
- [x] `[all]` LICENSE file present and repo states support status (2026-03-08)
- [x] `[cli]` `--help` output accurate for all commands and flags (2026-03-08)
- [ ] `[cli|mcp|desktop]` SKIP: simple CLI, no logging levels needed
- [ ] `[mcp]` SKIP: not an MCP server
- [ ] `[complex]` SKIP: not a complex daemon

## D. Shipping Hygiene

- [x] `[all]` `verify` script exists (test + build + smoke in one command) (2026-03-08)
- [x] `[all]` Version in manifest matches git tag (2026-03-08)
- [x] `[all]` Dependency scanning runs in CI (npm audit in verify) (2026-03-08)
- [ ] `[all]` SKIP: no dependabot per org rules
- [x] `[npm]` `npm pack --dry-run` includes: dist/, README.md, CHANGELOG.md, LICENSE (2026-03-08)
- [x] `[npm]` `engines.node` set (2026-03-08)
- [x] `[npm]` Lockfile committed (2026-03-08)
- [ ] `[vsix]` SKIP: not a VS Code extension
- [ ] `[desktop]` SKIP: not a desktop app

## E. Identity

- [ ] `[all]` SKIP: no logo yet — monorepo, not a standalone product page
- [ ] `[all]` SKIP: no translations — internal authoring tool
- [ ] `[org]` SKIP: no landing page — internal authoring tool
- [ ] `[all]` SKIP: GitHub metadata set at repo creation

---

## Gate Rules

**Hard gate (A-D):** Must pass before any version is tagged or published.
If a section doesn't apply, mark `SKIP:` with justification — don't leave it unchecked.

**All gates are hard.** No soft-gating — every item checked or skipped.
