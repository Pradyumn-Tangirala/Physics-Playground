// Before/after performance of the wave kernels. Each "before" is the
// pre-optimisation implementation, kept here verbatim in spirit as a baseline,
// run on identical inputs to the current code. Results are printed and saved
// to test-results/perf-kernels.json.
//
// The assertions are deliberately loose (current must beat the baseline by a
// margin well below the measured speed-up) so the suite is not flaky, while
// still failing if an optimisation is undone.

import { describe, it, expect, afterAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildField } from '../../src/physics/waves/field';
import { subSources, wavenumber } from '../../src/physics/waves/interference';
import { createGrid, step, maxAbs } from '../../src/physics/waves/fdtd';

const results = {};
afterAll(() => {
    mkdirSync('test-results', { recursive: true });
    writeFileSync('test-results/perf-kernels.json', JSON.stringify(results, null, 2));
    console.table(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { beforeMs: v.beforeMs.toFixed(2), afterMs: v.afterMs.toFixed(2), speedup: `${v.speedup.toFixed(2)}×` }])));
});

/** Median wall time (ms) of `fn` over `runs` runs, after `warmup` unmeasured runs. */
function median(fn, runs = 7, warmup = 2) {
    for (let i = 0; i < warmup; i++) fn();
    const t = [];
    for (let i = 0; i < runs; i++) {
        const t0 = performance.now();
        fn();
        t.push(performance.now() - t0);
    }
    t.sort((a, b) => a - b);
    return t[Math.floor(runs / 2)];
}

function compare(name, before, after, runs) {
    const beforeMs = median(before, runs);
    const afterMs = median(after, runs);
    results[name] = { beforeMs, afterMs, speedup: beforeMs / afterMs };
    return results[name];
}

// ---- Baseline 1: the analytical field as a direct sum (one sqrt, cos, sin per source per cell).
function buildFieldDirect(setup, width, height) {
    const D = setup.screenDistance;
    const x0 = -0.12 * D;
    const scale = (D - x0) / width;
    const yHalf = (scale * height) / 2;
    const k = wavenumber(setup.wavelength);
    const sources = subSources(setup, setup.wavelength / 4, 24);
    const re = new Float32Array(width * height);
    const im = new Float32Array(width * height);
    const rMin = setup.wavelength / 4;
    for (let row = 0; row < height; row++) {
        const y = yHalf - (row + 0.5) * scale;
        for (let col = 0; col < width; col++) {
            const x = x0 + (col + 0.5) * scale;
            if (x <= 0) continue;
            let sr = 0;
            let si = 0;
            for (const s of sources) {
                const dy = y - s.y;
                const r = Math.max(Math.sqrt(x * x + dy * dy), rMin);
                const w = s.weight * Math.sqrt(D / r);
                const a = k * r + s.phase;
                sr += w * Math.cos(a);
                si += w * Math.sin(a);
            }
            re[row * width + col] = sr;
            im[row * width + col] = si;
        }
    }
    return { re, im };
}

// ---- Baseline 2: the FDTD step with a wall branch and a division per cell.
function stepBranchy(g) {
    const { nx, ny, u, uPrev, uNext, wall, damp } = g;
    const C2 = g.courant * g.courant;
    for (let j = 1; j < ny - 1; j++) {
        let k = j * nx + 1;
        for (let i = 1; i < nx - 1; i++, k++) {
            if (wall[k]) { uNext[k] = 0; continue; }
            const lap = u[k - 1] + u[k + 1] + u[k - nx] + u[k + nx] - 4 * u[k];
            const b = damp[k];
            uNext[k] = (2 * u[k] - (1 - b) * uPrev[k] + C2 * lap) / (1 + b);
        }
    }
    g.uPrev = u; g.u = uNext; g.uNext = uPrev;
}

// ---- Baseline 3: the blow-up check with for…of and a NaN test per cell.
function maxAbsForOf(g) {
    let m = 0;
    for (const v of g.u) {
        const a = Math.abs(v);
        if (a > m || Number.isNaN(v)) m = Number.isNaN(v) ? Infinity : a;
    }
    return m;
}

const RIPPLE = {
    mode: 'double', wavelength: 0.02, waveSpeed: 0.25, slitSeparation: 0.1, slitWidth: 0.01,
    screenDistance: 1, phase: 0, amplitude1: 1, amplitude2: 1,
};

function seededGrid() {
    const g = createGrid({ nx: 500, ny: 301, dx: 0.002, c: 0.25, courant: 0.5, spongeCells: 45 });
    for (let k = 0; k < g.u.length; k++) { g.u[k] = Math.sin(k * 0.01); g.uPrev[k] = g.u[k]; }
    return g;
}

describe('analytical field precompute (495 × 211 cells)', () => {
    it('default ripple tank: kernel method is faster than the direct sum', () => {
        const r = compare('field: ripple tank', () => buildFieldDirect(RIPPLE, 495, 211), () => buildField(RIPPLE, 495, 211));
        expect(r.speedup).toBeGreaterThan(1.2);
    });

    it('wide slits (a = 60 mm, λ = 5 mm): kernel method is several times faster', () => {
        const wide = { ...RIPPLE, wavelength: 0.005, slitWidth: 0.06 };
        const r = compare('field: wide slits', () => buildFieldDirect(wide, 495, 211), () => buildField(wide, 495, 211), 5);
        expect(r.speedup).toBeGreaterThan(2.5);
    });
});

describe('FDTD (500 × 301 cells)', () => {
    it('branch-free, division-free step beats the original', () => {
        const a = seededGrid();
        const b = seededGrid();
        step(b); // builds the per-cell factors once, as in a real run
        const r = compare('fdtd: one step', () => stepBranchy(a), () => step(b), 15);
        expect(r.speedup).toBeGreaterThan(1.15);
    });

    it('indexed blow-up check beats for…of', () => {
        const g = seededGrid();
        const r = compare('fdtd: blow-up check', () => maxAbsForOf(g), () => maxAbs(g), 15);
        expect(r.speedup).toBeGreaterThan(1.5);
        expect(maxAbs(g)).toBe(maxAbsForOf(g)); // same answer
    });
});
