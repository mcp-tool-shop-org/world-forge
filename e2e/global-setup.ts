/**
 * Playwright globalSetup (F-b48f68c3 / F-2abb3406).
 *
 * dogfood/output/ is gitignored and is NOT the e2e source of truth. This
 * setup writes chapel-project.json from the schema chapel fixture at suite
 * start so the suite does not depend on a tracked snapshot.
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
