import { describe, it, expect } from 'vitest';
import {
    analyseScreen, screenPattern, fraunhoferIntensity, fringeSpacing, envelopeZero, predictedMaximum,
    findExtrema, measureFringeSpacing, subSources, frequency, wavenumber, screenPositionOf, fraunhoferDistance,
    apertureSize, excessPath, fringeComparison,
} from './interference';

const LASER = {
    mode: 'double', wavelength: 632.8e-9, waveSpeed: 2.998e8, slitSeparation: 0.25e-3, slitWidth: 0.05e-3,
    screenDistance: 1, phase: 0, amplitude1: 1, amplitude2: 1,
};
const RIPPLE = { ...LASER, wavelength: 0.02, waveSpeed: 0.25, slitSeparation: 0.1, slitWidth: 0.01 };

describe('basic relations', () => {
    it('f = c/λ, k = 2π/λ, β = λD/d, envelope zero λD/a', () => {
        expect(frequency(LASER)).toBeCloseTo(2.998e8 / 632.8e-9, -6);
        expect(wavenumber(0.02)).toBeCloseTo(Math.PI * 100, 10);
        expect(fringeSpacing(LASER)).toBeCloseTo(2.5312e-3, 7);
        expect(envelopeZero(LASER)).toBeCloseTo(12.656e-3, 6);
    });

    it('the path excess r − D is computed without cancellation at optical scale', () => {
        const D = 1;
        const dy = 1e-5;
        const r = Math.hypot(D, dy);
        expect(excessPath(dy, r, D)).toBeCloseTo((dy * dy) / 2, 20); // naive r − D loses ~6 digits here
    });

    it('slits are split into sub-sources whose weights add up to the slit amplitude', () => {
        const src = subSources({ ...RIPPLE, amplitude1: 1.5, amplitude2: 0.5 }, 0.001);
        const upper = src.filter((s) => s.y > 0);
        expect(upper.length).toBe(10);
        expect(upper.reduce((a, s) => a + s.weight, 0)).toBeCloseTo(1.5, 12);
        expect(Math.max(...upper.map((s) => s.y)) - Math.min(...upper.map((s) => s.y))).toBeCloseTo(0.009, 12);
        expect(subSources({ ...RIPPLE, slitWidth: 0 }, 0.001).length).toBe(2); // point sources
    });
});

describe('double slit: interference maxima and fringe spacing', () => {
    it('bright fringes where the path difference r₂ − r₁ is a whole number of wavelengths, dark ones at half (two point sources)', () => {
        const setup = { ...RIPPLE, slitWidth: 0 };
        const { slitSeparation: d, screenDistance: D, wavelength } = setup;
        const { y, intensity } = screenPattern(setup, 3.5 * fringeSpacing(setup), 4001);
        const order = (yy) => (Math.hypot(D, yy + d / 2) - Math.hypot(D, yy - d / 2)) / wavelength;
        const maxima = findExtrema(y, intensity, { minRelative: 0.5 });
        const minima = findExtrema(y, intensity, { kind: 'min' });
        expect(maxima.length).toBeGreaterThanOrEqual(5);
        // Maxima are pulled very slightly by the √(D/r) spreading; minima are where the two waves cancel.
        for (const m of maxima) expect(Math.abs(order(m.y) - Math.round(order(m.y)))).toBeLessThan(0.01);
        for (const m of minima) expect(Math.abs(order(m.y) - Math.round(order(m.y) - 0.5) - 0.5)).toBeLessThan(0.002);
    });

    it('He-Ne laser: measured fringe spacing matches λD/d within 0.01%', () => {
        const a = analyseScreen(LASER);
        expect(Math.abs(a.errorPct)).toBeLessThan(0.01);
        expect(Math.abs(a.fraunhoferErrorPct)).toBeLessThan(0.001);
        expect(a.profileErrorPct).toBeLessThan(0.05);
    });

    it('fringe spacing scales as λ, as D and as 1/d', () => {
        const base = analyseScreen(LASER).measured;
        expect(analyseScreen({ ...LASER, wavelength: 2 * LASER.wavelength }).measured / base).toBeCloseTo(2, 3);
        expect(analyseScreen({ ...LASER, screenDistance: 2 }).measured / base).toBeCloseTo(2, 3);
        expect(analyseScreen({ ...LASER, slitSeparation: 2 * LASER.slitSeparation }).measured / base).toBeCloseTo(0.5, 3);
    });

    it('ripple tank: the 5% gap from λD/d is the small-angle approximation; the gap from Fraunhofer shrinks with distance', () => {
        const near = analyseScreen(RIPPLE);
        expect(near.errorPct).toBeGreaterThan(4);
        expect(near.errorPct).toBeLessThan(6);
        const gaps = [1, 3, 20].map((D) => Math.abs(analyseScreen({ ...RIPPLE, screenDistance: D }).fraunhoferErrorPct));
        expect(gaps[1]).toBeLessThan(gaps[0]);
        expect(gaps[2]).toBeLessThan(gaps[1]);
        expect(gaps[2]).toBeLessThan(0.01);
    });

    it('a phase difference φ shifts the pattern by −φ/2π fringes; φ = π puts a dark fringe at the centre', () => {
        const shifted = { ...LASER, phase: Math.PI / 2 };
        const a = analyseScreen(shifted);
        const central = a.maxima.reduce((best, m) => (m.value > best.value ? m : best));
        expect(central.y / fringeSpacing(LASER)).toBeCloseTo(-0.25, 2);
        expect(predictedMaximum(shifted, 0).smallAngle).toBeCloseTo(-0.25 * fringeSpacing(LASER), 12);
        const anti = analyseScreen({ ...LASER, phase: Math.PI });
        expect(anti.intensity[(anti.y.length - 1) / 2] / Math.max(...anti.intensity)).toBeLessThan(1e-6);
    });

    it('amplitudes: intensity scales as A², and unequal slits give visibility 2A₁A₂/(A₁² + A₂²)', () => {
        const centre = (s) => {
            const r = analyseScreen({ ...s, slitWidth: 0, screenDistance: 1 });
            return r.intensity[(r.y.length - 1) / 2];
        };
        expect(centre({ ...LASER, amplitude1: 2, amplitude2: 2 }) / centre(LASER)).toBeCloseTo(4, 6);
        const A1 = 1;
        const A2 = 0.4;
        const setup = { ...LASER, slitWidth: 0, amplitude2: A2 };
        const half = fringeSpacing(setup) / 2;
        const Imax = fraunhoferIntensity(setup, 0);
        const Imin = fraunhoferIntensity(setup, half);
        const { intensity } = screenPattern(setup, half, 3);
        expect(intensity[1]).toBeCloseTo(Imax, 6);
        expect(intensity[2]).toBeCloseTo(Imin, 6);
        expect((Imax - Imin) / (Imax + Imin)).toBeCloseTo((2 * A1 * A2) / (A1 * A1 + A2 * A2), 4);
    });

    it('missing order: with d = 3a the third maximum falls on an envelope zero', () => {
        const setup = { ...LASER, slitWidth: LASER.slitSeparation / 3 };
        const y3 = screenPositionOf((3 * setup.wavelength) / setup.slitSeparation, setup.screenDistance);
        const { intensity } = screenPattern(setup, y3, 3);
        expect(intensity[2] / intensity[1]).toBeLessThan(1e-4); // not exactly 0: the screen is not infinitely far
    });

    it('dark-fringe spacing is not pulled by the envelope, unlike the bright fringes', () => {
        const a = analyseScreen(LASER);
        const beta = fringeSpacing(LASER);
        const first = a.maxima.find((m) => m.y > beta / 2);
        expect(Math.abs(first.y - beta) / beta).toBeGreaterThan(0.01); // pulled inwards by the sinc² slope
        const dark = measureFringeSpacing(a.y, a.intensity, 0, 2.6 * beta);
        expect(Math.abs(dark.spacing - beta) / beta).toBeLessThan(1e-4);
    });
});

describe('single slit: sinc² envelope', () => {
    const SINGLE = { ...LASER, mode: 'single', slitWidth: 0.1e-3 };

    it('simulated pattern matches cos θ·sinc²(ka sin θ/2) within 0.01% of the peak', () => {
        const a = analyseScreen(SINGLE);
        expect(a.profileErrorPct).toBeLessThan(0.01);
    });

    it('zeros at a·sin θ = mλ; central maximum twice as wide as the side lobes', () => {
        const a = analyseScreen(SINGLE);
        expect(Math.abs(a.errorPct)).toBeLessThan(0.01);
        const zeros = a.minima.filter((m) => m.y > 0).slice(0, 3).map((m) => m.y);
        zeros.forEach((y, i) => {
            const exact = screenPositionOf(((i + 1) * SINGLE.wavelength) / SINGLE.slitWidth, SINGLE.screenDistance);
            expect(Math.abs(y - exact) / exact).toBeLessThan(1e-3);
        });
        expect(a.measured / (zeros[1] - zeros[0])).toBeCloseTo(2, 2);
    });

    it('side-lobe peaks are about 4.7% and 1.6% of the centre', () => {
        const a = analyseScreen(SINGLE);
        const peak = Math.max(...a.intensity);
        const lobes = a.maxima.filter((m) => m.y > a.measured / 2).map((m) => m.value / peak); // beyond the first zero
        expect(lobes[0]).toBeCloseTo(0.0472, 3);
        expect(lobes[1]).toBeCloseTo(0.0165, 3);
    });

    it('a slit narrower than λ has no zeros: the wave spreads in every direction', () => {
        const a = analyseScreen({ ...RIPPLE, mode: 'single', slitWidth: 0.015 });
        expect(a.minima.length).toBe(0);
    });
});

describe('far-field criterion', () => {
    it('Fraunhofer distance L²/λ uses the whole aperture', () => {
        expect(apertureSize(LASER)).toBeCloseTo(0.3e-3, 15);
        expect(fraunhoferDistance(apertureSize(LASER), LASER.wavelength)).toBeCloseTo(0.1422, 4);
    });
});

describe('fringeComparison', () => {
    const laser = { mode: 'double', wavelength: 600e-9, waveSpeed: 3e8, slitSeparation: 0.2e-3, slitWidth: 0.04e-3, screenDistance: 1, phase: 0, amplitude1: 1, amplitude2: 1 };

    it('double slit: simulated bright fringes sit on the Fraunhofer maxima, near mλD/d', () => {
        const rows = fringeComparison(laser, analyseScreen(laser));
        expect(rows.map((r) => r.m)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
        for (const r of rows) {
            expect(r.smallAngle).toBeCloseTo((r.m * 600e-9) / 0.2e-3, 12);
            expect(Math.abs(r.simulated - r.fraunhofer)).toBeLessThan(0.01 * 3e-3); // < 1% of β
        }
    });

    it('flags an order suppressed by an envelope zero (d/a = 3 removes m = ±3)', () => {
        const setup = { ...laser, slitWidth: laser.slitSeparation / 3 };
        const rows = fringeComparison(setup, analyseScreen(setup));
        expect(rows.filter((r) => r.missing).map((r) => r.m)).toEqual([-3, 3]);
    });

    it('single slit: dark fringes near mλD/a, none at m = 0', () => {
        const setup = { ...laser, mode: 'single', slitWidth: 0.1e-3 };
        const rows = fringeComparison(setup, analyseScreen(setup));
        expect(rows.map((r) => r.m)).toEqual([-2, -1, 1, 2]);
        expect(rows.find((r) => r.m === 1).simulated).toBeCloseTo(6e-3, 4);
    });
});
