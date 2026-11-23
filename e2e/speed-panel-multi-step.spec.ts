import { readFileSync } from 'node:fs';
import { test, expect, loadChapel, CHAPEL_PROJECT } from './helpers';

function computeFittedChapelZoneAnchor(
  zoneId: string,
  canvasBox: { width: number; height: number },
  offsetRatio: { rx?: number; ry?: number } = {},
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
  const rx = offsetRatio.rx ?? 0.5;
  const ry = offsetRatio.ry ?? 0.5;
  return {
    sx: Math.min(canvasBox.width - 8, Math.max(8, ((zone.gridX + zone.gridWidth * rx) * tileSize - panX) * zoom)),
    sy: Math.min(canvasBox.height - 8, Math.max(8, ((zone.gridY + zone.gridHeight * ry) * tileSize - panY) * zoom)),
  };
}

test.describe('Speed Panel Multi-Step Flows, Macros, and Quick Fix', () => {
  test('Mechanism 1 & 2: Assign District (+ Create District), Place Encounter export badges, Set Elevation Tab pill with inline error & atomic Undo, and Repeat Last Action Here', async ({ page }) => {
    await loadChapel(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();

    // Target empty zone interiors away from entities/landmarks/spawns
    const entranceAnchor = computeFittedChapelZoneAnchor('chapel-entrance', box!, { rx: 0.75, ry: 0.75 });
    const naveAnchor = computeFittedChapelZoneAnchor('chapel-nave', box!, { rx: 0.8, ry: 0.8 });

    // 1) Open Speed Panel over Chapel Entrance -> Assign District -> + Create District -> inline error then atomic create+assign -> 1 Undo
    await page.mouse.move(box!.x + entranceAnchor.sx, box!.y + entranceAnchor.sy);
    await page.keyboard.press('q');
    const panel = page.getByTestId('wf-speed-panel');
    await expect(panel).toBeVisible();

    await panel.getByTestId('wf-sp-row-assign-district').click();
    await expect(panel.getByTestId('wf-sp-step-view')).toBeVisible();
    await panel.getByTestId('wf-sp-step-opt-__create_district__').click();

    const stepInput = panel.getByTestId('wf-sp-step-input');
    await stepInput.fill('   ');
    await panel.getByTestId('wf-sp-step-confirm').click();
    await expect(panel.getByTestId('wf-sp-step-error')).toBeVisible();

    await stepInput.fill('Bellfry Ward');
    await panel.getByTestId('wf-sp-step-confirm').click();
    await expect(panel).toHaveCount(0);

    // Objects tab shows created district; 1 Ctrl+Z removes both district and zone assignment
    const undoBtn = page.getByRole('button', { name: /^Undo\b/ });
    await expect(undoBtn).toHaveText('Undo (1)');
    await expect(undoBtn).toHaveAttribute('title', 'Undo: Create district "Bellfry Ward" and assign');
    await undoBtn.click();
    await expect(undoBtn).toBeDisabled();

    // 2) Place Encounter Here shows native/mapped/dropped/blocked AI RPG badges without blocking `trap`
    await page.mouse.move(box!.x + entranceAnchor.sx, box!.y + entranceAnchor.sy);
    await page.keyboard.press('q');
    await expect(panel).toBeVisible();
    await panel.getByTestId('wf-sp-row-place-encounter').click();
    await expect(panel.getByTestId('wf-sp-step-opt-boss').getByTestId('wf-sp-export-badge')).toContainText('Maps');
    await expect(panel.getByTestId('wf-sp-step-opt-hazard').getByTestId('wf-sp-export-badge')).toContainText('Dropped');
    await expect(panel.getByTestId('wf-sp-step-opt-trap').getByTestId('wf-sp-export-badge')).toContainText('Blocked');
    await panel.getByTestId('wf-sp-step-opt-trap').click();
    await expect(panel).toHaveCount(0);
    await expect(undoBtn).toHaveText('Undo (1)');
    await expect(undoBtn).toHaveAttribute('title', 'Undo: Place trap encounter in Chapel Entrance');

    // 3) Repeat Last Action Here replays placing a `trap` encounter on Chapel Nave cleanly
    await page.mouse.move(box!.x + naveAnchor.sx, box!.y + naveAnchor.sy);
    await page.keyboard.press('q');
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('wf-sp-repeat-last')).toBeVisible();
    await panel.getByTestId('wf-sp-repeat-repeat-last').click();
    await expect(panel).toHaveCount(0);
    await expect(undoBtn).toHaveText('Undo (2)');
    await expect(undoBtn).toHaveAttribute('title', 'Undo: Place trap encounter in Chapel Nave');
    await expect(page.getByLabel('Zone', { exact: true })).toHaveValue('Chapel Nave');
    await expect(page.getByRole('combobox', { name: /^Encounter Type/ })).toHaveValue('trap');
    await expect(page.getByLabel('Cooldown Turns', { exact: true })).toHaveValue('3');

    // 4) Mechanism 2: Set Elevation inline Tab scalar pill with invalid number rejection & valid commit
    await page.mouse.move(box!.x + entranceAnchor.sx, box!.y + entranceAnchor.sy);
    await page.keyboard.press('q');
    const search = page.getByTestId('wf-speed-panel-search');
    await search.fill('set elevation');
    await expect(panel.getByTestId('wf-sp-row-set-elevation')).toHaveAttribute('aria-selected', 'true');
    await search.press('Tab');
    const pill = panel.getByTestId('wf-sp-scalar-pill');
    await expect(pill).toBeVisible();
    await pill.fill('abc');
    await pill.press('Enter');
    await expect(panel.getByTestId('wf-sp-scalar-error')).toBeVisible();
    await expect(panel).toBeVisible();

    await pill.fill('-8');
    await pill.press('Enter');
    await expect(panel).toHaveCount(0);
    await expect(undoBtn).toHaveText('Undo (3)');
    await expect(undoBtn).toHaveAttribute('title', 'Undo: Set elevation to -8 (Chapel Entrance)');

    // Click Chapel Entrance and verify persisted zone elevation + single-step Undo restore
    await page.mouse.click(box!.x + entranceAnchor.sx, box!.y + entranceAnchor.sy);
    await expect(page.getByLabel('Name', { exact: true }).first()).toHaveValue('Chapel Entrance');
    await expect(page.getByTestId('elevation-number')).toHaveValue('-8');
    await undoBtn.click();
    await expect(undoBtn).toHaveText('Undo (2)');
    await expect(page.getByTestId('elevation-number')).toHaveValue('');
  });

  test('Mechanism 3: Connect From Here Tab kind cycle, self-target badge, Esc cancel preserving selection, Shift-chain multi-target connect, off-screen zone pick, and single-zone Merge Zones Shift multi-pick', async ({ page }) => {
    await loadChapel(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();

    const entranceAnchor = computeFittedChapelZoneAnchor('chapel-entrance', box!, { rx: 0.75, ry: 0.75 });
    const cryptAnchor = computeFittedChapelZoneAnchor('crypt-chamber', box!, { rx: 0.8, ry: 0.8 });

    // Pre-select Chapel Nave cleanly so we verify Esc cancel preserves selection
    const naveAnchor = computeFittedChapelZoneAnchor('chapel-nave', box!, { rx: 0.8, ry: 0.8 });
    await page.mouse.click(box!.x + naveAnchor.sx, box!.y + naveAnchor.sy);
    await expect(page.getByText('Selected: 1')).toBeVisible();
    await expect(page.getByLabel('Name', { exact: true }).first()).toHaveValue('Chapel Nave');

    // Start Connect From Here on Chapel Entrance -> verify pick bar & cursor badge -> self hover shows error -> Tab cycles kind -> Esc cancels cleanly
    await page.mouse.move(box!.x + entranceAnchor.sx, box!.y + entranceAnchor.sy);
    await page.keyboard.press('q');
    const panel = page.getByTestId('wf-speed-panel');
    await expect(panel).toBeVisible();
    await panel.getByTestId('wf-sp-row-connect-from').click();
    await expect(panel).toHaveCount(0);

    const pickBar = page.getByTestId('wf-sp-pick-bar');
    await expect(pickBar).toBeVisible();
    const kindBtn = page.getByTestId('wf-sp-pick-kind-cycle');
    const initialKind = await kindBtn.textContent();
    // Typing Tab inside an Inspector <input> during active pick must NOT cycle connection kind (Canvas key-listener guard order)
    const nameInput = page.getByLabel('Name', { exact: true }).first();
    await nameInput.focus();
    await page.keyboard.press('Tab');
    await expect(kindBtn).toHaveText(initialKind ?? '');
    // Outside editable inputs, Tab cycles the connection kind
    await nameInput.evaluate((el) => (el as HTMLElement).blur());
    await page.keyboard.press('Tab');
    await expect(kindBtn).not.toHaveText(initialKind ?? '');

    // Hover source zone shows inline error in cursor badge; clicking does NOT dismiss pick bar
    await page.mouse.move(box!.x + entranceAnchor.sx, box!.y + entranceAnchor.sy);
    await expect(page.getByTestId('wf-sp-cursor-badge')).toContainText('Pick a different zone');
    await page.mouse.click(box!.x + entranceAnchor.sx, box!.y + entranceAnchor.sy);
    await expect(pickBar).toBeVisible();

    // Esc cancels picking cleanly without mutating project or altering pre-existing selection
    const undoBtn = page.getByRole('button', { name: /^Undo\b/ });
    await expect(undoBtn).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(pickBar).toHaveCount(0);
    await expect(undoBtn).toBeDisabled();
    await expect(page.getByText('Selected: 1')).toBeVisible();
    await expect(page.getByLabel('Name', { exact: true }).first()).toHaveValue('Chapel Nave');

    // Re-run Connect From Here -> Shift+Click chains first target (Chapel Nave) keeping pick open -> off-screen search finishes second target (Crypt Chamber)
    await page.mouse.move(box!.x + entranceAnchor.sx, box!.y + entranceAnchor.sy);
    await page.keyboard.press('q');
    await page.getByTestId('wf-sp-row-connect-from').click();
    await expect(pickBar).toBeVisible();
    await page.keyboard.down('Shift');
    await page.mouse.click(box!.x + naveAnchor.sx, box!.y + naveAnchor.sy);
    await page.keyboard.up('Shift');
    await expect(pickBar).toBeVisible();
    await expect(undoBtn).toHaveText('Undo (1)');
    await expect(undoBtn).toHaveAttribute('title', /^Undo: Connect Chapel Entrance \u2192 Chapel Nave \(/);

    await page.getByTestId('wf-sp-pick-search').fill('Crypt');
    await page.getByTestId('wf-sp-pick-zone-crypt-chamber').click();
    await expect(page.getByTestId('wf-sp-pick-bar')).toHaveCount(0);
    await expect(undoBtn).toHaveText('Undo (2)');
    await expect(undoBtn).toHaveAttribute('title', /^Undo: Connect Chapel Entrance \u2192 Crypt Chamber \(/);

    // Single-zone Merge Zones initiates pick -> Shift+Click second zone keeps open -> Enter inside pick search does NOT confirm merge -> Merge (2) commits in 1 descriptive undo entry
    await page.mouse.move(box!.x + entranceAnchor.sx, box!.y + entranceAnchor.sy);
    await page.keyboard.press('q');
    const search = page.getByTestId('wf-speed-panel-search');
    await search.fill('merge');
    await search.press('Enter');
    await expect(page.getByTestId('wf-sp-pick-bar')).toContainText('1 picked');
    await page.keyboard.down('Shift');
    await page.mouse.click(box!.x + cryptAnchor.sx, box!.y + cryptAnchor.sy);
    await page.keyboard.up('Shift');
    await expect(page.getByTestId('wf-sp-pick-bar')).toContainText('2 picked');
    // Typing Enter inside an Inspector <textarea> during active merge pick must NOT trigger merge
    const descTextarea = page.getByRole('textbox', { name: 'Description', exact: true });
    await descTextarea.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('wf-sp-pick-bar')).toBeVisible();
    await page.getByTestId('wf-sp-pick-merge-confirm').click();
    await expect(page.getByTestId('wf-sp-pick-bar')).toHaveCount(0);
    await expect(undoBtn).toHaveText('Undo (4)');
    await expect(undoBtn).toHaveAttribute('title', 'Undo: Merge Chapel Entrance + Crypt Chamber');
  });

  test('creates a macro from recent actions, runs it with one undo entry, and cancels missing-target prompt with Esc', async ({ page }) => {
    await loadChapel(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();

    const entranceAnchor = computeFittedChapelZoneAnchor('chapel-entrance', box!, { rx: 0.75, ry: 0.75 });
    const naveAnchor = computeFittedChapelZoneAnchor('chapel-nave', box!, { rx: 0.8, ry: 0.8 });

    // 1) Perform Assign District (+ Create District 'Bellfry Ward') and Set Elevation '15' on Chapel Entrance
    await page.mouse.move(box!.x + entranceAnchor.sx, box!.y + entranceAnchor.sy);
    await page.keyboard.press('q');
    const panel = page.getByTestId('wf-speed-panel');
    await panel.getByTestId('wf-sp-row-assign-district').click();
    await panel.getByTestId('wf-sp-step-opt-__create_district__').click();
    await panel.getByTestId('wf-sp-step-input').fill('Bellfry Ward');
    await panel.getByTestId('wf-sp-step-confirm').click();
    await expect(panel).toHaveCount(0);

    await page.mouse.move(box!.x + entranceAnchor.sx, box!.y + entranceAnchor.sy);
    await page.keyboard.press('q');
    const search = page.getByTestId('wf-speed-panel-search');
    await search.fill('set elevation');
    await search.press('Tab');
    const pill = panel.getByTestId('wf-sp-scalar-pill');
    await pill.fill('15');
    await pill.press('Enter');
    await expect(panel).toHaveCount(0);

    const undoBtn = page.getByRole('button', { name: /^Undo\b/ });
    await expect(undoBtn).toHaveText('Undo (2)');

    // 2) Open Create Macro from Recent Actions -> save pinned macro 'Ward Prep'
    await page.mouse.move(box!.x + entranceAnchor.sx, box!.y + entranceAnchor.sy);
    await page.keyboard.press('q');
    await expect(panel).toBeVisible();
    await search.fill('create macro');
    await panel.getByTestId('wf-sp-row-create-macro-from-recent').click();
    await expect(panel.getByTestId('wf-sp-create-macro-view')).toBeVisible();
    await expect(panel.getByTestId('wf-sp-recent-action-0')).toBeVisible();
    await expect(panel.getByTestId('wf-sp-recent-action-1')).toBeVisible();
    await panel.getByTestId('wf-sp-create-macro-name').fill('Ward Prep');
    await panel.getByTestId('wf-sp-create-macro-save').click();
    await expect(panel.getByTestId('wf-sp-create-macro-view')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);

    // 3) Run 'Ward Prep' on Chapel Nave -> commits both district assignment & elevation in ONE undo entry
    await page.mouse.move(box!.x + naveAnchor.sx, box!.y + naveAnchor.sy);
    await page.keyboard.press('q');
    await expect(panel.getByTestId('wf-sp-band-2')).toContainText('Ward Prep');
    await panel.getByTestId('wf-sp-band-2').getByText('Ward Prep').click();
    await expect(panel).toHaveCount(0);
    await expect(undoBtn).toHaveText('Undo (3)');
    await expect(undoBtn).toHaveAttribute('title', 'Undo: Ward Prep');

    // Undo 'Ward Prep', Undo elevation 15, Undo creating 'Bellfry Ward' -> district ID is now missing
    await undoBtn.click();
    await expect(undoBtn).toHaveText('Undo (2)');
    await undoBtn.click();
    await expect(undoBtn).toHaveText('Undo (1)');
    await undoBtn.click();
    await expect(undoBtn).toBeDisabled();

    // 4) Run 'Ward Prep' again when 'Bellfry Ward' district is missing -> inline prompt appears -> Esc cancels with zero undo entry
    await page.mouse.move(box!.x + naveAnchor.sx, box!.y + naveAnchor.sy);
    await page.keyboard.press('q');
    await panel.getByTestId('wf-sp-band-2').getByText('Ward Prep').click();
    await expect(panel.getByTestId('wf-sp-step-view')).toContainText('Replace missing district');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(undoBtn).toBeDisabled();
  });

  test('displays Quick Fix count for object problems without shifting Band 1 deck, cancels cleanly on Esc, and applies repair with Deps undo parity', async ({ page }) => {
    await loadChapel(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();

    const entranceAnchor = computeFittedChapelZoneAnchor('chapel-entrance', box!, { rx: 0.75, ry: 0.75 });
    const panel = page.getByTestId('wf-speed-panel');
    const undoBtn = page.getByRole('button', { name: /^Undo\b/ });

    // 1) Clean Chapel Entrance has no Quick Fix row; Enter on open runs Band 1 slot 1 (Edit Properties)
    await page.mouse.move(box!.x + entranceAnchor.sx, box!.y + entranceAnchor.sy);
    await page.keyboard.press('q');
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('wf-sp-quick-fix-row')).toHaveCount(0);
    const baselineDeckIds = await panel.locator('[data-testid="wf-sp-band-1"] [id^="wf-sp-opt-b1-"]').evaluateAll(
      (els) => els.map((e) => e.id),
    );
    expect(baselineDeckIds.length).toBeGreaterThanOrEqual(4);
    await expect(panel.locator(`#${baselineDeckIds[0]}`)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(panel).toHaveCount(0);
    await expect(page.getByLabel('Name', { exact: true }).first()).toHaveValue('Chapel Entrance');

    // 2) Load a Chapel copy carrying a broken backgroundId reference on chapel-entrance
    const brokenChapel = JSON.parse(readFileSync(CHAPEL_PROJECT, 'utf-8')) as {
      zones: Array<Record<string, unknown>>;
    };
    const entIdx = brokenChapel.zones.findIndex((z) => z.id === 'chapel-entrance');
    expect(entIdx).toBeGreaterThanOrEqual(0);
    brokenChapel.zones[entIdx] = { ...brokenChapel.zones[entIdx], backgroundId: 'missing-bg-asset' };
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'chapel-broken-bg.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(brokenChapel), 'utf-8'),
    });
    await expect(undoBtn).toBeDisabled();

    // 3) Broken Chapel Entrance: Quick Fix appears above unshifted Band 1, slot 1 starts active, and Enter on open still runs slot 1
    await page.mouse.move(box!.x + entranceAnchor.sx, box!.y + entranceAnchor.sy);
    await page.keyboard.press('q');
    await expect(panel).toBeVisible();
    const qfRow = panel.getByTestId('wf-sp-quick-fix-row');
    await expect(qfRow).toBeVisible();
    await expect(panel.getByTestId('wf-sp-quick-fix-count')).toHaveText('2 problems');

    const deckIdsWithFix = await panel.locator('[data-testid="wf-sp-band-1"] [id^="wf-sp-opt-b1-"]').evaluateAll(
      (els) => els.map((e) => e.id),
    );
    expect(deckIdsWithFix).toEqual(baselineDeckIds);
    await expect(qfRow).toHaveAttribute('aria-selected', 'false');
    await expect(panel.locator(`#${baselineDeckIds[0]}`)).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Enter');
    await expect(panel).toHaveCount(0);
    await expect(page.getByLabel('Name', { exact: true }).first()).toHaveValue('Chapel Entrance');
    await expect(undoBtn).toBeDisabled();

    // 4) ArrowUp from Band 1 slot 1 reaches Quick Fix row, Enter opens Quick Fix, and Esc cancels cleanly
    await page.mouse.move(box!.x + entranceAnchor.sx, box!.y + entranceAnchor.sy);
    await page.keyboard.press('q');
    await expect(panel).toBeVisible();
    await expect(panel.locator(`#${baselineDeckIds[0]}`)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowUp');
    await expect(qfRow).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(panel.getByTestId('wf-sp-step-view')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(undoBtn).toBeDisabled();

    // 5) Reopen Quick Fix -> select the dependency problem -> verify Show in Deps option + apply repair -> exact Deps undo label parity
    await page.mouse.move(box!.x + entranceAnchor.sx, box!.y + entranceAnchor.sy);
    await page.keyboard.press('q');
    await panel.getByTestId('wf-sp-quick-fix-row').click();
    await panel.locator('[data-testid^="wf-sp-step-opt-dep:"]').first().click();
    await expect(panel.getByTestId('wf-sp-step-opt-show-in-panel')).toBeVisible();
    await panel.getByTestId('wf-sp-step-opt-repair:0').click();

    await expect(panel).toHaveCount(0);
    await expect(undoBtn).toHaveText('Undo (1)');
    await expect(undoBtn).toHaveAttribute('title', 'Undo: Repair: Clear backgroundId');

    // 6) Zone is now clean again -> Quick Fix row no longer appears and slot 1 remains active
    await page.mouse.move(box!.x + entranceAnchor.sx, box!.y + entranceAnchor.sy);
    await page.keyboard.press('q');
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('wf-sp-quick-fix-row')).toHaveCount(0);
    await expect(panel.locator(`#${baselineDeckIds[0]}`)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
  });

  test('displays overlapping scope chips, switches via Tab/Shift+Tab/click, moves canvas highlight cleanly, and preserves typed scalar Tab', async ({ page }) => {
    await loadChapel(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();

    const bareZoneAnchor = computeFittedChapelZoneAnchor('chapel-entrance', box!, { rx: 0.75, ry: 0.75 });
    const pilgrimOverlapAnchor = computeFittedChapelZoneAnchor('chapel-entrance', box!, { rx: 0.1, ry: 0.2 });
    const panel = page.getByTestId('wf-speed-panel');
    const undoBtn = page.getByRole('button', { name: /^Undo\b/ });
    const highlight = page.getByTestId('wf-sp-canvas-highlight');

    // 1) Single-object bare zone opening omits scope chip row
    await page.mouse.move(box!.x + bareZoneAnchor.sx, box!.y + bareZoneAnchor.sy);
    await page.keyboard.press('q');
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('wf-sp-scope-chips')).toHaveCount(0);
    await expect(highlight).toHaveAttribute('data-target-type', 'zone');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(highlight).toHaveCount(0);

    // 2) Overlapping Item + NPC + Zone opening renders chips in hit order with Canvas last, initial live announcement, and Item canvas highlight
    await page.mouse.move(box!.x + pilgrimOverlapAnchor.sx, box!.y + pilgrimOverlapAnchor.sy);
    await page.keyboard.press('q');
    await expect(panel).toBeVisible();
    const chipBar = panel.getByTestId('wf-sp-scope-chips');
    await expect(chipBar).toBeVisible();
    const itemChip = chipBar.getByTestId('wf-sp-scope-chip-item:chapel-lantern');
    const npcChip = chipBar.getByTestId('wf-sp-scope-chip-entity:suspicious-pilgrim');
    const zoneChip = chipBar.getByTestId('wf-sp-scope-chip-zone:chapel-entrance');
    const canvasChip = chipBar.getByTestId('wf-sp-scope-chip-canvas');
    await expect(itemChip).toHaveText('Item: Chapel Lantern');
    await expect(npcChip).toHaveText('NPC: Suspicious Pilgrim');
    await expect(zoneChip).toHaveText('Zone: Chapel Entrance');
    await expect(canvasChip).toHaveText('Canvas');
    await expect(itemChip).toHaveAttribute('aria-pressed', 'true');
    await expect(npcChip).toHaveAttribute('aria-pressed', 'false');
    await expect(zoneChip).toHaveAttribute('aria-pressed', 'false');
    await expect(highlight).toHaveAttribute('data-target-type', 'item');
    await expect(highlight).toHaveAttribute('data-target-id', 'chapel-lantern');
    await expect(panel.getByTestId('wf-sp-live-region')).toContainText('Item: Chapel Lantern');

    // 3) Tab from the focused last chip leaves the chip row and moves onto the first Band 1 pin button
    await canvasChip.focus();
    await expect(canvasChip).toBeFocused();
    await page.keyboard.press('Tab');
    const leftChipRow = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      const chips = document.querySelector('[data-testid="wf-sp-scope-chips"]');
      const band1 = document.querySelector('[data-testid="wf-sp-band-1"]');
      return {
        inChips: Boolean(active && chips && chips.contains(active)),
        inBand1: Boolean(active && band1 && band1.contains(active)),
        isFirstBand1Button: Boolean(active && band1 && band1.querySelector('button') === active),
        notBody: Boolean(active && active !== document.body),
        tagName: active?.tagName ?? '',
        accessibleLabel: (active?.getAttribute('aria-label') || active?.textContent || '').trim(),
      };
    });
    expect(leftChipRow.inChips).toBe(false);
    expect(leftChipRow.inBand1).toBe(true);
    expect(leftChipRow.isFirstBand1Button).toBe(true);
    expect(leftChipRow.notBody).toBe(true);
    expect(leftChipRow.tagName).toBe('BUTTON');
    expect(leftChipRow.accessibleLabel).toMatch(/^(Pin|Unpin) /);
    await panel.getByTestId('wf-speed-panel-search').focus();

    // 4) Tab with empty search cycles Item -> NPC -> Zone, moving canvas highlight, live announcement & Band 1 deck
    await page.keyboard.press('Tab');
    await expect(npcChip).toHaveAttribute('aria-pressed', 'true');
    await expect(highlight).toHaveAttribute('data-target-type', 'entity');
    await expect(highlight).toHaveAttribute('data-target-id', 'suspicious-pilgrim');
    await expect(panel.getByTestId('wf-sp-live-region')).toContainText('NPC: Suspicious Pilgrim');

    await page.keyboard.press('Tab');
    await expect(zoneChip).toHaveAttribute('aria-pressed', 'true');
    await expect(highlight).toHaveAttribute('data-target-type', 'zone');
    await expect(highlight).toHaveAttribute('data-target-id', 'chapel-entrance');
    await expect(panel.getByTestId('wf-sp-live-region')).toContainText('Zone: Chapel Entrance');
    await expect(panel.getByTestId('wf-sp-band-1').getByTestId('wf-sp-row-edit-props')).toBeVisible();

    // Shift+Tab cycles back to NPC
    await page.keyboard.press('Shift+Tab');
    await expect(npcChip).toHaveAttribute('aria-pressed', 'true');
    await expect(highlight).toHaveAttribute('data-target-type', 'entity');

    // Clicking Canvas chip clears target highlight and switches deck to Canvas commands
    await canvasChip.click();
    await expect(canvasChip).toHaveAttribute('aria-pressed', 'true');
    await expect(highlight).toHaveCount(0);
    await expect(panel.getByTestId('wf-sp-live-region')).toContainText('Canvas');
    await expect(panel.getByTestId('wf-sp-band-1').getByTestId('wf-sp-row-new-zone')).toBeVisible();

    // Clicking Zone chip restores Zone target & highlight, then typing 'elev' + Tab still opens inline scalar pill
    await zoneChip.click();
    await expect(zoneChip).toHaveAttribute('aria-pressed', 'true');
    await expect(highlight).toHaveAttribute('data-target-type', 'zone');
    await panel.getByTestId('wf-speed-panel-search').fill('elev');
    await page.keyboard.press('Tab');
    await expect(panel.getByTestId('wf-sp-scalar-pill')).toBeVisible();
    await expect(zoneChip).toHaveAttribute('aria-pressed', 'true');

    // Esc dismisses scalar pill, next Esc closes panel and clears highlight with zero project/undo mutation
    await page.keyboard.press('Escape');
    await expect(panel.getByTestId('wf-sp-scalar-pill')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(highlight).toHaveCount(0);
    await expect(undoBtn).toBeDisabled();
  });
});
