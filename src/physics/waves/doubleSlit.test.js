import { describe, it, expect } from 'vitest';
import { solveDoubleSlit } from './doubleSlit';

const base = { wavelengthNm: 500, slitSeparationMm: 0.5, screenDistanceM: 1 };

describe('solveDoubleSlit', () => {
    it('fringe width β = λD/d', () => {
        const r = solveDoubleSlit({ ...base, type: 'fringe-width' });
        expect(r.resultM).toBeCloseTo(1e-3, 12);
        expect(r.steps.at(-1)).toBe('Final result: 1.0000 mm');
    });

    it('steps are un-numbered so the page can number them sequentially', () => {
        for (const type of ['fringe-width', 'maxima', 'minima']) {
            solveDoubleSlit({ ...base, type, order: 1 }).steps.forEach((s) => expect(s).not.toMatch(/^\d+\./));
        }
    });

    it('n-th maximum at nλD/d, including the central maximum', () => {
        expect(solveDoubleSlit({ ...base, type: 'maxima', order: 2 }).resultMm).toBeCloseTo(2, 10);
        expect(solveDoubleSlit({ ...base, type: 'maxima', order: 0 }).resultMm).toBe(0);
    });

    it('n-th minimum at (n − ½)λD/d', () => {
        expect(solveDoubleSlit({ ...base, type: 'minima', order: 1 }).resultMm).toBeCloseTo(0.5, 10);
        expect(solveDoubleSlit({ ...base, type: 'minima', order: 3 }).resultMm).toBeCloseTo(2.5, 10);
    });

    it.each([
        [{ ...base, type: 'fringe-width', slitSeparationMm: 0 }],
        [{ ...base, type: 'fringe-width', wavelengthNm: -500 }],
        [{ ...base, type: 'fringe-width', screenDistanceM: NaN }],
        [{ ...base, type: 'minima', order: 0 }],
        [{ ...base, type: 'maxima', order: 1.5 }],
        [{ ...base, type: 'maxima', order: -1 }],
        [{ ...base, type: 'bogus' }],
    ])('rejects invalid input %#', (input) => {
        expect(solveDoubleSlit(input).error).toBeTruthy();
    });
});
