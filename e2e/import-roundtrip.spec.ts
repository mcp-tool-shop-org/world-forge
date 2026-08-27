/**
 * Phase 8 — Import / Round-Trip UI (F-56ff55da)
 *
 * Load Chapel Threshold → Export AI RPG JSON → Import the download via the
 * Import modal → Import Summary fidelity UI + Diff "No changes since import".
 *
 * Replaces the 2026-05-01 markdown-only PASS
 * (dogfood/DOGFOOD_IMPORT_ROUNDTRIP_UI_2026-05-01.md) with a browser spec.
 * Reuses globalSetup's chapel fixture (dogfood/output/chapel-project.json).
 */
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  test,
  expect,
  loadChapel,
  openExportModal,
  clickExportAndDownload,
} from './helpers';

test.describe('Import / round-trip UI (F-56ff55da)', () => {
  test.describe.configure({ timeout: 60_000 });

  test('Load Chapel → Export JSON → Import → fidelity report and Diff unchanged', async ({ page }) => {
    await loadChapel(page);
    await openExportModal(page);

    const download = await clickExportAndDownload(page, 'Export JSON');
    const dest = path.join(tmpdir(), download.suggestedFilename() || 'chapel-threshold-engine-pack.json');
    await download.saveAs(dest);

    await page.getByRole('dialog', { name: 'Export' }).getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Export' })).toBeHidden();

    await page.getByRole('button', { name: 'Import', exact: true }).click();
    const importDialog = page.getByRole('dialog', { name: 'Import Project' });
    await expect(importDialog).toBeVisible({ timeout: 3000 });

    await importDialog.locator('input[type="file"]').setInputFiles(dest);
    await expect(importDialog.getByText('ExportResult (lossy)')).toBeVisible({ timeout: 10_000 });

    await importDialog.getByRole('button', { name: 'Import', exact: true }).click();
    const confirm = importDialog.getByRole('button', { name: 'Confirm Import' });
    await confirm.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
    if (await confirm.isVisible()) {
      await confirm.click();
    }
    await expect(importDialog).toBeHidden({ timeout: 10_000 });

    const tabBar = page.locator('[data-testid="wf-tab-bar"]');
    await tabBar.getByRole('tab', { name: /Import/ }).click();
    await expect(page.getByText('Import Summary')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('ExportResult (lossy)')).toBeVisible();
    await expect(page.getByText(/Overall: (\d+% lossless|unmeasured)/)).toBeVisible();
    await expect(page.getByText(/Lossless:/)).toBeVisible();

    await tabBar.getByRole('tab', { name: 'Diff' }).click();
    await expect(page.getByText('No changes since import.')).toBeVisible({ timeout: 5000 });
  });
});
