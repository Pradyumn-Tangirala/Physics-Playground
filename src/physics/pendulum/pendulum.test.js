import { describe, it, expect } from 'vitest';
import { derivative, energy, smallAnglePeriod, exactPeriod, exactMotion, peakAngularVelocity } from './pendulum';
import { explicitEuler, symplecticEuler, rk4 } from '../integrators';
import { measurePeriod } from './experiments';
import { degToRad } from '../../utils/units';

const P = { g: 9.81, length: 1, damping: 0, mass: 1 };
const T0 = smallAnglePeriod(P.length, P.g);

/** Runs `seconds` with step h; returns { y, maxAbsDrift, drifts sampled each second }. */
function run(integrator, theta0, h, seconds, params = P) {
    const fn = derivative(params);
    let y = [theta0, 0];
    const E0 = energy(y, params).total;
    let maxAbsDrift = 0;
    const perSecond = [];
    const n = Math.round(seconds / h);
    const every = Math.round(1 / h);
    for (let i = 1; i <= n; i++) {
        y = integrator.step(y, fn, h);
        const d = (energy(y, params).total - E0) / E0;
        maxAbsDrift = Math.max(maxAbsDrift, Math.abs(d));
        if (i % every === 0) perSecond.push(d);
    }
    return { y, maxAbsDrift, perSecond };
}

describe('pendulum model', () => {
    it('derivative is [ω, −(g/L) sin θ − 2γω]', () => {
        expect(derivative({ ...P, damping: 0.5 })([0.3, 2])).toEqual([2, -9.81 * Math.sin(0.3) - 2]);
    });

    it('E = ½mL²ω² + mgL(1 − cos θ)', () => {
        const e = energy([0.5, 1.5], { g: 9.8, length: 2, mass: 3, damping: 0 });
        expect(e.ke).toBeCloseTo(0.5 * 3 * 4 * 2.25, 12);
        expect(e.pe).toBeCloseTo(3 * 9.8 * 2 * (1 - Math.cos(0.5)), 12);
        expect(e.total).toBeCloseTo(e.ke + e.pe, 12);
    });

    it('exact period: 1.18034·T₀ at 90°, → T₀ as θ₀ → 0, matches 1 + θ₀²/16 for small angles', () => {
        expect(exactPeriod(degToRad(90), 1, 9.81) / T0).toBeCloseTo(1.18034, 5);
        expect(exactPeriod(1e-6, 1, 9.81) / T0).toBeCloseTo(1, 10);
        const a = degToRad(5);
        expect(exactPeriod(a, 1, 9.81) / T0).toBeCloseTo(1 + a * a / 16, 6);
    });

    it('peak angular velocity follows from energy conservation', () => {
        const a = degToRad(60);
        const ek = 0.5 * P.mass * P.length ** 2 * peakAngularVelocity(a, P.length, P.g) ** 2;
        expect(ek).toBeCloseTo(energy([a, 0], P).pe, 12);
    });
});

describe('energy behaviour (undamped, θ₀ = 30°, 30 s)', () => {
    it('RK4 conserves energy: |ΔE/E₀| < 1e-8 at Δt = 5 ms', () => {
        expect(run(rk4, degToRad(30), 0.005, 30).maxAbsDrift).toBeLessThan(1e-8);
    });

    it('RK4 energy drift scales as Δt⁵ (halving Δt cuts it ≈ 32×)', () => {
        const a = Math.abs(run(rk4, degToRad(30), 0.02, 30).perSecond.at(-1));
        const b = Math.abs(run(rk4, degToRad(30), 0.01, 30).perSecond.at(-1));
        expect(a / b).toBeGreaterThan(25);
        expect(a / b).toBeLessThan(40);
    });

    it('explicit Euler drifts: energy keeps increasing, > +25% after 30 s even at Δt = 1 ms', () => {
        const { perSecond } = run(explicitEuler, degToRad(30), 0.001, 30);
        for (let i = 1; i < perSecond.length; i++) expect(perSecond[i]).toBeGreaterThan(perSecond[i - 1]);
        expect(perSecond.at(-1)).toBeGreaterThan(0.25);
    });

    it('symplectic Euler stays bounded: the error band does not grow from the first to the last 10 s', () => {
        const h = 0.005;
        const { perSecond, maxAbsDrift } = run(symplecticEuler, degToRad(30), h, 300);
        const early = Math.max(...perSecond.slice(0, 10).map(Math.abs));
        const late = Math.max(...perSecond.slice(-10).map(Math.abs));
        expect(maxAbsDrift).toBeLessThan(Math.sqrt(P.g / P.length) * h); // ≈ ω₀Δt band
        expect(late).toBeLessThan(early * 1.5);
    });

    it('damping removes energy monotonically (RK4, γ = 0.3 s⁻¹)', () => {
        const damped = { ...P, damping: 0.3 };
        const fn = derivative(damped);
        let y = [degToRad(40), 0];
        let prev = energy(y, damped).total;
        for (let i = 0; i < 4000; i++) {
            y = rk4.step(y, fn, 0.005);
            const e = energy(y, damped).total;
            expect(e).toBeLessThanOrEqual(prev + 1e-12);
            prev = e;
        }
    });
});

describe('period', () => {
    it('small-angle period agrees with T₀ = 2π√(L/g) (θ₀ = 1°, within 0.01%)', () => {
        const T = measurePeriod({ amplitude: degToRad(1), length: 1, g: 9.81, integrator: rk4, dt: 0.001 });
        expect(Math.abs(T - T0) / T0).toBeLessThan(1e-4);
    });

    it('nonlinear period increases with amplitude and matches the elliptic-integral value', () => {
        const amps = [10, 30, 60, 90, 120, 150, 170];
        const measured = amps.map((a) => measurePeriod({ amplitude: degToRad(a), length: 1, g: 9.81, integrator: rk4, dt: 0.001 }));
        for (let i = 1; i < measured.length; i++) expect(measured[i]).toBeGreaterThan(measured[i - 1]);
        amps.forEach((a, i) => {
            const exact = exactPeriod(degToRad(a), 1, 9.81);
            expect(Math.abs(measured[i] - exact) / exact).toBeLessThan(1e-8);
        });
        expect(measured.at(-1) / T0).toBeGreaterThan(2.4); // 170°: ≈ 2.44·T₀
    });

    it('is deterministic', () => {
        const args = { amplitude: degToRad(45), length: 1.3, g: 9.7, integrator: rk4, dt: 0.002 };
        expect(measurePeriod(args)).toBe(measurePeriod({ ...args }));
    });
});

describe('RK4 convergence on the nonlinear pendulum', () => {
    const f = derivative(P);
    const w0 = Math.sqrt(P.g / P.length);
    /** Observed orders log₂(e(h)/e(h/2)) over successive halvings, against a Δt = 0.05 ms reference at t = 3 s. */
    function orders(amplitudeDeg, steps) {
        const solve = (h) => {
            let y = [degToRad(amplitudeDeg), 0];
            for (let i = 0; i < Math.round(3 / h); i++) y = rk4.step(y, f, h);
            return y;
        };
        const ref = solve(0.00005);
        // Distance in phase space (θ and ω/ω₀): one component alone can pass through zero by chance.
        const errs = steps.map((h) => { const y = solve(h); return Math.hypot(y[0] - ref[0], (y[1] - ref[1]) / w0); });
        return errs.slice(1).map((e, i) => Math.log2(errs[i] / e));
    }

    it('order 4 at moderate amplitude (θ₀ = 30°)', () => {
        for (const p of orders(30, [0.02, 0.01, 0.005, 0.0025])) {
            expect(p).toBeGreaterThan(3.95);
            expect(p).toBeLessThan(4.05);
        }
    });

    it('at θ₀ = 120° the order climbs towards 4 as Δt shrinks (pre-asymptotic for large steps)', () => {
        const p = orders(120, [0.04, 0.02, 0.01, 0.005, 0.0025, 0.00125]);
        for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThan(p[i - 1]);
        expect(p[0]).toBeLessThan(3.5); // large steps: strong nonlinearity, not yet asymptotic
        expect(p.at(-1)).toBeGreaterThan(3.9);
    });
});

describe('damping regimes (small angle, ω₀ = √(g/L))', () => {
    const w0 = Math.sqrt(P.g / P.length);
    const trace = (damping, seconds = 6, h = 0.001) => {
        const f = derivative({ ...P, damping });
        let y = [0.05, 0];
        const out = [];
        for (let i = 0; i < Math.round(seconds / h); i++) {
            y = rk4.step(y, f, h);
            out.push(y[0]);
        }
        return out;
    };

    it('underdamped: oscillates, and the amplitude decays as e^(−γt)', () => {
        const g = 0.2;
        const xs = trace(g, 10);
        expect(Math.min(...xs)).toBeLessThan(0);
        // Successive positive peaks are one damped period apart, so their ratio is e^(−γ·T_d).
        const peaks = [];
        for (let i = 1; i < xs.length - 1; i++) if (xs[i] > xs[i - 1] && xs[i] >= xs[i + 1] && xs[i] > 0) peaks.push(i);
        const Td = (2 * Math.PI) / Math.sqrt(w0 * w0 - g * g);
        expect(xs[peaks[1]] / xs[peaks[0]]).toBeCloseTo(Math.exp(-g * Td), 3);
        expect(((peaks[1] - peaks[0]) * 0.001) / Td).toBeCloseTo(1, 2); // damping lengthens the period
    });

    it('critical damping (γ = ω₀): returns without overshooting', () => {
        expect(Math.min(...trace(w0))).toBeGreaterThan(0);
    });

    it('overdamping (γ = 3ω₀): never overshoots, and creeps back more slowly than critical', () => {
        const over = trace(3 * w0, 3);
        const critical = trace(w0, 3);
        expect(Math.min(...over)).toBeGreaterThan(0);
        expect(over.at(-1)).toBeGreaterThan(critical.at(-1));
    });
});

describe('exact motion (Jacobi elliptic solution)', () => {
    const P2 = { g: 9.81, length: 1 };

    it.each([5, 60, 150])('agrees with fine-step RK4 at θ₀ = %s° over 10 s', async (deg) => {
        const { rk4 } = await import('../integrators');
        const a = (deg * Math.PI) / 180;
        const f = derivative({ ...P2, damping: 0 });
        let y = [a, 0];
        const h = 1e-3;
        let worst = 0;
        for (let n = 1; n <= 10_000; n++) {
            y = rk4.step(y, f, h);
            if (n % 250 === 0) worst = Math.max(worst, Math.abs(exactMotion(a, P2.length, P2.g, n * h)[0] - y[0]));
        }
        expect(worst).toBeLessThan(1e-9);
    });

    it('starts at rest at θ₀ and returns there after one exact period', () => {
        for (const deg of [10, 90, 170]) {
            const a = (deg * Math.PI) / 180;
            const T = exactPeriod(a, P2.length, P2.g);
            const [theta0, omega0] = exactMotion(a, P2.length, P2.g, 0);
            expect(theta0).toBeCloseTo(a, 14);
            expect(omega0).toBeCloseTo(0, 14);
            expect(exactMotion(a, P2.length, P2.g, T)[0]).toBeCloseTo(a, 10);
        }
    });

    it('conserves energy, and passes the bottom at the peak speed after T/4', () => {
        const a = 2; // rad
        const T = exactPeriod(a, P2.length, P2.g);
        const physics = { ...P2, mass: 1 };
        const E0 = energy([a, 0], physics).total;
        for (const t of [0.1, 0.7, 1.9, 3.3]) {
            expect(energy(exactMotion(a, P2.length, P2.g, t), physics).total).toBeCloseTo(E0, 11);
        }
        const [theta, omega] = exactMotion(a, P2.length, P2.g, T / 4);
        expect(theta).toBeCloseTo(0, 10);
        expect(omega).toBeCloseTo(-peakAngularVelocity(a, P2.length, P2.g), 10);
    });

    it('is odd in θ₀ (released on the other side, it mirrors)', () => {
        const [p] = exactMotion(0.8, 1, 9.81, 0.37);
        const [n] = exactMotion(-0.8, 1, 9.81, 0.37);
        expect(n).toBeCloseTo(-p, 15);
    });
});
