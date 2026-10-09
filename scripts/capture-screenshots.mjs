// Captures the README screenshots from the production build.
//
//   npm run build && npm run preview      (in one terminal)
//   node scripts/capture-screenshots.mjs  (in another)
//
// Writes PNGs to docs/screenshots/. Uses Playwright's Chromium, which the E2E
// tests already install. Override the address with SCREENSHOT_BASE.

import { mkdirSync } from 'node:fs';
import { chromium, devices } from '@playwright/test';

const BASE = process.env.SCREENSHOT_BASE ?? 'http://localhost:4173/Physics-Playground/';
const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

async function shot(name, hash, prepare, { element, fullPage = false } = {}) {
    const page = await desktop.newPage();
    await page.goto(BASE + hash);
    await prepare?.(page);
    const target = element ? page.locator(element).first() : page;
    if (element) await target.scrollIntoViewIfNeeded();
    await target.screenshot({ path: `${OUT}/${name}.png`, ...(element ? {} : { fullPage }) });
    await page.close();
    console.log(`${OUT}/${name}.png`);
}

const wait = (ms) => (page) => page.waitForTimeout(ms);

await shot('landing', '#/', wait(1500));
await shot('oscillator-lab', '#/shm?mode=pendulum&angle=60&length=2&g=9.81&amplitude=1&mass=2&k=10&damping=0&method=rk4&dt=0.005', wait(5000));
await shot('numerical-methods-lab', '#/numerical-methods?angle=60&length=1&g=9.81&damping=0&dt=0.05&show=euler,symplectic,rk4', wait(8000));
await shot('accuracy-vs-cost', '#/numerical-methods', async (page) => {
    await page.getByRole('button', { name: 'Run accuracy vs cost' }).click();
    // The study runs on a Web Worker; wait for its table, then for the chart to redraw.
    await page.getByRole('region', { name: 'Accuracy and cost per method and timestep' }).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(300);
}, { element: 'section[aria-labelledby="cost-title"]' });
await shot('projectile-lab', '#/projectile?mode=compare&v=60&angle=45&h=0&g=9.81&rho=1.225&cd=0.47&area=0.0042&mass=0.145&method=rk4&dt=0.01&speed=10', async (page) => {
    await page.getByRole('button', { name: 'FIRE' }).click();
    await page.getByRole('button', { name: 'FIRE' }).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(300);
});
await shot('projectile-validation', '#/projectile', wait(500), { element: 'section[aria-labelledby="validation-title"]' });
await shot('wave-interference', '#/simulation', wait(2500));
await shot('wave-screen-pattern', '#/simulation?setup=laser&mode=double&wavelength=6e-7&separation=0.0002&width=0.00004&distance=1&c=299800000&phase=0&a1=1&a2=1&view=intensity', wait(1500),
    { element: 'section[aria-labelledby="screen-title"]' });
await shot('fdtd-lab', '#/waves/fdtd', wait(9000));
await shot('guided-experiments', '#/experiments', wait(500));
await shot('solver-simulate-this', '#/shm/problems', async (page) => {
    await page.getByLabel('Release angle (θ₀) [deg]').fill('40');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await page.waitForTimeout(300);
});

const phone = await browser.newContext({ ...devices['Pixel 7'] });
const page = await phone.newPage();
await page.goto(`${BASE}#/shm`);
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/phone-oscillator.png` });
console.log(`${OUT}/phone-oscillator.png`);

await browser.close();
