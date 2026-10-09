// Numerical solver for the 2-D scalar wave equation
//
//     ∂²u/∂t² = c²(∂²u/∂x² + ∂²u/∂y²) − σ(x, y)·∂u/∂t + F(x, y, t)
//
// by finite differences in time and space (FDTD, "leapfrog"): central
// differences in both, second-order accurate, on a uniform grid of square
// cells of size Δx with time step Δt. With the Courant number C = cΔt/Δx,
//
//     uⁿ⁺¹ = [2uⁿ − (1 − b)uⁿ⁻¹ + C²·(uⁿ_E + uⁿ_W + uⁿ_N + uⁿ_S − 4uⁿ)] / (1 + b),   b = σΔt/2,
//
// plus the source term Δt²F, added to uⁿ⁺¹ at the source cells.
//
// σ is zero except in the absorbing sponge layer along the edges. The scheme
// is stable only when C ≤ 1/√2 in 2-D (the CFL condition, COURANT_LIMIT).
//
// Boundaries:
//   'reflective'  the outermost ring of cells is held at u = 0 (a rigid edge:
//                 waves reflect with their sign inverted).
//   'absorbing'   a sponge layer of growing σ damps outgoing waves, and the
//                 outer ring uses a first-order Mur condition that lets what
//                 is left leave. Measured residual reflection ≈ 1% for a
//                 sponge three wavelengths thick (WAVE_MODEL.md).
// Wall cells (the barrier) are held at u = 0, which reflects like a rigid wall.
//
// Coordinates: cell (i, j) is at x = i·Δx from the left edge and
// y = (j_c − j)·Δx from the centre row j_c = (ny − 1)/2 (up is positive).

export const COURANT_LIMIT = 1 / Math.SQRT2;

/** Sponge thickness in cells when none is given (the lab sets it to three wavelengths). */
const DEFAULT_SPONGE_CELLS = 30;

/**
 * Peak damping σ_max = SPONGE_STRENGTH·c / (sponge thickness), with σ growing
 * quadratically into the layer. Stronger damping reflects off its own
 * gradient; 6 (with the Mur edge behind it) measured best.
 */
const SPONGE_STRENGTH = 6;

export function createGrid({ nx, ny, dx, c, courant, boundary = 'absorbing', spongeCells = DEFAULT_SPONGE_CELLS }) {
    const n = nx * ny;
    const grid = {
        nx,
        ny,
        dx,
        c,
        courant,
        dt: (courant * dx) / c,
        boundary,
        spongeCells: boundary === 'absorbing' ? spongeCells : 0,
        u: new Float32Array(n),
        uPrev: new Float32Array(n),
        uNext: new Float32Array(n),
        wall: new Uint8Array(n),
        damp: new Float32Array(n), // b = σΔt/2 per cell
        factors: null, // per-cell update factors, derived from damp on the first step
        wallList: null, // indices of wall cells, derived from wall on the first step
        steps: 0,
        t: 0,
    };
    if (boundary === 'absorbing') fillSponge(grid);
    return grid;
}

function fillSponge(grid) {
    const { nx, ny, spongeCells: N, c, dx, dt } = grid;
    const sigmaMax = (SPONGE_STRENGTH * c) / (N * dx);
    for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
            const edge = Math.min(i, nx - 1 - i, j, ny - 1 - j);
            const depth = N - edge;
            if (depth > 0) grid.damp[j * nx + i] = (sigmaMax * (depth / N) ** 2 * dt) / 2;
        }
    }
}

export const xOf = (grid, i) => i * grid.dx;
export const yOf = (grid, j) => ((grid.ny - 1) / 2 - j) * grid.dx;
export const colOf = (grid, x) => Math.round(x / grid.dx);
const centreRowOffset = (ny, dx, y) => (ny - 1) / 2 - Math.sign(y) * Math.round(Math.abs(y) / dx);
/** Row nearest to y, rounding halves away from the axis so ±y always map to mirror-image rows. */
export const rowOf = (grid, y) => centreRowOffset(grid.ny, grid.dx, y);

/**
 * The rows of a grid with ny rows of size dx that a slit { center, width }
 * (metres from the axis) opens: every row whose centre lies within the slit,
 * and at least one. Returns { rows, center, width } with the snapped values.
 */
export function snapOpening(ny, dx, center, width) {
    const rows = [];
    for (let j = 0; j < ny; j++) {
        if (Math.abs(((ny - 1) / 2 - j) * dx - center) <= width / 2 + 1e-12) rows.push(j);
    }
    if (!rows.length) rows.push(centreRowOffset(ny, dx, center));
    const top = ((ny - 1) / 2 - rows[0]) * dx;
    const bottom = ((ny - 1) / 2 - rows.at(-1)) * dx;
    return { rows, center: (top + bottom) / 2, width: rows.length * dx };
}

/**
 * A barrier one or more cells thick at x, open only at the slits
 * (slits: [{ center, width }] in metres, centre measured from the axis).
 * Openings snap to whole cells (at least one). Returns the actual openings
 * { center, width } after snapping, so the page can report what was built.
 */
export function addBarrier(grid, { x, thicknessCells = 2, slits = [] }) {
    const { nx, ny, dx, wall } = grid;
    const i0 = colOf(grid, x);
    const open = new Uint8Array(ny);
    const actual = slits.map(({ center, width }) => {
        const snapped = snapOpening(ny, dx, center, width);
        snapped.rows.forEach((j) => { open[j] = 1; });
        return { center: snapped.center, width: snapped.width };
    });
    for (let j = 0; j < ny; j++) {
        if (open[j]) continue;
        for (let i = i0; i < Math.min(nx, i0 + thicknessCells); i++) wall[j * nx + i] = 1;
    }
    grid.wallList = null; // re-derive on the next step
    return actual;
}

/**
 * A soft (additive) harmonic source on the given cells: every step adds
 * a·sin(ωt) to u there (i.e. F = a·sin(ωt)/Δt²). Soft sources let waves pass
 * through them, unlike a hard source that pins u. Amplitude is in arbitrary units.
 */
export function harmonicSource(cells, { frequency, amplitude = 1, phase = 0, rampPeriods = 2 }) {
    return { cells: Int32Array.from(cells), omega: 2 * Math.PI * frequency, amplitude, phase, rampTime: rampPeriods / frequency };
}

export const pointSourceCells = (grid, x, y) => [rowOf(grid, y) * grid.nx + colOf(grid, x)];

/** Every cell of the column at x except the fixed outer ring: a line source that launches a plane wave. */
export function lineSourceCells(grid, x) {
    const i = colOf(grid, x);
    return Array.from({ length: grid.ny - 2 }, (_, k) => (k + 1) * grid.nx + i);
}

/** Smooth turn-on (half a cosine over rampTime) so the source does not start with a jolt. */
const ramp = (t, rampTime) => (t >= rampTime ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * t) / rampTime));

/**
 * The update rewritten without a division per cell:
 *   uⁿ⁺¹ = keep·(2uⁿ + C²·lap) − carry·uⁿ⁻¹,   keep = 1/(1 + b),  carry = (1 − b)/(1 + b).
 */
function prepare(grid) {
    if (!grid.factors) {
        const n = grid.damp.length;
        const keep = new Float32Array(n);
        const carry = new Float32Array(n);
        for (let k = 0; k < n; k++) {
            const b = grid.damp[k];
            keep[k] = 1 / (1 + b);
            carry[k] = (1 - b) / (1 + b);
        }
        grid.factors = { keep, carry };
    }
    if (!grid.wallList) {
        const list = [];
        grid.wall.forEach((w, k) => { if (w) list.push(k); });
        grid.wallList = Int32Array.from(list);
    }
}

/** Advances the grid by one time step. */
export function step(grid, sources = []) {
    prepare(grid);
    const { nx, ny, u, uPrev, uNext, wallList } = grid;
    const { keep, carry } = grid.factors;
    const C2 = grid.courant * grid.courant;
    for (let j = 1; j < ny - 1; j++) {
        const end = j * nx + nx - 1;
        for (let k = j * nx + 1; k < end; k++) {
            const uk = u[k];
            const lap = u[k - 1] + u[k + 1] + u[k - nx] + u[k + nx] - 4 * uk;
            uNext[k] = keep[k] * (2 * uk + C2 * lap) - carry[k] * uPrev[k];
        }
    }
    for (let w = 0; w < wallList.length; w++) uNext[wallList[w]] = 0; // rigid walls
    if (grid.boundary === 'absorbing') applyMur(grid, u, uNext);
    const tNext = (grid.steps + 1) * grid.dt;
    for (const s of sources) {
        const f = s.amplitude * ramp(tNext, s.rampTime) * Math.sin(s.omega * tNext + s.phase);
        for (const k of s.cells) if (!grid.wall[k]) uNext[k] += f;
    }
    // Rotate the three time levels without allocating.
    grid.uPrev = u;
    grid.u = uNext;
    grid.uNext = uPrev;
    grid.steps += 1;
    grid.t = grid.steps * grid.dt;
}

/**
 * First-order Mur absorbing condition on the outer ring: the edge value is
 * extrapolated from its inner neighbour as a wave leaving at speed c,
 *   uⁿ⁺¹_edge = uⁿ_in + (C − 1)/(C + 1)·(uⁿ⁺¹_in − uⁿ_edge).
 * Exact for waves hitting the edge head-on; the sponge in front of it handles
 * the oblique ones. Corners take the mean of their two neighbours.
 */
function applyMur(grid, u, uNext) {
    const { nx, ny } = grid;
    const kappa = (grid.courant - 1) / (grid.courant + 1);
    for (let j = 1; j < ny - 1; j++) {
        const left = j * nx;
        const right = left + nx - 1;
        uNext[left] = u[left + 1] + kappa * (uNext[left + 1] - u[left]);
        uNext[right] = u[right - 1] + kappa * (uNext[right - 1] - u[right]);
    }
    const last = (ny - 1) * nx;
    for (let i = 1; i < nx - 1; i++) {
        uNext[i] = u[i + nx] + kappa * (uNext[i + nx] - u[i]);
        uNext[last + i] = u[last + i - nx] + kappa * (uNext[last + i - nx] - u[last + i]);
    }
    uNext[0] = 0.5 * (uNext[1] + uNext[nx]);
    uNext[nx - 1] = 0.5 * (uNext[nx - 2] + uNext[2 * nx - 1]);
    uNext[last] = 0.5 * (uNext[last + 1] + uNext[last - nx]);
    uNext[last + nx - 1] = 0.5 * (uNext[last + nx - 2] + uNext[last - 1]);
}

/**
 * The energy that the leapfrog scheme conserves exactly (without damping or
 * sources, with rigid edges), between time levels n and n+1:
 *   E = ½Σ((uⁿ⁺¹ − uⁿ)/Δt)² + ½(c/Δx)²·Σ_edges (Δuⁿ⁺¹)(Δuⁿ)
 * where Δ is the difference across each pair of neighbouring cells.
 * It is positive only when the CFL condition holds.
 */
export function discreteEnergy(grid) {
    const { nx, ny, u, uPrev, dt, c, dx } = grid;
    let kinetic = 0;
    let strain = 0;
    for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
            const k = j * nx + i;
            kinetic += ((u[k] - uPrev[k]) / dt) ** 2;
            if (i + 1 < nx) strain += (u[k + 1] - u[k]) * (uPrev[k + 1] - uPrev[k]);
            if (j + 1 < ny) strain += (u[k + nx] - u[k]) * (uPrev[k + nx] - uPrev[k]);
        }
    }
    return 0.5 * kinetic + 0.5 * (c / dx) ** 2 * strain;
}

/** Largest |u| on the grid (used to detect a blow-up). */
export function maxAbs(grid) {
    const { u } = grid;
    let m = 0;
    let nan = false;
    for (let k = 0; k < u.length; k++) {
        const a = Math.abs(u[k]);
        if (a > m) m = a;
        else if (a !== a) nan = true; // NaN fails every comparison
    }
    return nan ? Infinity : m;
}

/**
 * Exact numerical wavenumber of the leapfrog scheme for a wave of angular
 * frequency ω travelling along a grid axis, from its dispersion relation
 *   sin²(ωΔt/2) / (cΔt)² = sin²(kΔx/2) / Δx².
 * NaN if ω is above what the grid can carry.
 */
export function numericalWavenumber(omega, { dx, dt, c }) {
    const s = (dx / (c * dt)) * Math.sin((omega * dt) / 2);
    return Math.abs(s) > 1 ? NaN : (2 / dx) * Math.asin(s);
}

/** The same along the grid diagonal: sin²(ωΔt/2)/(cΔt)² = 2 sin²(kΔx/(2√2))/Δx². */
function numericalWavenumberDiagonal(omega, { dx, dt, c }) {
    const s = (dx / (c * dt * Math.SQRT2)) * Math.sin((omega * dt) / 2);
    return Math.abs(s) > 1 ? NaN : ((2 * Math.SQRT2) / dx) * Math.asin(s);
}

/**
 * Relative phase-velocity error ω/(k_num·c) − 1 along the axis and the
 * diagonal, for a given number of cells per wavelength and Courant number.
 * The scheme is slower than c at every angle (numerical dispersion).
 */
export function phaseVelocityError(cellsPerWavelength, courant) {
    const dx = 1;
    const c = 1;
    const dt = courant;
    const omega = (2 * Math.PI) / cellsPerWavelength; // k = 2π/λ with λ = cellsPerWavelength cells, ω = c·k
    return {
        axis: omega / numericalWavenumber(omega, { dx, dt, c }) - 1,
        diagonal: omega / numericalWavenumberDiagonal(omega, { dx, dt, c }) - 1,
    };
}
