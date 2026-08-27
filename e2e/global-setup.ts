/**
 * Playwright globalSetup (F-b48f68c3).
 *
 * dogfood/output/ is gitignored, so e2e/editor-smoke.spec.ts must not depend
 * on a tracked chapel-project.json sitting there. Write it from the schema
 * fixture at suite start.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chapelProject } from '../packages/schema/src/__tests__/fixtures/chapel-authored.js';

export default async function globalSetup(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(here, '../dogfood/output');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'chapel-project.json'), JSON.stringify(chapelProject, null, 2), 'utf-8');
}
