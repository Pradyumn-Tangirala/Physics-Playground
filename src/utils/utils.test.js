import { describe, it, expect } from 'vitest';
import { clamp, snapToStep, decimalsOf } from './math';
import { degToRad, radToDeg, nmToM, mmToM, mToMm } from './units';
import { parseNumber, requirePositive, requireInRange, requireInteger, firstError, validateBoundedInput } from './validation';
import { formatForStep, ordinal, niceStep, formatMetres, formatScientific, formatMeasurement, formatPercent } from './format';
import { csvRow, toCsv } from './csv';
import { frameDelta, advanceFixed, MAX_FRAME_DT } from './timeStep';

describe('math', () => {
    it('clamp', () => {
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(-1, 0, 10)).toBe(0);
        expect(clamp(11, 0, 10)).toBe(10);
        expect(clamp(5, 10, 0)).toBe(10); // min wins when the range is empty
    });

    it('snapToStep removes floating-point noise', () => {
        expect(snapToStep(9.849999, 0.1, 1)).toBe(9.8);
        expect(snapToStep(0.30000000000000004, 0.1)).toBe(0.3);
        expect(snapToStep(7, 0.5, 1)).toBe(7);
        expect(snapToStep(7.3, 0.5, 1)).toBe(7.5);
    });

    it('decimalsOf', () => {
        expect([1, 0.1, 0.01, 0.5, 1e-7].map(decimalsOf)).toEqual([0, 1, 2, 1, 7]);
    });
});

describe('units', () => {
    it('round-trips', () => {
        expect(radToDeg(degToRad(37))).toBeCloseTo(37, 12);
        expect(nmToM(500)).toBeCloseTo(5e-7, 20);
        expect(mToMm(mmToM(0.5))).toBeCloseTo(0.5, 12);
    });
});

describe('validation', () => {
    it('parseNumber treats empty input as invalid', () => {
        expect(parseNumber('')).toBeNaN();
        expect(parseNumber('   ')).toBeNaN();
        expect(parseNumber(' 2.5 ')).toBe(2.5);
        expect(parseNumber('abc')).toBeNaN();
    });

    it('requirement helpers', () => {
        expect(requirePositive(1, 'X')).toBeNull();
        expect(requirePositive(0, 'X')).toMatch(/X/);
        expect(requireInRange(90, 'A', 0, 90)).toBeNull();
        expect(requireInRange(91, 'A', 0, 90, '°')).toMatch(/0° and 90°/);
        expect(requireInteger(2, 'n', 1)).toBeNull();
        expect(requireInteger(1.5, 'n', 1)).toMatch(/whole number/);
        expect(firstError(null, 'a', 'b')).toBe('a');
        expect(firstError(null, null)).toBeNull();
    });

    it('validateBoundedInput', () => {
        const range = { min: 1, max: 25, step: 0.1 };
        expect(validateBoundedInput('9.8', range)).toMatchObject({ ok: true, value: 9.8 });
        expect(validateBoundedInput('9.83', range)).toMatchObject({ ok: true, value: 9.8 });
        expect(validateBoundedInput('30', range)).toMatchObject({ ok: false, fallback: 25 });
        expect(validateBoundedInput('0', range)).toMatchObject({ ok: false, fallback: 1 });
        expect(validateBoundedInput('', range)).toMatchObject({ ok: false, fallback: null });
    });
});

describe('format', () => {
    it('formatForStep', () => {
        expect(formatForStep(9.8, 0.1)).toBe('9.8');
        expect(formatForStep(200, 1)).toBe('200');
        expect(formatForStep(0.5, 0.01)).toBe('0.50');
    });

    it('ordinal suffixes', () => {
        const got = [0, 1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map((n) => `${n}${ordinal(n)}`);
        expect(got).toEqual(['0th', '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th']);
    });

    it.each([[0.7, 0.5], [1.4, 1], [2.9, 2], [6, 5], [8, 10], [130, 100], [0.04, 0.05]])('niceStep(%f) = %f', (rough, expected) => {
        expect(niceStep(rough)).toBeCloseTo(expected, 12);
    });

    it('niceStep handles bad input; formatMetres', () => {
        expect(niceStep(0)).toBe(1);
        expect(niceStep(Infinity)).toBe(1);
        expect(formatMetres(200)).toBe('200');
        expect(formatMetres(0.05)).toBe('0.050');
    });
});

describe('timeStep', () => {
    it('frameDelta converts ms to s and clamps', () => {
        expect(frameDelta(1000, null)).toBe(0);
        expect(frameDelta(1016, 1000)).toBeCloseTo(0.016, 12);
        expect(frameDelta(5000, 1000)).toBe(MAX_FRAME_DT);
        expect(frameDelta(900, 1000)).toBe(0);
    });

    const opts = { h: 0.01, maxSteps: 100 };
    const count = (s) => s + 1;

    it('advanceFixed takes whole steps and carries the remainder', () => {
        const r = advanceFixed(0, count, 0.035, 0, opts);
        expect(r.state).toBe(3);
        expect(r.accumulator).toBeCloseTo(0.005, 12);
        const r2 = advanceFixed(r.state, count, 0.005, r.accumulator, opts);
        expect(r2.state).toBe(4);
    });

    it('advanceFixed caps work per call and drops the backlog', () => {
        const r = advanceFixed(0, count, 10, 0, opts);
        expect(r.state).toBe(100);
        expect(r.accumulator).toBe(0);
    });

    it('is frame-rate independent', () => {
        const run = (fps) => {
            let s = 0;
            let acc = 0;
            for (let i = 0; i < fps * 2; i++) ({ state: s, accumulator: acc } = advanceFixed(s, count, 1 / fps, acc, opts));
            return s;
        };
        expect(Math.abs(run(60) - run(144))).toBeLessThanOrEqual(1);
    });
});

describe('CSV', () => {
    it('quotes only fields that need it, doubling embedded quotes (RFC 4180)', () => {
        expect(csvRow(['plain', 'a,b', 'say "hi"', 'two\nlines'])).toBe('plain,"a,b","say ""hi""","two\nlines"');
    });

    it('keeps full numeric precision and leaves non-finite numbers empty', () => {
        expect(csvRow([0.1 + 0.2, 6e-7, NaN, Infinity, null, undefined])).toBe('0.30000000000000004,6e-7,,,,');
    });

    it('writes # metadata, a blank line, the header and the rows with CRLF', () => {
        const text = toCsv({ metadata: [['method', 'RK4']], header: ['t (s)', 'x (m)'], rows: [[0, 1], [0.1, 0.9]] });
        expect(text).toBe('# method,RK4\r\n\r\nt (s),x (m)\r\n0,1\r\n0.1,0.9\r\n');
        expect(toCsv({ header: ['a'], rows: [] })).toBe('a\r\n');
    });
});

describe('number formatting for readouts', () => {
    it('scientific notation with Unicode exponents', () => {
        expect(formatScientific(3.21e-6)).toBe('3.21×10⁻⁶');
        expect(formatScientific(-1500, 1)).toBe('-1.5×10³');
        expect(formatScientific(2.5)).toBe('2.50');
        expect(formatScientific(NaN)).toBe('—');
    });

    it('measurements to 6 significant figures, scientific outside 10⁻³…10⁶', () => {
        expect(formatMeasurement(2.0070218823)).toBe('2.00702');
        expect(formatMeasurement(0.003000098)).toBe('0.0030001');
        expect(formatMeasurement(6.0e-7)).toBe('6.0000×10⁻⁷');
        expect(formatMeasurement(0)).toBe('0');
        expect(formatMeasurement(Infinity)).toBe('—');
    });

    it('percentages: two significant figures, scientific below 0.01%', () => {
        expect(formatPercent(0.1803)).toBe('+18%');
        expect(formatPercent(-0.000476)).toBe('-0.048%');
        expect(formatPercent(1.3e-7)).toBe('+1.3×10⁻⁵%');
        expect(formatPercent(0)).toBe('0%');
        expect(formatPercent(NaN)).toBe('—');
    });
});
