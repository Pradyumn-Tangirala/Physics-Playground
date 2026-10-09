import { describe, it, expect } from 'vitest';
import { solveProjectile } from './solver';

describe('solveProjectile', () => {
    it('matches closed-form range, height and time of flight', () => {
        const r = solveProjectile({ velocity: 20, angleDeg: 45, gravity: 9.8 });
        expect(r.range).toBeCloseTo(400 / 9.8, 10);
        expect(r.maxHeight).toBeCloseTo(200 / 19.6, 10);
        expect(r.timeOfFlight).toBeCloseTo((40 * Math.SQRT1_2) / 9.8, 10);
        r.steps.forEach((s) => expect(s).not.toMatch(/^\d+\./));
    });

    it('complementary angles give the same range', () => {
        const a = solveProjectile({ velocity: 30, angleDeg: 30, gravity: 9.8 });
        const b = solveProjectile({ velocity: 30, angleDeg: 60, gravity: 9.8 });
        expect(a.range).toBeCloseTo(b.range, 10);
    });

    it.each([
        [{ velocity: 0, angleDeg: 45, gravity: 9.8 }],
        [{ velocity: 20, angleDeg: 91, gravity: 9.8 }],
        [{ velocity: 20, angleDeg: -1, gravity: 9.8 }],
        [{ velocity: 20, angleDeg: 45, gravity: 0 }],
        [{ velocity: NaN, angleDeg: 45, gravity: 9.8 }],
    ])('rejects invalid input %#', (input) => {
        expect(solveProjectile(input).error).toBeTruthy();
    });
});
