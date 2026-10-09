// Numerical experiments on the undamped nonlinear pendulum.

import { derivative, energy, exactMotion, exactPeriod, smallAnglePeriod } from './pendulum.js';
import { createPeriodDetector, detectPeriod } from '../analysis.js';
import { degToRad } from '../../utils/units.js';

/**
 * Simulated period of an undamped pendulum released from rest at `amplitude`
 * (rad, 0 < θ₀ < π): integrates with `integrator` at step `dt` and returns the
 * time between the first two downward zero crossings. Returns NaN if no full
 * period completes within `maxTime` (e.g. an unstable method spun the pendulum
 * over the top, so θ never crosses zero again).
 */
export function measurePeriod({ amplitude, length, g, integrator, dt, maxTime }) {
    const f = derivative({ g, length, damping: 0 });
    const limit = maxTime ?? 3 * exactPeriod(amplitude, length, g);
    const detector = createPeriodDetector();
    let y = [Math.abs(amplitude), 0];
    for (let t = 0; t < limit; t += dt) {
        const next = integrator.step(y, f, dt, t);
        const period = detectPeriod(detector, t, y, t + dt, next, f);
        y = next;
        if (period !== null) return period;
    }
    return NaN;
}

/** T(θ₀)/T₀ for the exact nonlinear pendulum; independent of L and g. */
export const exactPeriodRatio = (amplitude) => exactPeriod(amplitude, 1, 1) / smallAnglePeriod(1, 1);

/**
 * Period-vs-amplitude sweep. For each amplitude (degrees) returns the simulated
 * period, the exact (elliptic-integral) period and the small-angle period T₀.
 */
export function periodVsAmplitude({ amplitudesDeg, length, g, integrator, dt }) {
    const T0 = smallAnglePeriod(length, g);
    return amplitudesDeg.map((amplitudeDeg) => {
        const amplitude = degToRad(amplitudeDeg);
        const exact = exactPeriod(amplitude, length, g);
        const simulated = measurePeriod({ amplitude, length, g, integrator, dt });
        return {
            amplitudeDeg,
            simulated,
            exact,
            smallAngle: T0,
            simulatedRatio: simulated / T0,
            exactRatio: exact / T0,
            relativeError: (simulated - exact) / exact,
        };
    });
}

/** Each timed run repeats until this much wall-clock time has passed, so short runs are not lost in timer resolution. */
const MIN_TIMING_MS = 5;
/** …but never more often than this, so a coarse or frozen clock cannot hang the page. */
const MAX_TIMING_REPEATS = 2000;

function integrateSteps(integrator, f, y0, dt, steps) {
    let y = y0;
    for (let n = 0; n < steps; n++) y = integrator.step(y, f, dt, n * dt);
    return y;
}

/**
 * Wall-clock seconds per call of `run`, averaged over enough repeats to be
 * measurable. One untimed call first, so the JavaScript engine has compiled
 * the integrator before the clock starts.
 */
function secondsPerRun(run, now) {
    run();
    const start = now();
    let repeats = 0;
    do {
        run();
        repeats++;
    } while (now() - start < MIN_TIMING_MS && repeats < MAX_TIMING_REPEATS);
    return (now() - start) / repeats / 1000;
}

/**
 * Accuracy against cost. Integrates the undamped pendulum released from rest
 * at `amplitude` (rad) for `duration` seconds with every method at every Δt
 * and records:
 *   maxError     largest |θ − θ_exact| over the run (rad), against exactMotion();
 *                Infinity if the run blew up
 *   energyDrift  (E − E₀)/E₀ at the end
 *   evaluations  derivative evaluations used (steps × evaluations per step)
 *   seconds      measured wall-clock time of one run, or NaN when no clock
 *                (`now`, in ms, e.g. performance.now) is given
 */
export function accuracyVsCost({ amplitude, length, g, integrators, dts, duration, now }) {
    const f = derivative({ g, length, damping: 0 });
    const physics = { g, length, mass: 1 };
    const y0 = [amplitude, 0];
    const E0 = energy(y0, physics).total;
    const rows = [];
    for (const integrator of integrators) {
        for (const dt of dts) {
            const steps = Math.round(duration / dt);
            let y = y0;
            let maxError = 0;
            for (let n = 1; n <= steps; n++) {
                y = integrator.step(y, f, dt, (n - 1) * dt);
                const error = Math.abs(y[0] - exactMotion(amplitude, length, g, n * dt)[0]);
                if (!Number.isFinite(error)) {
                    maxError = Infinity;
                    break;
                }
                maxError = Math.max(maxError, error);
            }
            rows.push({
                method: integrator.id,
                dt,
                steps,
                evaluations: steps * integrator.evaluationsPerStep,
                maxError,
                energyDrift: Number.isFinite(maxError) ? (energy(y, physics).total - E0) / E0 : NaN,
                seconds: now ? secondsPerRun(() => integrateSteps(integrator, f, y0, dt, steps), now) : NaN,
            });
        }
    }
    return rows;
}
