import { decimalsOf } from './math.js';

/** Formats a value with as many decimals as its control step uses (step 0.1 → "9.8"). */
export const formatForStep = (value, step) => Number(value).toFixed(decimalsOf(step));

/** English ordinal suffix: 1 → "st", 12 → "th", 23 → "rd". */
export function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

/** A 1/2/5 × 10ⁿ step close to `rough`, used for axis ticks. */
export function niceStep(rough) {
    if (!(rough > 0) || !Number.isFinite(rough)) return 1;
    const exp = Math.floor(Math.log10(rough));
    const base = 10 ** exp;
    const f = rough / base;
    const nice = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
    return nice * base;
}

/** Axis label for a distance in metres: whole-ish numbers stay short, small ones keep 2 s.f. */
export const formatMetres = (m) => (m >= 1 ? String(Math.round(m * 100) / 100) : m.toPrecision(2));

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** Scientific notation with Unicode exponents: 3.2×10⁻⁶. "—" for non-finite values. */
export function formatScientific(value, digits = 2) {
    if (!Number.isFinite(value)) return '—';
    const [mantissa, exponent] = value.toExponential(digits).split('e');
    const exp = Number(exponent);
    if (exp === 0) return mantissa;
    return `${mantissa}×10${String(exp).replace('-', '⁻').replace(/\d/g, (d) => SUPERSCRIPT[d])}`;
}

/** A measured value to 6 significant figures, switching to scientific notation outside 10⁻³…10⁶. */
export function formatMeasurement(value) {
    if (!Number.isFinite(value)) return '—';
    const magnitude = Math.abs(value);
    if (magnitude === 0) return '0';
    return magnitude >= 1e-3 && magnitude < 1e6 ? String(Number(value.toPrecision(6))) : formatScientific(value, 4);
}

/** A ratio as a signed percentage: 2 significant figures, scientific below 0.01%. */
export function formatPercent(ratio) {
    if (!Number.isFinite(ratio)) return '—';
    const percent = 100 * ratio;
    const sign = percent > 0 ? '+' : '';
    if (percent === 0) return '0%';
    return Math.abs(percent) >= 0.01 ? `${sign}${Number(percent.toPrecision(2))}%` : `${sign}${formatScientific(percent, 1)}%`;
}

/** A timestep in seconds as milliseconds without float noise: 0.0005 → "0.5 ms". */
export const formatMilliseconds = (seconds) => `${Number((seconds * 1000).toFixed(3))} ms`;
