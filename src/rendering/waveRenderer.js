// Draws the analytical wave lab: the 2-D field view and the screen-intensity
// chart. Reads simulation state; the caches below are render-side memoisation
// only and never feed back into the model.
//
// Performance: the complex field is computed once per parameter change
// (buildField). Each frame then costs two multiplications and one table
// lookup per cell, written into an ImageData that is allocated once and
// reused, and scaled onto the visible canvas with drawImage.

import { buildField, referenceAmplitude } from '../physics/waves/field.js';
import { envelopeIntensity } from '../physics/waves/interference.js';
import { FIELD_GAIN, LUT_HALF, buildFieldLut, buildIntensityLut } from './colorThemes.js';
import { drawChart } from './charts.js';
import { beginFrame } from './canvasSize.js';
import { niceStep } from '../utils/format.js';

const GRID_SCALE = 0.5; // field cells per canvas pixel in each direction
const WALL_RGB = [70, 70, 85];
const FIELD_DISPLAY = 1.5; // the on-axis screen amplitude maps to brightness 1.5·FIELD_GAIN
const INTENSITY_DISPLAY = 200; // the on-axis screen intensity maps to brightness 200/255
const STRIP_HEIGHT = 26;
export const SIMULATED_COLOR = '#48dbfb';
export const THEORY_COLOR = '#ffffff';
const ENVELOPE_COLOR = '#ff9f43';

/** Display unit for screen positions given the half-width shown (m). */
export function lengthUnit(halfWidth) {
    if (halfWidth < 0.2) return { name: 'mm', factor: 1e3 };
    if (halfWidth < 2) return { name: 'cm', factor: 1e2 };
    return { name: 'm', factor: 1 };
}

const makeCanvas = (w, h) => {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
};

export function createWaveRenderer() {
    const cache = {
        fieldKey: '', field: null, buildMs: 0,
        theme: '', fieldLut: null, intensityLut: null,
        image: null, offscreen: null,
        frameMs: 0,
        frames: 0,
        chartKey: '', chart: null,
    };

    /** Field view. view = { mode: 'field' | 'intensity', theme, setupKey }. */
    function renderField(canvas, state, setup, view) {
        const t0 = performance.now();
        const ctx = canvas.getContext('2d', { alpha: false });
        const { width: W, height: H } = beginFrame(ctx); // CSS pixels
        const gw = Math.max(1, Math.floor(W * GRID_SCALE));
        const gh = Math.max(1, Math.floor(H * GRID_SCALE)) | 1; // odd, so the axis y = 0 is a row centre
        const drawW = gw / GRID_SCALE; // drawn size: exactly the grid's, so the view stays to scale
        const drawH = gh / GRID_SCALE;

        const fieldKey = `${gw}x${gh}|${view.setupKey}`;
        if (cache.fieldKey !== fieldKey) {
            const b0 = performance.now();
            cache.field = buildField(setup, gw, gh);
            cache.buildMs = performance.now() - b0;
            cache.fieldKey = fieldKey;
        }
        if (cache.theme !== view.theme) {
            cache.fieldLut = buildFieldLut(view.theme);
            cache.intensityLut = buildIntensityLut(view.theme);
            cache.theme = view.theme;
        }
        if (!cache.image || cache.image.width !== gw || cache.image.height !== gh) {
            cache.image = new ImageData(gw, gh);
            cache.image.data.fill(255); // opaque alpha; RGB is overwritten every frame
            cache.offscreen = makeCanvas(gw, gh);
        }

        const field = cache.field;
        const mode = view.mode === 'field' && field.drawable.field ? 'field'
            : field.drawable.intensity ? 'intensity' : null;

        ctx.fillStyle = '#05050a';
        ctx.fillRect(0, 0, W, H);
        if (!mode) {
            drawNotDrawable(ctx, W, H, field.view, setup);
        } else {
            fillImage(cache, field, mode, state.wavePhase, referenceAmplitude(setup));
            cache.offscreen.getContext('2d').putImageData(cache.image, 0, 0);
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(cache.offscreen, 0, 0, drawW, drawH);
            drawAnnotations(ctx, drawW, Math.min(H, drawH), field.view, setup, mode);
            if (view.mode === 'field' && mode !== 'field') {
                drawBanner(ctx, W, `λ is only ${field.view.cellsPerWavelength.toFixed(2)} cells here, too small to draw the instantaneous wave: showing the time-averaged intensity instead.`);
            }
        }

        cache.frameMs = 0.9 * cache.frameMs + 0.1 * (performance.now() - t0);
        // Published (every 10th frame) for the end-to-end performance tests.
        if (++cache.frames % 10 === 0) {
            canvas.dataset.frameMs = cache.frameMs.toFixed(3);
            canvas.dataset.precomputeMs = cache.buildMs.toFixed(2);
        }
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText(`${gw}×${gh} cells · frame ${cache.frameMs.toFixed(2)} ms · field precompute ${cache.buildMs.toFixed(1)} ms`, W - 8, H - 6);
    }

    /**
     * Screen chart. chartView = { analysis, setup, theme, cursor, markers } —
     * redrawn only when one of those changes.
     */
    function renderChart(canvas, chartView) {
        const key = `${canvas.width}x${canvas.height}|${chartView.setupKey}|${chartView.theme}|${chartView.cursor}|${chartView.markers.join(',')}`;
        if (key === cache.chartKey) return;
        cache.chartKey = key;
        cache.chart = drawScreenChart(canvas, chartView);
    }

    /** Screen position (m) under canvas x, or null outside the plot. */
    function screenYAt(canvasX) {
        const c = cache.chart;
        if (!c || canvasX < c.plot.x || canvasX > c.plot.x + c.plot.w) return null;
        return (c.xMin + ((canvasX - c.plot.x) / c.plot.w) * (c.xMax - c.xMin)) / c.unit.factor;
    }

    return { renderField, renderChart, screenYAt };
}

function fillImage(cache, field, mode, wavePhase, refAmp) {
    const data = cache.image.data;
    const { re, im, wall } = field;
    if (mode === 'field') {
        const lut = cache.fieldLut;
        const gain = (FIELD_DISPLAY * FIELD_GAIN) / refAmp;
        const c = Math.cos(wavePhase) * gain;
        const s = Math.sin(wavePhase) * gain;
        for (let i = 0, o = 0; i < re.length; i++, o += 4) {
            if (wall[i]) {
                data[o] = WALL_RGB[0]; data[o + 1] = WALL_RGB[1]; data[o + 2] = WALL_RGB[2];
                continue;
            }
            let q = Math.round(re[i] * c + im[i] * s); // u = re·cos ωt + im·sin ωt, pre-scaled
            if (q > LUT_HALF) q = LUT_HALF; else if (q < -LUT_HALF) q = -LUT_HALF;
            const l = (q + LUT_HALF) * 3;
            data[o] = lut[l]; data[o + 1] = lut[l + 1]; data[o + 2] = lut[l + 2];
        }
        return;
    }
    const lut = cache.intensityLut;
    const gain = INTENSITY_DISPLAY / (refAmp * refAmp);
    for (let i = 0, o = 0; i < re.length; i++, o += 4) {
        if (wall[i]) {
            data[o] = WALL_RGB[0]; data[o + 1] = WALL_RGB[1]; data[o + 2] = WALL_RGB[2];
            continue;
        }
        let b = Math.round((re[i] * re[i] + im[i] * im[i]) * gain); // |U|², time-averaged
        if (b > 255) b = 255;
        const l = b * 3;
        data[o] = lut[l]; data[o + 1] = lut[l + 1]; data[o + 2] = lut[l + 2];
    }
}

function drawAnnotations(ctx, W, H, view, setup, mode) {
    const pxPerM = W / (view.x1 - view.x0);
    const xBarrier = -view.x0 * pxPerM;
    ctx.font = '12px Inter, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.textAlign = 'center';
    ctx.fillText('barrier', xBarrier, 28);
    ctx.textAlign = 'right';
    ctx.fillText('screen →', W - 8, 8);
    ctx.textAlign = 'left';
    ctx.fillText(mode === 'field' ? 'instantaneous field u(x, y, t)' : 'time-averaged intensity |U|²', 8, 8);

    // Scale bar
    const lengthM = niceStep((W * 0.18) / pxPerM);
    const barPx = lengthM * pxPerM;
    const unit = lengthM < 0.01 ? ['mm', 1e3] : lengthM < 1 ? ['cm', 1e2] : ['m', 1];
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, H - 30); ctx.lineTo(12 + barPx, H - 30);
    ctx.moveTo(12, H - 35); ctx.lineTo(12, H - 25);
    ctx.moveTo(12 + barPx, H - 35); ctx.lineTo(12 + barPx, H - 25);
    ctx.stroke();
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${Number((lengthM * unit[1]).toPrecision(3))} ${unit[0]}  (λ = ${(setup.wavelength * unit[1]).toPrecision(3)} ${unit[0]})`, 12, H - 36);
}

function drawBanner(ctx, W, text) {
    ctx.font = '12px Inter, sans-serif';
    const w = Math.min(W - 24, ctx.measureText(text).width + 24);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect((W - w) / 2, 30, w, 24);
    ctx.fillStyle = '#feca57';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, 42, W - 36);
}

function drawNotDrawable(ctx, W, H, view, setup) {
    const lines = [
        'The 2-D field cannot be drawn to scale at these dimensions.',
        `One wavelength (${(setup.wavelength * 1e9).toPrecision(4)} nm) is ${view.cellsPerWavelength.toExponential(1)} of a cell, so neither the waves nor the slits can be resolved.`,
        'The screen pattern below is computed exactly; the field view needs a macroscopic preset',
        '(ripple tank, microwaves or sound), where a wavelength spans many cells.',
    ];
    ctx.fillStyle = '#ccc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => {
        ctx.font = i === 0 ? 'bold 15px Inter, sans-serif' : '13px Inter, sans-serif';
        ctx.fillText(line, W / 2, H / 2 - 36 + i * 24, W - 24);
    });
}

function drawScreenChart(canvas, { analysis, setup, theme, cursor, markers }) {
    const ctx = canvas.getContext('2d');
    const { width: W, height: H } = beginFrame(ctx); // CSS pixels
    ctx.fillStyle = '#11111b';
    ctx.fillRect(0, 0, W, H);

    const unit = lengthUnit(analysis.halfWidth);
    const { y, intensity, theory } = analysis;
    let peak = 0;
    for (let i = 0; i < y.length; i++) peak = Math.max(peak, intensity[i], theory[i]);
    const xMin = -analysis.halfWidth * unit.factor;
    const xMax = analysis.halfWidth * unit.factor;

    const series = [
        { label: 'simulated (phasor sum)', color: SIMULATED_COLOR, lineWidth: 2.25, points: Array.from(y, (v, i) => [v * unit.factor, intensity[i]]) },
        { label: 'Fraunhofer theory', color: THEORY_COLOR, dashed: true, lineWidth: 1.25, points: Array.from(y, (v, i) => [v * unit.factor, theory[i]]) },
    ];
    if (setup.mode === 'double' && setup.slitWidth > 0) {
        series.push({
            label: 'single-slit envelope (sinc²)', color: ENVELOPE_COLOR, dashed: true, lineWidth: 1.25,
            points: Array.from(y, (v) => [v * unit.factor, envelopeIntensity(setup, v)]),
        });
    }

    const rect = { x: 0, y: STRIP_HEIGHT + 6, width: W, height: H - STRIP_HEIGHT - 6 };
    const { plot, toX } = drawChart(ctx, rect, {
        title: 'Intensity on the screen, I = |U|²',
        xLabel: `position on screen y (${unit.name})`,
        yLabel: 'I (arb. units)',
        xRange: [xMin, xMax],
        yRange: [0, peak * 1.35 || 1], // headroom keeps the legend clear of equal-height fringes
        series,
    });

    // Screen strip: what the screen looks like, aligned with the plot's x axis.
    const lut = buildIntensityLut(theme);
    for (let px = Math.floor(plot.x); px < plot.x + plot.w; px++) {
        const v = ((px - plot.x) / plot.w) * (y.length - 1);
        const b = Math.min(255, Math.round((intensity[Math.round(v)] / (peak || 1)) * 255));
        ctx.fillStyle = `rgb(${lut[b * 3]}, ${lut[b * 3 + 1]}, ${lut[b * 3 + 2]})`;
        ctx.fillRect(px, 4, 1, STRIP_HEIGHT - 4);
    }
    ctx.fillStyle = '#888';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('screen', 4, STRIP_HEIGHT / 2 + 2);

    // Measurement: markers and cursor.
    const vline = (ym, color, label) => {
        const px = toX(ym * unit.factor);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(px, 4); ctx.lineTo(px, plot.y + plot.h); ctx.stroke();
        ctx.setLineDash([]);
        if (label) {
            ctx.fillStyle = color;
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(label, px, plot.y - 2);
        }
    };
    markers.forEach((m, i) => vline(m, '#feca57', i === 0 ? 'A' : 'B'));
    if (cursor !== null) vline(cursor, 'rgba(255,255,255,0.7)', null);

    return { plot, xMin, xMax, unit };
}
