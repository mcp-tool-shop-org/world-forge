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

test.describe('Speed Panel C4 Multi-Step, Scalar Pill, Spatial Picking & Replay', () => {
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

  test('Speed Panel D2: Create Macro from Recent Actions, run with single atomic undo, and cancel missing-ref prompt with Esc', async ({ page }) => {
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
});
