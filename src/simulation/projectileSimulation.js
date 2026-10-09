// Projectile simulation: state machine idle → flying → landed.
//
// params = { mode: 'ideal' | 'compare', velocity (m/s), angleDeg, height (m), gravity (m/s²),
//            rho (kg/m³), cd, area (m²), mass (kg),
//            integrator: 'euler' | 'symplectic' | 'rk4', dt (s), playbackSpeed }
//
// 'ideal'   one shot from the closed-form solution — nothing is integrated.
// 'compare' three shots from the same launch, flown together:
//             analytic  closed form, no drag
//             numeric   selected integrator and Δt, no drag (k = 0)
//             drag      selected integrator and Δt, quadratic drag
//
// Launch parameters are snapshotted when a shot is fired.

import * as ideal from '../physics/projectile/projectile.js';
import { dragConstant, derivative } from '../physics/projectile/drag.js';
import { createFlight, advanceFlight, simulateFlight, flightMetrics, MAX_FLIGHT_TIME } from '../physics/projectile/flight.js';
import { INTEGRATORS } from '../physics/integrators.js';
import { advanceFixed, maxStepsFor } from '../utils/timeStep.js';
import { degToRad } from '../utils/units.js';

export const PLAYBACK_SPEEDS = [0.5, 1, 2, 5, 10];
export const DEFAULT_PROJECTILE_DT = 0.01; // s
const PREVIEW_POINTS = 400; // points per predicted path (drawing only)

export const RUNS = {
    analytic: { label: 'Analytical, no drag', short: 'Exact', color: '#ffffff' },
    numeric: { label: 'Numerical, no drag', short: 'Numerical', color: '#48dbfb' },
    drag: { label: 'Numerical, quadratic drag', short: 'Drag', color: '#ff9f43' },
};

export const launchFromParams = ({ velocity, angleDeg, gravity, height = 0 }) => ({
    v0: velocity,
    theta: degToRad(angleDeg),
    g: gravity,
    y0: height,
});

export const airFromParams = ({ rho, cd, area, mass }) => ({ rho, cd, area, mass });

/** The trajectories shown in this mode, each with its drag constant k (1/m). */
function runSpecs(params) {
    if (params.mode === 'ideal') return [{ id: 'analytic', k: 0 }];
    return [
        { id: 'analytic', k: 0 },
        { id: 'numeric', k: 0 },
        { id: 'drag', k: dragConstant(airFromParams(params)) },
    ];
}

function createRun({ id, k }, launch) {
    if (id === 'analytic') {
        const T = ideal.flightTime(launch);
        const y = ideal.stateAt(launch, 0);
        return { id, kind: 'analytic', T, y, landed: T === 0, diverged: false, trail: [[y[0], y[1]]] };
    }
    const flight = createFlight(launch, k);
    return {
        id,
        kind: 'numeric',
        f: derivative({ g: launch.g, k }),
        flight,
        y: flight.y,
        landed: flight.landing !== null,
        diverged: false,
        trail: [[flight.y[0], flight.y[1]]],
    };
}

/** State for a shot just fired with the current parameters. */
export function launch(params) {
    const shot = launchFromParams(params);
    return {
        phase: 'flying',
        steps: 0,
        t: 0,
        accumulator: 0,
        h: params.dt,
        integrator: INTEGRATORS[params.integrator],
        launch: shot,
        runs: runSpecs(params).map((spec) => createRun(spec, shot)),
    };
}

/** Moves a run's displayed state to the simulation clock and extends its trail. */
function syncRun(run, state) {
    if (run.done) return;
    if (run.kind === 'analytic') {
        const t = Math.min(state.t, run.T);
        run.y = ideal.stateAt(state.launch, t);
        if (t >= run.T) {
            run.y[1] = 0;
            run.landed = true;
        }
    } else {
        run.y = run.flight.y;
        run.diverged = run.flight.diverged;
        run.landed = run.flight.landing !== null;
    }
    run.trail.push([run.y[0], run.y[1]]);
    run.done = run.landed || run.diverged;
}

export const projectileSimulation = {
    init: () => ({ phase: 'idle', t: 0, runs: [] }),

    step(state, params, dt) {
        if (state.phase !== 'flying') return null;
        const { h, integrator } = state;
        // Every numerical run takes the same fixed steps; the clock is steps·h.
        const result = advanceFixed(
            state.steps,
            (n) => {
                for (const run of state.runs) {
                    if (run.kind === 'numeric') advanceFlight(run.flight, run.f, integrator, h);
                }
                return n + 1;
            },
            dt * params.playbackSpeed,
            state.accumulator,
            { h, maxSteps: maxStepsFor(h, params.playbackSpeed) },
        );
        state.steps = result.state;
        state.accumulator = result.accumulator;
        state.t = state.steps * h;
        for (const run of state.runs) syncRun(run, state);

        if (state.runs.every((run) => run.done) || state.t >= MAX_FLIGHT_TIME) {
            state.phase = 'landed';
            return { type: 'landed' };
        }
        return null;
    },
};

/**
 * Full predicted trajectories for the current parameters, computed with the
 * same integrator and Δt as a real shot: { id, path: [[x, y], …], metrics, diverged }.
 * Used for the dashed preview, the camera and the metrics table.
 */
export function predictFlights(params) {
    const shot = launchFromParams(params);
    const integrator = INTEGRATORS[params.integrator];
    const T = ideal.flightTime(shot);

    return runSpecs(params).map(({ id, k }) => {
        if (id === 'analytic') {
            const path = Array.from({ length: PREVIEW_POINTS + 1 }, (_, i) => {
                const p = ideal.position(shot, (T * i) / PREVIEW_POINTS);
                return [p.x, Math.max(0, p.y)];
            });
            return { id, path, metrics: ideal.flightSummary(shot), diverged: false };
        }
        const stride = Math.max(1, Math.floor(T / params.dt / PREVIEW_POINTS));
        const path = [];
        let n = 0;
        const flight = simulateFlight({
            launch: shot, k, integrator, dt: params.dt,
            visit: (t, y) => {
                if (n++ % stride === 0) path.push([y[0], y[1]]);
            },
        });
        if (flight.landing) path.push([flight.landing.state[0], 0]);
        return { id, path, metrics: flightMetrics(flight), diverged: flight.diverged };
    });
}

/** Columns of the flight report: every step of every trajectory, plus the parameters. */
export const REPORT_COLUMNS = [
    'trajectory', 'method', 't (s)', 'x (m)', 'y (m)', 'vx (m/s)', 'vy (m/s)', 'speed (m/s)', 'KE (J)', 'PE (J)', 'E (J)',
    'Δt (s)', 'v0 (m/s)', 'angle (deg)', 'y0 (m)', 'g (m/s²)', 'rho (kg/m³)', 'Cd', 'A (m²)', 'm (kg)',
];

/**
 * Full-resolution flight data for the current parameters: one row per
 * integration step per trajectory (the analytical one is evaluated at the same
 * instants), ending at the located impact point. Energies use the mass m and
 * PE = m·g·y.
 */
export function flightReport(params) {
    const shot = launchFromParams(params);
    const integrator = INTEGRATORS[params.integrator];
    const constants = [params.dt, params.velocity, params.angleDeg, params.height, params.gravity, params.rho, params.cd, params.area, params.mass];
    const rows = [];
    const add = (id, method, t, [x, y, vx, vy]) => {
        const speed = Math.hypot(vx, vy);
        const ke = 0.5 * params.mass * speed * speed;
        const pe = params.mass * params.gravity * y;
        rows.push([RUNS[id].label, method, t, x, y, vx, vy, speed, ke, pe, ke + pe, ...constants]);
    };

    for (const { id, k } of runSpecs(params)) {
        if (id === 'analytic') {
            const T = ideal.flightTime(shot);
            const steps = Math.floor(T / params.dt);
            for (let n = 0; n <= steps; n++) add(id, 'closed form', n * params.dt, ideal.stateAt(shot, n * params.dt));
            if (T > steps * params.dt) add(id, 'closed form', T, [ideal.range(shot), 0, ...ideal.stateAt(shot, T).slice(2)]);
            continue;
        }
        const flight = simulateFlight({ launch: shot, k, integrator, dt: params.dt, visit: (t, y) => add(id, integrator.name, t, y) });
        if (flight.landing) add(id, integrator.name, flight.landing.t, flight.landing.state);
    }
    return rows;
}
