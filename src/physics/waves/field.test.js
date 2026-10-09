import { describe, it, expect } from 'vitest';
import { buildField, fieldAt, intensityAt, fieldView, drawability } from './field';
import { screenPattern } from './interference';

const RIPPLE = {
    mode: 'double', wavelength: 0.02, waveSpeed: 0.25, slitSeparation: 0.1, slitWidth: 0.01,
    screenDistance: 1, phase: 0, amplitude1: 1, amplitude2: 1,
};
const LASER = { ...RIPPLE, wavelength: 632.8e-9, slitSeparation: 0.25e-3, slitWidth: 0.05e-3 };
const W = 280;
const H = 120;

describe('2-D field view (analytical)', () => {
    it('|U|² equals twice the time average of u(t)² (intensity is not the instantaneous amplitude)', () => {
        const f = buildField(RIPPLE, W, H);
        const i = 40 * W + 200;
        const N = 2000;
        let sum = 0;
        for (let n = 0; n < N; n++) sum += fieldAt(f, i, (2 * Math.PI * n) / N) ** 2;
        expect(sum / N).toBeCloseTo(intensityAt(f, i) / 2, 6);
    });

    it('is drawn to scale: the same metres per cell in x and y', () => {
        const v = fieldView(RIPPLE, W, H);
        expect(v.scale).toBeCloseTo((v.x1 - v.x0) / W, 15);
        expect(v.yHalf).toBeCloseTo((v.scale * H) / 2, 15);
        expect(v.cellsPerWavelength).toBeCloseTo(RIPPLE.wavelength / v.scale, 12);
    });

    it('wavelength in the picture: the phase advances by 2π per λ along the axis', () => {
        const f = buildField({ ...RIPPLE, mode: 'single', slitWidth: 0 }, W, H + 1);
        const { scale, x0 } = f.view;
        const row = H / 2; // the axis
        const phase = (col) => Math.atan2(f.im[row * W + col], f.re[row * W + col]);
        const col1 = Math.round((0.3 - x0) / scale);
        const col2 = col1 + Math.round(RIPPLE.wavelength / scale);
        const dx = (col2 - col1) * scale;
        let dphi = phase(col2) - phase(col1);
        dphi -= 2 * Math.PI * Math.round(dphi / (2 * Math.PI) - dx / RIPPLE.wavelength);
        expect(dphi).toBeCloseTo((2 * Math.PI * dx) / RIPPLE.wavelength, 6);
    });

    it('agrees with the screen calculation at the right-hand edge (x ≈ D)', () => {
        const setup = { ...RIPPLE, slitWidth: 0 }; // one point source per slit
        const f = buildField(setup, W, H + 1);
        // The field view puts its sources on row centres; use the same positions for the screen calculation.
        const snapped = { ...setup, slitSeparation: f.openings[0].center - f.openings[1].center };
        const lastX = f.view.x0 + (W - 0.5) * f.view.scale;
        const row = 10;
        const y = (H / 2 - row) * f.view.scale;
        const { intensity } = screenPattern({ ...snapped, screenDistance: lastX }, y, 2);
        // Same geometry; only the √(D/r) normalisation differs (D here vs the column's x there).
        expect(intensityAt(f, row * W + W - 1) * (lastX / setup.screenDistance)).toBeCloseTo(intensity[1], 4);
    });

    it('precomputes quickly: one kernel, then a multiply-add per source per cell', () => {
        const wide = { ...RIPPLE, wavelength: 0.005, slitWidth: 0.06 };
        const t0 = performance.now();
        const f = buildField(wide, 495, 211);
        expect(f.openings[0].rows.length).toBeGreaterThan(20); // many sub-sources per slit
        expect(performance.now() - t0).toBeLessThan(500); // generous bound for slow CI machines
    });

    it('the barrier blocks everything except the slits', () => {
        const f = buildField(RIPPLE, W, H);
        const col = Math.floor((-f.view.x0) / f.view.scale) - 1; // inside the wall
        const blocked = Array.from({ length: H }, (_, r) => f.wall[r * W + col]);
        expect(blocked.filter((b) => b === 0).length).toBeGreaterThan(0);
        expect(blocked.filter((b) => b === 1).length).toBeGreaterThan(H * 0.8);
    });

    it('refuses to draw optical scales instead of aliasing', () => {
        const f = buildField(LASER, W, H);
        expect(f.drawable).toEqual({ field: false, intensity: false });
        // Even when the far-field pattern is wide enough to see, the slit itself is unresolved.
        const single = { ...LASER, mode: 'single' };
        expect(fieldView(single, W, H).cellsPerFringe).toBeGreaterThan(3);
        expect(buildField(single, W, H).drawable.intensity).toBe(false);
        expect(f.re).toBeNull();
        expect(drawability(fieldView(RIPPLE, W, H)).field).toBe(true);
    });

    it('is deterministic', () => {
        const a = buildField(RIPPLE, W, H);
        const b = buildField(RIPPLE, W, H);
        expect(Array.from(a.re)).toEqual(Array.from(b.re));
    });
});
