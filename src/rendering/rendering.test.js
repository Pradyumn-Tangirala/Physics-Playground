import { describe, it, expect } from 'vitest';
import { fitScale } from './camera';
import { buildFieldLut, LUT_HALF } from './colorThemes';
import { projectileCamera, sceneExtent } from './projectileRenderer';
import { predictFlights } from '../simulation/projectileSimulation';

describe('projectile camera', () => {
    const W = 1400;
    const H = 520;
    const idle = { phase: 'idle', runs: [] };
    const base = {
        mode: 'compare', velocity: 60, angleDeg: 45, height: 0, gravity: 9.8,
        rho: 1.225, cd: 0.47, area: 0.0042, mass: 0.145, integrator: 'rk4', dt: 0.01,
    };

    it.each([
        ['default', {}],
        ['max range', { velocity: 100, gravity: 1 }],
        ['vertical, low g', { velocity: 100, angleDeg: 90, gravity: 1 }],
        ['flat', { velocity: 10, angleDeg: 0, gravity: 25 }],
        ['flat from a tower', { velocity: 10, angleDeg: 0, height: 100 }],
        ['slow, steep, heavy', { velocity: 10, angleDeg: 89, gravity: 25 }],
        ['coarse Euler overshoot', { integrator: 'euler', dt: 0.1 }],
    ])('%s: every predicted path fits the drawing area', (_, overrides) => {
        const predictions = predictFlights({ ...base, ...overrides });
        const cam = projectileCamera(W, H, sceneExtent(predictions, idle));
        expect(Number.isFinite(cam.scale)).toBe(true);
        expect(cam.scale).toBeGreaterThan(0);
        for (const p of predictions) {
            for (const [x, y] of p.path) {
                expect(x * cam.scale).toBeLessThanOrEqual(cam.availW + 1e-6);
                expect(y * cam.scale).toBeLessThanOrEqual(cam.availH + 1e-6);
            }
        }
    });

    it('fits both the landed shot and the next preview', () => {
        const landed = { phase: 'landed', runs: [{ id: 'analytic', trail: [[0, 0], [1000, 250], [2000, 0]], diverged: false }] };
        const cam = projectileCamera(W, H, sceneExtent(predictFlights({ ...base, velocity: 10 }), landed));
        expect(2000 * cam.scale).toBeLessThanOrEqual(cam.availW + 1e-6);
    });

    it('ignores diverged paths', () => {
        const extent = sceneExtent([{ id: 'drag', diverged: true, path: [[1e300, 1e300]] }, { id: 'analytic', diverged: false, path: [[0, 0], [50, 10]] }], idle);
        expect(extent).toEqual({ x: 50, y: 10 });
    });

    it('fitScale caps the zoom for tiny scenes', () => {
        expect(fitScale(0, 0, 1000, 1000)).toBe(40);
    });
});

describe('buildFieldLut', () => {
    it('maps zero amplitude to black and saturates at the ends', () => {
        const lut = buildFieldLut('grayscale');
        const at = (q) => Array.from(lut.slice((q + LUT_HALF) * 3, (q + LUT_HALF) * 3 + 3));
        expect(at(0)).toEqual([0, 0, 0]);
        expect(at(LUT_HALF)).toEqual([255, 255, 255]);
        expect(at(-LUT_HALF)).toEqual([255, 255, 255]);
    });
});
