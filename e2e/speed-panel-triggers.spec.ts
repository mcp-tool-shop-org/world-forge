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

    // Does not open when a visible text input is focused
    const filterInput = page.locator('input:visible').first();
    await filterInput.focus();
    await page.keyboard.press('q');
    await expect(page.getByTestId('wf-speed-panel')).toHaveCount(0);

    // With canvas focused via keyboard and no pointer over it, Q opens at centre/selection
    await canvas.focus();
    await page.keyboard.press('q');
    await expect(page.getByTestId('wf-speed-panel')).toBeVisible();
    await expect(search).toHaveValue('');
  });

  test('changed: Options refuses clashing keys, persists changed key/switches, and updates compact menu footer', async ({ page }) => {
    await loadChapel(page);

    await page.getByTestId('wf-options-btn').click();
    await expect(page.getByTestId('wf-options-modal')).toBeVisible();

    // Refuses V (tool key) and Space (canvas pan) with clear reason
    const keyField = page.getByTestId('wf-opt-trigger-key');
    await keyField.focus();
    await page.keyboard.press('v');
    await expect(page.getByTestId('wf-opt-trigger-key-error')).toContainText(/Select|already used/i);
    await expect(keyField).toHaveValue('Q');

    await page.keyboard.press(' ');
    await expect(page.getByTestId('wf-opt-trigger-key-error')).toContainText(/Space/i);
    await expect(keyField).toHaveValue('Q');

    // Change trigger key to K
    await page.keyboard.press('k');
    await expect(page.getByTestId('wf-opt-trigger-key-error')).toHaveCount(0);
    await expect(keyField).toHaveValue('K');
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
