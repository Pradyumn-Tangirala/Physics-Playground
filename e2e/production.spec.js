import { test, expect } from '@playwright/test';

const LAB_CHUNK = /\/assets\/(OscillatorLab|WaveInterferenceLab|WaveEquationLab|ProjectileLab|NumericalMethodsLab|integrators|fdtd|interference)[-.]/;

test.describe('code splitting', () => {
    test('the landing page downloads no simulation code', async ({ page }) => {
        const scripts = [];
        page.on('request', (req) => { if (req.resourceType() === 'script') scripts.push(req.url()); });
        await page.goto('');
        await expect(page.getByRole('heading', { name: /THE PHYSICS/i })).toBeVisible();
        await page.waitForLoadState('networkidle');
        expect(scripts.filter((u) => LAB_CHUNK.test(u))).toEqual([]);
    });

    test('a lab’s code is fetched when the lab is opened', async ({ page }) => {
        await page.goto('');
        const chunk = page.waitForRequest((req) => /\/assets\/OscillatorLab-/.test(req.url()));
        await page.getByRole('button', { name: 'Launch Harmonic Motion' }).click();
        await chunk;
        await expect(page.getByRole('heading', { name: 'Oscillator Lab' })).toBeVisible();
    });
});

test.describe('error recovery', () => {
    test('a lab that fails to download shows a recovery screen, and Reload recovers', async ({ page }) => {
        await page.goto('');
        await page.route(/\/assets\/OscillatorLab-.*\.js$/, (route) => route.abort());
        await page.getByRole('button', { name: 'Launch Harmonic Motion' }).click();
        const alert = page.getByRole('alert');
        await expect(alert).toContainText('This page could not be loaded');
        await expect(alert).not.toContainText(/\bat \S+ \(|\.js:\d+/); // no stack trace for users
        await page.unroute(/\/assets\/OscillatorLab-.*\.js$/);
        await page.getByRole('button', { name: 'Reload page' }).click();
        await expect(page.getByRole('heading', { name: 'Oscillator Lab' })).toBeVisible();
    });

    test('Back to home from the recovery screen', async ({ page }) => {
        await page.goto('');
        await page.route(/\/assets\/WaveEquationLab-.*\.js$/, (route) => route.abort());
        await page.getByRole('button', { name: 'Launch Wave Equation Lab' }).click();
        await page.getByRole('button', { name: 'Back to home' }).click();
        await expect(page.getByRole('heading', { name: /THE PHYSICS/i })).toBeVisible();
    });

    test('an unknown address shows a not-found page', async ({ page }) => {
        await page.goto('#/does-not-exist');
        await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    });
});

test.describe('high-DPI canvases', () => {
    test('the backing store follows devicePixelRatio (capped at 2) and stays sharp', async ({ browser }) => {
        for (const scale of [1, 2, 3]) {
            const context = await browser.newContext({ deviceScaleFactor: scale, viewport: { width: 1200, height: 800 } });
            const page = await context.newPage();
            await page.goto('#/shm');
            const canvas = page.getByRole('img', { name: 'Pendulum simulation' });
            await expect(canvas).toHaveAttribute('data-dpr', String(Math.min(scale, 2)));
            const { width, clientWidth } = await canvas.evaluate((c) => ({ width: c.width, clientWidth: c.clientWidth }));
            expect(width).toBe(Math.round(clientWidth * Math.min(scale, 2)));
            await context.close();
        }
    });
});
