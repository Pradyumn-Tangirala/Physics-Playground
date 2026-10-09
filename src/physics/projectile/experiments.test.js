import { describe, it, expect } from 'vitest';
import {
    analyticalReference, numericalReference, measureErrors, convergenceStudy, observedOrder,
} from './experiments';
import { dragConstant } from './drag';
import * as ideal from './projectile';
import { INTEGRATOR_LIST, explicitEuler, rk4 } from '../integrators';
import { TIMESTEP_OPTIONS } from '../../utils/timeStep';
import { degToRad } from '../../utils/units';

const launch = { v0: 60, theta: degToRad(45), g: 9.8, y0: 0 };
const k = dragConstant({ rho: 1.225, cd: 0.47, area: 0.0042, mass: 0.145 });

describe('references', () => {
    it('the analytical reference is the closed form and ends at landing', () => {
        const ref = analyticalReference(launch);
        expect(ref.stateAt(2)).toEqual(ideal.stateAt(launch, 2));
        expect(ref.stateAt(ideal.flightTime(launch) + 0.1)).toBeNull();
    });

    it('the fine-step RK4 reference for drag is converged to ~1e-11 m', () => {
        const ref = numericalReference(launch, k);
        const finer = numericalReference(launch, k, { dt: 2.5e-5, stride: 20 });
        expect(Math.abs(ref.metrics.range - finer.metrics.range)).toBeLessThan(1e-10);
        for (const t of [0.5, 2.0123, 4.75]) {
            const a = ref.stateAt(t);
            const b = finer.stateAt(t);
            expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1e-10);
        }
    });
});

describe('timestep convergence', () => {
    const noDrag = convergenceStudy({ launch, k: 0, integrators: INTEGRATOR_LIST, dts: TIMESTEP_OPTIONS });
    const withDrag = convergenceStudy({ launch, k, integrators: INTEGRATOR_LIST, dts: TIMESTEP_OPTIONS });

    it('no drag: both Euler methods converge at first order in range and position', () => {
        for (const id of ['euler', 'symplectic']) {
            expect(noDrag.orders[id].rangeError).toBeGreaterThan(0.95);
            expect(noDrag.orders[id].rangeError).toBeLessThan(1.05);
            expect(noDrag.orders[id].positionError).toBeGreaterThan(0.95);
            expect(noDrag.orders[id].positionError).toBeLessThan(1.05);
        }
    });

    it('no drag: halving Δt halves the Euler range error', () => {
        const err = (dt) => Math.abs(measureErrors({ launch, integrator: explicitEuler, dt }).rangeError);
        expect(err(0.02) / err(0.01)).toBeCloseTo(2, 2);
        expect(err(0.002) / err(0.001)).toBeCloseTo(2, 2);
    });

    it('no drag: RK4 and every velocity error are at round-off — no order to measure', () => {
        for (const row of noDrag.rows.filter((r) => r.method === 'rk4')) {
            expect(Math.abs(row.rangeError)).toBeLessThan(1e-9);
            expect(row.positionError).toBeLessThan(1e-9);
        }
        for (const row of noDrag.rows) expect(row.velocityError).toBeLessThan(1e-9);
        expect(noDrag.orders.rk4.rangeError).toBeNull();
        for (const id of ['euler', 'symplectic', 'rk4']) expect(noDrag.orders[id].velocityError).toBeNull();
    });

    it('with drag: Euler methods are first order, RK4 fourth order', () => {
        for (const id of ['euler', 'symplectic']) {
            for (const key of ['rangeError', 'positionError', 'velocityError']) {
                expect(withDrag.orders[id][key]).toBeGreaterThan(0.95);
                expect(withDrag.orders[id][key]).toBeLessThan(1.1);
            }
        }
        for (const key of ['rangeError', 'positionError', 'velocityError']) {
            expect(withDrag.orders.rk4[key]).toBeGreaterThan(3.8);
            expect(withDrag.orders.rk4[key]).toBeLessThan(4.2);
        }
    });

    it('with drag: smaller Δt never makes a method worse until round-off', () => {
        for (const id of ['euler', 'symplectic']) {
            const errs = withDrag.rows.filter((r) => r.method === id).map((r) => Math.abs(r.rangeError));
            for (let i = 1; i < errs.length; i++) expect(errs[i]).toBeGreaterThan(errs[i - 1]);
        }
        const rk = withDrag.rows.filter((r) => r.method === 'rk4' && r.dt >= 0.005).map((r) => Math.abs(r.rangeError));
        for (let i = 1; i < rk.length; i++) expect(rk[i]).toBeGreaterThan(rk[i - 1]);
    });

    it('RK4 at 10 ms beats explicit Euler at 0.5 ms (20× more steps) by orders of magnitude', () => {
        const rk = Math.abs(measureErrors({ launch, k, integrator: rk4, dt: 0.01 }).rangeError);
        const eu = Math.abs(measureErrors({ launch, k, integrator: explicitEuler, dt: 0.0005 }).rangeError);
        expect(rk * 1e4).toBeLessThan(eu);
    });
});

describe('observedOrder', () => {
    it('recovers the exponent of synthetic C·Δtⁿ data and ignores round-off points', () => {
        const pts = [0.1, 0.05, 0.02, 0.01].map((dt) => [dt, 3 * dt ** 3]);
        expect(observedOrder(pts)).toBeCloseTo(3, 12);
        expect(observedOrder([...pts, [0.001, 1e-15]], 1e-12)).toBeCloseTo(3, 12);
        expect(observedOrder([[0.1, 1e-15], [0.01, 1e-15]], 1e-12)).toBeNull();
    });
});
