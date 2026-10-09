/** Clamps `value` into [min, max]. If min > max, min wins. */
export const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

/** Snaps `value` to the nearest multiple of `step` measured from `min`. */
export function snapToStep(value, step, min = 0) {
    if (!(step > 0)) return value;
    const snapped = min + Math.round((value - min) / step) * step;
    return Number(snapped.toFixed(decimalsOf(step))); // strip floating-point noise (0.30000000000000004)
}

/** Number of decimal places in a step such as 0.01 → 2, 1 → 0, 1e-3 → 3. */
export function decimalsOf(step) {
    if (!Number.isFinite(step)) return 0;
    const text = String(step);
    if (text.includes('e-')) return Number(text.split('e-')[1]);
    const dot = text.indexOf('.');
    return dot === -1 ? 0 : text.length - dot - 1;
}
