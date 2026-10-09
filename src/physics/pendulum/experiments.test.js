import { describe, it, expect } from 'vitest';
import { accuracyVsCost, measurePeriod, periodVsAmplitude } from './experiments';
import { exactPeriod } from './pendulum';
import { INTEGRATOR_LIST, rk4 } from '../integrators';

const SETUP = { amplitude: Math.PI / 3, length: 1, g: 9.81, duration: 10 };
const study = accuracyVsCost({ ...SETUP, integrators: INTEGRATOR_LIST, dts: [0.1, 0.02, 0.01, 0.0005] });
const row = (method, dt) => study.find((r) => r.method === method && r.dt === dt);

describe('accuracy vs cost', () => {
    it('counts the work: steps × evaluations per step', () => {
        expect(row('euler', 0.01)).toMatchObject({ steps: 1000, evaluations: 1000 });
        expect(row('rk4', 0.01)).toMatchObject({ steps: 1000, evaluations: 4000 });
    });

    it('shows each method’s order: halving Δt divides the error by 2 (Euler) or 16 (RK4)', () => {
        expect(row('rk4', 0.02).maxError / row('rk4', 0.01).maxError).toBeCloseTo(16, -0.5); // within ±2
        expect(row('symplectic', 0.02).maxError / row('symplectic', 0.01).maxError).toBeCloseTo(2, 0);
    });

    it('RK4 with 400 evaluations beats both Euler methods with 20 000', () => {
        expect(row('rk4', 0.1).maxError).toBeLessThan(row('symplectic', 0.0005).maxError);
        expect(row('rk4', 0.1).maxError).toBeLessThan(row('euler', 0.0005).maxError / 50);
    });

    it('explicit Euler gains energy, symplectic Euler stays close', () => {
        expect(row('euler', 0.01).energyDrift).toBeGreaterThan(0.5);
        expect(Math.abs(row('symplectic', 0.01).energyDrift)).toBeLessThan(0.02);
    });

    it('times runs only when given a clock, and survives a frozen one', () => {
        expect(study.every((r) => Number.isNaN(r.seconds))).toBe(true);
        let t = 0;
        const [timed] = accuracyVsCost({ ...SETUP, integrators: [rk4], dts: [0.1], now: () => (t += 1) });
        expect(timed.seconds).toBeGreaterThan(0);
        const [frozen] = accuracyVsCost({ ...SETUP, integrators: [rk4], dts: [0.1], now: () => 0 });
        expect(frozen.seconds).toBe(0);
    });

    it('marks a run that blows up', () => {
        const [blown] = accuracyVsCost({ amplitude: 3, length: 1, g: 9.81, duration: 100, integrators: [INTEGRATOR_LIST[0]], dts: [0.1] });
        expect(blown.maxError).toBeGreaterThan(1); // went over the top
    });
});

describe('period measurements', () => {
    // Measured: 5.0×10⁻¹⁰ and 2.3×10⁻¹⁰ at 5 ms; 8.0×10⁻⁹ and 3.5×10⁻⁹ at 10 ms (about 16×: fourth order).
    it.each([[0.005, 1e-9], [0.01, 1e-8]])('RK4 at Δt = %s s measures the exact period to %s at 5° and 90°', (dt, tolerance) => {
        for (const deg of [5, 90]) {
            const amplitude = (deg * Math.PI) / 180;
            const T = measurePeriod({ amplitude, length: 1, g: 9.81, integrator: rk4, dt });
            expect(Math.abs(T - exactPeriod(amplitude, 1, 9.81)) / T).toBeLessThan(tolerance);
        }
    });

    it('period-vs-amplitude rows carry the exact ratio', () => {
        const [r] = periodVsAmplitude({ amplitudesDeg: [90], length: 1, g: 9.81, integrator: rk4, dt: 0.01 });
        expect(r.exactRatio).toBeCloseTo(1.18034, 5);
    });
});
