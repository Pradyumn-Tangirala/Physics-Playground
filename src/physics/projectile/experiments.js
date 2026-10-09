// Error measurement for the numerical projectile: numerical vs a reference
// solution, and how that error changes with the timestep.
//
// Reference:
//   k = 0 → the analytical solution (exact).
//   k > 0 → there is no closed form in 2-D, so the reference is RK4 with a much
//           smaller step (REFERENCE_DT), stored on a grid and interpolated
//           (cubic Hermite) to any time. Its own error is reported in
//           PROJECTILE_MODEL.md and is far below the errors it is used to judge.

import * as ideal from './projectile.js';
import { derivative } from './drag.js';
import { simulateFlight, flightMetrics } from './flight.js';
import { rk4 } from '../integrators.js';
import { hermite } from '../analysis.js';

export const REFERENCE_DT = 5e-5; // s
const GRID_STRIDE = 10; // store every 10th reference step (every 0.5 ms)
const ROUND_OFF_FLOOR = 1e-11; // relative to the trajectory size

/** Exact reference for the ideal (k = 0) model. */
export function analyticalReference(launch) {
    const summary = ideal.flightSummary(launch);
    return {
        kind: 'analytical',
        stateAt: (t) => (t <= summary.time ? ideal.stateAt(launch, t) : null),
        metrics: summary,
    };
}

/** Fine-step RK4 reference for the drag model, queryable at any time before landing. */
export function numericalReference(launch, k, { dt = REFERENCE_DT, stride = GRID_STRIDE } = {}) {
    const grid = [];
    let n = 0;
    const flight = simulateFlight({
        launch, k, integrator: rk4, dt,
        visit: (t, y) => {
            if (n++ % stride === 0) grid.push(y);
        },
    });
    const H = dt * stride;
    const f = derivative({ g: launch.g, k });
    const end = flight.landing ? flight.landing.t : flight.t;
    return {
        kind: 'numerical',
        stateAt(t) {
            if (t > end) return null;
            const i = Math.min(Math.floor(t / H), grid.length - 2);
            if (i < 0) return null;
            const s = t / H - i;
            if (s === 0) return grid[i];
            return hermite(grid[i], f(grid[i]), grid[i + 1], f(grid[i + 1]), H, s);
        },
        metrics: flightMetrics(flight),
    };
}

const referenceFor = (launch, k) => (k === 0 ? analyticalReference(launch) : numericalReference(launch, k));

/**
 * Runs one numerical flight and compares it with `reference`.
 *   positionError: max |r − r_ref| over all steps both are in the air (m)
 *   velocityError: max |v − v_ref| over the same steps (m/s)
 *   rangeError, heightError, timeError, impactSpeedError: signed (numerical − reference)
 */
export function measureErrors({ launch, k = 0, integrator, dt, reference = referenceFor(launch, k) }) {
    let positionError = 0;
    let velocityError = 0;
    const flight = simulateFlight({
        launch, k, integrator, dt,
        visit: (t, y) => {
            const r = reference.stateAt(t);
            if (!r) return;
            positionError = Math.max(positionError, Math.hypot(y[0] - r[0], y[1] - r[1]));
            velocityError = Math.max(velocityError, Math.hypot(y[2] - r[2], y[3] - r[3]));
        },
    });
    const metrics = flightMetrics(flight);
    const ref = reference.metrics;
    return {
        method: integrator.id,
        dt,
        metrics,
        diverged: flight.diverged,
        positionError,
        velocityError,
        rangeError: metrics.range - ref.range,
        heightError: metrics.maxHeight - ref.maxHeight,
        timeError: metrics.time - ref.time,
        impactSpeedError: metrics.impactSpeed - ref.impactSpeed,
    };
}

/**
 * Least-squares slope of log|error| against log Δt — the observed order of
 * accuracy. Points at or below `floor` (round-off level) are ignored; returns
 * null when fewer than two usable points remain.
 */
export function observedOrder(points, floor = 0) {
    const usable = points.filter(([dt, e]) => Number.isFinite(e) && Math.abs(e) > floor && dt > 0);
    if (usable.length < 2) return null;
    const xs = usable.map(([dt]) => Math.log(dt));
    const ys = usable.map(([, e]) => Math.log(Math.abs(e)));
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0;
    let den = 0;
    xs.forEach((x, i) => {
        num += (x - mx) * (ys[i] - my);
        den += (x - mx) ** 2;
    });
    return num / den;
}

export const ERROR_METRICS = {
    rangeError: { label: 'Range error |ΔR|', unit: 'm' },
    positionError: { label: 'Max position error |Δr|', unit: 'm' },
    velocityError: { label: 'Max velocity error |Δv|', unit: 'm/s' },
};

/**
 * Timestep convergence study: every integrator at every Δt against one shared
 * reference. Returns { referenceKind, reference, rows, orders } where
 * orders[method][metric] is the observed order (null = round-off only).
 */
export function convergenceStudy({ launch, k = 0, integrators, dts }) {
    const reference = referenceFor(launch, k);
    const rows = [];
    for (const integrator of integrators) {
        for (const dt of dts) rows.push(measureErrors({ launch, k, integrator, dt, reference }));
    }
    // Errors below 1e-11 × the size of the trajectory are round-off, not truncation
    // error (measured round-off reaches ~1e-10 m after ~10⁴ steps; see PROJECTILE_MODEL.md).
    const scale = Math.max(1, reference.metrics.range, reference.metrics.maxHeight);
    const orders = {};
    for (const integrator of integrators) {
        const mine = rows.filter((r) => r.method === integrator.id && !r.diverged);
        orders[integrator.id] = Object.fromEntries(
            Object.keys(ERROR_METRICS).map((key) => [key, observedOrder(mine.map((r) => [r.dt, r[key]]), ROUND_OFF_FLOOR * scale)]),
        );
    }
    return { referenceKind: reference.kind, reference: reference.metrics, rows, orders };
}
