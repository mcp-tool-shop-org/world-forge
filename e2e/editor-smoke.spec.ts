/**
 * Phase 7 — Automated Browser Regression
 *
 * This Playwright smoke test locks in the Phase 5E verification:
 *   1. Editor boots without crashes
 *   2. A project can be loaded via the file input
 *   3. Issues tab opens
 *   4. Suggestions toggle is accessible
 *   5. Export modal opens
 *   6. AI RPG, UE5, and Godot export buttons are visible
 *   7. Pre-export advisories section is visible (when applicable)
 *   8. F-624ed964: each export target is clicked and yields a non-empty
 *      download (chapel id + zone count; Godot also ships a .tscn scene)
 *
 * Prevents regressions on node:*, sidebar z-index, and export UI parity.
 * Visibility of the three buttons does not substitute for the download.
 */

import {
  test,
  expect,
  CHAPEL_PROJECT,
  CHAPEL_ID,
  CHAPEL_ZONE_COUNT,
  loadChapel,
  openExportModal,
  clickExportAndDownload,
  readDownloadJson,
  asRecord,
  asArray,
} from './helpers';

test.describe('Editor browser smoke', () => {
  test('boots and renders the top bar', async ({ page }) => {
    await page.goto('/');
    // The top bar should contain the World Forge logo/label
    await expect(page.locator('strong').filter({ hasText: 'World Forge' })).toBeVisible();
  });

  test('loads chapel project via file input', async ({ page }) => {
    await page.goto('/');
    // Set the hidden file input directly (no OS dialog)
    await page.locator('input[type="file"]').setInputFiles(CHAPEL_PROJECT);
    // After loading, the project name should appear in the top bar
    await expect(page.locator('text=Chapel Threshold')).toBeVisible({ timeout: 5000 });
  });

  test('Issues tab opens and shows validation panel', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="file"]').setInputFiles(CHAPEL_PROJECT);
    await expect(page.locator('text=Chapel Threshold')).toBeVisible({ timeout: 5000 });

    // Click the Issues tab
    const tabBar = page.locator('[data-testid="wf-tab-bar"]');
    await tabBar.locator('text=Issues').click();

    // The validation panel should render (look for the suggestions toggle)
    await expect(page.locator('[data-testid="wf-suggestions-toggle"]')).toBeVisible({ timeout: 3000 });
  });

  test('Suggestions toggle is a focusable button', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="file"]').setInputFiles(CHAPEL_PROJECT);
    await expect(page.locator('text=Chapel Threshold')).toBeVisible({ timeout: 5000 });

    const tabBar = page.locator('[data-testid="wf-tab-bar"]');
    await tabBar.locator('text=Issues').click();

    const toggle = page.locator('[data-testid="wf-suggestions-toggle"]');
    await expect(toggle).toBeVisible({ timeout: 3000 });
    // Must be a <button> for accessibility
    await expect(toggle).toHaveRole('button');
  });

  test('Export modal opens with all three target buttons', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="file"]').setInputFiles(CHAPEL_PROJECT);
    await expect(page.locator('text=Chapel Threshold')).toBeVisible({ timeout: 5000 });

    // Click the Export button in the top bar
    await page.locator('button', { hasText: 'Export' }).first().click();

    // All three export buttons should be visible
    await expect(page.locator('button', { hasText: 'Export JSON' })).toBeVisible({ timeout: 3000 });
    await expect(page.locator('button', { hasText: 'Export Unreal Engine 5' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Export Godot 4' })).toBeVisible();
  });

  test('Export modal shows pre-export advisories when applicable', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="file"]').setInputFiles(CHAPEL_PROJECT);
    await expect(page.locator('text=Chapel Threshold')).toBeVisible({ timeout: 5000 });

    await page.locator('button', { hasText: 'Export' }).first().click();

    // Chapel Threshold's fixture (dogfood/output/chapel-project.json) has zero
    // zones with `elevation`/`elevationRange` and zero zones with
    // `parallaxLayers` — both trip an advisory in ExportModal's `advisories`
    // useMemo (packages/editor/src/panels/ExportModal.tsx), so this fixture
    // is guaranteed to render the Advisories section. Assert it unconditionally:
    // a `.catch(() => false)` soft-check here (as this test previously had)
    // means a fully broken advisory renderer would still pass, because the
    // conditional body simply never runs. See F-002.
    const advisories = page.getByText('Advisories', { exact: true }).first();
    await expect(advisories).toBeVisible({ timeout: 3000 });

    // Modal still renders correctly alongside the advisories section.
    await expect(page.locator('button', { hasText: 'Export JSON' })).toBeVisible();
  });
});

test.describe('Editor export downloads (F-624ed964)', () => {
  test.describe.configure({ timeout: 45_000 });

  test('Export JSON downloads a non-empty chapel engine pack', async ({ page }) => {
    await loadChapel(page);
    await openExportModal(page);

    const download = await clickExportAndDownload(page, 'Export JSON');
    expect(download.suggestedFilename()).toBe(`${CHAPEL_ID}-engine-pack.json`);

    const json = await readDownloadJson(download);
    expect(asRecord(json.packMeta, 'packMeta').id).toBe(CHAPEL_ID);
    expect(asRecord(json.manifest, 'manifest').id).toBe(CHAPEL_ID);
    expect(asArray(asRecord(json.contentPack, 'contentPack').zones, 'contentPack.zones')).toHaveLength(CHAPEL_ZONE_COUNT);
  });

  test('Export Unreal Engine 5 downloads a non-empty chapel pack', async ({ page }) => {
    await loadChapel(page);
    await openExportModal(page);

    const download = await clickExportAndDownload(page, 'Export Unreal Engine 5');
    expect(download.suggestedFilename()).toBe(`${CHAPEL_ID}-unreal-pack.json`);

    const json = await readDownloadJson(download);
    const pack = asRecord(json.contentPack, 'contentPack');
    const meta = asRecord(pack.Meta, 'contentPack.Meta');
    expect(meta.Id).toBe(CHAPEL_ID);
    expect(meta.SourceProjectId).toBe(CHAPEL_ID);
    expect(asArray(pack.Zones, 'contentPack.Zones')).toHaveLength(CHAPEL_ZONE_COUNT);
  });

  test('Export Godot 4 downloads a non-empty chapel pack with a world scene', async ({ page }) => {
    await loadChapel(page);
    await openExportModal(page);

    const download = await clickExportAndDownload(page, 'Export Godot 4');
    expect(download.suggestedFilename()).toBe(`${CHAPEL_ID}-godot-pack.json`);

    const json = await readDownloadJson(download);
    const pack = asRecord(json.contentPack, 'contentPack');
    expect(asRecord(pack.meta, 'contentPack.meta').sourceProjectId).toBe(CHAPEL_ID);
    expect(asArray(pack.zones, 'contentPack.zones')).toHaveLength(CHAPEL_ZONE_COUNT);
    expect(typeof pack.worldSceneTscn).toBe('string');
    expect(String(pack.worldSceneTscn).length).toBeGreaterThan(0);
    expect(String(pack.worldSceneTscn)).toContain('[gd_scene');
  });
});
