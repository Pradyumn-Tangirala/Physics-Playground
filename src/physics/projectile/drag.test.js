import { describe, it, expect } from 'vitest';
import { dragConstant, terminalSpeed, derivative, verticalApex, fallSpeed, dragStiffness, peakSpeed } from './drag';
import { simulateFlight, flightMetrics } from './flight';
import * as ideal from './projectile';
import { rk4 } from '../integrators';
import { degToRad } from '../../utils/units';

const BALL = { rho: 1.225, cd: 0.47, area: 0.0042, mass: 0.145 };
const shot = (v0, deg, g = 9.8, y0 = 0) => ({ v0, theta: degToRad(deg), g, y0 });
const rangeWith = (launch, air, dt = 0.002) =>
    flightMetrics(simulateFlight({ launch, k: dragConstant(air), integrator: rk4, dt })).range;

describe('quadratic drag model', () => {
    it('k = ρ·C_d·A / 2m and v_t = √(g/k)', () => {
        const k = dragConstant(BALL);
        expect(k).toBeCloseTo((1.225 * 0.47 * 0.0042) / (2 * 0.145), 15);
        expect(terminalSpeed(9.8, k)).toBeCloseTo(Math.sqrt(9.8 / k), 12);
        expect(terminalSpeed(9.8, 0)).toBe(Infinity);
    });

    it('drag force is ½ρC_dA|v|² and points against the velocity', () => {
        const k = dragConstant(BALL);
        const v = [30, -12];
        const [, , ax, ay] = derivative({ g: 9.8, k })([0, 10, ...v]);
        const drag = [ax, ay + 9.8]; // remove gravity
        const speed = Math.hypot(...v);
        expect(BALL.mass * Math.hypot(...drag)).toBeCloseTo(0.5 * BALL.rho * BALL.cd * BALL.area * speed ** 2, 12);
        expect(drag[0] * v[1] - drag[1] * v[0]).toBeCloseTo(0, 12); // parallel…
        expect(drag[0] * v[0] + drag[1] * v[1]).toBeLessThan(0); // …and opposite
    });

    it('vertical launch: apex height and time match the exact solution', () => {
        const k = dragConstant(BALL);
        const flight = simulateFlight({ launch: shot(50, 90), k, integrator: rk4, dt: 0.001 });
        const exact = verticalApex(50, 9.8, k);
        expect(Math.abs(flight.apex.state[1] - exact.height) / exact.height).toBeLessThan(1e-10);
        expect(flight.apex.t).toBeCloseTo(exact.time, 9);
        expect(exact.height).toBeLessThan(ideal.maxHeight(shot(50, 90))); // drag lowers the apex
    });

    it('falling from rest: speed follows v_t·tanh(g·t/v_t) and approaches v_t', () => {
        const k = dragConstant(BALL);
        const vt = terminalSpeed(9.8, k);
        const samples = [];
        simulateFlight({
            launch: shot(0, 0, 9.8, 5000), k, integrator: rk4, dt: 0.001, maxTime: 20,
            visit: (t, y) => { if (Math.abs(t - Math.round(t)) < 1e-9 && t > 0) samples.push([t, Math.hypot(y[2], y[3])]); },
        });
        for (const [t, v] of samples) expect(v).toBeCloseTo(fallSpeed(t, 9.8, k), 9);
        expect(samples.at(-1)[1] / vt).toBeGreaterThan(0.99);
        expect(samples.at(-1)[1]).toBeLessThan(vt);
    });

    it('as k → 0 the drag solution approaches the ideal one', () => {
        const launch = shot(60, 45);
        const nearlyNone = flightMetrics(simulateFlight({ launch, k: 1e-9, integrator: rk4, dt: 0.005 })).range;
        expect(Math.abs(nearlyNone - ideal.range(launch)) / ideal.range(launch)).toBeLessThan(1e-5);
    });
});

describe('drag and range', () => {
    it.each([[60, 45, 0], [20, 30, 0], [90, 60, 0], [40, 10, 25]])(
        'drag reduces the range under equivalent conditions (v0 %s m/s, θ %s°, y0 %s m)',
        (v0, deg, y0) => {
            const launch = shot(v0, deg, 9.8, y0);
            expect(rangeWith(launch, BALL)).toBeLessThan(ideal.range(launch));
            expect(rangeWith(launch, BALL)).toBeLessThan(rangeWith(launch, { ...BALL, rho: 0 }) - 1e-9);
        },
    );

    it('increasing the drag coefficient steadily reduces the range', () => {
        const ranges = [0, 0.1, 0.25, 0.47, 0.8, 1.2, 2].map((cd) => rangeWith(shot(60, 45), { ...BALL, cd }));
        expect(ranges[0]).toBeCloseTo(ideal.range(shot(60, 45)), 6);
        for (let i = 1; i < ranges.length; i++) expect(ranges[i]).toBeLessThan(ranges[i - 1]);
    });

    it('more air density or area reduces range; more mass increases it', () => {
        const base = rangeWith(shot(60, 45), BALL);
        expect(rangeWith(shot(60, 45), { ...BALL, rho: 1.5 })).toBeLessThan(base);
        expect(rangeWith(shot(60, 45), { ...BALL, area: 0.006 })).toBeLessThan(base);
        expect(rangeWith(shot(60, 45), { ...BALL, mass: 0.3 })).toBeGreaterThan(base);
    });

    it('with drag the best launch angle is below 45°', () => {
        const angles = Array.from({ length: 31 }, (_, i) => 25 + i); // 25°…55°
        const ranges = angles.map((a) => rangeWith(shot(60, a), BALL, 0.005));
        const best = angles[ranges.indexOf(Math.max(...ranges))];
        expect(best).toBeLessThan(45);
        expect(best).toBeGreaterThan(30);
    });
});

describe('stiffness', () => {
    it('2k·v·Δt and the peak-speed bound', () => {
        expect(dragStiffness(0.01, 50, 0.1)).toBeCloseTo(0.1, 12);
        expect(peakSpeed(60, 60, 34)).toBe(60); // launched faster than v_t: launch speed is the peak
        expect(peakSpeed(10, 80, 34)).toBe(34); // long fall: speed approaches v_t
        expect(peakSpeed(10, 20, 34)).toBe(20); // short fall: never reaches v_t
    });
});
