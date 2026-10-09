import { describe, it, expect } from 'vitest';
import { createSimulation } from './simulationState';
import {
    fdtdSimulation, gridKey, gridSpacing, analyticSetupFor, settleTime, DOMAIN, MAX_CELLS,
} from './fdtdSimulation';
import { screenPattern, measureFringeSpacing, fringeSpacing } from '../physics/waves/interference';

const BASE = {
    scene: 'double', wavelength: 0.03, slitWidth: 0.012, slitSeparation: 0.1, waveSpeed: 0.25,
    cellsPerWavelength: 15, courant: 0.5, boundary: 'absorbing', stepsPerFrame: 10,
};

/** Runs until the detector average has settled; returns the detector line and the analytical prediction, both normalised. */
function detectorVsAnalytic(params) {
    const sim = createSimulation(fdtdSimulation, params);
    const state = sim.getState();
    const until = settleTime(state, params) + 4 / state.frequency;
    while (state.grid.t < until) sim.tick(1 / 60, params);
    const { grid, detector } = state;
    const half = ((grid.ny - 1) / 2) * grid.dx;
    const inner = half - (grid.spongeCells + 2) * grid.dx;
    const setup = analyticSetupFor(state, params);
    const analytic = screenPattern(setup, half, grid.ny).intensity;
    const y = [];
    const fd = [];
    const an = [];
    for (let s = 0; s < grid.ny; s++) {
        const ys = -half + s * grid.dx;
        if (Math.abs(ys) > inner) continue;
        y.push(ys);
        fd.push(detector.intensity[grid.ny - 1 - s]);
        an.push(analytic[s]);
    }
    const norm = (v) => { const m = Math.max(...v); return Float64Array.from(v, (x) => x / m); };
    return { y: Float64Array.from(y), fdtd: norm(fd), analytic: norm(an), setup, inner };
}

describe('fdtdSimulation', () => {
    it('restarts only for parameters baked into the grid', () => {
        expect(gridKey({ ...BASE, stepsPerFrame: 1 })).toBe(gridKey(BASE));
        expect(gridKey({ ...BASE, courant: 0.6 })).not.toBe(gridKey(BASE));
        expect(gridKey({ ...BASE, boundary: 'reflective' })).not.toBe(gridKey(BASE));
    });

    it('coarsens the grid rather than exceed MAX_CELLS', () => {
        const dx = gridSpacing({ wavelength: 0.015, cellsPerWavelength: 30 });
        expect((DOMAIN.width / dx) * (DOMAIN.height / dx)).toBeLessThanOrEqual(MAX_CELLS * 1.0001);
        expect(gridSpacing(BASE)).toBeCloseTo(0.002, 12);
    });

    it('builds a symmetric double slit and a plane-wave source', () => {
        const s = createSimulation(fdtdSimulation, BASE).getState();
        expect(s.openings).toHaveLength(2);
        expect(s.openings[0].center).toBeCloseTo(-s.openings[1].center, 12);
        expect(s.openings[0].width).toBeCloseTo(0.014, 12); // 1.2 cm snapped to 7 rows of 2 mm
        expect(s.sources).toHaveLength(1);
        expect(s.grid.ny % 2).toBe(1);
    });

    it('reports an unstable run and stops stepping when the CFL condition is violated', () => {
        const params = { ...BASE, courant: 0.75, cellsPerWavelength: 8 };
        const sim = createSimulation(fdtdSimulation, params);
        let event = null;
        for (let f = 0; f < 400 && !event; f++) event = sim.tick(1 / 60, params);
        expect(event).toMatchObject({ type: 'unstable' });
        const steps = sim.getState().grid.steps;
        sim.tick(1 / 60, params);
        expect(sim.getState().grid.steps).toBe(steps);
    });

    it('stays stable at the same settings with C = 0.7', () => {
        const params = { ...BASE, courant: 0.7, cellsPerWavelength: 8 };
        const sim = createSimulation(fdtdSimulation, params);
        for (let f = 0; f < 150; f++) expect(sim.tick(1 / 60, params)).toBeNull();
        expect(sim.getState().unstable).toBe(false);
    });
});

describe('FDTD against the analytical model (end to end)', () => {
    it('double slit: fringe spacing agrees, and the gap closes as the grid is refined', () => {
        const gap = (cellsPerWavelength) => {
            const r = detectorVsAnalytic({ ...BASE, cellsPerWavelength });
            const window = Math.min(2.6 * fringeSpacing(r.setup), 0.9 * r.inner);
            const f = measureFringeSpacing(r.y, r.fdtd, 0, window).spacing;
            const a = measureFringeSpacing(r.y, r.analytic, 0, window).spacing;
            return Math.abs(f - a) / a;
        };
        const coarse = gap(10);
        const fine = gap(15);
        expect(fine).toBeLessThan(0.04);
        expect(fine).toBeLessThan(coarse);
    }, 20000);

    it('single slit: the diffraction envelope agrees within 3% RMS', () => {
        const r = detectorVsAnalytic({ ...BASE, scene: 'single', slitWidth: 0.08, cellsPerWavelength: 10 });
        let sum = 0;
        for (let i = 0; i < r.y.length; i++) sum += (r.fdtd[i] - r.analytic[i]) ** 2;
        expect(Math.sqrt(sum / r.y.length)).toBeLessThan(0.03);
    }, 20000);
});
