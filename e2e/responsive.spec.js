// Layout at the viewport of each project (desktop, phone, tablet): nothing may
// force horizontal scrolling, and the key controls must be on screen and big
// enough to use.

import { test, expect } from '@playwright/test';
import { ROUTES } from './helpers';

for (const { hash, heading } of ROUTES) {
    test(`${hash}: no horizontal overflow`, async ({ page }) => {
        await page.goto(hash);
        await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
        await page.waitForTimeout(200);
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    });
}

test('oscillator lab: the canvas comes first and the controls follow on narrow screens', async ({ page, viewport }) => {
    await page.goto('#/shm');
    const canvas = await page.getByRole('img', { name: 'Pendulum simulation' }).boundingBox();
    const panel = await page.getByRole('complementary', { name: /oscillator lab controls/i }).boundingBox();
    if (viewport.width < 900) {
        expect(panel.y).toBeGreaterThanOrEqual(canvas.y + canvas.height - 1); // stacked
        expect(canvas.width).toBeGreaterThan(viewport.width - 2); // full width
        expect(canvas.height).toBeGreaterThan(400); // still a usable stage
    } else {
        expect(panel.x).toBeGreaterThanOrEqual(canvas.x + canvas.width - 1); // side by side
    }
});

test('landing cards fit the screen and their buttons are large enough to tap', async ({ page, viewport }) => {
    await page.goto('');
    const button = page.getByRole('button', { name: 'Launch Projectile Motion' });
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
});
