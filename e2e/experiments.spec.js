// Experiment sharing and data export in a real browser: links reproduce
// experiments, the clipboard receives the link, CSV files download, and the
// Back button returns to the previous experiment.

import { test, expect } from '@playwright/test';

const field = (page, name) => page.getByRole('spinbutton', { name: new RegExp(`^${name} value`, 'i') });

test('an experiment link opens the exact experiment', async ({ page }) => {
    await page.goto('#/projectile?mode=compare&v=35&angle=30&h=10&g=9.81&rho=0&method=euler&dt=0.02');
    await expect(page.getByRole('heading', { name: 'Projectile Lab' })).toBeVisible();
    await expect(field(page, 'Initial velocity v₀')).toHaveValue('35');
    await expect(field(page, 'Launch angle θ')).toHaveValue('30');
    await expect(field(page, 'Launch height y₀')).toHaveValue('10');
    await expect(page.getByLabel('Integrator')).toHaveValue('euler');
    await expect(page.getByLabel('Timestep Δt')).toHaveValue('0.02');
});

test('changes are written into the address, and survive a reload', async ({ page }) => {
    await page.goto('#/numerical-methods');
    await page.getByLabel('Timestep Δt').selectOption('0.05');
    await expect(page).toHaveURL(/#\/numerical-methods\?.*dt=0\.05/);
    await page.reload();
    await expect(page.getByLabel('Timestep Δt')).toHaveValue('0.05');
});

test('guided experiments load from the list, and Back returns to the previous one', async ({ page }) => {
    await page.goto('#/experiments');
    await page.getByRole('link', { name: 'Open experiment: Small-angle pendulum' }).click();
    await expect(field(page, 'Start Angle')).toHaveValue('5');
    await page.getByLabel('Guided experiment').selectOption('nonlinear-pendulum');
    await expect(field(page, 'Start Angle')).toHaveValue('90');
    await expect(page.locator('p', { hasText: 'Look for:' })).toContainText('18% longer');
    await page.goBack();
    await expect(field(page, 'Start Angle')).toHaveValue('5');
});

test.describe('clipboard', () => {
    test.skip(({ browserName }) => browserName !== 'chromium', 'clipboard permissions can only be granted in Chromium');

    test('Copy Experiment Link puts a working link on the clipboard', async ({ page, context }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await page.goto('#/shm?mode=spring&k=30');
        await page.getByRole('button', { name: 'Copy Experiment Link' }).click();
        await expect(page.getByText('Link copied to the clipboard.')).toBeVisible();
        const link = await page.evaluate(() => navigator.clipboard.readText());
        expect(link).toMatch(/\/Physics-Playground\/#\/shm\?mode=spring&.*k=30/);
        await page.goto(link);
        await expect(field(page, 'Spring Constant \\(k\\)')).toHaveValue('30');
    });
});

test('data logging records samples and exports a CSV file', async ({ page }) => {
    await page.goto('#/shm');
    const panel = page.getByRole('region', { name: 'Data logging' });
    await panel.getByRole('button', { name: '● Start logging' }).click();
    await expect(panel.getByText(/rows stored/)).toContainText(/[1-9]\d{2,} rows/); // hundreds of steps
    await panel.getByRole('button', { name: '■ Stop logging' }).click();
    const download = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Export CSV' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^oscillator-pendulum-rk4-.*\.csv$/);
    const text = await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString('utf8'));
    expect(text).toContain('run,t (s),θ (rad),ω (rad/s),KE (J),PE (J),E (J),method');
});

test('a solved problem opens in its lab with "Simulate this"', async ({ page }) => {
    await page.goto('#/shm/problems');
    await page.getByLabel('Length (L) [m]').fill('1.5');
    await page.getByLabel('Release angle (θ₀) [deg]').fill('40');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await page.getByRole('link', { name: 'Simulate this →' }).click();
    await expect(page.getByRole('heading', { name: 'Oscillator Lab' })).toBeVisible();
    await expect(field(page, 'Length L')).toHaveValue('1.50');
    await expect(field(page, 'Start Angle')).toHaveValue('40');
});

test('the accuracy-vs-cost study runs on a Web Worker while the page keeps animating', async ({ page }) => {
    const workers = [];
    page.on('worker', (worker) => workers.push(worker.url()));
    await page.goto('#/numerical-methods');
    await page.evaluate(() => {
        window.__longestFrameGap = 0;
        let last = null;
        const watch = (now) => {
            if (last !== null) window.__longestFrameGap = Math.max(window.__longestFrameGap, now - last);
            last = now;
            requestAnimationFrame(watch);
        };
        requestAnimationFrame(watch);
    });
    await page.waitForTimeout(500); // let the page settle before measuring
    await page.evaluate(() => { window.__longestFrameGap = 0; });
    await page.getByRole('button', { name: 'Run accuracy vs cost' }).click();
    const table = page.getByRole('region', { name: 'Accuracy and cost per method and timestep' });
    await expect(table.getByRole('row')).toHaveCount(1 + 8, { timeout: 20_000 });
    await expect(table).toContainText('7.30×10⁻⁴ · 400'); // RK4 at Δt = 100 ms, the same as on the main thread
    expect(workers.some((url) => /studyWorker/.test(url))).toBe(true);
    const gap = await page.evaluate(() => window.__longestFrameGap);
    test.info().annotations.push({ type: 'longest frame gap (ms)', description: gap.toFixed(1) });
    // Measured on the development machine: 33 ms with the worker; 167 ms when the
    // same study runs on the main thread (Worker removed), which this would catch.
    expect(gap).toBeLessThan(100);
});
