// Experiment parameters ⇄ URL query string.
//
// Each lab describes its parameters with a schema, keyed by the page's
// parameter name:
//
//   { lengthM: { param: 'length', kind: 'number', min, max, default, unit, label }, … }
//
//   kind 'number'  a finite number in [min, max]
//   kind 'choice'  one of `choices` (strings, or numbers such as the timestep options)
//   kind 'set'     a comma-separated subset of `choices`
//
// `min`, `max` and `choices` may be functions of the parameters decoded so far
// (the wave lab's ranges depend on its setup), so fields are decoded in schema
// order. Out-of-range or malformed values are never clamped silently: they are
// reported in `rejected` and the default is used instead, so a link either
// reproduces the experiment exactly or says what it could not reproduce.

const resolve = (value, params) => (typeof value === 'function' ? value(params) : value);

/** Numbers are written with 12 significant digits, which drops float noise from unit conversion. */
export const formatParamValue = (value) =>
    (typeof value === 'number' ? String(Number(value.toPrecision(12))) : String(value));

/** Relative tolerance when comparing numbers against bounds and choices (absorbs that rounding). */
const MATCH_TOLERANCE = 1e-9;
const close = (a, b) => Math.abs(a - b) <= MATCH_TOLERANCE * Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE);

const encodeValue = (field, value) => (field.kind === 'set' ? value.join(',') : formatParamValue(value));

/** Query string (without "?") for `params`, in schema order. */
export function encodeParams(schema, params) {
    return Object.entries(schema)
        .map(([key, field]) => `${field.param}=${encodeURIComponent(encodeValue(field, params[key])).replace(/%2C/g, ',')}`)
        .join('&');
}

/** Parses one raw string for `field`. Returns { value } or { reason }. */
function parseField(field, raw, params) {
    if (field.kind === 'number') {
        const value = raw.trim() === '' ? NaN : Number(raw);
        if (!Number.isFinite(value)) return { reason: 'not a number' };
        const min = resolve(field.min, params);
        const max = resolve(field.max, params);
        const inRange = (value >= min || close(value, min)) && (value <= max || close(value, max));
        return inRange ? { value } : { reason: `outside ${formatParamValue(min)}–${formatParamValue(max)}${field.unit ? ` ${field.unit}` : ''}` };
    }
    const choices = resolve(field.choices, params);
    const match = (text) => choices.find((c) => (typeof c === 'number' ? close(Number(text), c) : c === text));
    if (field.kind === 'choice') {
        const value = match(raw);
        return value === undefined ? { reason: `not one of ${choices.map(formatParamValue).join(', ')}` } : { value };
    }
    const items = raw === '' ? [] : raw.split(',');
    const values = items.map(match);
    return values.includes(undefined)
        ? { reason: `contains values other than ${choices.join(', ')}` }
        : { value: choices.filter((c) => values.includes(c)) };
}

/**
 * Reads parameters from a query string ("?a=1&b=2" or "a=1&b=2"). Missing
 * parameters take their defaults. Returns { params, rejected }, where
 * rejected = [{ key, label, value, reason }].
 */
export function decodeParams(schema, search) {
    const query = new URLSearchParams(search);
    const params = {};
    const rejected = [];
    for (const [key, field] of Object.entries(schema)) {
        const raw = query.get(field.param);
        params[key] = field.default;
        if (raw === null) continue;
        const result = parseField(field, raw, params);
        if ('value' in result) params[key] = result.value;
        else rejected.push({ key, label: field.label, value: raw, reason: result.reason });
    }
    return { params, rejected };
}

/** The parameters a lab would reject; empty when `params` can be reproduced exactly. */
export const checkParams = (schema, params) => decodeParams(schema, encodeParams(schema, params)).rejected;

/** Default value of every field. */
export const defaultParams = (schema) =>
    Object.fromEntries(Object.entries(schema).map(([key, field]) => [key, field.default]));

/** True when the two parameter sets encode to the same link. */
export const sameParams = (schema, a, b) => encodeParams(schema, a) === encodeParams(schema, b);
