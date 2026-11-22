import type { Page } from '@playwright/test';
import { test, expect, loadChapel } from './helpers';

type OsOrder = 'windows' | 'macos';

async function installPausedClock(page: Page): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.install({ time: now + 1000 });
  await page.clock.pauseAt(now + 2000);
}

async function dispatchRightGesture(
  page: Page,
  order: OsOrder,
  opts: {
    startX: number;
    startY: number;
    moveX?: number;
    moveY?: number;
    endX?: number;
    endY?: number;
    button?: number;
    ctrlKey?: boolean;
    pointerType?: string;
    pointerId?: number;
  },
): Promise<{ contextMenuPrevented: boolean }> {
  return page.evaluate(
    ({ order: evOrder, opts: o }) => {
      const button = o.button ?? 2;
      const ctrlKey = Boolean(o.ctrlKey);
      const pointerType = o.pointerType ?? 'mouse';
      const pointerId = o.pointerId ?? 1;
      const endX = o.endX ?? o.moveX ?? o.startX;
      const endY = o.endY ?? o.moveY ?? o.startY;

      const targetDown = document.elementFromPoint(o.startX, o.startY) ?? document.querySelector('canvas');
      if (!targetDown) throw new Error('No target element found for right gesture');

      targetDown.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          button,
          buttons: button === 2 ? 2 : 1,
          ctrlKey,
          clientX: o.startX,
          clientY: o.startY,
          pointerId,
          pointerType,
        }),
      );

      if (o.moveX !== undefined || o.moveY !== undefined) {
        const mx = o.moveX ?? o.startX;
        const my = o.moveY ?? o.startY;
        const moveTarget = document.elementFromPoint(mx, my) ?? targetDown;
        moveTarget.dispatchEvent(
          new PointerEvent('pointermove', {
            bubbles: true,
            cancelable: true,
            button,
            buttons: button === 2 ? 2 : 1,
            ctrlKey,
            clientX: mx,
            clientY: my,
            pointerId,
            pointerType,
          }),
        );
      }

      const fireUp = () => {
        const targetUp = document.elementFromPoint(endX, endY) ?? targetDown;
        targetUp.dispatchEvent(
          new PointerEvent('pointerup', {
            bubbles: true,
            cancelable: true,
            button,
            buttons: 0,
            ctrlKey,
            clientX: endX,
            clientY: endY,
            pointerId,
            pointerType,
          }),
        );
      };

      const fireContextMenu = () => {
        const targetCtx = document.elementFromPoint(endX, endY) ?? targetDown;
        const ev = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button,
          buttons: 0,
          ctrlKey,
          clientX: endX,
          clientY: endY,
        });
        targetCtx.dispatchEvent(ev);
        return ev.defaultPrevented;
      };

      let contextMenuPrevented = false;
      if (evOrder === 'macos') {
        contextMenuPrevented = fireContextMenu();
        fireUp();
      } else {
        fireUp();
        contextMenuPrevented = fireContextMenu();
      }
      return { contextMenuPrevented };
    },
    { order, opts },
  );
}

test.describe('Speed Panel triggers & instant open (C2)', () => {
  for (const osOrder of ['windows', 'macos'] as const) {
    test.describe(`${osOrder} right-click event order`, () => {
      test(`changed (${osOrder}): single right-click opens compact menu immediately on release and suppresses browser contextmenu`, async ({ page }) => {
        await loadChapel(page);
        await installPausedClock(page);

        const box = await page.locator('canvas').boundingBox();
        expect(box).toBeTruthy();
        const cx = box!.x + box!.width / 2;
        const cy = box!.y + box!.height / 2;

        const { contextMenuPrevented } = await dispatchRightGesture(page, osOrder, { startX: cx, startY: cy });
        expect(contextMenuPrevented).toBe(true);

        // Compact menu appears immediately at 0 ms elapsed without waiting
        await expect(page.getByTestId('wf-context-menu')).toBeVisible();
        await expect(page.getByTestId('wf-speed-panel')).toHaveCount(0);
        await expect(page.getByTestId('wf-context-menu-footer')).toHaveText('Speed Panel — Q / 2×Right-Click');
      });

      test(`changed (${osOrder}): double right-click window boundaries (319 ms upgrades in place, 321 ms stays compact)`, async ({ page }) => {
        await loadChapel(page);
        await installPausedClock(page);

        const box = await page.locator('canvas').boundingBox();
        const cx = box!.x + box!.width / 2;
        const cy = box!.y + box!.height / 2;

        // Inside window: 319 ms upgrades open compact menu into Speed Panel
        await dispatchRightGesture(page, osOrder, { startX: cx, startY: cy });
        await expect(page.getByTestId('wf-context-menu')).toBeVisible();

        await page.clock.runFor(319);
        const insideCtx = await dispatchRightGesture(page, osOrder, { startX: cx, startY: cy });
        expect(insideCtx.contextMenuPrevented).toBe(true);
        await expect(page.getByTestId('wf-speed-panel')).toBeVisible();
        await expect(page.getByTestId('wf-context-menu')).toHaveCount(0);

        await page.keyboard.press('Escape');
        await expect(page.getByTestId('wf-speed-panel')).toHaveCount(0);

        // Outside window: 321 ms keeps compact menu
        await dispatchRightGesture(page, osOrder, { startX: cx + 20, startY: cy + 20 });
        await expect(page.getByTestId('wf-context-menu')).toBeVisible();

        await page.clock.runFor(321);
        await dispatchRightGesture(page, osOrder, { startX: cx + 20, startY: cy + 20 });
        await expect(page.getByTestId('wf-context-menu')).toBeVisible();
        await expect(page.getByTestId('wf-speed-panel')).toHaveCount(0);
      });

      test(`changed (${osOrder}): double right-click radius boundaries (17 px upgrades, 19 px stays compact)`, async ({ page }) => {
        await loadChapel(page);
        await installPausedClock(page);

        const box = await page.locator('canvas').boundingBox();
        const cx = box!.x + box!.width / 2;
        const cy = box!.y + box!.height / 2;

        await dispatchRightGesture(page, osOrder, { startX: cx, startY: cy });
        await expect(page.getByTestId('wf-context-menu')).toBeVisible();
        await page.clock.runFor(100);
        await dispatchRightGesture(page, osOrder, { startX: cx + 17, startY: cy });
        await expect(page.getByTestId('wf-speed-panel')).toBeVisible();
        await expect(page.getByTestId('wf-context-menu')).toHaveCount(0);

        await page.keyboard.press('Escape');

        await dispatchRightGesture(page, osOrder, { startX: cx, startY: cy });
        await expect(page.getByTestId('wf-context-menu')).toBeVisible();
        await page.clock.runFor(100);
        await dispatchRightGesture(page, osOrder, { startX: cx + 19, startY: cy });
        await expect(page.getByTestId('wf-context-menu')).toBeVisible();
        await expect(page.getByTestId('wf-speed-panel')).toHaveCount(0);
      });

      test(`changed (${osOrder}): drift boundaries (5 px opens compact menu, 7 px pans canvas with no menu)`, async ({ page }) => {
        await loadChapel(page);
        await installPausedClock(page);

        const box = await page.locator('canvas').boundingBox();
        const cx = box!.x + box!.width / 2;
        const cy = box!.y + box!.height / 2;

        // 5 px move within 6 px drift still opens compact menu
        await dispatchRightGesture(page, osOrder, { startX: cx, startY: cy, moveX: cx + 5, moveY: cy });
        await expect(page.getByTestId('wf-context-menu')).toBeVisible();

        // Dismiss by left-clicking canvas
        await page.mouse.click(cx - 80, cy - 80);
        await expect(page.getByTestId('wf-context-menu')).toHaveCount(0);

        // Read canvas bitmap before 7 px drag
        const beforeData = await page.locator('canvas').evaluate((el) => (el as HTMLCanvasElement).toDataURL());
        await dispatchRightGesture(page, osOrder, { startX: cx, startY: cy, moveX: cx + 7, moveY: cy });
        await page.clock.runFor(16);
        await expect(page.getByTestId('wf-context-menu')).toHaveCount(0);
        await expect(page.getByTestId('wf-speed-panel')).toHaveCount(0);
        const afterData = await page.locator('canvas').evaluate((el) => (el as HTMLCanvasElement).toDataURL());
        expect(afterData).not.toBe(beforeData);
      });
    });
  }

  test('changed: macOS Ctrl+click counts as right-click and upgrades on double Ctrl+click', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
    });
    await loadChapel(page);
    await installPausedClock(page);

    const box = await page.locator('canvas').boundingBox();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    const first = await dispatchRightGesture(page, 'macos', {
      startX: cx,
      startY: cy,
      button: 0,
      ctrlKey: true,
    });
    expect(first.contextMenuPrevented).toBe(true);
    await expect(page.getByTestId('wf-context-menu')).toBeVisible();

    await page.clock.runFor(100);
    await dispatchRightGesture(page, 'macos', {
      startX: cx + 5,
      startY: cy,
      button: 0,
      ctrlKey: true,
    });
    await expect(page.getByTestId('wf-speed-panel')).toBeVisible();
    await expect(page.getByTestId('wf-context-menu')).toHaveCount(0);
  });

  test('changed: Q key trigger opens over canvas with empty search, respects focus/input/modifier/repeat/IME/dead-key guards, and opens at centre when canvas focused', async ({ page }) => {
    await loadChapel(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();

    // Hover canvas and press Q -> opens Speed Panel with focused empty search box
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.keyboard.press('q');
    await expect(page.getByTestId('wf-speed-panel')).toBeVisible();
    const search = page.getByTestId('wf-speed-panel-search');
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('');

    // Repeat while closed does not open; Escape closes
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('wf-speed-panel')).toHaveCount(0);

    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q', repeat: true, bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q', ctrlKey: true, bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q', shiftKey: true, bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q', altKey: true, bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q', isComposing: true, bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'Dead', bubbles: true, cancelable: true }));
    });
    await expect(page.getByTestId('wf-speed-panel')).toHaveCount(0);

    // Does not open when hovering over sidebar
    await page.mouse.move(40, 180);
    await page.keyboard.press('q');
    await expect(page.getByTestId('wf-speed-panel')).toHaveCount(0);

    // Does not open when a visible text input is focused — EVEN while pointer hovers the canvas
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    const filterInput = page.locator('input:visible').first();
    await filterInput.focus();
    await page.keyboard.press('q');
    await expect(page.getByTestId('wf-speed-panel')).toHaveCount(0);

    // Move pointer off canvas, focus canvas with nothing selected -> Q opens near canvas centre
    await page.mouse.move(40, 180);
    await canvas.focus();
    await page.keyboard.press('q');
    const panel = page.getByTestId('wf-speed-panel');
    await expect(panel).toBeVisible();
    await expect(search).toHaveValue('');
    const panelBox = await panel.boundingBox();
    expect(panelBox).toBeTruthy();
    const expectedCentreX = box!.x + Math.min(Math.round(box!.width / 2), Math.max(4, box!.width - panelBox!.width - 4));
    const expectedCentreY = box!.y + Math.min(Math.round(box!.height / 2), Math.max(4, box!.height - panelBox!.height - 4));
    expect(Math.abs(panelBox!.x - expectedCentreX)).toBeLessThanOrEqual(4);
    expect(Math.abs(panelBox!.y - expectedCentreY)).toBeLessThanOrEqual(4);
    // Global empty-canvas actions are present
    await expect(panel).toContainText('New Zone');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);

    // Select a zone ("Chapel Alcove" sits left/above map centre), keep pointer off canvas, focus canvas -> Q opens at selection's centre
    await page.mouse.click(box!.x + box!.width / 2 - box!.height * 0.22, box!.y + box!.height / 2 - box!.height * 0.11);
    await expect(page.getByText('Zone Properties')).toBeVisible();
    await page.mouse.move(40, 180);
    await canvas.evaluate((el) => (el as HTMLElement).blur());
    await canvas.focus();
    await page.keyboard.press('q');
    await expect(panel).toBeVisible();
    const selPanelBox = await panel.boundingBox();
    expect(selPanelBox).toBeTruthy();
    // Speed Panel shows zone context actions and anchors at the selected zone's left-shifted centroid rather than canvas centre
    await expect(panel).toContainText('Assign District');
    expect(selPanelBox!.x).toBeLessThan(expectedCentreX - 20);
  });

  test('changed: real page.mouse right-button down/up opens compact menu immediately and upgrades on second real click', async ({ page }) => {
    await loadChapel(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: 'right' });
    await expect(page.getByTestId('wf-context-menu')).toBeVisible();
    await expect(page.getByTestId('wf-speed-panel')).toHaveCount(0);

    await page.mouse.move(cx + 4, cy + 2);
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: 'right' });
    await expect(page.getByTestId('wf-speed-panel')).toBeVisible();
    await expect(page.getByTestId('wf-context-menu')).toHaveCount(0);
  });

  test('changed: Options refuses clashing keys, allows multi-digit numeric editing, persists switches, and updates compact menu footer', async ({ page }) => {
    await loadChapel(page);

    await page.getByTestId('wf-options-btn').click();
    await expect(page.getByTestId('wf-options-modal')).toBeVisible();

    // Refuses V (tool key) and Space (canvas pan) with clear reason and aria-invalid / aria-describedby
    const keyField = page.getByTestId('wf-opt-trigger-key');
    await keyField.focus();
    await expect(keyField).not.toHaveAttribute('aria-invalid', 'true');
    await page.keyboard.press('v');
    await expect(page.getByTestId('wf-opt-trigger-key-error')).toContainText(/Select|already used/i);
    await expect(keyField).toHaveAttribute('aria-invalid', 'true');
    await expect(keyField).toHaveAttribute('aria-describedby', 'wf-opt-trigger-key-error');
    await expect(keyField).toHaveValue('Q');

    await page.keyboard.press(' ');
    await expect(page.getByTestId('wf-opt-trigger-key-error')).toContainText(/Space/i);
    await expect(keyField).toHaveValue('Q');

    // Change trigger key to K clears error and aria attributes
    await page.keyboard.press('k');
    await expect(page.getByTestId('wf-opt-trigger-key-error')).toHaveCount(0);
    await expect(keyField).not.toHaveAttribute('aria-invalid', 'true');
    await expect(keyField).toHaveValue('K');

    // Multi-digit numeric threshold fields can be typed without immediate mid-typing clamping; Escape reverts, Enter/blur commits
    const driftInput = page.getByTestId('wf-opt-click-drift');
    const radiusInput = page.getByTestId('wf-opt-dbl-radius');
    const windowInput = page.getByTestId('wf-opt-dbl-window');

    await driftInput.fill('9');
    await driftInput.press('Escape');
    await expect(page.getByTestId('wf-options-modal')).toBeVisible();
    await expect(driftInput).toHaveValue('6');

    await driftInput.fill('12');
    await driftInput.press('Enter');
    await expect(driftInput).toHaveValue('12');

    await radiusInput.fill('35');
    await radiusInput.blur();
    await expect(radiusInput).toHaveValue('35');

    await windowInput.fill('999');
    await windowInput.press('Enter');
    await expect(windowInput).toHaveValue('500');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('wf-options-modal')).toHaveCount(0);

    // Old Q no longer opens; K opens; footer shows K
    const box = await page.locator('canvas').boundingBox();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    await page.mouse.move(cx, cy);
    await page.keyboard.press('q');
    await expect(page.getByTestId('wf-speed-panel')).toHaveCount(0);

    await dispatchRightGesture(page, 'windows', { startX: cx, startY: cy });
    await expect(page.getByTestId('wf-context-menu-footer')).toHaveText('Speed Panel — K / 2×Right-Click');

    await page.mouse.click(cx - 80, cy - 80);
    await page.keyboard.press('k');
    await expect(page.getByTestId('wf-speed-panel')).toBeVisible();
    await expect(page.getByTestId('wf-speed-panel-search')).toHaveValue('');
    await page.keyboard.press('Escape');

    // Disable key trigger -> removed from footer and K disabled
    await page.getByTestId('wf-options-btn').click();
    await page.getByTestId('wf-opt-key-trigger-enabled').uncheck();
    await page.keyboard.press('Escape');

    await page.mouse.move(cx, cy);
    await page.keyboard.press('k');
    await expect(page.getByTestId('wf-speed-panel')).toHaveCount(0);

    await dispatchRightGesture(page, 'windows', { startX: cx, startY: cy });
    await expect(page.getByTestId('wf-context-menu-footer')).toHaveText('Speed Panel — 2×Right-Click');
    await page.mouse.click(cx - 80, cy - 80);

    // Disable double right-click -> second right-click keeps compact menu and footer drops 2×Right-Click
    await page.getByTestId('wf-options-btn').click();
    await page.getByTestId('wf-opt-dbl-right-enabled').uncheck();
    await page.keyboard.press('Escape');

    await installPausedClock(page);
    await dispatchRightGesture(page, 'windows', { startX: cx, startY: cy });
    await expect(page.getByTestId('wf-context-menu')).toBeVisible();
    await expect(page.getByTestId('wf-context-menu-footer')).toHaveText('Speed Panel');
    await page.clock.runFor(100);
    await dispatchRightGesture(page, 'windows', { startX: cx, startY: cy });
    await expect(page.getByTestId('wf-context-menu')).toBeVisible();
    await expect(page.getByTestId('wf-speed-panel')).toHaveCount(0);
  });
});
