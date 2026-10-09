import { describe, it, expect, vi } from 'vitest';
import { explicitEuler, symplecticEuler, rk4, INTEGRATOR_LIST, integrate } from './integrators';
import * as spring from './spring/spring';

// Reference problem with an exact solution: x'' = −ω²x, x(0) = 1, v(0) = 0  →  x(t) = cos ωt.
const OSC = { k: 4, mass: 1, damping: 0 }; // ω = 2 rad/s
const f = spring.derivative(OSC);
const w = spring.naturalFrequency(OSC);
const energy = (y) => spring.energy(y, OSC).total;

describe('integrator API', () => {
    it('every integrator exposes id, name, order and step(y, f, h, t)', () => {
        for (const m of INTEGRATOR_LIST) {
            expect(typeof m.step).toBe('function');
            expect(m.id && m.name && m.order).toBeTruthy();
        }
    });

    it('does not mutate the input state', () => {
        for (const m of INTEGRATOR_LIST) {
            const y = [0.3, -0.1];
            m.step(y, f, 0.01);
            expect(y).toEqual([0.3, -0.1]);
        }
    });

    it('is not tied to any model: works for exponential decay y′ = −y', () => {
        const decay = ([y]) => [-y];
        const y = integrate(rk4, [1], decay, 0.01, 100);
        expect(y[0]).toBeCloseTo(Math.exp(-1), 9);
    });

    it('RK4 performs exactly four derivative evaluations per step, at t, t+h/2, t+h/2, t+h', () => {
        const spy = vi.fn((y) => f(y));
        rk4.step([1, 0], spy, 0.1, 2);
        expect(spy).toHaveBeenCalledTimes(4);
        expect(spy.mock.calls.map((c) => c[1])).toEqual([2, 2.05, 2.05, 2.1]);
    });

    it('Euler and symplectic Euler perform one evaluation per step', () => {
        for (const m of [explicitEuler, symplecticEuler]) {
            const spy = vi.fn((y) => f(y));
            m.step([1, 0], spy, 0.1);
            expect(spy).toHaveBeenCalledTimes(1);
        }
    });

    it('RK4 on y′ = λy reproduces the 4th-order Taylor polynomial exactly', () => {
        const z = -0.3; // λh
        const y1 = rk4.step([1], ([y]) => [z * y], 1)[0];
        expect(y1).toBeCloseTo(1 + z + z * z / 2 + z ** 3 / 6 + z ** 4 / 24, 15);
    });
});

describe('convergence order (error at t = 2 s against cos ωt)', () => {
    const errorAt = (m, h) => Math.abs(integrate(m, [1, 0], f, h, Math.round(2 / h))[0] - Math.cos(w * 2));

    it('RK4 is fourth order: halving h cuts the error ≈ 16×', () => {
        const hs = [0.02, 0.01, 0.005, 0.0025];
        const errs = hs.map((h) => errorAt(rk4, h));
        for (let i = 1; i < errs.length; i++) {
            const ratio = errs[i - 1] / errs[i];
            expect(ratio).toBeGreaterThan(15);
            expect(ratio).toBeLessThan(17);
        }
        expect(Math.log2(errs[0] / errs[3]) / 3).toBeCloseTo(4, 1); // observed order
    });

    it.each([[explicitEuler], [symplecticEuler]])('%o is first order: halving h halves the error', (m) => {
        const e1 = errorAt(m, 0.004);
        const e2 = errorAt(m, 0.002);
        expect(e1 / e2).toBeGreaterThan(1.9);
        expect(e1 / e2).toBeLessThan(2.1);
    });
});

describe('energy behaviour on the undamped oscillator', () => {
    const E0 = energy([1, 0]);

    it('explicit Euler multiplies energy by exactly (1 + ω²h²) every step', () => {
        const h = 0.01;
        const n = 1000;
        const y = integrate(explicitEuler, [1, 0], f, h, n);
        expect(energy(y) / E0).toBeCloseTo((1 + w * w * h * h) ** n, 9);
        expect(energy(y)).toBeGreaterThan(1.4 * E0); // +49% after 10 s at h = 10 ms
    });

    it('explicit Euler gains energy at every step (monotonic growth)', () => {
        let y = [1, 0];
        let prev = E0;
        for (let i = 0; i < 500; i++) {
            y = explicitEuler.step(y, f, 0.01);
            expect(energy(y)).toBeGreaterThan(prev);
            prev = energy(y);
        }
    });

    it('symplectic Euler keeps the energy error bounded (no secular drift over 1000 periods)', () => {
        const h = 0.01;
        const period = (2 * Math.PI) / w;
        let y = [1, 0];
        let maxEarly = 0;
        let maxLate = 0;
        const steps = Math.round((1000 * period) / h);
        for (let i = 0; i < steps; i++) {
            y = symplecticEuler.step(y, f, h);
            const err = Math.abs(energy(y) - E0) / E0;
            if (i < steps / 100) maxEarly = Math.max(maxEarly, err);
            if (i > steps * 0.99) maxLate = Math.max(maxLate, err);
        }
        expect(maxLate).toBeLessThan(w * h); // band ≈ ω h
        expect(maxLate).toBeLessThan(maxEarly * 1.05); // the band does not grow
    });

    it('symplectic Euler preserves phase-space area (det of the step map = 1)', () => {
        const h = 0.05;
        const e = 1e-6;
        const base = symplecticEuler.step([0.4, 0.2], f, h);
        const dq = symplecticEuler.step([0.4 + e, 0.2], f, h).map((v, i) => (v - base[i]) / e);
        const dv = symplecticEuler.step([0.4, 0.2 + e], f, h).map((v, i) => (v - base[i]) / e);
        expect(dq[0] * dv[1] - dq[1] * dv[0]).toBeCloseTo(1, 6);
    });

    it('RK4 conserves energy to ~1e-9 over 10 s at h = 10 ms and slightly dissipates', () => {
        const y = integrate(rk4, [1, 0], f, 0.01, 1000);
        const drift = (energy(y) - E0) / E0;
        expect(Math.abs(drift)).toBeLessThan(1e-8);
        expect(drift).toBeLessThan(0); // |R(iωh)| < 1
    });
});
