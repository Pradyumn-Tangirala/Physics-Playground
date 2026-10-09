import { describe, it, expect } from 'vitest';
import { agm, ellipticK, jacobiElliptic } from './elliptic';

describe('arithmetic–geometric mean and K(m)', () => {
    it('AGM(1, √2) = 1.198140234735592 (Gauss’s constant × √2 relation)', () => {
        expect(agm(1, Math.SQRT2)).toBeCloseTo(1.198140234735592, 14);
    });

    it('K(0) = π/2 and K(0.5) = 1.854074677301372 (A&S table 17.1)', () => {
        expect(ellipticK(0)).toBeCloseTo(Math.PI / 2, 15);
        expect(ellipticK(0.5)).toBeCloseTo(1.854074677301372, 14);
    });
});

describe('Jacobi elliptic functions', () => {
    const U = [-7.3, -1, -0.2, 0, 0.4, 1.1, 2.5, 9.9];
    const M = [0, 1e-10, 0.1, 0.5, 0.9, 0.999];

    it('reduce to sin, cos, 1 at m = 0', () => {
        for (const u of U) {
            const { sn, cn, dn } = jacobiElliptic(u, 0);
            expect(sn).toBeCloseTo(Math.sin(u), 15);
            expect(cn).toBeCloseTo(Math.cos(u), 15);
            expect(dn).toBe(1);
        }
    });

    it('satisfy sn² + cn² = 1 and dn² + m·sn² = 1', () => {
        for (const m of M) {
            for (const u of U) {
                const { sn, cn, dn } = jacobiElliptic(u, m);
                expect(sn * sn + cn * cn).toBeCloseTo(1, 14);
                expect(dn * dn + m * sn * sn).toBeCloseTo(1, 14);
            }
        }
    });

    it('have quarter period K: sn(K) = 1, cn(K) = 0, and period 4K', () => {
        for (const m of [0.1, 0.5, 0.9]) {
            const K = ellipticK(m);
            expect(jacobiElliptic(K, m).sn).toBeCloseTo(1, 12);
            expect(jacobiElliptic(K, m).cn).toBeCloseTo(0, 7); // cn is flat near K, so this is the sensitive one
            for (const u of [0.3, 1.7]) expect(jacobiElliptic(u + 4 * K, m).sn).toBeCloseTo(jacobiElliptic(u, m).sn, 12);
        }
    });

    it('match the derivative sn′ = cn·dn (central difference)', () => {
        const h = 1e-5;
        for (const m of [0.3, 0.8]) {
            for (const u of [0.2, 1.3, 2.9]) {
                const derivative = (jacobiElliptic(u + h, m).sn - jacobiElliptic(u - h, m).sn) / (2 * h);
                const { cn, dn } = jacobiElliptic(u, m);
                expect(derivative).toBeCloseTo(cn * dn, 9);
            }
        }
    });

    it('rejects m outside [0, 1)', () => {
        expect(() => jacobiElliptic(1, 1)).toThrow(RangeError);
        expect(() => jacobiElliptic(1, -0.1)).toThrow(RangeError);
    });
});
