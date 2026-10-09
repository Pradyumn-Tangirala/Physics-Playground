import { describe, it, expect } from 'vitest';
import { createPeriodDetector, detectPeriod, relativeEnergyError, hermite, locateCrossing, errorAgainst } from './analysis';
import { periodVsAmplitude, exactPeriodRatio } from './pendulum/experiments';
import { explicitEuler, symplecticEuler, rk4 } from './integrators';
import { degToRad } from '../utils/units';

describe('period detector', () => {
    // x = cos(2πt/T) as the state [x, x'] of a harmonic oscillator.
    const T = 1.7;
    const w = (2 * Math.PI) / T;
    const f = ([x, v]) => [v, -w * w * x];
    const at = (t) => [Math.cos(w * t), -w * Math.sin(w * t)];

    it('measures the period of a sampled sine wave', () => {
        const h = 0.01;
        const d = createPeriodDetector();
        const found = [];
        for (let n = 0; n < 600; n++) {
            const p = detectPeriod(d, n * h, at(n * h), (n + 1) * h, at((n + 1) * h), f);
            if (p !== null) found.push(p);
        }
        expect(found.length).toBeGreaterThanOrEqual(2);
        found.forEach((p) => expect(p).toBeCloseTo(T, 8));
    });

    it('ignores upward crossings and needs two downward crossings', () => {
        const line = ([, v]) => [v, 0]; // x moving at constant speed: the crossing is exactly linear
        const d = createPeriodDetector();
        expect(detectPeriod(d, 0, [-1, 2], 1, [1, 2], line)).toBeNull(); // upward
        expect(detectPeriod(d, 1, [1, -2], 2, [-1, -2], line)).toBeNull(); // first downward
        expect(detectPeriod(d, 3, [1, -2], 4, [-1, -2], line)).toBeCloseTo(2, 12);
    });

    it('stays accurate where the motion curves at the crossing (damping), unlike linear interpolation', () => {
        // Damped oscillator, exact solution x = e^{−γt}cos(ω_d t): x'' = −2γx' ≠ 0 at x = 0.
        const gamma = 0.8;
        const wd = 3;
        const fd = ([x, v]) => [v, -(wd * wd + gamma * gamma) * x - 2 * gamma * v];
        const exact = (t) => {
            const e = Math.exp(-gamma * t);
            return [e * Math.cos(wd * t), -e * (gamma * Math.cos(wd * t) + wd * Math.sin(wd * t))];
        };
        const h = 0.02;
        const d = createPeriodDetector();
        for (let n = 0; n < 400; n++) detectPeriod(d, n * h, exact(n * h), (n + 1) * h, exact((n + 1) * h), fd);
        const Td = (2 * Math.PI) / wd;
        d.periods.forEach((p) => expect(Math.abs(p - Td) / Td).toBeLessThan(1e-6));
    });
});

describe('relativeEnergyError', () => {
    it('is (E − E₀)/E₀, NaN for E₀ = 0', () => {
        expect(relativeEnergyError(1.1, 1)).toBeCloseTo(0.1, 12);
        expect(relativeEnergyError(1, 0)).toBeNaN();
    });
});

describe('period-vs-amplitude experiment', () => {
    const amplitudesDeg = [5, 30, 60, 90, 120, 150, 170];

    it('RK4 reproduces the exact curve and T/T₀ rises monotonically', () => {
        const rows = periodVsAmplitude({ amplitudesDeg, length: 1, g: 9.81, integrator: rk4, dt: 0.001 });
        rows.forEach((r) => expect(Math.abs(r.relativeError)).toBeLessThan(1e-8));
        for (let i = 1; i < rows.length; i++) expect(rows[i].simulatedRatio).toBeGreaterThan(rows[i - 1].simulatedRatio);
        expect(rows.at(-1).exactRatio).toBeCloseTo(exactPeriodRatio(degToRad(170)), 12);
    });

    it('symplectic Euler gets the period right to ~4e-7 at Δt = 1 ms', () => {
        const rows = periodVsAmplitude({ amplitudesDeg, length: 1, g: 9.81, integrator: symplecticEuler, dt: 0.001 });
        rows.forEach((r) => expect(Math.abs(r.relativeError)).toBeLessThan(1e-6));
    });

    it('explicit Euler overestimates the period and fails to complete one at 170° with Δt = 10 ms', () => {
        const rows = periodVsAmplitude({ amplitudesDeg: [30, 90, 170], length: 1, g: 9.81, integrator: explicitEuler, dt: 0.01 });
        expect(rows[0].relativeError).toBeGreaterThan(0);
        expect(rows[1].relativeError).toBeGreaterThan(rows[0].relativeError);
        expect(rows[2].simulated).toBeNaN();
    });
});

describe('Hermite interpolation and event location', () => {
    // y(t) = [p(t), p'(t)] with p a cubic: Hermite must reproduce it exactly.
    const p = (t) => 2 - 3 * t + 0.5 * t * t + 0.25 * t ** 3;
    const dp = (t) => -3 + t + 0.75 * t * t;
    const ddp = (t) => 1 + 1.5 * t;
    const y = (t) => [p(t), dp(t)];
    const f = (t) => [dp(t), ddp(t)];

    it('is exact for a cubic inside the step', () => {
        const [t0, h] = [0.4, 0.9];
        for (const s of [0, 0.25, 0.5, 0.9, 1]) {
            const v = hermite(y(t0), f(t0), y(t0 + h), f(t0 + h), h, s);
            expect(v[0]).toBeCloseTo(p(t0 + s * h), 13);
        }
    });

    it('locates the zero crossing of a component to double precision', () => {
        // p has a root between t = 0.6 and t = 1.0 (p(0.6) > 0 > p(1.0)).
        const [t0, h] = [0.6, 0.4];
        const { s, state } = locateCrossing(y(t0), f(t0), y(t0 + h), f(t0 + h), h, 0);
        expect(Math.abs(p(t0 + s * h))).toBeLessThan(1e-14);
        expect(state[0]).toBeCloseTo(0, 14);
    });
});

describe('errorAgainst', () => {
    it('gives the signed absolute error and the error relative to the reference', () => {
        expect(errorAgainst(2, 2.002)).toEqual({ absolute: expect.closeTo(0.002, 15), relative: expect.closeTo(0.001, 15) });
        expect(errorAgainst(-4, -5).relative).toBeCloseTo(-0.25, 15);
    });

    it('can be relative to another scale, and is NaN with nothing to compare against', () => {
        expect(errorAgainst(0.001, 0.002, 0.5).relative).toBeCloseTo(0.002, 15);
        expect(errorAgainst(0, 1).relative).toBeNaN();
    });
});
