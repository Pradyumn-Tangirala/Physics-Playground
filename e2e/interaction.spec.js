// Direct manipulation with every pointer type: drag the pendulum bob with a
// mouse, a finger and a pen. The page uses Pointer Events with
// setPointerCapture, so all three go through the same code path.

import { test, expect } from '@playwright/test';
import { oscillatorLayout } from '../src/rendering/oscillatorLayout.js';

/** Centre (page coordinates) of the yellow bob, found from the canvas pixels. */
async function bobCentre(page) {
    const canvas = page.getByRole('img', { name: 'Pendulum simulation' });
    const box = await canvas.boundingBox();
    // Search only above the graphs, which are also drawn in yellow.
    const { stripTop } = oscillatorLayout(box.width, box.height);
    const local = await canvas.evaluate((c, cssTop) => {
        const ctx = c.getContext('2d');
        const h = Math.floor(cssTop * (Number(c.dataset.dpr) || 1));
        const { data } = ctx.getImageData(0, 0, c.width, h);
        let sx = 0;
        let sy = 0;
        let n = 0;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < c.width; x++) {
                const i = (y * c.width + x) * 4;
                if (data[i] > 200 && data[i + 1] > 160 && data[i + 2] < 90) { sx += x; sy += y; n++; }
            }
        }
        const dpr = Number(c.dataset.dpr) || 1;
        return { x: sx / n / dpr, y: sy / n / dpr };
    }, stripTop);
    return { x: box.x + local.x, y: box.y + local.y };
}

const angleField = (page) => page.getByRole('spinbutton', { name: /start angle value/i });
const lengthField = (page) => page.getByRole('spinbutton', { name: /length l value/i });

async function prepare(page) {
    await page.goto('#/shm');
    await page.getByRole('button', { name: /pause/i }).click(); // hold still while we find the bob
    // On phones the controls sit below the canvas, so clicking Pause scrolled it away.
    await page.getByRole('img', { name: 'Pendulum simulation' }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    const start = await bobCentre(page);
    return { start, angle: await angleField(page).inputValue(), length: await lengthField(page).inputValue() };
}

test('mouse: dragging the bob sets the release angle and length', async ({ page }) => {
    const { start, angle } = await prepare(page);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 120, start.y - 10, { steps: 8 });
    await page.mouse.up();
    await expect(angleField(page)).not.toHaveValue(angle);
    expect(Number(await angleField(page).inputValue())).toBeLessThan(Number(angle)); // dragged to the left
    await expect(page.getByRole('button', { name: /pause/i })).toBeVisible(); // letting go releases the bob
});

test.describe('touch and pen (Chromium input pipeline)', () => {
    test.skip(({ browserName }) => browserName !== 'chromium', 'synthesised touch/pen input needs the Chromium DevTools protocol');

    test('touch: a finger drag moves the bob', async ({ page }) => {
        const { start, angle } = await prepare(page);
        const cdp = await page.context().newCDPSession(page);
        const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
            type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
        });
        await touch('touchStart', start.x, start.y);
        for (let i = 1; i <= 8; i++) await touch('touchMove', start.x + 15 * i, start.y);
        await touch('touchEnd');
        await expect(angleField(page)).not.toHaveValue(angle);
        expect(Number(await angleField(page).inputValue())).toBeGreaterThan(Number(angle)); // dragged to the right
    });

    test('pen: a stylus drag moves the bob and changes the length', async ({ page }) => {
        const { start, length } = await prepare(page);
        const cdp = await page.context().newCDPSession(page);
        const pen = (type, x, y, buttons) => cdp.send('Input.dispatchMouseEvent', {
            type, x, y, button: 'left', buttons, clickCount: 1, pointerType: 'pen',
        });
        await pen('mousePressed', start.x, start.y, 1);
        for (let i = 1; i <= 8; i++) await pen('mouseMoved', start.x, start.y - 8 * i, 1);
        await pen('mouseReleased', start.x, start.y - 64, 0);
        await expect(lengthField(page)).not.toHaveValue(length);
        expect(Number(await lengthField(page).inputValue())).toBeLessThan(Number(length)); // dragged towards the pivot
    });
});
