// The 2-D field view of the analytical model (see interference.js): the
// complex field U(x, y) on a grid of cells, from the barrier to the screen.
//
// Only the spatial part is computed here, once per parameter change. The
// renderer animates it by rotating the phase: the real field at time t is
//     u = Re(U·e^{−iωt}) = re·cos ωt + im·sin ωt,
// and the time-averaged intensity is |U|²/2 — neither needs any trigonometry
// per pixel per frame.
//
// The view is drawn to scale (one metre is the same number of cells in x and
// y). That only works when a wavelength spans several cells; at optical
// scales (λ ≈ 600 nm over D ≈ 1 m) it cannot, and buildField says so instead
// of drawing an aliased picture.

import { wavenumber, slits, fringeSpacing, envelopeZero } from './interference.js';
import { snapOpening } from './fdtd.js';

/** The view starts this fraction of D to the left of the barrier (incident region). */
const INCIDENT_FRACTION = 0.12;
/** Fewest cells per wavelength for which the instantaneous field is drawn without aliasing. */
const MIN_CELLS_PER_WAVELENGTH = 3;
/** Fewest cells per fringe for which the intensity map is drawn. */
const MIN_CELLS_PER_FRINGE = 3;
/**
 * The field view radiates from one sub-source per grid row, which is a valid
 * Huygens sum only if neighbouring sources are at most λ/2 apart (otherwise
 * spurious "grating" beams appear and the aperture itself is unresolved).
 */
const MIN_SOURCE_CELLS_PER_WAVELENGTH = 2;
const WALL_THICKNESS_CELLS = 2;

/** Physical window of a width × height grid: x from −0.12·D to D, y centred on the axis. */
export function fieldView(setup, width, height) {
    const D = setup.screenDistance;
    const x0 = -INCIDENT_FRACTION * D;
    const scale = (D - x0) / width; // metres per cell, the same in x and y
    const pattern = setup.mode === 'double' ? fringeSpacing(setup)
        : setup.slitWidth > 0 ? envelopeZero(setup) : Infinity;
    return {
        x0,
        x1: D,
        yHalf: (scale * height) / 2,
        scale,
        cellsPerWavelength: setup.wavelength / scale,
        cellsPerFringe: pattern / scale,
    };
}

/** Whether each display mode can be drawn to scale on this grid. */
export function drawability(view) {
    const sourcesValid = view.cellsPerWavelength >= MIN_SOURCE_CELLS_PER_WAVELENGTH;
    return {
        field: view.cellsPerWavelength >= MIN_CELLS_PER_WAVELENGTH,
        intensity: sourcesValid && view.cellsPerFringe >= MIN_CELLS_PER_FRINGE,
    };
}

/** On-axis amplitude at the screen in the far field: the reference for display brightness. */
export const referenceAmplitude = ({ mode, amplitude1, amplitude2 }) =>
    (mode === 'double' ? amplitude1 + amplitude2 : amplitude1) || 1;

/**
 * Sub-sources for the field view: one per grid row inside each slit opening
 * (the same rows that are drawn open in the barrier), so every source sits on
 * a row centre. Returns [{ row, weight, phase }] and the rows each slit opens.
 */
function fieldSources(setup, height, scale) {
    const slitList = slits(setup);
    const openings = slitList.map((s) => snapOpening(height, scale, s.y, setup.slitWidth));
    const sources = [];
    slitList.forEach((slit, n) => {
        const { rows } = openings[n];
        for (const row of rows) sources.push({ row, weight: slit.amplitude / rows.length, phase: slit.phase });
    });
    return { sources, openings };
}

/**
 * Precomputes U = re + i·im on a width × height grid (Float32Array, row-major;
 * row j is at y = ((height − 1)/2 − j)·scale, so y = 0 is a row centre when
 * height is odd). Returns { width, height, re, im, wall, view, drawable,
 * openings } — re/im are null when nothing can be drawn to scale.
 *
 * Speed: every sub-source sits on a row centre, so the wave of a source at
 * row r_s seen from row r is the same kernel K(|r − r_s|, x) = √(D/ρ)·e^{ikρ}
 * shifted. K is computed once (all the trigonometry), and each source then
 * costs one complex multiply-add per cell.
 */
export function buildField(setup, width, height) {
    const view = fieldView(setup, width, height);
    const drawable = drawability(view);
    const n = width * height;
    const wall = new Uint8Array(n);
    if (!drawable.field && !drawable.intensity) {
        return { width, height, re: null, im: null, wall, view, drawable, openings: [] };
    }

    const re = new Float32Array(n);
    const im = new Float32Array(n);
    const { wavelength, screenDistance: D } = setup;
    const k = wavenumber(wavelength);
    const { x0, scale } = view;
    const { sources, openings } = fieldSources(setup, height, scale);
    const open = new Uint8Array(height);
    for (const o of openings) for (const r of o.rows) if (r >= 0 && r < height) open[r] = 1;
    const wallThickness = WALL_THICKNESS_CELLS * scale;
    const incident = 0.5 * referenceAmplitude(setup); // display amplitude of the incoming plane wave
    const rMin = wavelength / 4; // avoid the 1/√r singularity at a sub-source

    // Barrier and incident region (x ≤ 0).
    const firstLit = Math.max(0, Math.ceil(-x0 / scale - 0.5)); // first column with x > 0
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < firstLit; col++) {
            const x = x0 + (col + 0.5) * scale;
            const i = row * width + col;
            if (x > -wallThickness && !open[row]) {
                wall[i] = 1;
            } else {
                re[i] = incident * Math.cos(k * x);
                im[i] = incident * Math.sin(k * x);
            }
        }
    }

    // Kernel K(d, col) for row offsets d = 0 … maxOffset.
    let maxOffset = 0;
    for (const s of sources) maxOffset = Math.max(maxOffset, Math.abs(s.row), Math.abs(height - 1 - s.row));
    const lit = width - firstLit;
    const kRe = new Float32Array((maxOffset + 1) * lit);
    const kIm = new Float32Array((maxOffset + 1) * lit);
    for (let d = 0; d <= maxOffset; d++) {
        const dy = d * scale;
        for (let c = 0; c < lit; c++) {
            const x = x0 + (firstLit + c + 0.5) * scale;
            const r = Math.max(Math.sqrt(x * x + dy * dy), rMin);
            const w = Math.sqrt(D / r);
            kRe[d * lit + c] = w * Math.cos(k * r);
            kIm[d * lit + c] = w * Math.sin(k * r);
        }
    }

    // U = Σ_s (weight·e^{iφ}) · K(|row − row_s|, col)
    for (const s of sources) {
        const cr = s.weight * Math.cos(s.phase);
        const ci = s.weight * Math.sin(s.phase);
        for (let row = 0; row < height; row++) {
            const kBase = Math.abs(row - s.row) * lit;
            let i = row * width + firstLit;
            for (let c = 0; c < lit; c++, i++) {
                const a = kRe[kBase + c];
                const b = kIm[kBase + c];
                re[i] += cr * a - ci * b;
                im[i] += cr * b + ci * a;
            }
        }
    }
    return { width, height, re, im, wall, view, drawable, openings };
}

/** Instantaneous field u = re·cos ωt + im·sin ωt at cell i, for accumulated phase ωt. */
export const fieldAt = (field, i, wavePhase) =>
    field.re[i] * Math.cos(wavePhase) + field.im[i] * Math.sin(wavePhase);

/** Time-averaged intensity |U|² at cell i (the factor ½ of ⟨u²⟩ is dropped, as in interference.js). */
export const intensityAt = (field, i) => field.re[i] ** 2 + field.im[i] ** 2;
