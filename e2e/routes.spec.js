import { test, expect } from '@playwright/test';
import { ROUTES, watchForErrors } from './helpers';

test.describe('every route loads in the production build', () => {
    for (const { hash, heading } of ROUTES) {
        test(`${hash}`, async ({ page }) => {
            const errors = watchForErrors(page);
            await page.goto(hash);
            await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
            await page.waitForTimeout(300); // let a few frames render
            expect(errors).toEqual([]);
        });
    }
});

test.describe('production base path', () => {
    test('the app and its assets are served under /Physics-Playground/', async ({ page }) => {
        const assets = [];
        page.on('response', (res) => { if (/\.(js|css)$/.test(new URL(res.url()).pathname)) assets.push(res); });
        await page.goto('');
        await expect(page.getByRole('heading', { name: /THE PHYSICS/i })).toBeVisible();
        expect(assets.length).toBeGreaterThan(0);
        for (const res of assets) {
            expect(new URL(res.url()).pathname.startsWith('/Physics-Playground/assets/')).toBe(true);
            expect(res.status()).toBe(200);
        }
    });

    test('a deep link loads directly (hash routing needs no server rewrites)', async ({ page }) => {
        await page.goto('#/numerical-methods');
        await expect(page.getByRole('heading', { name: 'Numerical Methods Lab' })).toBeVisible();
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Numerical Methods Lab' })).toBeVisible();
    });

    test('the served HTML points at assets under the base path', async ({ request }) => {
        const html = await (await request.get('')).text();
        const srcs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1]);
        expect(srcs.length).toBeGreaterThan(0);
        for (const src of srcs) expect(src.startsWith('/Physics-Playground/assets/')).toBe(true);
    });
});

test.describe('Home navigation', () => {
    const cards = [
        ['Launch Projectile Motion', 'Projectile Lab'],
        ['Launch Harmonic Motion', 'Oscillator Lab'],
        ['Launch Wave Interference', 'Wave Interference: analytical model'],
        ['Launch Wave Equation Lab', 'Numerical Wave Equation Lab (FDTD)'],
        ['Launch Numerical Methods Lab', 'Numerical Methods Lab'],
        ['Projectile Motion problem solver', 'Projectile Solver'],
        ['Harmonic Motion problem solver', 'Pendulum Solver'],
        ['Wave Interference problem solver', 'Double-Slit Solver'],
    ];
    for (const [button, heading] of cards) {
        test(`"${button}" opens the page and Home comes back`, async ({ page }) => {
            await page.goto('');
            await page.getByRole('button', { name: button }).click();
            await expect(page.getByRole('heading', { name: heading })).toBeVisible();
            await page.getByRole('button', { name: /home/i }).click();
            await expect(page).toHaveURL(/#\/$/);
            await expect(page.getByRole('heading', { name: /THE PHYSICS/i })).toBeVisible();
        });
    }
});
