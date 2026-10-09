// Input validation across every solver, driven by one table of bad and
// boundary inputs. A solver must either return { error } with a message, or a
// result whose numbers are all finite — never NaN, never Infinity, never a throw.

import { describe, it, expect } from 'vitest';
import { solveProjectile } from '../../src/physics/projectile/solver';
import { solvePendulum } from '../../src/physics/pendulum/solver';
import { solveDoubleSlit } from '../../src/physics/waves/doubleSlit';
import { parseNumber, requirePositive, requireInRange, requireInteger, validateBoundedInput } from '../../src/utils/validation';

const SOLVERS = {
    projectile: {
        solve: solveProjectile,
        valid: { velocity: 20, angleDeg: 45, gravity: 9.8 },
        positive: ['velocity', 'gravity'],
        ranges: { angleDeg: [0, 90] },
        outputs: (r) => [r.range, r.maxHeight, r.timeOfFlight],
    },
    pendulum: {
        solve: solvePendulum,
        valid: { length: 1, gravity: 9.8, amplitudeDeg: 10 },
        positive: ['length', 'gravity'],
        ranges: { amplitudeDeg: [0, 179] },
        outputs: (r) => [r.period, r.frequency, r.exactPeriod],
    },
    doubleSlit: {
        solve: solveDoubleSlit,
        valid: { type: 'fringe-width', wavelengthNm: 500, slitSeparationMm: 0.5, screenDistanceM: 1, order: 1 },
        positive: ['wavelengthNm', 'slitSeparationMm', 'screenDistanceM'],
        ranges: {},
        outputs: (r) => [r.resultM, r.resultMm],
    },
};

const BAD_POSITIVE = [
    ['zero', 0],
    ['negative', -1],
    ['tiny negative', -1e-300],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['−Infinity', -Infinity],
    ['undefined', undefined],
    ['empty text (parsed)', parseNumber('')],
    ['non-numeric text (parsed)', parseNumber('abc')],
    ['overflowing text (parsed)', parseNumber('1e999')],
];

const allFinite = (values) => values.every((v) => typeof v === 'number' && Number.isFinite(v));

describe.each(Object.entries(SOLVERS))('%s solver', (_, solver) => {
    it('valid input gives finite results and steps', () => {
        const r = solver.solve(solver.valid);
        expect(r.error).toBeUndefined();
        expect(allFinite(solver.outputs(r))).toBe(true);
        expect(r.steps.length).toBeGreaterThan(0);
    });

    for (const field of solver.positive) {
        it.each(BAD_POSITIVE)(`rejects ${field} = %s`, (_, value) => {
            const r = solver.solve({ ...solver.valid, [field]: value });
            expect(r.error).toMatch(/must be a positive number/);
        });

        it.each([1e-9, 1e9])(`accepts ${field} = %s and stays finite`, (value) => {
            const r = solver.solve({ ...solver.valid, [field]: value });
            expect(r.error).toBeUndefined();
            expect(allFinite(solver.outputs(r))).toBe(true);
        });
    }

    for (const [field, [min, max]] of Object.entries(solver.ranges)) {
        it.each([min, max, (min + max) / 2])(`accepts ${field} at %s (inclusive bounds)`, (value) => {
            const r = solver.solve({ ...solver.valid, [field]: value });
            expect(r.error).toBeUndefined();
            expect(allFinite(solver.outputs(r))).toBe(true);
        });

        it.each([min - 1e-9, max + 1e-9, NaN, Infinity, -Infinity])(`rejects ${field} = %s`, (value) => {
            expect(solver.solve({ ...solver.valid, [field]: value }).error).toMatch(/must be between/);
        });
    }

    it('never throws on garbage', () => {
        for (const value of [null, '12', {}, [], true]) {
            for (const field of Object.keys(solver.valid)) {
                expect(() => solver.solve({ ...solver.valid, [field]: value })).not.toThrow();
            }
        }
    });
});

describe('projectile boundary angles', () => {
    it('θ = 0° and θ = 90° are valid and give zero range', () => {
        expect(solveProjectile({ velocity: 20, angleDeg: 0, gravity: 9.8 }).range).toBe(0);
        expect(solveProjectile({ velocity: 20, angleDeg: 90, gravity: 9.8 }).range).toBeLessThan(1e-12);
    });
});

describe('double slit: fringe order', () => {
    const base = { wavelengthNm: 500, slitSeparationMm: 0.5, screenDistanceM: 1 };
    it.each([
        ['maxima', 0, true], ['maxima', 3, true], ['maxima', -1, false], ['maxima', 1.5, false],
        ['minima', 1, true], ['minima', 0, false], ['minima', NaN, false], ['minima', Infinity, false],
    ])('%s with order %s → valid: %s', (type, order, valid) => {
        const r = solveDoubleSlit({ ...base, type, order });
        if (valid) expect(allFinite([r.resultM])).toBe(true);
        else expect(r.error).toMatch(/whole number/);
    });

    it('rejects an unknown problem type', () => {
        expect(solveDoubleSlit({ ...base, type: 'bogus' }).error).toMatch(/Unknown problem type/);
    });
});

describe('validation primitives', () => {
    it('parseNumber: blank and non-numeric text become NaN; numbers parse', () => {
        expect(parseNumber('')).toBeNaN();
        expect(parseNumber('   ')).toBeNaN();
        expect(parseNumber('abc')).toBeNaN();
        expect(parseNumber(' 2.5 ')).toBe(2.5);
        expect(parseNumber('-3')).toBe(-3);
        expect(parseNumber('1e999')).toBe(Infinity); // rejected later by the finite checks
    });

    it('requirePositive / requireInRange / requireInteger reject non-finite numbers', () => {
        for (const v of [NaN, Infinity, -Infinity]) {
            expect(requirePositive(v, 'x')).not.toBeNull();
            expect(requireInRange(v, 'x', -1e308, 1e308)).not.toBeNull();
            expect(requireInteger(v, 'x', 0)).not.toBeNull();
        }
    });

    it('validateBoundedInput clamps and snaps at the bounds', () => {
        expect(validateBoundedInput('25', { min: 1, max: 25, step: 0.1 })).toMatchObject({ ok: true, value: 25 });
        expect(validateBoundedInput('1', { min: 1, max: 25, step: 0.1 })).toMatchObject({ ok: true, value: 1 });
        expect(validateBoundedInput('25.01', { min: 1, max: 25, step: 0.1 })).toMatchObject({ ok: false, fallback: 25 });
        expect(validateBoundedInput('-1e9', { min: 1, max: 25, step: 0.1 })).toMatchObject({ ok: false, fallback: 1 });
        expect(validateBoundedInput('Infinity', { min: 1, max: 25, step: 0.1 })).toMatchObject({ ok: false, fallback: null, error: 'Enter a number.' });
        expect(validateBoundedInput('9.84', { min: 1, max: 25, step: 0.1 })).toMatchObject({ ok: true, value: 9.8 });
    });
});
