// Pendulum / spring simulation integrated on a fixed, user-selectable timestep.
// params = { mode: 'pendulum' | 'spring', startAngleDeg, lengthM, gravity,
//            amplitudeM, mass, k, damping, integrator: 'euler'|'symplectic'|'rk4', dt }
//
// State vector y = [position, velocity]: [θ, ω] for the pendulum, [x, v] for the spring.

import * as pendulum from '../physics/pendulum/pendulum.js';
import * as spring from '../physics/spring/spring.js';
import { INTEGRATORS } from '../physics/integrators.js';
import { createPeriodDetector, detectPeriod } from '../physics/analysis.js';
import { advanceFixed, maxStepsFor } from '../utils/timeStep.js';
import { degToRad } from '../utils/units.js';

export const DEFAULT_DT = 0.005;
/** m. Longest pendulum and largest spring amplitude the lab offers; the drawing scale is fitted to them. */
export const MAX_LENGTH_M = 4;
export const MAX_AMPLITUDE_M = 2;
export const GRAPH_SAMPLE_DT = 1 / 30; // s of simulated time between graph samples
export const GRAPH_SAMPLES = 300; // → 10 s window
const PHASE_SAMPLES = 600; // → 20 s of phase-space trail

/** The physics model and SI parameters for the current mode. */
function modelFor(params) {
    return params.mode === 'pendulum'
        ? { model: pendulum, physics: { g: params.gravity, length: params.lengthM, damping: params.damping, mass: pendulum.BOB_MASS } }
        : { model: spring, physics: { k: params.k, mass: params.mass, damping: params.damping } };
}

/** Small-angle / undamped analytic period for the current mode (s). */
export const analyticPeriod = (params) =>
    params.mode === 'pendulum'
        ? pendulum.smallAnglePeriod(params.lengthM, params.gravity)
        : spring.period({ k: params.k, mass: params.mass });

const initialPosition = (params) =>
    params.mode === 'pendulum' ? degToRad(params.startAngleDeg) : params.amplitudeM;

// Changing a parameter does work on the system (e.g. shortening the string),
// so the energy reference is re-taken instead of resetting the motion.
const paramKey = (p) => `${p.mode}|${p.lengthM}|${p.gravity}|${p.k}|${p.mass}|${p.damping}`;

export const oscillatorSimulation = {
    init: (params) => ({
        y: [initialPosition(params), 0],
        t: 0,
        accumulator: 0,
        sampleClock: 0,
        history: [], // position samples for the time graph
        phase: [], // [position, velocity] samples for the phase-space plot
        detector: createPeriodDetector(),
        // Where and when the bob/block was last released from rest. The exact
        // solution is a valid reference only while this is set: changing a
        // physical parameter mid-motion clears it.
        release: { t: 0, position: initialPosition(params) },
        energy: { ke: 0, pe: 0, total: 0 },
        energyRef: null,
        paramKey: '',
    }),

    step(state, params, dt, sample) {
        const { model, physics } = modelFor(params);
        // After a reset or a drag the reference is the energy at release, so
        // take it before the first step moves the system (sync runs after step).
        if (state.energyRef === null) {
            state.energyRef = model.energy(state.y, physics).total;
            state.paramKey = paramKey(params);
        }
        const f = model.derivative(physics);
        const integrator = INTEGRATORS[params.integrator];
        let newPeriod = null;

        const result = advanceFixed(
            { y: state.y, t: state.t },
            (s, h) => {
                const y = integrator.step(s.y, f, h, s.t);
                newPeriod = detectPeriod(state.detector, s.t, s.y, s.t + h, y, f) ?? newPeriod;
                sample?.(s.t + h, y);
                return { y, t: s.t + h };
            },
            dt,
            state.accumulator,
            { h: params.dt, maxSteps: maxStepsFor(params.dt) },
        );
        state.y = result.state.y;
        state.t = result.state.t;
        state.accumulator = result.accumulator;

        state.sampleClock += dt;
        while (state.sampleClock >= GRAPH_SAMPLE_DT) {
            state.sampleClock -= GRAPH_SAMPLE_DT;
            state.history.push(state.y[0]);
            if (state.history.length > GRAPH_SAMPLES) state.history.shift();
            state.phase.push([state.y[0], state.y[1]]);
            if (state.phase.length > PHASE_SAMPLES) state.phase.shift();
        }
        return newPeriod === null ? null : { type: 'period', period: newPeriod };
    },

    sync(state, params) {
        const { model, physics } = modelFor(params);
        state.energy = model.energy(state.y, physics);
        const key = paramKey(params);
        if (state.energyRef === null) {
            state.energyRef = state.energy.total;
            state.paramKey = key;
        } else if (state.paramKey !== key) {
            state.energyRef = state.energy.total;
            state.paramKey = key;
            // Still held where it was released (no time has passed, e.g. during a
            // drag): the new parameters simply apply from the release. This does
            // not depend on whether React delivered the new parameters before or
            // after the frame that saw the drag.
            if (state.release && state.t === state.release.t) return;
            // The system changed under the moving bob: what follows is a different
            // motion, so the exact solution no longer applies and the period
            // measurement restarts.
            state.release = null;
            state.detector = createPeriodDetector();
        }
    },
};

/** Holds the bob/block at position x (rad or m) at rest, e.g. while dragging. */
export function holdAt(state, x) {
    state.y = [x, 0];
    state.accumulator = 0;
    state.energyRef = null; // re-reference at the new release point
    state.detector = createPeriodDetector(); // a period across a drag would be meaningless
    state.phase = [];
    state.release = { t: state.t, position: x };
}

/**
 * Exact position (rad or m) at the current time for the motion since the
 * last release, or null when there is no closed form: a parameter changed
 * mid-motion, or the pendulum is damped (the nonlinear damped pendulum has no
 * closed-form solution).
 */
export function exactPositionNow(state, params) {
    if (!state.release) return null;
    const elapsed = state.t - state.release.t;
    if (params.mode === 'pendulum') {
        return params.damping === 0
            ? pendulum.exactMotion(state.release.position, params.lengthM, params.gravity, elapsed)[0]
            : null;
    }
    return spring.exactPosition(state.release.position, { k: params.k, mass: params.mass, damping: params.damping }, elapsed);
}

/** Last measured period (s), or null before the first full period. */
export const lastPeriod = (state) => state.detector.periods.at(-1) ?? null;

/**
 * Analytical vs simulated values for the validation panel. Each row is
 * { quantity, reference, analytical, simulated, unit, scale? } or
 * { quantity, reference, unavailable } when no exact reference exists.
 */
export function validationRows(state, params) {
    const measured = lastPeriod(state) ?? NaN;
    const release = state.release;
    const exact = exactPositionNow(state, params);
    const rows = [];

    if (params.mode === 'pendulum') {
        const amplitude = release?.position ?? 0;
        rows.push(params.damping > 0 || !release
            ? { quantity: 'Period T', reference: 'exact, 4√(L/g)·K(k²)', unavailable: params.damping > 0 ? 'No closed form with damping (γ > 0).' : 'Parameters changed mid-swing; reset or drag to release again.' }
            : { quantity: 'Period T', reference: 'exact, 4√(L/g)·K(k²)', analytical: pendulum.exactPeriod(amplitude, params.lengthM, params.gravity), simulated: measured, unit: 's' });
        if (exact !== null && amplitude !== 0) {
            rows.push({ quantity: 'Angle θ(t)', reference: 'exact, Jacobi elliptic solution; rel. to θ₀', analytical: exact, simulated: state.y[0], unit: 'rad', scale: Math.abs(amplitude) });
        }
    } else {
        const w0 = spring.naturalFrequency(params);
        rows.push(params.damping < w0
            ? { quantity: 'Period T', reference: 'exact, 2π/√(k/m − γ²)', analytical: (2 * Math.PI) / Math.sqrt(w0 * w0 - params.damping ** 2), simulated: measured, unit: 's' }
            : { quantity: 'Period T', reference: 'exact', unavailable: 'Critically damped or overdamped: no oscillation.' });
        rows.push(exact === null
            ? { quantity: 'Position x(t)', reference: 'exact solution', unavailable: 'Parameters changed mid-motion; reset or drag to release again.' }
            : { quantity: 'Position x(t)', reference: 'exact solution; rel. to x₀', analytical: exact, simulated: state.y[0], unit: 'm', scale: Math.abs(release.position) });
    }
    if (params.damping === 0) {
        rows.push({ quantity: 'Energy E', reference: 'conserved: E at release', analytical: state.energyRef ?? NaN, simulated: state.energy.total, unit: 'J' });
    }
    return rows;
}

/**
 * The small-angle period T₀ = 2π√(L/g) beside the exact period of the current
 * release, for an undamped pendulum: { smallAngle, exact, longerBy }, or null.
 * Their difference is the linearisation sin θ ≈ θ, a property of the model and
 * not a numerical error, so it is reported apart from the validation rows.
 */
export function smallAngleComparison(state, params) {
    if (params.mode !== 'pendulum' || params.damping !== 0 || !state.release) return null;
    const smallAngle = analyticPeriod(params);
    const exact = pendulum.exactPeriod(state.release.position, params.lengthM, params.gravity);
    return { smallAngle, exact, longerBy: exact / smallAngle - 1 };
}

/** Columns of the data log for each mode (simulation/dataLog.js adds the run number). */
export function logColumns(mode) {
    const [position, velocity] = mode === 'pendulum'
        ? [{ key: 'theta', label: 'θ', unit: 'rad' }, { key: 'omega', label: 'ω', unit: 'rad/s' }]
        : [{ key: 'x', label: 'x', unit: 'm' }, { key: 'v', label: 'v', unit: 'm/s' }];
    const parameters = mode === 'pendulum'
        ? [{ key: 'L', label: 'L', unit: 'm' }, { key: 'g', label: 'g', unit: 'm/s²' }, { key: 'm', label: 'm', unit: 'kg' }]
        : [{ key: 'k', label: 'k', unit: 'N/m' }, { key: 'm', label: 'm', unit: 'kg' }];
    return [
        { key: 't', label: 't', unit: 's' },
        position,
        velocity,
        { key: 'ke', label: 'KE', unit: 'J' },
        { key: 'pe', label: 'PE', unit: 'J' },
        { key: 'e', label: 'E', unit: 'J' },
        { key: 'method', label: 'method' },
        { key: 'dt', label: 'Δt', unit: 's' },
        ...parameters,
        { key: 'gamma', label: 'γ', unit: '1/s' },
    ];
}

/** One log row matching logColumns(params.mode). */
export function logRow(t, y, params) {
    const { model, physics } = modelFor(params);
    const { ke, pe, total } = model.energy(y, physics);
    const parameters = params.mode === 'pendulum'
        ? [params.lengthM, params.gravity, pendulum.BOB_MASS]
        : [params.k, params.mass];
    return [t, y[0], y[1], ke, pe, total, params.integrator, params.dt, ...parameters, params.damping];
}
