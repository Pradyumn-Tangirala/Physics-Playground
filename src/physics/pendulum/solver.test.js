import { describe, it, expect } from 'vitest';
import { solvePendulum } from './solver';

describe('solvePendulum', () => {
    it('T = 2π√(L/g)', () => {
        const r = solvePendulum({ length: 1, gravity: 9.8 });
        expect(r.period).toBeCloseTo(2 * Math.PI * Math.sqrt(1 / 9.8), 12);
        expect(r.frequency).toBeCloseTo(1 / r.period, 12);
    });

    it.each([[{ length: 0, gravity: 9.8 }], [{ length: -1, gravity: 9.8 }], [{ length: 1, gravity: 0 }]])(
        'rejects invalid input %#',
        (input) => expect(solvePendulum(input).error).toBeTruthy(),
    );
});

describe('solvePendulum: exact period at the release angle', () => {
    it('matches the exact (elliptic-integral) period the lab validates against', async () => {
        const { exactPeriod } = await import('./pendulum');
        const r = solvePendulum({ length: 1, gravity: 9.81, amplitudeDeg: 90 });
        expect(r.exactPeriod).toBe(exactPeriod(Math.PI / 2, 1, 9.81));
        expect(r.steps.at(-1)).toMatch(/off by 15\.\d+%/); // (T − T₀)/T at 90°
    });

    it('defaults to a 5° release and rejects angles of 180° or more', () => {
        expect(solvePendulum({ length: 1, gravity: 9.8 }).steps.join(' ')).toContain('θ₀ = 5°');
        expect(solvePendulum({ length: 1, gravity: 9.8, amplitudeDeg: 180 }).error).toMatch(/Release angle/);
    });
});
