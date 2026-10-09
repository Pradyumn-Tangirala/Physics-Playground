// Numerical Wave Equation Lab: a real FDTD solution (physics/waves/fdtd.js)
// stepped a fixed number of times per frame.
//
// params = { scene: 'double' | 'single' | 'two-point' | 'point',
//            wavelength λ (m), slitWidth a (m), slitSeparation d (m), waveSpeed c (m/s),
//            cellsPerWavelength, courant, boundary: 'absorbing' | 'reflective', stepsPerFrame }
//
// The domain is a fixed DOMAIN.width × DOMAIN.height metres. Geometry,
// resolution, Courant number and boundary are baked into the grid, so
// changing any of them restarts the run (see gridKey); stepsPerFrame is read
// live.

import {
    createGrid, step, addBarrier, harmonicSource, lineSourceCells, pointSourceCells, colOf, rowOf, xOf, yOf, maxAbs,
} from '../physics/waves/fdtd.js';

export const DOMAIN = { width: 1.0, height: 0.6 }; // m
export const SOURCE_X = 0.12; // m, plane-wave line source
export const BARRIER_X = 0.28; // m, barrier (or the point sources)
export const DETECTOR_X = 0.88; // m, line along which intensity is averaged
export const MAX_CELLS = 250_000; // keeps one step under ~1 ms in a browser
const SPONGE_WAVELENGTHS = 3; // sponge thickness; 3λ measured ≈ 1% reflection
const DETECTOR_PERIODS = 4; // time constant of the running intensity average
const BLOW_UP = 1e6; // |u| beyond this means the scheme went unstable

/** Grid spacing for the requested resolution, coarsened if the grid would exceed MAX_CELLS. */
export function gridSpacing({ wavelength, cellsPerWavelength }) {
    const requested = wavelength / cellsPerWavelength;
    const minimum = Math.sqrt((DOMAIN.width * DOMAIN.height) / MAX_CELLS);
    return Math.max(requested, minimum);
}

/** Every parameter that requires a new grid. */
export const gridKey = (p) =>
    JSON.stringify([p.scene, p.wavelength, p.slitWidth, p.slitSeparation, p.waveSpeed, p.cellsPerWavelength, p.courant, p.boundary]);

function buildScene(params) {
    const { scene, wavelength, slitWidth, slitSeparation, waveSpeed: c, courant, boundary } = params;
    const dx = gridSpacing(params);
    const nx = Math.round(DOMAIN.width / dx);
    const ny = 2 * Math.round(DOMAIN.height / dx / 2) + 1; // odd, so there is a centre row
    const grid = createGrid({
        nx, ny, dx, c, courant, boundary,
        spongeCells: Math.max(20, Math.round((SPONGE_WAVELENGTHS * wavelength) / dx)),
    });
    const frequency = c / wavelength;
    let openings = null;
    let sources;
    if (scene === 'double' || scene === 'single') {
        const slits = scene === 'double'
            ? [{ center: slitSeparation / 2, width: slitWidth }, { center: -slitSeparation / 2, width: slitWidth }]
            : [{ center: 0, width: slitWidth }];
        openings = addBarrier(grid, { x: BARRIER_X, slits });
        sources = [harmonicSource(lineSourceCells(grid, SOURCE_X), { frequency, amplitude: 0.02 })];
    } else {
        const ys = scene === 'two-point' ? [slitSeparation / 2, -slitSeparation / 2] : [0];
        sources = ys.map((y) => harmonicSource(pointSourceCells(grid, BARRIER_X, y), { frequency, amplitude: 0.2 }));
    }
    return { grid, sources, openings, frequency };
}

export const fdtdSimulation = {
    init(params) {
        const scene = buildScene(params);
        const { grid } = scene;
        return {
            ...scene,
            key: gridKey(params),
            detector: { col: colOf(grid, DETECTOR_X), intensity: new Float64Array(grid.ny) },
            unstable: false,
            stepMs: 0, // smoothed wall time per step
        };
    },

    step(state, params) {
        if (state.unstable) return null;
        const { grid, sources, detector } = state;
        const alpha = Math.min(1, (grid.dt * state.frequency) / DETECTOR_PERIODS);
        const n = Math.max(1, Math.round(params.stepsPerFrame));
        const t0 = performance.now();
        for (let s = 0; s < n; s++) {
            step(grid, sources);
            const { u, nx } = grid;
            const I = detector.intensity;
            for (let j = 0; j < grid.ny; j++) {
                const v = u[j * nx + detector.col];
                I[j] += alpha * (v * v - I[j]);
            }
        }
        state.stepMs = 0.9 * state.stepMs + (0.1 * (performance.now() - t0)) / n;
        if (!(maxAbs(grid) < BLOW_UP)) {
            state.unstable = true;
            return { type: 'unstable', steps: grid.steps };
        }
        return null;
    },
};

/**
 * The analytical (phasor) model of the scene as actually built on the grid —
 * snapped slit widths and positions, the barrier's far face as the slit
 * plane — for comparing the detector line with interference.js.
 */
export function analyticSetupFor(state, params) {
    const { grid, openings } = state;
    const dx = grid.dx;
    const base = { wavelength: params.wavelength, waveSpeed: params.waveSpeed, phase: 0, amplitude1: 1, amplitude2: 1 };
    const detectorX = xOf(grid, colOf(grid, DETECTOR_X));
    if (openings) {
        // Slits radiate from the far face of the two-cell barrier.
        const exitX = xOf(grid, colOf(grid, BARRIER_X)) + 2 * dx;
        const double = openings.length === 2;
        return {
            ...base,
            mode: double ? 'double' : 'single',
            slitWidth: openings[0].width,
            slitSeparation: double ? openings[0].center - openings[1].center : 0,
            screenDistance: detectorX - exitX,
        };
    }
    const sourceX = xOf(grid, colOf(grid, BARRIER_X));
    const two = params.scene === 'two-point';
    const rowY = (y) => yOf(grid, rowOf(grid, y)); // where the point source actually sits
    return {
        ...base,
        mode: two ? 'double' : 'single',
        slitWidth: 0,
        slitSeparation: two ? rowY(params.slitSeparation / 2) - rowY(-params.slitSeparation / 2) : 0,
        screenDistance: detectorX - sourceX,
    };
}

/** Simulated time until the detector average is meaningful: travel to the far corner of the detector line plus a few periods. */
export function settleTime(state, params) {
    const startX = state.openings ? SOURCE_X : BARRIER_X;
    const path = Math.hypot(DETECTOR_X - startX, (state.grid.ny * state.grid.dx) / 2);
    return path / params.waveSpeed + 10 / state.frequency;
}
