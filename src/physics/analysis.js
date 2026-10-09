// Measurements on simulated trajectories. Pure functions / plain data.

/**
 * Period detector: records downward zero crossings of the position
 * (x goes from > 0 to ≤ 0) and reports the time between consecutive ones.
 *
 * The crossing inside a step is located on the cubic Hermite interpolant of
 * the step (locateCrossing below), whose error is O(h⁴). Linear interpolation
 * is not good enough: its error is O(h²)·|x''| at the crossing, and with
 * damping x'' = −2γv ≠ 0 there. For a damped spring at Δt = 10 ms it put a
 * 1.7×10⁻⁶ error on RK4's period, a thousand times RK4's own (1.7×10⁻⁹),
 * so the readout measured the interpolation instead of the integrator.
 */
export const createPeriodDetector = () => ({ lastCrossing: null, periods: [] });

/**
 * Feeds one step (t₀, y₀) → (t₁, y₁) of a state vector whose first component
 * is the position, with f the derivative function the step was integrated
 * with. Returns the new period if one was completed, else null.
 */
export function detectPeriod(detector, t0, y0, t1, y1, f) {
    if (!(y0[0] > 0 && y1[0] <= 0)) return null;
    const { s } = locateCrossing(y0, f(y0, t0), y1, f(y1, t1), t1 - t0, 0);
    const tc = t0 + (t1 - t0) * s;
    const last = detector.lastCrossing;
    detector.lastCrossing = tc;
    if (last === null) return null;
    const period = tc - last;
    detector.periods.push(period);
    return period;
}

/** Relative energy error ΔE/E₀. Returns NaN when E₀ is zero (nothing to compare against). */
export const relativeEnergyError = (E, E0) => (E0 === 0 ? NaN : (E - E0) / E0);

/**
 * Cubic Hermite interpolation of a state vector inside one step of size h,
 * using the states y0, y1 and their derivatives f0 = f(y0), f1 = f(y1).
 * s ∈ [0, 1] is the fraction of the step. Exact for solutions that are cubic
 * polynomials in t; otherwise its error is O(h⁴), matching RK4.
 */
export function hermite(y0, f0, y1, f1, h, s) {
    const s2 = s * s;
    const s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;
    return y0.map((a, i) => h00 * a + h10 * h * f0[i] + h01 * y1[i] + h11 * h * f1[i]);
}

/** 2⁻⁶⁰ < 10⁻¹⁸: after this many halvings the step fraction is exact to double precision. */
const BISECTION_STEPS = 60;

/**
 * Locates where component `index` of the state crosses zero inside a step,
 * given y0[index] > 0 ≥ y1[index]. Bisects the Hermite interpolant. Returns
 * { s, state } with s the step fraction.
 */
export function locateCrossing(y0, f0, y1, f1, h, index) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < BISECTION_STEPS; i++) {
        const mid = 0.5 * (lo + hi);
        if (hermite(y0, f0, y1, f1, h, mid)[index] > 0) lo = mid; else hi = mid;
    }
    const s = 0.5 * (lo + hi);
    return { s, state: hermite(y0, f0, y1, f1, h, s) };
}

/**
 * Error of a simulated value against an analytical reference: the signed
 * absolute error and the relative error, relative to `scale` (by default the
 * reference's magnitude; pass e.g. the amplitude for a quantity that passes
 * through zero, where a relative error would be meaningless).
 */
export function errorAgainst(reference, simulated, scale = Math.abs(reference)) {
    const absolute = simulated - reference;
    return { absolute, relative: scale > 0 ? absolute / scale : NaN };
}
