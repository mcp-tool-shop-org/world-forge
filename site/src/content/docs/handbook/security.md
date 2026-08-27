---
title: Security
description: Security model and threat boundaries
sidebar:
  order: 6
---

World Forge is a local-only authoring tool with a minimal threat surface.

## Data Touched

- **Project files** on local disk (user-created JSON)
- **Local dev server** (Vite on localhost:5173 during development)

## Data NOT Touched

- No telemetry or analytics
- No network requests beyond the local dev server
- No server-side storage
- No user accounts or authentication

## Permissions

- No API keys required
- No secrets or credentials
- No environment variables needed

## Source Code

- No secrets, tokens, or credentials in source
- All dependencies are open source
- MIT licensed

## Reporting Vulnerabilities

If you discover a security issue, please email [64996768+mcp-tool-shop@users.noreply.github.com](mailto:64996768+mcp-tool-shop@users.noreply.github.com).

- Supported versions: v4.x
- Response timeline: see [SECURITY.md](https://github.com/mcp-tool-shop-org/world-forge/blob/main/SECURITY.md) — acknowledge in 48 hours, assess in 7 days, fix in 30 days. Do not keep a second SLA here.
- We will work with you to understand and address the issue before any public disclosure
