import { describe, it, expect } from 'vitest';
import { position, velocity, flightTime, range, maxHeight, impactVelocity, flightSummary } from './projectile';
import { degToRad } from '../../utils/units';

const launch = (v0, deg, g) => ({ v0, theta: degToRad(deg), g });

describe('projectile kinematics', () => {
    it('lands at y = 0, x = R after the flight time', () => {
        const l = launch(60, 37, 9.8);
        const p = position(l, flightTime(l));
        expect(p.y).toBeCloseTo(0, 9);
        expect(p.x).toBeCloseTo(range(l), 9);
    });

    it('reaches max height at T/2', () => {
        const l = launch(42, 63, 9.8);
        expect(position(l, flightTime(l) / 2).y).toBeCloseTo(maxHeight(l), 9);
    });

    it('45° gives R = v²/g', () => {
        expect(range(launch(60, 45, 9.8))).toBeCloseTo(3600 / 9.8, 9);
    });

    it('θ = 0 and θ = 90° never produce negative values', () => {
        expect(range(launch(50, 0, 9.8))).toBe(0);
        expect(flightTime(launch(50, 0, 9.8))).toBe(0);
        expect(range(launch(50, 90, 9.8))).toBeGreaterThanOrEqual(0);
    });

    it('launch height: lands at y = 0, impact speed √(v0² + 2g·y0), apex y0 + (v0 sin θ)²/2g', () => {
        const l = { ...launch(25, 40, 9.81), y0: 30 };
        expect(position(l, flightTime(l)).y).toBeCloseTo(0, 9);
        expect(impactVelocity(l).speed).toBeCloseTo(Math.sqrt(25 ** 2 + 2 * 9.81 * 30), 9);
        expect(maxHeight(l)).toBeCloseTo(30 + (25 * Math.sin(degToRad(40))) ** 2 / (2 * 9.81), 9);
        expect(range(l)).toBeGreaterThan(range(launch(25, 40, 9.81)));
    });

    it('horizontal launch from a height falls for √(2y0/g)', () => {
        const l = { ...launch(15, 0, 9.8), y0: 45 };
        expect(flightTime(l)).toBeCloseTo(Math.sqrt(90 / 9.8), 12);
        expect(maxHeight(l)).toBe(45);
        expect(range(l)).toBeCloseTo(15 * Math.sqrt(90 / 9.8), 12);
    });

    it('velocity is the time derivative of position', () => {
        const l = { ...launch(33, 61, 7), y0: 4 };
        const t = 1.7;
        const e = 1e-6;
        expect((position(l, t + e).y - position(l, t - e).y) / (2 * e)).toBeCloseTo(velocity(l, t).vy, 6);
        expect((position(l, t + e).x - position(l, t - e).x) / (2 * e)).toBeCloseTo(velocity(l, t).vx, 6);
    });

    it('45° gives the maximum range on level ground (scan of 1°…89°)', () => {
        const angles = Array.from({ length: 177 }, (_, i) => 1 + i * 0.5);
        const ranges = angles.map((a) => range(launch(37, a, 9.81)));
        expect(angles[ranges.indexOf(Math.max(...ranges))]).toBe(45);
    });

    it('from a height, the best angle is below 45°', () => {
        const angles = Array.from({ length: 90 }, (_, i) => i);
        const ranges = angles.map((a) => range({ ...launch(20, a, 9.81), y0: 30 }));
        const best = angles[ranges.indexOf(Math.max(...ranges))];
        expect(best).toBeLessThan(45);
        expect(best).toBeGreaterThan(25);
    });

    it.each([[10, 9.8], [55, 9.81], [80, 1.62]])('complementary angles θ and 90° − θ give the same range (v₀ = %s, g = %s)', (v0, g) => {
        for (const a of [5, 15, 30, 40]) {
            expect(range(launch(v0, a, g))).toBeCloseTo(range(launch(v0, 90 - a, g)), 9);
            expect(flightTime(launch(v0, a, g))).not.toBeCloseTo(flightTime(launch(v0, 90 - a, g)), 3); // different paths
        }
    });

    it('is deterministic', () => {
        const l = launch(33, 51, 7.1);
        expect(flightSummary(l)).toEqual(flightSummary({ ...l }));
    });
});
