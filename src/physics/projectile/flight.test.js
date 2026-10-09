import { describe, it, expect } from 'vitest';
import { simulateFlight, flightMetrics, initialState } from './flight';
import { derivative, energy, dragConstant, dragPower } from './drag';
import * as ideal from './projectile';
import { explicitEuler, symplecticEuler, rk4, INTEGRATOR_LIST } from '../integrators';
import { degToRad } from '../../utils/units';

const shot = (v0, deg, g = 9.8, y0 = 0) => ({ v0, theta: degToRad(deg), g, y0 });
const LAUNCHES = [shot(60, 45), shot(25, 70, 9.81, 30), shot(80, 15, 3.7, 5), shot(10, 0, 9.8, 50)];

/** Runs a flight and returns every in-air state with its time: [[t, y], …]. */
function trace(launch, integrator, dt, k = 0) {
    const states = [];
    const flight = simulateFlight({ launch, k, integrator, dt, visit: (t, y) => states.push([t, y]) });
    return { flight, states };
}

describe('zero drag: numerical vs analytical', () => {
    it.each(LAUNCHES.map((l) => [l.v0, l.theta, l.y0, l]))(
        'RK4 reproduces the exact trajectory to round-off (v0 %s, θ %s rad, y0 %s m)',
        (_, __, ___, launch) => {
            const { flight, states } = trace(launch, rk4, 0.01);
            for (const [t, y] of states) {
                const exact = ideal.stateAt(launch, t);
                expect(Math.hypot(y[0] - exact[0], y[1] - exact[1])).toBeLessThan(1e-9);
                expect(Math.hypot(y[2] - exact[2], y[3] - exact[3])).toBeLessThan(1e-10);
            }
            const m = flightMetrics(flight);
            const exact = ideal.flightSummary(launch);
            expect(Math.abs(m.range - exact.range)).toBeLessThan(1e-9);
            expect(Math.abs(m.time - exact.time)).toBeLessThan(1e-11);
            expect(Math.abs(m.maxHeight - exact.maxHeight)).toBeLessThan(1e-9);
            expect(Math.abs(m.impactSpeed - exact.impactSpeed)).toBeLessThan(1e-10);
        },
    );

    it('every method gets the velocity exactly right (constant acceleration)', () => {
        for (const integrator of INTEGRATOR_LIST) {
            for (const [t, y] of trace(shot(60, 45), integrator, 0.05).states) {
                const exact = ideal.stateAt(shot(60, 45), t);
                expect(Math.abs(y[3] - exact[3])).toBeLessThan(1e-10);
                expect(y[2]).toBe(exact[2]);
            }
        }
    });

    it('explicit Euler is too high by exactly ½·g·Δt·t; symplectic Euler too low by the same', () => {
        const launch = shot(60, 45);
        const h = 0.02;
        for (const [integrator, sign] of [[explicitEuler, 1], [symplecticEuler, -1]]) {
            for (const [t, y] of trace(launch, integrator, h).states) {
                expect(y[1] - ideal.position(launch, t).y).toBeCloseTo(sign * 0.5 * launch.g * h * t, 9);
                expect(y[0]).toBeCloseTo(ideal.position(launch, t).x, 9);
            }
        }
    });

    it('from the ground, explicit Euler lands one step late and symplectic Euler one step early', () => {
        const launch = shot(60, 45);
        const T = ideal.flightTime(launch);
        // The discrete Euler points lie on y0 + (vy ± ½gΔt)·t − ½gt², whose root is T ± Δt; the
        // interpolated landing between two points is within a fraction of a percent of that.
        for (const h of [0.001, 0.01, 0.05]) {
            expect(Math.abs(flightMetrics(trace(launch, explicitEuler, h).flight).time - T - h)).toBeLessThan(0.005 * h);
            expect(Math.abs(flightMetrics(trace(launch, symplecticEuler, h).flight).time - T + h)).toBeLessThan(0.005 * h);
        }
    });
});

describe('gravity', () => {
    it('without drag the acceleration is exactly (0, −g) at any velocity', () => {
        for (const g of [1.62, 9.81, 24.79]) {
            expect(derivative({ g, k: 0 })([3, 4, 50, -20]).map((v) => v + 0)).toEqual([50, -20, 0, -g]); // + 0 turns −0 into 0
        }
    });

    it.each([['Moon', 1.62], ['Earth', 9.81], ['Jupiter', 24.79]])(
        'a drop from 80 m on the %s lands after √(2h/g)',
        (_, g) => {
            const m = flightMetrics(simulateFlight({ launch: shot(0, 0, g, 80), integrator: rk4, dt: 0.01 }));
            expect(m.time).toBeCloseTo(Math.sqrt((2 * 80) / g), 11);
            expect(m.impactSpeed).toBeCloseTo(Math.sqrt(2 * g * 80), 9);
        },
    );

    it('range scales as 1/g for the same launch (numerical, RK4)', () => {
        const rg = [2, 9.8, 20].map((g) => flightMetrics(simulateFlight({ launch: shot(40, 30, g), integrator: rk4, dt: 0.005 })).range * g);
        expect(rg[1]).toBeCloseTo(rg[0], 8);
        expect(rg[2]).toBeCloseTo(rg[0], 8);
    });
});

describe('energy', () => {
    const mass = 0.145;
    const E = (y, g) => energy(y, { g, mass }).total;

    it('without drag, RK4 conserves mechanical energy to round-off', () => {
        const launch = shot(60, 45);
        const E0 = E(initialState(launch), launch.g);
        for (const [, y] of trace(launch, rk4, 0.01).states) {
            expect(Math.abs(E(y, launch.g) - E0) / E0).toBeLessThan(1e-13);
        }
    });

    it('without drag, the Euler methods drift linearly: ΔE = ±½·m·g²·Δt·t', () => {
        const launch = shot(60, 45);
        const h = 0.01;
        const E0 = E(initialState(launch), launch.g);
        for (const [integrator, sign] of [[explicitEuler, 1], [symplecticEuler, -1]]) {
            for (const [t, y] of trace(launch, integrator, h).states) {
                expect(E(y, launch.g) - E0).toBeCloseTo(sign * 0.5 * mass * launch.g ** 2 * h * t, 8);
            }
        }
    });

    it('with drag, energy falls at every step', () => {
        const launch = shot(60, 45);
        const k = dragConstant({ rho: 1.225, cd: 0.47, area: 0.0042, mass });
        const { states } = trace(launch, rk4, 0.005, k);
        for (let i = 1; i < states.length; i++) {
            expect(E(states[i][1], launch.g)).toBeLessThan(E(states[i - 1][1], launch.g));
        }
    });

    it('with drag, the energy lost equals the work done by drag, ∫ m·k·|v|³ dt', () => {
        const launch = shot(60, 45);
        const k = dragConstant({ rho: 1.225, cd: 0.47, area: 0.0042, mass });
        const params = { g: launch.g, k, mass };
        const f = derivative(params);
        // Augment the state with the accumulated drag work W, dW/dt = F·v, and integrate both together.
        const augmented = (y) => [...f(y), dragPower(y, params)];
        let y = [...initialState(launch), 0];
        const E0 = E(y, launch.g);
        for (let i = 0; i < 500; i++) {
            y = rk4.step(y, augmented, 0.01);
            expect(Math.abs(E(y, launch.g) - E0 - y[4])).toBeLessThan(1e-9 * E0); // RK4 truncation ~1e-11·E₀
        }
        expect(y[4]).toBeLessThan(-0.5 * E0); // more than half the energy is gone after 5 s
    });
});

describe('flight bookkeeping', () => {
    it('a launch along the ground (θ = 0, y0 = 0) lands immediately with zero range', () => {
        const m = flightMetrics(simulateFlight({ launch: shot(30, 0), integrator: rk4, dt: 0.01 }));
        expect(m).toMatchObject({ landed: true, range: 0, time: 0, maxHeight: 0 });
    });

    it('flags an unstable solution instead of reporting a bogus landing', () => {
        // k = 10 m⁻¹: 2k·v·Δt ≈ 120 ≫ 2, far outside explicit Euler's stability region. Without
        // the check this "lands" moving backwards at ~10⁵ m/s.
        const flight = simulateFlight({ launch: shot(60, 45), k: 10, integrator: explicitEuler, dt: 0.1 });
        expect(flight.diverged).toBe(true);
        expect(flightMetrics(flight).range).toBeNaN();
        // The same drag with a small enough step is fine.
        const fine = simulateFlight({ launch: shot(60, 45), k: 10, integrator: rk4, dt: 0.0005 });
        expect(fine.diverged).toBe(false);
        expect(flightMetrics(fine).range).toBeGreaterThan(0);
    });

    it('never flags a stable solution: no false alarms across methods and step sizes', () => {
        const k = dragConstant({ rho: 1.225, cd: 0.47, area: 0.0042, mass: 0.145 });
        for (const integrator of INTEGRATOR_LIST) {
            for (const dt of [0.0005, 0.01, 0.1]) {
                for (const launch of LAUNCHES) {
                    expect(simulateFlight({ launch, k, integrator, dt }).diverged).toBe(false);
                    expect(simulateFlight({ launch, k: 0, integrator, dt }).diverged).toBe(false);
                }
            }
        }
    });

    it('is deterministic', () => {
        const a = flightMetrics(simulateFlight({ launch: shot(47, 38, 9.8, 12), k: 0.01, integrator: rk4, dt: 0.002 }));
        const b = flightMetrics(simulateFlight({ launch: shot(47, 38, 9.8, 12), k: 0.01, integrator: rk4, dt: 0.002 }));
        expect(a).toEqual(b);
    });
});
