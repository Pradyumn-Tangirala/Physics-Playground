import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ROUTES } from './helpers';
import { canvasFingerprint } from './helpers';

test.describe('automated accessibility audit (axe-core, WCAG 2.1 A/AA)', () => {
    test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough for the audit');

    for (const { hash, heading } of ROUTES) {
        test(`${hash} has no serious or critical violations`, async ({ page }) => {
            await page.goto(hash);
            await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
            const { violations } = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .analyze();
            const serious = violations
                .filter((v) => v.impact === 'serious' || v.impact === 'critical')
                .map((v) => `${v.id}: ${v.help} (${v.nodes.length}× e.g. ${v.nodes[0].target.join(' ')})`);
            expect(serious).toEqual([]);
        });
    }
});

test.describe('keyboard', () => {
    test.skip(({ isMobile }) => isMobile, 'keyboard navigation is a desktop concern');

    test('the labs can be reached and opened with the keyboard alone', async ({ page }) => {
        await page.goto('');
        await page.getByRole('button', { name: 'Start Experimenting' }).focus();
        await page.keyboard.press('Enter');
        // Focus moved to the labs section; Tab reaches the first lab's Launch button.
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Launch Projectile Motion' })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('heading', { name: 'Projectile Lab' })).toBeVisible();
    });

    test('focus is visible on controls', async ({ page }) => {
        await page.goto('#/shm');
        await page.getByRole('button', { name: /pause/i }).focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        const outline = await page.getByRole('button', { name: /pause/i }).evaluate((el) => getComputedStyle(el).outlineStyle);
        expect(outline).not.toBe('none');
    });

    test('Space pauses and resumes the oscillator', async ({ page }) => {
        await page.goto('#/shm');
        await page.getByRole('button', { name: /pause/i }).focus();
        await page.keyboard.press('Space');
        await expect(page.getByRole('button', { name: /resume/i })).toBeFocused();
        await page.keyboard.press('Space');
        await expect(page.getByRole('button', { name: /pause/i })).toBeFocused();
    });
});

test.describe('motion', () => {
    test('the landing animation can be paused (WCAG 2.2.2)', async ({ page }) => {
        await page.goto('');
        const toggle = page.getByRole('button', { name: /pause background animation/i });
        await toggle.click();
        await expect(page.getByRole('button', { name: /play background animation/i })).toHaveAttribute('aria-pressed', 'true');
    });

    test.describe('with prefers-reduced-motion', () => {
        test.use({ reducedMotion: 'reduce' });

        test('the landing background is still and has no animation toggle', async ({ page }) => {
            await page.goto('');
            await expect(page.getByRole('button', { name: /background animation/i })).toHaveCount(0);
            const canvas = page.locator('canvas[aria-hidden="true"]');
            await page.waitForTimeout(300);
            const a = await canvasFingerprint(canvas);
            await page.waitForTimeout(600);
            expect(await canvasFingerprint(canvas)).toBe(a);
        });
    });
});
