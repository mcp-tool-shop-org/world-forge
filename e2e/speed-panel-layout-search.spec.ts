import { readFileSync } from 'node:fs';
import { test, expect, loadChapel, CHAPEL_PROJECT } from './helpers';

function computeFittedChapelZoneAnchor(
  zoneId: string,
  canvasBox: { width: number; height: number },
): { sx: number; sy: number } {
  const chapel = JSON.parse(readFileSync(CHAPEL_PROJECT, 'utf-8')) as {
    map: { tileSize: number };
    zones: Array<{ id: string; gridX: number; gridY: number; gridWidth: number; gridHeight: number }>;
    entityPlacements: Array<{ zoneId: string; gridX?: number; gridY?: number }>;
    landmarks: Array<{ gridX: number; gridY: number }>;
    spawnPoints: Array<{ gridX: number; gridY: number }>;
  };
  const tileSize = chapel.map.tileSize;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const z of chapel.zones) {
    minX = Math.min(minX, z.gridX * tileSize);
    minY = Math.min(minY, z.gridY * tileSize);
    maxX = Math.max(maxX, (z.gridX + z.gridWidth) * tileSize);
    maxY = Math.max(maxY, (z.gridY + z.gridHeight) * tileSize);
  }
  for (const ep of chapel.entityPlacements) {
    const z = chapel.zones.find((zn) => zn.id === ep.zoneId);
    if (!z) continue;
    const ex = (ep.gridX ?? z.gridX + 2) * tileSize;
    const ey = (ep.gridY ?? z.gridY + 2) * tileSize;
    minX = Math.min(minX, ex);
    minY = Math.min(minY, ey);
    maxX = Math.max(maxX, ex);
    maxY = Math.max(maxY, ey);
  }
  for (const lm of chapel.landmarks) {
    minX = Math.min(minX, lm.gridX * tileSize);
    minY = Math.min(minY, lm.gridY * tileSize);
    maxX = Math.max(maxX, lm.gridX * tileSize);
    maxY = Math.max(maxY, lm.gridY * tileSize);
  }
  for (const sp of chapel.spawnPoints) {
    minX = Math.min(minX, sp.gridX * tileSize);
    minY = Math.min(minY, sp.gridY * tileSize);
    maxX = Math.max(maxX, sp.gridX * tileSize);
    maxY = Math.max(maxY, sp.gridY * tileSize);
  }
  const pad = 64;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const bw = maxX - minX;
  const bh = maxY - minY;
  const zoom = Math.min(Math.max(Math.min(canvasBox.width / bw, canvasBox.height / bh), 0.1), 5.0);
  const panX = minX - (canvasBox.width / zoom - bw) / 2;
  const panY = minY - (canvasBox.height / zoom - bh) / 2;

  const zone = chapel.zones.find((z) => z.id === zoneId)!;
  const rawSX = ((zone.gridX + zone.gridWidth / 2) * tileSize - panX) * zoom;
  const rawSY = ((zone.gridY + zone.gridHeight / 2) * tileSize - panY) * zoom;
  const maxW = Math.max(16, canvasBox.width - 8);
  const maxH = Math.max(16, canvasBox.height - 8);
  return {
    sx: Math.min(maxW, Math.max(8, rawSX)),
    sy: Math.min(maxH, Math.max(8, rawSY)),
  };
}

test.describe('Speed Panel layout & search (C3)', () => {
  test('changed: Four-Band layout fixes Band 1 deck order, copies pins into Band 2, and persists Alt+ArrowDown reorder across reload', async ({ page }) => {
    await loadChapel(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const alcove = computeFittedChapelZoneAnchor('chapel-alcove', box!);
    const zx = box!.x + alcove.sx;
    const zy = box!.y + alcove.sy;

    // Hover and click Chapel Alcove so zone context applies, then open with Q
    await page.mouse.click(zx, zy);
    await expect(page.getByText('Zone Properties')).toBeVisible();
    await page.mouse.move(zx, zy);
    await page.keyboard.press('q');

    const panel = page.getByTestId('wf-speed-panel');
    await expect(panel).toBeVisible();

    // Band 1 holds the 5 fixed Zone slots in order
    const band1 = panel.getByTestId('wf-sp-band-1');
    await expect(band1).toBeVisible();
    const band1Options = band1.locator('[role="option"]');
    await expect(band1Options).toHaveCount(5);
    await expect(band1Options.nth(0)).toHaveAttribute('data-testid', 'wf-sp-row-edit-props');
    await expect(band1Options.nth(1)).toHaveAttribute('data-testid', 'wf-sp-row-connect-from');
    await expect(band1Options.nth(2)).toHaveAttribute('data-testid', 'wf-sp-row-place-entity');
    await expect(band1Options.nth(3)).toHaveAttribute('data-testid', 'wf-sp-row-place-encounter');
    await expect(band1Options.nth(4)).toHaveAttribute('data-testid', 'wf-sp-row-duplicate');

    // Empty search hides cross-type actions (Swap Direction) and keeps same-type blocked actions (Merge Zones) inline
    const band4 = panel.getByTestId('wf-sp-band-4');
    await expect(band4).toBeVisible();
    await expect(panel.getByTestId('wf-sp-row-swap-direction')).toHaveCount(0);
    const mergeRow = band4.getByTestId('wf-sp-row-merge-zones');
    await expect(mergeRow).toBeVisible();
    await expect(mergeRow).toHaveAttribute('aria-disabled', 'true');
    await expect(mergeRow).toContainText('Select at least 2 zones to merge');

    // Pin Edit Properties (in Band 1) and Delete (in Band 4) -> copied into Band 2, originals stay
    await band1.getByTestId('wf-sp-row-edit-props').getByRole('button', { name: 'Pin Edit Properties' }).click();
    await band4.getByTestId('wf-sp-row-delete').getByRole('button', { name: 'Pin Delete' }).click();

    const band2 = panel.getByTestId('wf-sp-band-2');
    await expect(band2).toBeVisible();
    await expect(band2.getByTestId('wf-sp-pin-edit-props')).toBeVisible();
    await expect(band2.getByTestId('wf-sp-pin-delete')).toBeVisible();
    // Originals stay in place!
    await expect(band1.getByTestId('wf-sp-row-edit-props')).toBeVisible();
    await expect(band4.getByTestId('wf-sp-row-delete')).toBeVisible();

    // Move cursor to Band 2 first pin (`edit-props` is right after the 5 Band 1 items: 5 ArrowDown presses)
    const search = page.getByTestId('wf-speed-panel-search');
    await search.focus();
    for (let i = 0; i < 5; i++) {
      await search.press('ArrowDown');
    }
    await expect(band2.getByTestId('wf-sp-pin-edit-props')).toHaveAttribute('aria-selected', 'true');

    // Alt+ArrowDown moves Edit Properties below Delete
    await search.press('Alt+ArrowDown');
    const pinRows = band2.locator('[role="option"]');
    await expect(pinRows.nth(0)).toHaveAttribute('data-testid', 'wf-sp-pin-delete');
    await expect(pinRows.nth(1)).toHaveAttribute('data-testid', 'wf-sp-pin-edit-props');

    // Reload page and confirm persisted pin order in localStorage (`wf.speedPanel.v2`)
    await page.reload();
    await page.locator('input[type="file"]').first().setInputFiles(CHAPEL_PROJECT);
    await expect(page.locator('text=Chapel Threshold')).toBeVisible({ timeout: 5000 });
    const reloadedBox = await page.locator('canvas').boundingBox();
    const reloadedAlcove = computeFittedChapelZoneAnchor('chapel-alcove', reloadedBox!);
    await page.mouse.click(reloadedBox!.x + reloadedAlcove.sx, reloadedBox!.y + reloadedAlcove.sy);
    await page.mouse.move(reloadedBox!.x + reloadedAlcove.sx, reloadedBox!.y + reloadedAlcove.sy);
    await page.keyboard.press('q');

    const reloadedBand2 = page.getByTestId('wf-speed-panel').getByTestId('wf-sp-band-2');
    await expect(reloadedBand2.locator('[role="option"]').nth(0)).toHaveAttribute('data-testid', 'wf-sp-pin-delete');
    await expect(reloadedBand2.locator('[role="option"]').nth(1)).toHaveAttribute('data-testid', 'wf-sp-pin-edit-props');
  });

  test('changed: search highlights characters, ranks RPG synonyms first, shows live shortcuts/locations, and keeps blocked matches in Unavailable here', async ({ page }) => {
    await loadChapel(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();

    // Open over empty canvas margin
    await page.mouse.move(box!.x + 12, box!.y + 12);
    await page.keyboard.press('q');
    const panel = page.getByTestId('wf-speed-panel');
    await expect(panel).toBeVisible();
    const search = page.getByTestId('wf-speed-panel-search');

    // Search `new` on empty canvas -> New Zone ranks #1 with <mark> highlight and UI path badge
    await search.fill('new');
    const firstOption = panel.locator('[role="option"]').first();
    await expect(firstOption).toHaveAttribute('data-testid', 'wf-sp-row-new-zone');
    await expect(firstOption.getByTestId('wf-sp-highlight').first()).toHaveText('New');
    await expect(firstOption.getByTestId('wf-sp-badge')).toContainText('Tool Palette');

    // Search `swap` on empty canvas -> never hidden; rendered in Unavailable here with aria-disabled="true" & exact reason
    await search.fill('swap');
    const unavailGroup = panel.getByTestId('wf-sp-unavailable-group');
    await expect(unavailGroup).toBeVisible();
    await expect(unavailGroup).toContainText('Unavailable here');
    const swapRow = unavailGroup.getByTestId('wf-sp-unavailable-swap-direction');
    await expect(swapRow).toHaveAttribute('aria-disabled', 'true');
    await expect(swapRow).toHaveAttribute('aria-selected', 'true');
    await expect(swapRow).toContainText('Target a connection to reverse it');

    // Live shortcut badge shown on bound command
    await search.fill('tool-z');
    await search.fill('zone t');
    const zoneToolRow = panel.getByTestId('wf-sp-row-tool-zone');
    await expect(zoneToolRow).toBeVisible();
    await expect(zoneToolRow.getByTestId('wf-sp-badge')).toHaveText('Z');

    await search.press('Escape');
    await expect(panel).toHaveCount(0);

    // Over a zone: search RPG synonym `npc` -> Place Entity Here ranks #1 with highlighted synonym
    const alcove = computeFittedChapelZoneAnchor('chapel-alcove', box!);
    await page.mouse.move(box!.x + alcove.sx, box!.y + alcove.sy);
    await page.keyboard.press('q');
    await expect(panel).toBeVisible();
    await search.fill('npc');
    await expect(panel.locator('[role="option"]').first()).toHaveAttribute('data-testid', 'wf-sp-row-place-entity');
    await expect(panel.locator('[role="option"]').first().getByTestId('wf-sp-highlight').first()).toHaveText('npc');
  });

  test('changed: Band 3 shows up to 3 frecency recents and turns off via Options toggle', async ({ page }) => {
    await loadChapel(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();

    // Open on empty canvas, execute `Zone Tool` (not in empty canvas Band 1) -> populates Band 3 recents
    await page.mouse.move(box!.x + 12, box!.y + 12);
    await page.keyboard.press('q');
    const panel = page.getByTestId('wf-speed-panel');
    const search = page.getByTestId('wf-speed-panel-search');
    await search.fill('zon');
    await expect(panel.locator('[role="option"]').first()).toHaveAttribute('data-testid', 'wf-sp-row-tool-zone');
    await search.press('Enter');
    await expect(panel).toHaveCount(0);

    // Re-open -> Band 3 (`RECENT`) shows `Zone Tool`
    await page.mouse.move(box!.x + 12, box!.y + 12);
    await page.keyboard.press('q');
    await expect(panel.getByTestId('wf-sp-band-3')).toBeVisible();
    await expect(panel.getByTestId('wf-sp-band-3').getByTestId('wf-sp-row-tool-zone')).toBeVisible();
    await search.press('Escape');

    // Open Options and turn off "Show recent commands in Speed Panel"
    await page.getByTestId('wf-options-btn').click();
    await expect(page.getByTestId('wf-options-modal')).toBeVisible();
    await page.getByTestId('wf-opt-show-recents').uncheck();
    await page.keyboard.press('Escape');

    // Re-open -> Band 3 is hidden while Band 1 remains intact
    await page.mouse.move(box!.x + 12, box!.y + 12);
    await page.keyboard.press('q');
    await expect(panel.getByTestId('wf-sp-band-1')).toBeVisible();
    await expect(panel.getByTestId('wf-sp-band-3')).toHaveCount(0);
  });
});
