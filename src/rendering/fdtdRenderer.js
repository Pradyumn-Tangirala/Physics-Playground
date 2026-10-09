// Draws the Numerical Wave Equation Lab: the FDTD field and the detector-line
// intensity compared with the analytical model for the same geometry.
// Reads simulation state; caches are render-side memoisation only.

import { colOf } from '../physics/waves/fdtd.js';
import {
    screenPattern, fringeSpacing, measureFringeSpacing, measureCentralWidth,
} from '../physics/waves/interference.js';
import { BARRIER_X, DETECTOR_X, SOURCE_X, analyticSetupFor, settleTime } from '../simulation/fdtdSimulation.js';
import { FIELD_GAIN, LUT_HALF, buildFieldLut } from './colorThemes.js';
import { drawChart } from './charts.js';
import { beginFrame } from './canvasSize.js';

const WALL_RGB = [150, 150, 165];
export const FDTD_COLOR = '#ff9f43';
export const ANALYTIC_COLOR = '#48dbfb';

const makeCanvas = (w, h) => {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
};

/** Text on a translucent backing box, so it stays readable over the field. */
function label(ctx, text, x, y, align, color) {
    const w = ctx.measureText(text).width;
    const h = parseInt(ctx.font, 10) + 4;
    const left = align === 'right' ? x - w - 3 : x - 3;
    const top = ctx.textBaseline === 'bottom' ? y - h + 2 : y - 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(left, top, w + 6, h);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
}

export function createFdtdRenderer() {
    const cache = { image: null, offscreen: null, theme: '', lut: null, gain: 1, gainAtStep: -1, frameMs: 0, frames: 0, analyticKey: '', analytic: null };

    function renderField(canvas, state, params, { theme }) {
        const t0 = performance.now();
        const ctx = canvas.getContext('2d', { alpha: false });
        const { width: W, height: H } = beginFrame(ctx); // CSS pixels
        const { grid } = state;
        const { nx, ny, u, wall, spongeCells: N } = grid;

        if (!cache.image || cache.image.width !== nx || cache.image.height !== ny) {
            cache.image = new ImageData(nx, ny);
            cache.image.data.fill(255);
            cache.offscreen = makeCanvas(nx, ny);
        }
        if (cache.theme !== theme) {
            cache.lut = buildFieldLut(theme);
            cache.theme = theme;
        }

        // Fill pixels with the current gain. The gain for the next frame comes
        // from the RMS of the field in the region of interest (behind the
        // barrier for slit scenes, so the strong standing wave in front of it
        // does not wash out the diffracted waves), sampled on every 3rd cell.
        const data = cache.image.data;
        const lut = cache.lut;
        const gain = cache.gain;
        for (let k = 0, o = 0; k < u.length; k++, o += 4) {
            if (wall[k]) {
                data[o] = WALL_RGB[0]; data[o + 1] = WALL_RGB[1]; data[o + 2] = WALL_RGB[2];
                continue;
            }
            let q = Math.round(u[k] * gain);
            if (q > LUT_HALF) q = LUT_HALF; else if (q < -LUT_HALF) q = -LUT_HALF;
            const l = (q + LUT_HALF) * 3;
            data[o] = lut[l]; data[o + 1] = lut[l + 1]; data[o + 2] = lut[l + 2];
        }
        const i0 = state.openings ? colOf(grid, BARRIER_X) + 3 : N + 1;
        let sum = 0;
        let count = 0;
        let peak = 0;
        for (let j = N + 1; j < ny - 1 - N; j += 3) {
            for (let i = N + 1, k = j * nx + N + 1; i < nx - 1 - N; i += 3, k += 3) {
                const v = u[k];
                if (Math.abs(v) > peak) peak = Math.abs(v);
                if (i >= i0) { sum += v * v; count++; }
            }
        }
        const rms = Math.sqrt(sum / Math.max(count, 1));
        // Only adapt while the solver is advancing, so a paused field stays perfectly still.
        const advanced = grid.steps !== cache.gainAtStep;
        cache.gainAtStep = grid.steps;
        if (advanced && rms > 0 && Number.isFinite(rms)) {
            // ±2.2 RMS of the region of interest spans the colour range, but never
            // more than 4× saturation for the strongest field (otherwise the
            // round-off noise before the wave arrives would be amplified).
            const target = Math.min((0.45 * FIELD_GAIN) / rms, (4 * LUT_HALF) / peak);
            // Drop at once (no saturated frames), rise smoothly (no flicker).
            cache.gain = target < cache.gain || cache.gain === 1 ? target : 0.9 * cache.gain + 0.1 * target;
        }

        cache.offscreen.getContext('2d').putImageData(cache.image, 0, 0);
        const scale = Math.min(W / nx, H / ny);
        const ox = (W - nx * scale) / 2;
        const oy = (H - ny * scale) / 2;
        ctx.fillStyle = '#05050a';
        ctx.fillRect(0, 0, W, H);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(cache.offscreen, ox, oy, nx * scale, ny * scale);

        // Overlays: sponge edge, detector line, source line.
        const X = (i) => ox + i * scale;
        const Y = (j) => oy + j * scale;
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        if (N > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.strokeRect(X(N), Y(N), (nx - 2 * N) * scale, (ny - 2 * N) * scale);
        }
        ctx.strokeStyle = 'rgba(72, 219, 251, 0.7)';
        const dcol = colOf(grid, DETECTOR_X);
        ctx.beginPath(); ctx.moveTo(X(dcol), Y(N)); ctx.lineTo(X(dcol), Y(ny - N)); ctx.stroke();
        if (state.openings) {
            ctx.strokeStyle = 'rgba(255, 159, 67, 0.6)';
            const scol = colOf(grid, SOURCE_X);
            ctx.beginPath(); ctx.moveTo(X(scol), Y(N)); ctx.lineTo(X(scol), Y(ny - N)); ctx.stroke();
        }
        ctx.setLineDash([]);

        ctx.font = '12px Inter, sans-serif';
        ctx.textBaseline = 'top';
        label(ctx, `FDTD solution u(x, y, t) · t = ${formatTime(grid.t)} (${grid.steps} steps)`, ox + 6, oy + 6, 'left', '#fff');
        label(ctx, 'detector', X(dcol) - 4, Y(N) + 4, 'right', 'rgb(72, 219, 251)');
        if (N > 0) label(ctx, 'absorbing layer', X(nx) - 6, Y(0) + 6, 'right', 'rgba(255,255,255,0.7)');

        if (state.unstable) {
            ctx.fillStyle = 'rgba(80, 0, 0, 0.82)';
            ctx.fillRect(0, H / 2 - 44, W, 88);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 15px Inter, sans-serif';
            ctx.fillText(`The solution blew up after ${grid.steps} steps.`, W / 2, H / 2 - 14);
            ctx.font = '13px Inter, sans-serif';
            ctx.fillText(`Courant number C = ${grid.courant.toFixed(3)} exceeds the CFL limit 1/√2 ≈ 0.707: the scheme amplifies the shortest waves every step.`, W / 2, H / 2 + 14, W - 24);
        }

        cache.frameMs = 0.9 * cache.frameMs + 0.1 * (performance.now() - t0);
        // Published (every 10th frame) for the end-to-end performance tests.
        if (++cache.frames % 10 === 0) {
            canvas.dataset.frameMs = cache.frameMs.toFixed(3);
            canvas.dataset.stepMs = state.stepMs.toFixed(3);
        }
        const mcells = state.stepMs > 0 ? (nx * ny) / state.stepMs / 1000 : 0;
        ctx.font = '11px monospace';
        ctx.textBaseline = 'bottom';
        label(ctx, `${nx}×${ny} cells · ${state.stepMs.toFixed(2)} ms/step (${mcells.toFixed(0)} M cell-updates/s) · draw ${cache.frameMs.toFixed(2)} ms`,
            W - 6, H - 4, 'right', 'rgba(255,255,255,0.75)');
    }

    /** Detector chart: time-averaged FDTD intensity vs the analytical phasor model, both normalised. */
    function renderDetector(canvas, state, params) {
        const ctx = canvas.getContext('2d');
        const { width: W, height: H } = beginFrame(ctx); // CSS pixels
        ctx.fillStyle = '#11111b';
        ctx.fillRect(0, 0, W, H);
        const { grid, detector } = state;
        const { ny, dx, spongeCells: N } = grid;
        const half = ((ny - 1) / 2) * dx;
        const inner = half - (N + 2) * dx;

        if (cache.analyticKey !== state.key) {
            const setup = analyticSetupFor(state, params);
            const { intensity } = screenPattern(setup, half, ny); // samples at exactly the detector rows
            cache.analytic = { setup, intensity };
            cache.analyticKey = state.key;
        }
        const { setup, intensity: analytic } = cache.analytic;

        // Row j (top = +y) ↔ analytic sample ny−1−j (ascending y).
        const ys = [];
        const fd = [];
        const an = [];
        for (let s = 0; s < ny; s++) {
            const y = -half + s * dx;
            if (Math.abs(y) > inner) continue;
            ys.push(y);
            fd.push(detector.intensity[ny - 1 - s]);
            an.push(analytic[s]);
        }
        const norm = (a) => { const m = Math.max(...a) || 1; return a.map((v) => v / m); };
        const fdN = norm(fd);
        const anN = norm(an);
        const unit = { name: 'cm', f: 100 };

        const { plot } = drawChart(ctx, { x: 0, y: 0, width: W, height: H }, {
            title: 'Detector line: time-averaged intensity, FDTD vs analytical model (each normalised to its peak)',
            xLabel: `position along the detector y (${unit.name})`,
            yLabel: 'I / I_max',
            xRange: [-inner * unit.f, inner * unit.f],
            yRange: [0, 1.35],
            series: [
                { label: 'FDTD (numerical)', color: FDTD_COLOR, lineWidth: 2.25, points: ys.map((y, i) => [y * unit.f, fdN[i]]) },
                { label: 'analytical phasor model', color: ANALYTIC_COLOR, dashed: true, lineWidth: 1.5, points: ys.map((y, i) => [y * unit.f, anN[i]]) },
            ],
        });

        // Agreement of the pattern scale, measured the same way on both curves.
        const yArr = Float64Array.from(ys);
        let rms = 0;
        for (let i = 0; i < ys.length; i++) rms += (fdN[i] - anN[i]) ** 2;
        rms = 100 * Math.sqrt(rms / Math.max(ys.length, 1));
        let text = `profile difference (RMS) ${rms.toFixed(1)}%`;
        let a = NaN;
        let f = NaN;
        let what = '';
        if (setup.mode === 'double') {
            const beta = fringeSpacing(setup);
            const window = Math.min(2.6 * beta, inner * 0.9);
            a = measureFringeSpacing(yArr, Float64Array.from(anN), 0, window).spacing;
            f = measureFringeSpacing(yArr, Float64Array.from(fdN), 0, window).spacing;
            what = 'fringe spacing (dark fringes)';
        } else if (setup.slitWidth > setup.wavelength) {
            a = measureCentralWidth(yArr, Float64Array.from(anN));
            f = measureCentralWidth(yArr, Float64Array.from(fdN));
            what = 'central maximum width';
        }
        if (Number.isFinite(a) && Number.isFinite(f)) {
            text += ` · ${what}: FDTD ${(f * 100).toFixed(2)} cm, analytical ${(a * 100).toFixed(2)} cm (${(100 * (f - a) / a).toFixed(2)}%)`;
        } else if (what) {
            text += ` · ${what}: the minima fall outside the unabsorbed part of the detector`;
        }
        const settle = settleTime(state, params);
        if (grid.t < settle) text = `averaging… the pattern settles after about ${formatTime(settle)} of simulated time`;
        ctx.font = '12px Inter, sans-serif';
        ctx.fillStyle = grid.t < settle ? '#feca57' : '#ddd';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(text, plot.x + 8, plot.y + 6, plot.w - 220);
    }

    return { renderField, renderDetector };
}

/** Seconds as s, ms or µs, whichever reads best. */
export function formatTime(t) {
    if (t >= 1) return `${t.toFixed(2)} s`;
    if (t >= 1e-3) return `${(t * 1e3).toFixed(1)} ms`;
    return `${(t * 1e6).toFixed(1)} µs`;
}
