// Analytical interference and diffraction for one or two slits, in SI units.
//
// Geometry: the slit plane is x = 0, the screen is the line x = D. In double-
// slit mode slit 1 is centred at y = +d/2 and slit 2 at y = −d/2; in single-
// slit mode one slit is centred at y = 0. Each slit has width a.
//
// Model (Huygens–Fresnel, 2-D): every point of an open slit re-radiates a
// cylindrical wave. A slit is discretised into n coherent sub-sources and
// the complex field (phasor) at a point is the sum
//
//     U(x, y) = Σ_j  (A_j / n) · √(D / r_j) · e^{i(k r_j + φ_j)}
//
// with k = 2π/λ, r_j the distance to sub-source j, A_j the slit's amplitude
// and φ_j its phase (slit 2 carries the phase difference φ). √(D/r) is the
// 2-D cylindrical spreading, normalised so a slit far away on the axis
// contributes amplitude A_j. The real field is u = Re(U·e^{−iωt}), and the
// time-averaged intensity is ⟨u²⟩ = |U|²/2. Here "intensity" is I = |U|²
// (the factor ½ cancels in every ratio shown).
//
// setup = { mode: 'double' | 'single', wavelength λ (m), waveSpeed c (m/s),
//           slitSeparation d (m), slitWidth a (m), screenDistance D (m),
//           phase φ (rad), amplitude1 A₁, amplitude2 A₂ }

export const wavenumber = (wavelength) => (2 * Math.PI) / wavelength;
export const frequency = ({ waveSpeed, wavelength }) => waveSpeed / wavelength;

/** Small-angle fringe spacing β = λD/d. */
export const fringeSpacing = ({ wavelength, screenDistance, slitSeparation }) =>
    (wavelength * screenDistance) / slitSeparation;

/** Small-angle position of the single-slit envelope's first zero, λD/a. */
export const envelopeZero = ({ wavelength, screenDistance, slitWidth }) =>
    (wavelength * screenDistance) / slitWidth;

/** Exact screen position of the direction sin θ = s (Infinity if |s| ≥ 1). */
export const screenPositionOf = (s, screenDistance) =>
    Math.abs(s) >= 1 ? Math.sign(s) * Infinity : screenDistance * Math.tan(Math.asin(s));

/**
 * Fraunhofer (far-field) distance for an aperture of total size L: L²/λ.
 * The Fraunhofer formulas hold when D ≫ this.
 */
export const fraunhoferDistance = (size, wavelength) => (size * size) / wavelength;

/** Overall aperture size: d + a for two slits, a for one. */
export const apertureSize = ({ mode, slitSeparation, slitWidth }) =>
    mode === 'double' ? slitSeparation + slitWidth : slitWidth;

const sinc = (x) => (Math.abs(x) < 1e-8 ? 1 - (x * x) / 6 : Math.sin(x) / x);

/** The slits as { y (centre), amplitude, phase } in this mode. */
export function slits({ mode, slitSeparation, phase, amplitude1, amplitude2 }) {
    if (mode === 'single') return [{ y: 0, amplitude: amplitude1, phase: 0 }];
    return [
        { y: slitSeparation / 2, amplitude: amplitude1, phase: 0 },
        { y: -slitSeparation / 2, amplitude: amplitude2, phase },
    ];
}

/**
 * Coherent sub-sources { y, weight, phase } with at most `spacing` metres
 * between them (midpoint rule across each slit); a slit of width 0 is one
 * point source. `maxPerSlit` caps the count for the 2-D field view.
 */
export function subSources(setup, spacing, maxPerSlit = Infinity) {
    const a = setup.slitWidth;
    const out = [];
    for (const slit of slits(setup)) {
        const n = a > 0 ? Math.min(maxPerSlit, Math.max(1, Math.ceil(a / spacing))) : 1;
        for (let j = 0; j < n; j++) {
            const y = a > 0 ? slit.y - a / 2 + ((j + 0.5) * a) / n : slit.y;
            out.push({ y, weight: slit.amplitude / n, phase: slit.phase });
        }
    }
    return out;
}

/**
 * Sub-source spacing for the screen pattern. The phase of a sub-source's wave
 * at the screen changes with its position y_s at rate k·sin θ, so a spacing of
 * λ / (SOURCES_PER_WAVELENGTH·sin θ_max) keeps the phase step between
 * neighbours below π/25 everywhere on the displayed screen (amplitude error of
 * the midpoint rule against the exact slit integral ≈ (π/25)²/24 < 10⁻³).
 */
const SOURCES_PER_WAVELENGTH = 50;
function screenSourceSpacing(setup, halfWidth) {
    const reach = halfWidth + apertureSize(setup) / 2;
    const sinMax = reach / Math.hypot(setup.screenDistance, reach);
    return setup.wavelength / (SOURCES_PER_WAVELENGTH * Math.max(sinMax, 1e-6));
}
const MAX_SCREEN_SOURCES_PER_SLIT = 4000;

/**
 * Phase-relevant path length r − D for a source-to-point offset dy, computed
 * as dy² / (r + D) to avoid cancellation: at optical scales k·r ≈ 10⁷ rad, and
 * subtracting the common k·D (which does not change |U|²) keeps both the
 * trigonometry fast and every significant digit.
 */
export const excessPath = (dy, r, D) => (dy * dy) / (r + D);

/**
 * Simulated screen intensity I(y) = |U(D, y)|² from the phasor sum, at
 * `samples` points over [−halfWidth, halfWidth]. Returns { y, intensity }.
 */
export function screenPattern(setup, halfWidth, samples) {
    const { wavelength, screenDistance: D } = setup;
    const k = wavenumber(wavelength);
    const sources = subSources(setup, screenSourceSpacing(setup, halfWidth), MAX_SCREEN_SOURCES_PER_SLIT);
    const y = new Float64Array(samples);
    const intensity = new Float64Array(samples);
    for (let s = 0; s < samples; s++) {
        const ys = -halfWidth + (2 * halfWidth * s) / (samples - 1);
        let re = 0;
        let im = 0;
        for (const src of sources) {
            const dy = ys - src.y;
            const r = Math.sqrt(D * D + dy * dy);
            const w = src.weight * Math.sqrt(D / r);
            const a = k * excessPath(dy, r, D) + src.phase;
            re += w * Math.cos(a);
            im += w * Math.sin(a);
        }
        y[s] = ys;
        intensity[s] = re * re + im * im;
    }
    return { y, intensity };
}

/**
 * Fraunhofer (far-field) intensity at screen position y, for comparison with
 * the simulation. With sin θ = y/√(y² + D²):
 *   double: I = cos θ · [A₁² + A₂² + 2A₁A₂ cos(k d sin θ + φ)] · sinc²(k a sin θ / 2)
 *   single: I = cos θ · A₁² · sinc²(k a sin θ / 2)
 * cos θ is the 2-D spreading factor on a flat screen (r = D / cos θ).
 */
export function fraunhoferIntensity(setup, y) {
    const { mode, wavelength, screenDistance: D, slitSeparation: d, slitWidth: a, phase, amplitude1: A1, amplitude2: A2 } = setup;
    const r = Math.hypot(D, y);
    const s = y / r;
    const k = wavenumber(wavelength);
    const env = sinc((k * a * s) / 2) ** 2;
    const pair = mode === 'double' ? A1 * A1 + A2 * A2 + 2 * A1 * A2 * Math.cos(k * d * s + phase) : A1 * A1;
    return (D / r) * pair * env;
}

/** The single-slit envelope alone, scaled to the pattern's on-axis peak: cos θ · (A₁ + A₂)² · sinc². */
export function envelopeIntensity(setup, y) {
    const { mode, wavelength, screenDistance: D, slitWidth: a, amplitude1: A1, amplitude2: A2 } = setup;
    const r = Math.hypot(D, y);
    const peak = mode === 'double' ? (A1 + A2) ** 2 : A1 * A1;
    return (D / r) * peak * sinc((wavenumber(wavelength) * a * (y / r)) / 2) ** 2;
}

/**
 * Screen half-width that shows the interesting part of the pattern: about
 * five fringes each side for two slits (but not far past the envelope's
 * first zero), or the central maximum and two side lobes for one slit.
 */
const SCREEN = {
    maxHalfWidth: 1.5, // × D, i.e. ±56°: beyond that the screen would be mostly obliquity fall-off
    singleSlitLobes: 3.2, // × first-zero distance: the central maximum and two side lobes each side
    minFringes: 3, // × β: at least three fringes each side…
    maxFringes: 5.5, // …at most about five,
    envelopeMargin: 1.25, // …and not far past the envelope's first zero
};
function screenHalfWidth(setup) {
    const { mode, wavelength: lambda, screenDistance: D, slitWidth: a } = setup;
    const maxHalf = SCREEN.maxHalfWidth * D;
    const env = a > lambda ? screenPositionOf(lambda / a, D) : Infinity;
    if (mode === 'single') return Math.min(a > lambda ? SCREEN.singleSlitLobes * env : maxHalf, maxHalf);
    const beta = fringeSpacing(setup);
    return Math.min(Math.max(SCREEN.minFringes * beta, Math.min(SCREEN.maxFringes * beta, SCREEN.envelopeMargin * env)), maxHalf);
}

/** Local maxima of a sampled curve above `minRelative` × its peak, refined by a parabola through 3 samples. */
export function findExtrema(y, values, { kind = 'max', minRelative = 0 } = {}) {
    let peak = 0;
    for (const v of values) peak = Math.max(peak, v);
    const out = [];
    const sign = kind === 'max' ? 1 : -1;
    for (let i = 1; i < values.length - 1; i++) {
        const a = sign * values[i - 1];
        const b = sign * values[i];
        const c = sign * values[i + 1];
        if (!(b > a && b >= c)) continue;
        if (kind === 'max' && values[i] < minRelative * peak) continue;
        const denom = a - 2 * b + c;
        const shift = denom === 0 ? 0 : (0.5 * (a - c)) / denom; // in samples, |shift| ≤ ½
        const h = y[1] - y[0];
        out.push({ y: y[i] + shift * h, value: sign * (b - 0.25 * (a - c) * shift) });
    }
    return out;
}

/**
 * Fringe spacing measured from a two-slit pattern: the mean distance between
 * adjacent dark fringes within `window` of the central maximum yc. Dark
 * fringes are used because, for equal slits, they are exact zeros of the
 * pattern: the single-slit envelope multiplies them by zero and cannot move
 * them, whereas it pulls every bright fringe slightly towards the centre.
 */
export function measureFringeSpacing(y, intensity, yc, window) {
    const minima = findExtrema(y, intensity, { kind: 'min' }).filter((m) => Math.abs(m.y - yc) <= window);
    if (minima.length < 2) return { spacing: NaN, minima };
    return { spacing: (minima.at(-1).y - minima[0].y) / (minima.length - 1), minima };
}

/** Width of the central maximum: the distance between the minima on either side of yc. */
export function measureCentralWidth(y, intensity, yc = 0) {
    const minima = findExtrema(y, intensity, { kind: 'min' });
    const left = minima.filter((m) => m.y < yc).at(-1);
    const right = minima.find((m) => m.y > yc);
    return left && right ? right.y - left.y : NaN;
}

/**
 * Bright-fringe positions predicted for orders m:
 *   smallAngle: y = (m − φ/2π)·λD/d
 *   fraunhofer: y = D·tan(asin((m − φ/2π)·λ/d))   (exact direction of the maximum)
 */
export function predictedMaximum(setup, m) {
    const { wavelength: lambda, screenDistance: D, slitSeparation: d, phase } = setup;
    const order = m - phase / (2 * Math.PI);
    return {
        smallAngle: (order * lambda * D) / d,
        fraunhofer: screenPositionOf((order * lambda) / d, D),
    };
}

/**
 * Dark-fringe (two-slit minimum) positions for orders n = 1, 2, … above the
 * centre: path difference (n − ½)λ, shifted by the phase difference like the maxima.
 */
export function predictedMinimum(setup, n) {
    return predictedMaximum(setup, n - 0.5);
}

/**
 * Compares simulated and theoretical patterns over the displayed range:
 * the RMS difference as a percentage of the theoretical peak.
 */
function profileError(setup, y, intensity) {
    let peak = 0;
    let sum = 0;
    for (let i = 0; i < y.length; i++) {
        const th = fraunhoferIntensity(setup, y[i]);
        peak = Math.max(peak, th);
        sum += (intensity[i] - th) ** 2;
    }
    return peak > 0 ? (100 * Math.sqrt(sum / y.length)) / peak : NaN;
}

/**
 * Everything the page shows about the screen pattern, computed once per
 * parameter change:
 *   y, intensity        the simulated pattern (phasor sum)
 *   theory              the Fraunhofer formula on the same samples
 *   predicted           small-angle formula: β = λD/d (double) or 2λD/a (single)
 *   fraunhofer          the same quantity measured on the Fraunhofer curve
 *   measured            the same quantity measured on the simulated curve
 *   errorPct            measured vs predicted (small-angle), in %
 *   fraunhoferErrorPct  measured vs Fraunhofer, in % (near-field + discretisation only)
 *   profileErrorPct     RMS(simulated − theory) / theoretical peak, in %
 *   maxima, minima, theoryMaxima, theoryMinima   bright and dark fringes of each curve
 */
export function analyseScreen(setup, samples = 1601) {
    const halfWidth = screenHalfWidth(setup);
    const { y, intensity } = screenPattern(setup, halfWidth, samples);
    const theory = y.map((yi) => fraunhoferIntensity(setup, yi));

    let predicted;
    let measure;
    if (setup.mode === 'double') {
        predicted = fringeSpacing(setup);
        const yc = predictedMaximum(setup, 0).smallAngle;
        const env = setup.slitWidth > setup.wavelength ? envelopeZero(setup) : Infinity;
        const window = Math.min(2.6 * predicted, 0.9 * env, halfWidth - Math.abs(yc));
        measure = (values) => measureFringeSpacing(y, values, yc, window).spacing;
    } else {
        predicted = 2 * envelopeZero(setup);
        measure = (values) => measureCentralWidth(y, values);
    }
    const measured = measure(intensity);
    const fraunhofer = measure(theory);
    return {
        halfWidth,
        y,
        intensity,
        theory,
        predicted,
        fraunhofer,
        measured,
        errorPct: (100 * (measured - predicted)) / predicted,
        fraunhoferErrorPct: (100 * (measured - fraunhofer)) / fraunhofer,
        profileErrorPct: profileError(setup, y, intensity),
        maxima: findExtrema(y, intensity, { minRelative: 0.005 }),
        minima: findExtrema(y, intensity, { kind: 'min' }),
        theoryMaxima: findExtrema(y, theory, { minRelative: 0.005 }),
        theoryMinima: findExtrema(y, theory, { kind: 'min' }),
    };
}

const nearestExtremum = (list, target) =>
    list.reduce((best, e) => (!best || Math.abs(e.y - target) < Math.abs(best.y - target) ? e : best), null);

/** Orders compared in the fringe table: bright fringes ±3 (double slit), dark fringes ±1, ±2 (single slit). */
const DOUBLE_SLIT_ORDERS = [-3, -2, -1, 0, 1, 2, 3];
const SINGLE_SLIT_ORDERS = [-2, -1, 1, 2];

/**
 * Fringe positions three ways, for each order m on the displayed screen:
 *   smallAngle  the textbook formula
 *   fraunhofer  the far-field curve's extremum (NaN for a missing order)
 *   simulated   the phasor-sum pattern's extremum
 * Double slit: bright fringes. A "missing" order is one suppressed by a zero
 * of the single-slit envelope (when d/a is a whole number). Single slit: dark
 * fringes at a·sin θ = mλ. `analysis` is the result of analyseScreen(setup).
 */
export function fringeComparison(setup, analysis) {
    const onScreen = (y) => Number.isFinite(y) && Math.abs(y) <= analysis.halfWidth;
    if (setup.mode === 'double') {
        const beta = fringeSpacing(setup);
        return DOUBLE_SLIT_ORDERS.flatMap((m) => {
            const p = predictedMaximum(setup, m);
            if (!onScreen(p.fraunhofer)) return [];
            const theory = nearestExtremum(analysis.theoryMaxima, p.fraunhofer);
            const simulated = nearestExtremum(analysis.maxima, p.fraunhofer);
            const missing = !theory || Math.abs(theory.y - p.fraunhofer) > beta / 2;
            return [{ m, smallAngle: p.smallAngle, fraunhofer: missing ? NaN : theory.y, simulated: missing ? NaN : simulated?.y ?? NaN, missing }];
        });
    }
    return SINGLE_SLIT_ORDERS.flatMap((m) => {
        const exact = screenPositionOf((m * setup.wavelength) / setup.slitWidth, setup.screenDistance);
        if (!onScreen(exact)) return [];
        const theory = nearestExtremum(analysis.theoryMinima, exact);
        const simulated = nearestExtremum(analysis.minima, exact);
        return [{ m, smallAngle: m * envelopeZero(setup), fraunhofer: theory?.y ?? NaN, simulated: simulated?.y ?? NaN, missing: false }];
    });
}
