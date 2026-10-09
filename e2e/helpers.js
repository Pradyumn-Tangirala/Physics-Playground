// Shared helpers for the end-to-end tests.

import { expect } from '@playwright/test';

export const ROUTES = [
    { hash: '#/', heading: /THE PHYSICS/i },
    { hash: '#/projectile', heading: 'Projectile Lab' },
    { hash: '#/projectile/problems', heading: 'Projectile Solver' },
    { hash: '#/shm', heading: 'Oscillator Lab' },
    { hash: '#/shm/problems', heading: 'Pendulum Solver' },
    { hash: '#/simulation', heading: 'Wave Interference: analytical model' },
    { hash: '#/problems', heading: 'Double-Slit Solver' },
    { hash: '#/waves/fdtd', heading: 'Numerical Wave Equation Lab (FDTD)' },
    { hash: '#/numerical-methods', heading: 'Numerical Methods Lab' },
    { hash: '#/experiments', heading: 'Guided experiments' },
];

/** Collects console errors, uncaught exceptions and failed requests while a test runs. */
export function watchForErrors(page) {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('response', (res) => { if (res.status() >= 400) errors.push(`HTTP ${res.status()} ${res.url()}`); });
    return errors;
}

/**
 * A cheap fingerprint of what a canvas currently shows: a hash of every 97th
 * byte of its pixels. Two equal fingerprints mean the picture did not change.
 * The top and bottom 30 CSS px are left out: some canvases print live
 * measurements there (frame time), which change even when the scene does not.
 */
export async function canvasFingerprint(locator) {
    return locator.evaluate((canvas) => {
        const margin = Math.ceil(30 * (Number(canvas.dataset.dpr) || 1));
        const { data } = canvas.getContext('2d').getImageData(0, margin, canvas.width, Math.max(1, canvas.height - 2 * margin));
        let hash = 0;
        for (let i = 0; i < data.length; i += 97) hash = (hash * 31 + data[i]) | 0;
        return hash;
    });
}

/** Waits until the canvas picture changes (the simulation is animating). */
export async function expectAnimating(locator) {
    const first = await canvasFingerprint(locator);
    await expect.poll(() => canvasFingerprint(locator), { timeout: 5000 }).not.toBe(first);
}

/** Asserts the canvas picture stays the same over `ms` milliseconds. */
export async function expectFrozen(page, locator, ms = 600) {
    const first = await canvasFingerprint(locator);
    await page.waitForTimeout(ms);
    expect(await canvasFingerprint(locator)).toBe(first);
}
