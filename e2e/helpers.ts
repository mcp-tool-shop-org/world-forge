/**
 * Shared Playwright helpers for editor e2e specs.
 *
 * F-03e207f6: fail when a Pixi/GPU exception or console.error fires after
 * goto. F-624ed964 / F-56ff55da: chapel fixture + export download bytes.
 */
import { test as base, expect, type Download, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const CHAPEL_PROJECT = resolve(here, '../dogfood/output/chapel-project.json');
export const CHAPEL_ID = 'chapel-threshold';
export const CHAPEL_ZONE_COUNT = 5;

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      errors.push(`pageerror: ${err.message}`);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });
    await use(page);
    expect(errors, errors.join('\n')).toEqual([]);
  },
});

export { expect };

export async function loadChapel(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('input[type="file"]').first().setInputFiles(CHAPEL_PROJECT);
  await expect(page.locator('text=Chapel Threshold')).toBeVisible({ timeout: 5000 });
}

export async function openExportModal(page: Page): Promise<void> {
  await page.locator('button', { hasText: 'Export' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Export' })).toBeVisible({ timeout: 3000 });
}

/**
 * Click an Export-modal target button and wait for a real browser download.
 * If the synthetic <a download> click is swallowed, fall through to the
 * visible ED-B-002 fallback anchor (still a download, not a painted button).
 */
export async function clickExportAndDownload(page: Page, buttonText: string): Promise<Download> {
  const dialog = page.getByRole('dialog', { name: 'Export' });
  const button = dialog.getByRole('button', { name: buttonText, exact: true });
  await expect(button).toBeEnabled({ timeout: 5000 });
  const downloadPromise = page.waitForEvent('download', { timeout: 45_000 });
  await button.click();
  await expect(button).not.toHaveText(/Exporting/, { timeout: 45_000 });
  try {
    return await downloadPromise;
  } catch {
    const fallback = page.getByTestId('wf-export-fallback-link');
    await expect(fallback).toBeVisible({ timeout: 15_000 });
    const retry = page.waitForEvent('download', { timeout: 15_000 });
    await fallback.click();
    return await retry;
  }
}

export async function readDownloadJson(download: Download): Promise<Record<string, unknown>> {
  const filePath = await download.path();
  expect(filePath, 'download has a path').toBeTruthy();
  const text = readFileSync(filePath as string, 'utf8');
  expect(text.length, 'download is non-empty').toBeGreaterThan(0);
  const parsed: unknown = JSON.parse(text);
  expect(parsed && typeof parsed === 'object' && !Array.isArray(parsed)).toBe(true);
  return parsed as Record<string, unknown>;
}

export function asRecord(value: unknown, label: string): Record<string, unknown> {
  expect(value && typeof value === 'object' && !Array.isArray(value), `${label} is an object`).toBe(true);
  return value as Record<string, unknown>;
}

export function asArray(value: unknown, label: string): unknown[] {
  expect(Array.isArray(value), `${label} is an array`).toBe(true);
  return value as unknown[];
}
