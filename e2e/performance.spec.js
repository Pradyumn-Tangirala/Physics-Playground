// Performance and resource checks in a real browser (Chromium).
//
// - Frame time: the wave renderers publish their own smoothed frame time on
//   the canvas (data-frame-ms). The budgets are generous (CI machines are
//   slow) but would catch a regression to the pre-optimisation numbers.
// - Animation loops: a counter wrapped around requestAnimationFrame shows how
//   many loops are alive; it must stay at one per page however often the
//   user navigates.
// - Memory: JS heap after 20 navigation round trips, after forcing garbage
//   collection, must not keep growing.
//
// This file runs in its own Playwright project, after the functional tests
// and one test at a time (see playwright.config.js).

import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

test.describe.configure({ mode: 'serial' });

/** Saves one measurement to test-results/perf-<name>.json (one file per test, so parallel runs never clobber each other). */
function record(name, data) {
    mkdirSync('test-results', { recursive: true });
    writeFileSync(`test-results/perf-${name}.json`, JSON.stringify(data, null, 2));
}

async function frameStats(page, name) {
    const canvas = page.getByRole('img', { name });
    await expect(canvas).toHaveAttribute('data-frame-ms', /\d/, { timeout: 10_000 });
    await page.waitForTimeout(2000); // let the smoothed value settle
    return canvas.evaluate((c) => ({ ...c.dataset }));
}

test('analytical wave renderer: frame time within budget', async ({ page }) => {
    await page.goto('#/simulation');
    // Rebuild the field twice so the precompute is measured warm, not on the first (cold JIT) call.
    const lambda = page.getByRole('spinbutton', { name: /wavelength/i });
    for (const v of ['21', '20']) {
        await lambda.fill(v);
        await lambda.press('Enter');
        await page.waitForTimeout(200);
    }
    const stats = await frameStats(page, /wave field/i);
    record('analytical-wave', stats);
    expect(Number(stats.frameMs)).toBeLessThan(16); // a 60 fps frame; measured ≈ 5 ms
    expect(Number(stats.precomputeMs)).toBeLessThan(120); // measured 8–15 ms (was 24 ms before the kernel method)
});

test('FDTD solver: step and draw time within budget', async ({ page }) => {
    await page.goto('#/waves/fdtd');
    const stats = await frameStats(page, /fdtd wave field/i);
    record('fdtd', stats);
    // 3 steps per frame must fit with the draw in about one 60 fps frame.
    expect(Number(stats.stepMs)).toBeLessThan(5); // measured ≈ 1–2 ms (was ≈ 3.2 ms before optimisation)
    expect(Number(stats.frameMs)).toBeLessThan(25);
});

test.describe('no leaks across repeated navigation', () => {
    test.beforeEach(async ({ page }) => {
        // Count pending animation-frame callbacks: one per live animation loop.
        await page.addInitScript(() => {
            const raf = window.requestAnimationFrame.bind(window);
            const caf = window.cancelAnimationFrame.bind(window);
            const pending = new Set();
            window.__pendingFrames = () => pending.size;
            window.requestAnimationFrame = (cb) => {
                const id = raf((t) => { pending.delete(id); cb(t); });
                pending.add(id);
                return id;
            };
            window.cancelAnimationFrame = (id) => { pending.delete(id); caf(id); };
        });
    });

    const tour = ['#/shm', '#/numerical-methods', '#/simulation', '#/waves/fdtd', '#/projectile', '#/'];

    async function navigate(page, hash) {
        await page.evaluate((h) => { window.location.hash = h; }, hash);
        await page.waitForTimeout(150);
    }

    test('exactly one animation loop is alive after every navigation', async ({ page }) => {
        await page.goto('');
        for (let round = 0; round < 3; round++) {
            for (const hash of tour) {
                await navigate(page, hash);
                await expect.poll(() => page.evaluate(() => window.__pendingFrames())).toBe(1);
            }
        }
    });

    test('JS heap does not keep growing over 20 navigation round trips', async ({ page }) => {
        test.setTimeout(90_000);
        const cdp = await page.context().newCDPSession(page);
        const heapAfterGC = async () => {
            await cdp.send('HeapProfiler.collectGarbage');
            await page.waitForTimeout(100);
            return (await cdp.send('Runtime.getHeapUsage')).usedSize;
        };
        await page.goto('');
        for (const hash of tour) await navigate(page, hash); // warm up every page once
        const baseline = await heapAfterGC();
        for (let round = 0; round < 20; round++) {
            for (const hash of tour) await navigate(page, hash);
        }
        const after = await heapAfterGC();
        record('heap', { baselineMB: baseline / 1e6, afterMB: after / 1e6, growthMB: (after - baseline) / 1e6 });
        // The FDTD page alone allocates ~5 MB of grid; 20 leaked copies would be 100 MB.
        expect(after - baseline).toBeLessThan(15e6);
    });
});
