// Input validation shared by the solver pages and ParamSlider.

import { clamp, snapToStep } from './math.js';

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/** Parses a text input; empty or non-numeric strings become NaN. */
export const parseNumber = (text) => (String(text).trim() === '' ? NaN : Number(text));

/** Returns an error message, or null when `value` is a finite number > 0. */
export const requirePositive = (value, name) =>
    isFiniteNumber(value) && value > 0 ? null : `${name} must be a positive number.`;

/** Returns an error message, or null when min ≤ value ≤ max. */
export const requireInRange = (value, name, min, max, unit = '') =>
    isFiniteNumber(value) && value >= min && value <= max
        ? null
        : `${name} must be between ${min}${unit} and ${max}${unit}.`;

/** Returns an error message, or null when `value` is an integer ≥ min. */
export const requireInteger = (value, name, min) =>
    Number.isInteger(value) && value >= min ? null : `${name} must be a whole number ≥ ${min}.`;

/** First non-null error among the given checks, or null. */
export const firstError = (...errors) => errors.find((e) => e) ?? null;

/**
 * Validates a typed number for a bounded control.
 * - `ok`: the text is a number inside [min, max]; `value` is snapped to `step`.
 * - otherwise `error` explains why, and `fallback` is the nearest valid value
 *   (clamped) or null when the text is not a number at all.
 */
export function validateBoundedInput(text, { min, max, step }) {
    const raw = parseNumber(text);
    if (!isFiniteNumber(raw)) {
        return { ok: false, value: null, fallback: null, error: 'Enter a number.' };
    }
    const fallback = snapToStep(clamp(raw, min, max), step, min);
    if (raw < min || raw > max) {
        return { ok: false, value: null, fallback, error: `Must be between ${min} and ${max}.` };
    }
    return { ok: true, value: snapToStep(raw, step, min), fallback, error: null };
}
