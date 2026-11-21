/**
 * Materialize chapel-project.json for Playwright (F-b48f68c3 / F-2abb3406).
 *
 * dogfood/output/ is gitignored and is NOT the e2e source of truth. Playwright
 * runs this via webServer.command before Vite boots so specs do not depend on
 * a tracked snapshot. Kept as a script (not Playwright globalSetup) because
 * Playwright loads globalSetup as CJS (`exports is not defined` under ESM).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chapelProject } from '../packages/schema/src/__tests__/fixtures/chapel-authored.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../dogfood/output');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'chapel-project.json'), JSON.stringify(chapelProject, null, 2), 'utf-8');

// AI RPG exportable variant for E2E download specs (keeps authored chapel-authored.ts unchanged).
const chapelAiRpgProject = {
  ...chapelProject,
  encounterAnchors: chapelProject.encounterAnchors.map((ea) =>
    ea.id === 'crypt-encounter' ? { ...ea, encounterType: 'duel' } : ea,
  ),
};
writeFileSync(resolve(outDir, 'chapel-ai-rpg-project.json'), JSON.stringify(chapelAiRpgProject, null, 2), 'utf-8');
