// Runs the same undamped/damped nonlinear pendulum through all three
// integrators side by side, from identical initial conditions and with the
// same timestep, so their differences come only from the method. Each run is
// measured against a reference solution at every step:
//
//   γ = 0   the exact solution (Jacobi elliptic functions, pendulum.exactMotion)
//   γ > 0   RK4 with Δt / REFERENCE_SUBSTEPS (no closed form exists)
//
// params = { lengthM, gravity, damping, amplitudeDeg, dt }

import * as pendulum from '../physics/pendulum/pendulum.js';
import { INTEGRATOR_LIST, rk4 } from '../physics/integrators.js';
import { createPeriodDetector, detectPeriod, relativeEnergyError } from '../physics/analysis.js';
import { advanceFixed, maxStepsFor } from '../utils/timeStep.js';
import { degToRad } from '../utils/units.js';

const SAMPLE_DT = 1 / 30; // s of simulated time between chart samples
export const ENERGY_WINDOW = 60; // s of history kept for the time charts
const MAX_SAMPLES = Math.round(ENERGY_WINDOW / SAMPLE_DT);
const MAX_PHASE_SAMPLES = 900; // 30 s of phase-space trail

/**
 * Substeps of the damped reference. RK4's error scales as Δt⁴, so the
 * reference is 20⁴ ≈ 1.6×10⁵ times more accurate than the RK4 run it checks.
 */
export const REFERENCE_SUBSTEPS = 20;

const physicsFor = (params) => ({
    g: params.gravity,
    length: params.lengthM,
    damping: params.damping,
    mass: pendulum.BOB_MASS,
});

const createRun = (integrator, y0, E0) => ({
    id: integrator.id,
    integrator,
    y: y0,
    E0,
    steps: 0,
    drift: 0, // latest ΔE/E₀
    error: 0, // latest |θ − θ_ref| (rad)
    maxError: 0,
    detector: createPeriodDetector(),
    energySamples: [], // [t, ΔE/E₀]
    errorSamples: [], // [t, |θ − θ_ref|]
    phase: [], // [θ, ω]
});

/** Derivative evaluations so far: steps × evaluations per step (the usual measure of cost). */
export const evaluations = (run) => run.steps * run.integrator.evaluationsPerStep;

/** Reference state at time t for these parameters. */
function referenceAt(state, params, t) {
    if (params.damping === 0) return pendulum.exactMotion(state.amplitude, params.lengthM, params.gravity, t);
    return state.reference;
}

const pushCapped = (list, item, max) => {
    list.push(item);
    if (list.length > max) list.shift();
};

export const integratorComparison = {
    init(params) {
        const amplitude = degToRad(params.amplitudeDeg);
        const y0 = [amplitude, 0];
        const E0 = pendulum.energy(y0, physicsFor(params)).total;
        return {
            t: 0,
            accumulator: 0,
            sampleClock: 0,
            amplitude,
            reference: y0, // only advanced when γ > 0
            runs: INTEGRATOR_LIST.map((integrator) => createRun(integrator, y0, E0)),
        };
    },

    step(state, params, dt, sample) {
        const physics = physicsFor(params);
        const f = pendulum.derivative(physics);
        const newPeriods = {};

        // All runs advance in lock-step: same number of steps of the same size.
        const result = advanceFixed(
            state.t,
            (t, h) => {
                if (params.damping > 0) {
                    const sub = h / REFERENCE_SUBSTEPS;
                    for (let i = 0; i < REFERENCE_SUBSTEPS; i++) state.reference = rk4.step(state.reference, f, sub, t + i * sub);
                }
                const reference = referenceAt(state, params, t + h);
                for (const run of state.runs) {
                    const y = run.integrator.step(run.y, f, h, t);
                    const period = detectPeriod(run.detector, t, run.y, t + h, y, f);
                    if (period !== null) newPeriods[run.id] = period;
                    run.y = y;
                    run.steps += 1;
                    run.error = Math.abs(y[0] - reference[0]);
                    if (run.error > run.maxError || !Number.isFinite(run.error)) run.maxError = run.error;
                }
                sample?.(t + h, { runs: state.runs, reference });
                return t + h;
            },
            dt,
            state.accumulator,
            { h: params.dt, maxSteps: maxStepsFor(params.dt) },
        );
        state.t = result.state;
        state.accumulator = result.accumulator;

        for (const run of state.runs) {
            run.drift = relativeEnergyError(pendulum.energy(run.y, physics).total, run.E0);
        }

        state.sampleClock += dt;
        while (state.sampleClock >= SAMPLE_DT) {
            state.sampleClock -= SAMPLE_DT;
            for (const run of state.runs) {
                pushCapped(run.energySamples, [state.t, run.drift], MAX_SAMPLES);
                pushCapped(run.errorSamples, [state.t, run.error], MAX_SAMPLES);
                pushCapped(run.phase, [run.y[0], run.y[1]], MAX_PHASE_SAMPLES);
            }
        }

        return Object.keys(newPeriods).length ? { type: 'periods', periods: newPeriods } : null;
    },
};

/** Columns of the comparison data log: one row per method per sample. */
export const LOG_COLUMNS = [
    { key: 't', label: 't', unit: 's' },
    { key: 'method', label: 'method' },
    { key: 'theta', label: 'θ', unit: 'rad' },
    { key: 'omega', label: 'ω', unit: 'rad/s' },
    { key: 'e', label: 'E', unit: 'J' },
    { key: 'drift', label: 'ΔE/E₀' },
    { key: 'thetaRef', label: 'θ_reference', unit: 'rad' },
    { key: 'error', label: '|θ − θ_reference|', unit: 'rad' },
    { key: 'evaluations', label: 'f evaluations' },
    { key: 'dt', label: 'Δt', unit: 's' },
    { key: 'L', label: 'L', unit: 'm' },
    { key: 'g', label: 'g', unit: 'm/s²' },
    { key: 'gamma', label: 'γ', unit: '1/s' },
    { key: 'theta0', label: 'θ₀', unit: 'rad' },
];

/** Log rows (one per run) for a sample taken at time t. */
export function logRows(t, { runs, reference }, params) {
    const physics = physicsFor(params);
    return runs.map((run) => {
        const E = pendulum.energy(run.y, physics).total;
        return [
            t, run.integrator.name, run.y[0], run.y[1], E, relativeEnergyError(E, run.E0), reference[0], run.error,
            evaluations(run), params.dt, params.lengthM, params.gravity, params.damping, degToRad(params.amplitudeDeg),
        ];
    });
}
