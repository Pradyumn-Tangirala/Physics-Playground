import { describe, it, expect } from 'vitest';
import {
    createGrid, step, harmonicSource, addBarrier, maxAbs, discreteEnergy, numericalWavenumber,
    phaseVelocityError, COURANT_LIMIT, rowOf, yOf,
} from './fdtd';
import { findExtrema } from './interference';

// Grid units throughout: Δx = 1, c = 1, so lengths are in cells and times in cells/c.

/** A Gaussian bump of width sigma (cells) at rest, centred on (ic, jc). */
function gaussian(grid, ic, jc, sigma) {
    for (let j = 0; j < grid.ny; j++) {
        for (let i = 0; i < grid.nx; i++) {
            const v = Math.exp(-((i - ic) ** 2 + (j - jc) ** 2) / (2 * sigma * sigma));
            grid.u[j * grid.nx + i] = v;
            grid.uPrev[j * grid.nx + i] = v;
        }
    }
}

/** Time of the largest value of a sampled signal, refined with a parabola. */
function peakTime(series, dt) {
    let k = 1;
    for (let i = 1; i < series.length - 1; i++) if (series[i] > series[k]) k = i;
    const [a, b, c] = [series[k - 1], series[k], series[k + 1]];
    return (k + (0.5 * (a - c)) / (a - 2 * b + c) + 1) * dt;
}

/** Deterministic pseudo-random numbers in [−0.5, 0.5). */
function noise(seed) {
    let s = seed;
    return () => (s = (s * 16807) % 2147483647) / 2147483647 - 0.5;
}

describe('FDTD: propagation speed', () => {
    it('a pulse travels at c (within 1%) along the axis and the diagonal', () => {
        const g = createGrid({ nx: 360, ny: 360, dx: 1, c: 1, courant: 0.5, spongeCells: 30 });
        gaussian(g, 180, 180, 4);
        const d40 = Math.round(40 / Math.SQRT2);
        const d120 = Math.round(120 / Math.SQRT2);
        const probes = { a40: [220, 180], a120: [300, 180], d40: [180 + d40, 180 - d40], d120: [180 + d120, 180 - d120] };
        const series = Object.fromEntries(Object.keys(probes).map((k) => [k, []]));
        for (let n = 0; n < 340; n++) {
            step(g);
            for (const [k, [i, j]] of Object.entries(probes)) series[k].push(g.u[j * g.nx + i]);
        }
        const t = (k) => peakTime(series[k], g.dt);
        const axis = 80 / (t('a120') - t('a40'));
        const diagonal = (Math.SQRT2 * (d120 - d40)) / (t('d120') - t('d40'));
        expect(Math.abs(axis - 1)).toBeLessThan(0.01);
        expect(Math.abs(diagonal - 1)).toBeLessThan(0.01);
    });
});

describe('FDTD: CFL stability', () => {
    const runNoise = (courant, steps = 1500) => {
        const g = createGrid({ nx: 64, ny: 64, dx: 1, c: 1, courant, boundary: 'reflective' });
        const rnd = noise(7);
        for (let j = 1; j < 63; j++) for (let i = 1; i < 63; i++) { g.u[j * 64 + i] = rnd(); g.uPrev[j * 64 + i] = g.u[j * 64 + i]; }
        for (let n = 0; n < steps; n++) {
            step(g);
            if (!(maxAbs(g) < 1e6)) return n;
        }
        return -1;
    };

    it('the 2-D limit is C = 1/√2', () => {
        expect(COURANT_LIMIT).toBeCloseTo(0.70711, 5);
    });

    it('random noise stays bounded for C ≤ 1/√2', () => {
        for (const C of [0.3, 0.6, 0.7, COURANT_LIMIT]) expect(runNoise(C)).toBe(-1);
    });

    it('random noise blows up just above the limit, faster the further above', () => {
        const at071 = runNoise(0.71);
        const at075 = runNoise(0.75);
        expect(at071).toBeGreaterThan(0);
        expect(at075).toBeGreaterThan(0);
        expect(at075).toBeLessThan(at071);
    });
});

describe('FDTD: boundaries', () => {
    it('rigid (reflective) edges conserve the discrete energy and reflect with the sign inverted', () => {
        const g = createGrid({ nx: 160, ny: 160, dx: 1, c: 1, courant: 0.5, boundary: 'reflective' });
        gaussian(g, 100, 80, 3);
        step(g);
        const E0 = discreteEnergy(g);
        const probe = [];
        for (let n = 0; n < 800; n++) {
            step(g);
            if (n < 200) probe.push(g.u[80 * 160 + 130]); // 30 cells right of the source, 29 from the edge
        }
        expect(Math.abs(discreteEnergy(g) - E0) / E0).toBeLessThan(1e-4); // float32 round-off only
        const incident = Math.max(...probe.slice(0, 100));
        const reflected = Math.min(...probe.slice(100));
        expect(incident).toBeGreaterThan(0);
        expect(reflected / incident).toBeLessThan(-0.4); // inverted, weaker by 2-D spreading
    });

    it('the absorbing boundary removes almost all the energy of an outgoing pulse', () => {
        const g = createGrid({ nx: 200, ny: 200, dx: 1, c: 1, courant: 0.5, boundary: 'absorbing', spongeCells: 40 });
        gaussian(g, 100, 100, 3);
        step(g);
        const E0 = discreteEnergy(g);
        for (let n = 0; n < 800; n++) step(g);
        expect(discreteEnergy(g) / E0).toBeLessThan(1e-3);
    });

    it('a wall cell stays at zero and blocks the wave except at the slits', () => {
        const g = createGrid({ nx: 120, ny: 121, dx: 1, c: 1, courant: 0.5, spongeCells: 20 });
        const openings = addBarrier(g, { x: 60, slits: [{ center: 0, width: 4.5 }] });
        expect(openings[0].width).toBe(5); // snapped to whole cells: rows −2…2
        gaussian(g, 40, 60, 3);
        const peak = { axis: 0, shadow: 0, front: 0 }; // largest |u| seen at each probe
        let wallStaysZero = true;
        for (let n = 0; n < 200; n++) {
            step(g);
            for (let j = 0; j < g.ny; j++) if (g.wall[j * g.nx + 60] && g.u[j * g.nx + 60] !== 0) wallStaysZero = false;
            peak.axis = Math.max(peak.axis, Math.abs(g.u[rowOf(g, 0) * g.nx + 70])); // straight behind the slit
            peak.shadow = Math.max(peak.shadow, Math.abs(g.u[rowOf(g, 30) * g.nx + 70])); // behind the wall
            peak.front = Math.max(peak.front, Math.abs(g.u[rowOf(g, 30) * g.nx + 50])); // same height, in front of it
        }
        expect(wallStaysZero).toBe(true);
        expect(peak.shadow).toBeLessThan(0.2 * peak.front);
        expect(peak.axis).toBeGreaterThan(peak.shadow);
    });
});

describe('FDTD: wavelength', () => {
    it('a source at frequency f makes waves of wavelength c/f (within 1%), matching the scheme\'s dispersion relation (within 0.2%)', () => {
        const lambda = 20;
        const C = 0.5;
        const g = createGrid({ nx: 300, ny: 300, dx: 1, c: 1, courant: C, spongeCells: 45 });
        const src = harmonicSource([150 * 300 + 150], { frequency: 1 / lambda, amplitude: 0.1 });
        const omega = (2 * Math.PI) / lambda;
        const r1 = 40;
        const r2 = 100;
        const lockin = [[0, 0], [0, 0]];
        const perPeriod = lambda / C;
        const start = Math.round(160 / C);
        for (let n = 0; n < start + 4 * perPeriod; n++) {
            step(g, [src]);
            if (n >= start) {
                [r1, r2].forEach((r, p) => {
                    const v = g.u[150 * 300 + 150 + r];
                    lockin[p][0] += v * Math.cos(omega * g.t);
                    lockin[p][1] += v * Math.sin(omega * g.t);
                });
            }
        }
        const phase = ([re, im]) => Math.atan2(im, re);
        let dphi = phase(lockin[1]) - phase(lockin[0]); // phase advances by k·Δr (signal ∝ sin(ωt − kr))
        const expected = (2 * Math.PI * (r2 - r1)) / lambda;
        dphi += 2 * Math.PI * Math.round((expected - dphi) / (2 * Math.PI));
        const measured = (2 * Math.PI * (r2 - r1)) / dphi;
        const numerical = (2 * Math.PI) / numericalWavenumber(omega, { dx: 1, dt: C, c: 1 });
        expect(Math.abs(measured - lambda) / lambda).toBeLessThan(0.01);
        expect(Math.abs(measured - numerical) / numerical).toBeLessThan(0.002);
        expect(numerical).toBeLessThan(lambda); // the scheme's waves are slightly short (slow)
    });

    it('numerical dispersion shrinks as the grid gets finer (≈ second order)', () => {
        const e10 = Math.abs(phaseVelocityError(10, 0.5).axis);
        const e20 = Math.abs(phaseVelocityError(20, 0.5).axis);
        expect(e10 / e20).toBeGreaterThan(3.8);
        expect(e10 / e20).toBeLessThan(4.2);
        expect(phaseVelocityError(15, 0.5).axis).toBeLessThan(0); // slower than c
    });
});

describe('FDTD: interference maxima', () => {
    it('two coherent sources give intensity maxima where the path difference is a whole number of wavelengths', () => {
        const lambda = 16;
        const C = 0.5;
        const d = 4 * lambda;
        const N = 40;
        const nx = 270;
        const ny = 301;
        const g = createGrid({ nx, ny, dx: 1, c: 1, courant: C, spongeCells: N });
        const x0 = 50;
        const cell = (y) => rowOf(g, y) * nx + x0;
        const sources = [harmonicSource([cell(d / 2)], { frequency: 1 / lambda, amplitude: 0.1 }),
            harmonicSource([cell(-d / 2)], { frequency: 1 / lambda, amplitude: 0.1 })];
        const xd = x0 + 160; // detector column
        const perPeriod = lambda / C;
        const start = Math.round(260 / C);
        const I = new Float64Array(ny);
        for (let n = 0; n < start + 3 * perPeriod; n++) {
            step(g, sources);
            if (n >= start) for (let j = 0; j < ny; j++) I[j] += g.u[j * nx + xd] ** 2;
        }
        // Positions (y up) of the maxima away from the sponge, using the scheme's actual wavelength.
        const ys = Array.from({ length: ny }, (_, j) => yOf(g, ny - 1 - j));
        const values = Array.from({ length: ny }, (_, j) => I[ny - 1 - j]);
        const inner = (y) => Math.abs(y) < (ny - 1) / 2 - N - 5;
        const maxima = findExtrema(ys, values, { minRelative: 0.3 }).filter((m) => inner(m.y));
        const lambdaNum = (2 * Math.PI) / numericalWavenumber((2 * Math.PI) / lambda, { dx: 1, dt: C, c: 1 });
        const D = xd - x0;
        const pathDiff = (y) => Math.hypot(D, y + d / 2) - Math.hypot(D, y - d / 2);
        expect(maxima.length).toBeGreaterThanOrEqual(3);
        for (const m of maxima) {
            const order = pathDiff(m.y) / lambdaNum;
            expect(Math.abs(order - Math.round(order))).toBeLessThan(0.05); // within 5% of a fringe
        }
        const central = maxima.reduce((a, b) => (Math.abs(b.y) < Math.abs(a.y) ? b : a));
        expect(Math.abs(central.y)).toBeLessThan(1);
    });
});
