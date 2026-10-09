// Validation readouts and exported data of the labs: the numbers the
// validation panels show and the rows the CSV files contain.

import { describe, it, expect } from 'vitest';
import {
    oscillatorSimulation, holdAt, validationRows, smallAngleComparison, logColumns, logRow, exactPositionNow, lastPeriod,
} from './oscillatorSimulation';
import { integratorComparison, evaluations, LOG_COLUMNS, logRows, REFERENCE_SUBSTEPS } from './integratorComparison';
import { flightReport, REPORT_COLUMNS, predictFlights } from './projectileSimulation';
import { defaultParams } from '../experiments/urlParams';
import { OSCILLATOR_LAB, METHODS_LAB, PROJECTILE_LAB } from '../experiments/labs';

const FRAME = 1 / 60;
const run = (definition, params, seconds, sample) => {
    const state = definition.init(params);
    for (let i = 0; i < Math.round(seconds / FRAME); i++) {
        definition.step(state, params, FRAME, sample);
        definition.sync?.(state, params);
    }
    return state;
};
const row = (rows, quantity) => rows.find((r) => r.quantity === quantity);

describe('oscillator lab', () => {
    const pendulum = { ...defaultParams(OSCILLATOR_LAB.fields), startAngleDeg: 40, lengthM: 1, gravity: 9.81 };
    const spring = { ...defaultParams(OSCILLATOR_LAB.fields), mode: 'spring', damping: 0.2 };

    it('validates the pendulum against the exact period and the exact elliptic solution', () => {
        const state = run(oscillatorSimulation, pendulum, 5);
        const rows = validationRows(state, pendulum);
        const period = row(rows, 'Period T');
        expect(Math.abs(period.simulated / period.analytical - 1)).toBeLessThan(1e-7);
        const angle = row(rows, 'Angle θ(t)');
        expect(Math.abs(angle.simulated - angle.analytical)).toBeLessThan(1e-7);
        expect(row(rows, 'Energy E').simulated).toBeCloseTo(row(rows, 'Energy E').analytical, 8);
    });

    it('validates the damped spring against its exact solution', () => {
        const state = run(oscillatorSimulation, spring, 6);
        const rows = validationRows(state, spring);
        const x = row(rows, 'Position x(t)');
        expect(Math.abs(x.simulated - x.analytical)).toBeLessThan(1e-8);
        // Hermite crossing location: linear interpolation alone put ~10⁻⁶ on this (x'' ≠ 0 at a crossing with damping).
        expect(Math.abs(row(rows, 'Period T').simulated / row(rows, 'Period T').analytical - 1)).toBeLessThan(1e-9);
        expect(row(rows, 'Energy E')).toBeUndefined(); // not conserved with damping
    });

    it('withdraws the exact references when a parameter changes mid-motion', () => {
        const state = run(oscillatorSimulation, pendulum, 3);
        oscillatorSimulation.sync(state, { ...pendulum, lengthM: 2 });
        expect(exactPositionNow(state, pendulum)).toBeNull();
        expect(lastPeriod(state)).toBeNull(); // period measurement restarts too
        expect(row(validationRows(state, pendulum), 'Period T').unavailable).toMatch(/changed mid-swing/);
    });

    it('restores them on the next release (a drag)', () => {
        const state = run(oscillatorSimulation, pendulum, 1);
        oscillatorSimulation.sync(state, { ...pendulum, lengthM: 2 });
        holdAt(state, 0.3);
        expect(exactPositionNow(state, pendulum)).toBeCloseTo(0.3, 12);
    });

    it('keeps them when a drag changes the length while the bob is held, in either update order', () => {
        const dragged = { ...pendulum, lengthM: 2 };
        for (const order of [[pendulum, dragged], [dragged]]) {
            const state = run(oscillatorSimulation, pendulum, 1);
            holdAt(state, 0.3);
            for (const p of order) oscillatorSimulation.sync(state, p); // a frame may still see the old parameters
            expect(exactPositionNow(state, dragged)).toBeCloseTo(0.3, 12);
            oscillatorSimulation.step(state, dragged, 1);
            oscillatorSimulation.sync(state, dragged);
            expect(row(validationRows(state, dragged), 'Angle θ(t)')).toBeDefined();
        }
    });

    it('reports the small-angle period as a model comparison, not as a validation row', () => {
        const state = run(oscillatorSimulation, pendulum, 1);
        expect(validationRows(state, pendulum).map((r) => r.quantity)).not.toContain('Period vs small-angle');
        const { smallAngle, exact, longerBy } = smallAngleComparison(state, pendulum);
        expect(smallAngle).toBeCloseTo(2 * Math.PI * Math.sqrt(1 / 9.81), 12);
        expect(longerBy).toBeCloseTo(exact / smallAngle - 1, 15);
        expect(longerBy).toBeGreaterThan(0.03); // 40°: about 3% longer
        expect(longerBy).toBeLessThan(0.035);
        expect(smallAngleComparison(state, { ...pendulum, damping: 0.1 })).toBeNull();
        expect(smallAngleComparison(state, spring)).toBeNull();
    });

    it('has no exact pendulum reference with damping', () => {
        const damped = { ...pendulum, damping: 0.1 };
        const rows = validationRows(run(oscillatorSimulation, damped, 1), damped);
        expect(row(rows, 'Period T').unavailable).toMatch(/No closed form/);
        expect(row(rows, 'Angle θ(t)')).toBeUndefined();
    });

    it('logs one row per integration step, matching its columns', () => {
        const samples = [];
        const state = run(oscillatorSimulation, pendulum, 0.5, (t, y) => samples.push(logRow(t, y, pendulum)));
        expect(samples).toHaveLength(Math.round(state.t / pendulum.dt)); // one per step taken
        expect(samples[0]).toHaveLength(logColumns('pendulum').length);
        const [t, , , ke, pe, e, method, dt] = samples[0];
        expect(t).toBeCloseTo(pendulum.dt, 15);
        expect(e).toBeCloseTo(ke + pe, 15);
        expect([method, dt]).toEqual(['rk4', pendulum.dt]);
        expect(logRow(0, [0.1, 0], spring)).toHaveLength(logColumns('spring').length);
    });
});

describe('numerical methods lab', () => {
    const params = { ...defaultParams(METHODS_LAB.fields), dt: 0.01 };

    it('measures every method against the exact solution and counts evaluations', () => {
        const state = run(integratorComparison, params, 5);
        const byId = Object.fromEntries(state.runs.map((r) => [r.id, r]));
        expect(byId.rk4.maxError).toBeLessThan(1e-6);
        expect(byId.euler.maxError).toBeGreaterThan(1e-2);
        expect(evaluations(byId.rk4)).toBe(4 * byId.rk4.steps);
        expect(evaluations(byId.euler)).toBe(byId.euler.steps);
        expect(byId.rk4.errorSamples.length).toBeGreaterThan(100);
    });

    it('uses a fine-step RK4 reference when damped', () => {
        const damped = { ...params, damping: 0.3 };
        const state = run(integratorComparison, damped, 2);
        const rk4 = state.runs.find((r) => r.id === 'rk4');
        // RK4 at Δt vs RK4 at Δt/20: the difference is RK4's own error at Δt.
        expect(rk4.maxError).toBeGreaterThan(0);
        expect(rk4.maxError).toBeLessThan(1e-6);
        expect(REFERENCE_SUBSTEPS).toBe(20);
    });

    it('logs one row per method per step', () => {
        const rows = [];
        const state = run(integratorComparison, params, 0.1, (t, data) => rows.push(...logRows(t, data, params)));
        expect(rows).toHaveLength(3 * state.runs[0].steps);
        expect(rows[0]).toHaveLength(LOG_COLUMNS.length);
        expect(rows.slice(0, 3).map((r) => r[1])).toEqual(['Explicit Euler', 'Symplectic Euler', 'RK4']);
    });
});

describe('projectile flight report', () => {
    const params = { ...defaultParams(PROJECTILE_LAB.fields), velocity: 30, rho: 1.225 };
    const rows = flightReport(params);

    it('has every column on every row', () => {
        expect(rows.every((r) => r.length === REPORT_COLUMNS.length)).toBe(true);
    });

    it('ends each trajectory at the located impact, where the predicted metrics say', () => {
        const predicted = Object.fromEntries(predictFlights(params).map((p) => [p.id, p.metrics]));
        for (const [label, id] of [['Analytical, no drag', 'analytic'], ['Numerical, quadratic drag', 'drag']]) {
            const last = rows.filter((r) => r[0] === label).at(-1);
            expect(last[2]).toBeCloseTo(predicted[id].time, 12);
            expect(last[3]).toBeCloseTo(predicted[id].range, 9);
            expect(last[4]).toBe(0);
        }
    });

    it('conserves energy without drag and loses it with drag', () => {
        const energy = (label) => rows.filter((r) => r[0] === label).map((r) => r[10]);
        const ideal = energy('Analytical, no drag');
        expect(Math.max(...ideal) - Math.min(...ideal)).toBeLessThan(1e-9);
        const drag = energy('Numerical, quadratic drag');
        expect(drag.at(-1)).toBeLessThan(0.5 * drag[0]);
    });
});
