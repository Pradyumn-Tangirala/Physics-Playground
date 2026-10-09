// Guided experiments and "Simulate this" links. Two promises are checked:
//   1. every preset opens exactly as written, and the numbers its text quotes
//      are what the model actually gives;
//   2. a solved problem opens in its lab with the same parameters, and the
//      lab's analytical values equal the solver's answer (one shared model).

import { describe, it, expect } from 'vitest';
import { PRESETS, presetPath, presetsFor } from '../../src/experiments/presets';
import { LABS, OSCILLATOR_LAB, PROJECTILE_LAB, WAVE_LAB, experimentPath } from '../../src/experiments/labs';
import { decodeParams, defaultParams } from '../../src/experiments/urlParams';
import { WAVE_MEDIA } from '../../src/experiments/waveSetups';
import { analyticPeriod } from '../../src/simulation/oscillatorSimulation';
import { launchFromParams, predictFlights } from '../../src/simulation/projectileSimulation';
import { flightSummary } from '../../src/physics/projectile/projectile';
import { exactMotion, exactPeriod, smallAnglePeriod } from '../../src/physics/pendulum/pendulum';
import { measurePeriod } from '../../src/physics/pendulum/experiments';
import { analyseScreen, envelopeZero, fringeSpacing } from '../../src/physics/waves/interference';
import { INTEGRATORS } from '../../src/physics/integrators';
import { solveDoubleSlit } from '../../src/physics/waves/doubleSlit';
import { solveProjectile } from '../../src/physics/projectile/solver';
import { solvePendulum } from '../../src/physics/pendulum/solver';
import { degToRad } from '../../src/utils/units';

const byId = (id) => PRESETS.find((p) => p.id === id);
const opened = (path) => {
    const [route, query] = path.split('?');
    const lab = LABS.find((l) => l.path === route);
    return { lab, ...decodeParams(lab.fields, query) };
};

describe('presets', () => {
    it('cover the eight requested experiments, with unique ids', () => {
        expect(PRESETS.map((p) => p.id)).toEqual([
            'small-angle-pendulum', 'nonlinear-pendulum', 'euler-energy-drift', 'rk4-accuracy',
            'double-slit', 'single-slit', 'projectile-no-drag', 'projectile-drag',
        ]);
        expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    });

    it.each(PRESETS.map((p) => [p.id, p]))('%s opens in its lab exactly as written', (_, preset) => {
        const { lab, params, rejected } = opened(presetPath(preset));
        expect(lab).toBe(preset.lab);
        expect(rejected).toEqual([]);
        expect(params).toEqual(preset.params);
        expect(presetsFor(lab)).toContain(preset);
    });

    const pendulumPeriod = (p) => measurePeriod({
        amplitude: degToRad(p.startAngleDeg), length: p.lengthM, g: p.gravity, integrator: INTEGRATORS[p.integrator], dt: p.dt,
    });

    it('small-angle pendulum: 2.0070 s measured, within 0.05% of T₀ = 2.0061 s', () => {
        const p = byId('small-angle-pendulum').params;
        const T = pendulumPeriod(p);
        const T0 = smallAnglePeriod(p.lengthM, p.gravity);
        expect(T.toFixed(4)).toBe('2.0070');
        expect(T0.toFixed(4)).toBe('2.0061');
        expect((T - T0) / T0).toBeLessThan(0.0005);
    });

    it('nonlinear pendulum: 2.3678 s, 18% longer than T₀, equal to the exact period', () => {
        const p = byId('nonlinear-pendulum').params;
        const T = pendulumPeriod(p);
        expect(T.toFixed(4)).toBe('2.3678');
        expect(Math.round(100 * (T / smallAnglePeriod(p.lengthM, p.gravity) - 1))).toBe(18);
        expect(Math.abs(T / exactPeriod(degToRad(90), p.lengthM, p.gravity) - 1)).toBeLessThan(1e-7);
    });

    it('RK4 accuracy: period to ~1 part in 10⁷, angle within 2×10⁻⁷ rad over 10 s', () => {
        const p = byId('rk4-accuracy').params;
        const a = degToRad(p.amplitudeDeg);
        const T = measurePeriod({ amplitude: a, length: p.lengthM, g: p.gravity, integrator: INTEGRATORS.rk4, dt: p.dt });
        expect(Math.abs(T / exactPeriod(a, p.lengthM, p.gravity) - 1)).toBeLessThan(3e-7);
        const f = (y) => [y[1], -(p.gravity / p.lengthM) * Math.sin(y[0])];
        let y = [a, 0];
        let worst = 0;
        for (let n = 1; n <= Math.round(10 / p.dt); n++) {
            y = INTEGRATORS.rk4.step(y, f, p.dt);
            worst = Math.max(worst, Math.abs(y[0] - exactMotion(a, p.lengthM, p.gravity, n * p.dt)[0]));
        }
        expect(worst).toBeLessThan(2e-7);
    });

    it('double slit: β = 3.0 mm, envelope zero at 15 mm, so the 5th order is missing', () => {
        const p = byId('double-slit').params;
        expect(fringeSpacing(p) * 1e3).toBeCloseTo(3, 10);
        expect(envelopeZero(p) * 1e3).toBeCloseTo(15, 10);
        expect(p.slitSeparation / p.slitWidth).toBeCloseTo(5, 10);
        expect(analyseScreen(p).measured * 1e3).toBeCloseTo(3, 3);
    });

    it('single slit: central maximum 2λD/a = 12 mm', () => {
        const a = analyseScreen(byId('single-slit').params);
        expect(a.predicted * 1e3).toBeCloseTo(12, 10);
        expect(a.measured * 1e3).toBeCloseTo(12, 2);
    });

    it('projectiles: 91.74 m without drag; 367 m → 127 m with drag', () => {
        const range = (id, run) => predictFlights(byId(id).params).find((r) => r.id === run).metrics.range;
        expect(range('projectile-no-drag', 'analytic').toFixed(2)).toBe('91.74');
        expect(Math.abs(range('projectile-no-drag', 'numeric') - 91.74311926605502)).toBeLessThan(1e-9);
        expect(Math.round(range('projectile-drag', 'analytic'))).toBe(367);
        expect(Math.round(range('projectile-drag', 'drag'))).toBe(127);
    });
});

describe('solver → simulation: one model', () => {
    // The parameters each solver page hands to <SimulateLink>.
    const link = (lab, params) => opened(experimentPath(lab, { ...defaultParams(lab.fields), ...params }));

    it('double slit: the wave lab’s fringe spacing equals the solver’s answer', () => {
        const solution = solveDoubleSlit({ type: 'fringe-width', wavelengthNm: 600, slitSeparationMm: 0.2, screenDistanceM: 1 });
        const { params, rejected } = link(WAVE_LAB, { ...solution.setup, setupId: 'laser', waveSpeed: WAVE_MEDIA.light.speed });
        expect(rejected).toEqual([]);
        expect(params).toMatchObject({ wavelength: 6e-7, slitSeparation: 2e-4, screenDistance: 1, slitWidth: 0 });
        // Links carry 12 significant digits, so agreement is to round-off, not bit-for-bit.
        expect(Math.abs(fringeSpacing(params) / solution.resultM - 1)).toBeLessThan(1e-12);
    });

    it('double slit: values outside the lab’s range are reported, not clamped', () => {
        const solution = solveDoubleSlit({ type: 'fringe-width', wavelengthNm: 1064, slitSeparationMm: 0.2, screenDistanceM: 1 });
        const { rejected } = link(WAVE_LAB, { ...solution.setup, setupId: 'laser', waveSpeed: WAVE_MEDIA.light.speed });
        expect(rejected.map((r) => r.key)).toEqual(['wavelength']);
    });

    it('projectile: the lab’s closed-form flight equals the solver’s range, height and time', () => {
        const inputs = { velocity: 20, angleDeg: 35, gravity: 9.8 };
        const solution = solveProjectile(inputs);
        const { params, rejected } = link(PROJECTILE_LAB, { ...inputs, mode: 'compare', height: 0, rho: 0 });
        expect(rejected).toEqual([]);
        const summary = flightSummary(launchFromParams(params));
        expect(summary.range).toBe(solution.range);
        expect(summary.maxHeight).toBe(solution.maxHeight);
        expect(summary.time).toBe(solution.timeOfFlight);
    });

    it('pendulum: the lab’s small-angle and exact periods equal the solver’s', () => {
        const inputs = { length: 1.5, gravity: 9.81, amplitudeDeg: 40 };
        const solution = solvePendulum(inputs);
        const { params, rejected } = link(OSCILLATOR_LAB, { mode: 'pendulum', lengthM: 1.5, gravity: 9.81, startAngleDeg: 40, damping: 0, integrator: 'rk4' });
        expect(rejected).toEqual([]);
        expect(analyticPeriod(params)).toBe(solution.period);
        expect(exactPeriod(degToRad(params.startAngleDeg), params.lengthM, params.gravity)).toBe(solution.exactPeriod);
    });
});
