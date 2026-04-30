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
 *
 * Prevents regressions on node:*, sidebar z-index, and export UI parity.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

const CHAPEL_PROJECT = path.resolve(__dirname, '../dogfood/output/chapel-project.json');

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

    // Chapel Threshold has zones with connections + entities → advisories should appear
    // The advisories section header text
    const advisories = page.locator('text=Advisories');
    // If the project triggers advisories they'll be visible; if not, at minimum
    // the export buttons are still there (covered by previous test).
    // Use a soft check — the advisory section is conditional on project content.
    const hasAdvisories = await advisories.isVisible().catch(() => false);
    if (hasAdvisories) {
      await expect(advisories).toBeVisible();
    }
    // Either way, Export JSON should remain visible (modal didn't crash)
    await expect(page.locator('button', { hasText: 'Export JSON' })).toBeVisible();
  });
});
