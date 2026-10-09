import { describe, it, expect } from 'vitest';
import { derivative, energy, naturalFrequency, period, exactPosition } from './spring';
import { rk4, explicitEuler, symplecticEuler, integrate } from '../integrators';
import { createPeriodDetector, detectPeriod } from '../analysis';
import * as pendulum from '../pendulum/pendulum';

const H = 0.001;
const base = { k: 9, mass: 1 }; // ω₀ = 3 rad/s

/** Positions sampled every step for `seconds`. */
function trajectory(params, seconds, x0 = 1) {
    const f = derivative(params);
    const xs = [];
    let y = [x0, 0];
    for (let i = 0; i < Math.round(seconds / H); i++) {
        y = rk4.step(y, f, H);
        xs.push(y[0]);
    }
    return xs;
}

describe('spring-mass', () => {
    it('matches the analytic underdamped solution', () => {
        const p = { k: 10, mass: 2, damping: 0.1 };
        const y = integrate(rk4, [1, 0], derivative(p), H, 5000);
        expect(y[0]).toBeCloseTo(exactPosition(1, p, 5), 10);
    });

    it('conserves energy without damping', () => {
        const p = { k: 25, mass: 1.5, damping: 0 };
        const y = integrate(rk4, [0.8, 0], derivative(p), 0.005, 4000);
        const E0 = energy([0.8, 0], p).total;
        expect(Math.abs(energy(y, p).total - E0) / E0).toBeLessThan(1e-8);
    });

    it('T₀ = 2π√(m/k)', () => {
        expect(period(base)).toBeCloseTo((2 * Math.PI) / 3, 12);
    });
});

describe('critical damping (γ = ω₀)', () => {
    const w0 = naturalFrequency(base);
    const critical = { ...base, damping: w0 };
    const under = { ...base, damping: 0.3 * w0 };
    const over = { ...base, damping: 3 * w0 };

    it('RK4 matches x(t) = x₀(1 + ω₀t)e^(−ω₀t)', () => {
        const xs = trajectory(critical, 4);
        [0.5, 1, 2, 4].forEach((t) => {
            const i = Math.round(t / H) - 1;
            expect(xs[i]).toBeCloseTo((1 + w0 * t) * Math.exp(-w0 * t), 9);
        });
    });

    it('critically damped and overdamped motion never overshoot; underdamped does', () => {
        expect(Math.min(...trajectory(critical, 6))).toBeGreaterThan(0);
        expect(Math.min(...trajectory(over, 6))).toBeGreaterThan(0);
        expect(Math.min(...trajectory(under, 6))).toBeLessThan(0);
    });

    it('critical damping returns to equilibrium faster than overdamping', () => {
        const i = Math.round(3 / H) - 1;
        expect(trajectory(critical, 3)[i]).toBeLessThan(trajectory(over, 3)[i]);
    });

    it('exact solutions are continuous across the critical boundary', () => {
        const t = 1.2;
        const just = (g) => exactPosition(1, { ...base, damping: g }, t);
        expect(just(w0 * (1 - 1e-6))).toBeCloseTo(just(w0), 5);
        expect(just(w0 * (1 + 1e-6))).toBeCloseTo(just(w0), 5);
    });

    it('small-angle pendulum at γ = √(g/L) does not overshoot either', () => {
        const p = { g: 9.81, length: 1, mass: 1, damping: Math.sqrt(9.81) };
        const f = pendulum.derivative(p);
        let y = [0.05, 0];
        let min = Infinity;
        for (let i = 0; i < 6000; i++) {
            y = rk4.step(y, f, H);
            min = Math.min(min, y[0]);
        }
        expect(min).toBeGreaterThan(0);
    });
});

describe('spring: numerical period and energy behaviour', () => {
    const p = { k: 20, mass: 2, damping: 0 }; // ω₀ = √10

    /** Period measured from downward zero crossings of the integrated motion. */
    function measuredPeriod(params, integrator, h, seconds = 10) {
        const f = derivative(params);
        const det = createPeriodDetector();
        let y = [0.5, 0];
        for (let i = 0; i < Math.round(seconds / h); i++) {
            const next = integrator.step(y, f, h);
            detectPeriod(det, i * h, y, (i + 1) * h, next, f);
            y = next;
        }
        return det.periods.at(-1);
    }

    it('numerical period (RK4) matches T₀ = 2π√(m/k) to 1e-8', () => {
        expect(Math.abs(measuredPeriod(p, rk4, 0.001) - period(p)) / period(p)).toBeLessThan(1e-8);
    });

    it('with damping the measured period is the damped period 2π/√(ω₀² − γ²)', () => {
        const damped = { ...p, damping: 1 };
        const w0 = naturalFrequency(p);
        expect(measuredPeriod(damped, rk4, 0.001)).toBeCloseTo((2 * Math.PI) / Math.sqrt(w0 * w0 - 1), 6);
    });

    it('energy: Euler grows, symplectic Euler stays bounded, RK4 conserves', () => {
        const run = (integrator) => {
            const f = derivative(p);
            let y = [0.5, 0];
            const E0 = energy(y, p).total;
            let maxDev = 0;
            for (let i = 0; i < 20000; i++) {
                y = integrator.step(y, f, 0.005);
                maxDev = Math.max(maxDev, Math.abs(energy(y, p).total - E0) / E0);
            }
            return { final: (energy(y, p).total - E0) / E0, maxDev };
        };
        expect(run(explicitEuler).final).toBeGreaterThan(1); // more than doubled in 100 s
        const symp = run(symplecticEuler);
        expect(symp.maxDev).toBeLessThan(naturalFrequency(p) * 0.005); // band ≈ ω₀Δt/2
        expect(run(rk4).maxDev).toBeLessThan(1e-7);
    });

    it('damping: energy decays on average as e^(−2γt)', () => {
        const damped = { ...p, damping: 0.4 };
        const y = integrate(rk4, [0.5, 0], derivative(damped), 0.001, 5000);
        const ratio = energy(y, damped).total / energy([0.5, 0], damped).total;
        // E(t)/E₀ oscillates around e^(−2γt) with relative amplitude ≈ γ/ω₀; check the band.
        expect(ratio / Math.exp(-2 * 0.4 * 5)).toBeGreaterThan(1 - 0.4 / naturalFrequency(p) - 0.05);
        expect(ratio / Math.exp(-2 * 0.4 * 5)).toBeLessThan(1 + 0.4 / naturalFrequency(p) + 0.05);
    });
});
