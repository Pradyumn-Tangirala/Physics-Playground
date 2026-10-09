// Minimal canvas line/scatter chart used by the numerical-methods views.
// Pure drawing: takes data, draws axes + series, mutates nothing but the canvas.

import { niceStep } from '../utils/format.js';

const PAD = { left: 62, right: 14, top: 28, bottom: 40 };
const PAD_COMPACT = { left: 40, right: 8, top: 22, bottom: 32 }; // small inset charts
const AXIS_COLOR = 'rgba(255,255,255,0.35)';
const GRID_COLOR = 'rgba(255,255,255,0.07)';
const TEXT_COLOR = '#aaa';
const MIN_PLOT_SIZE = 10; // px; keeps the transforms finite on a collapsed canvas
// Target spacing between tick labels (px); the step is then rounded to 1/2/5 × 10ⁿ.
const X_TICK_SPACING = 90;
const Y_TICK_SPACING = 40;
const LOG_Y_TICK_SPACING = 28;
const TICK_EPSILON = 1e-9; // keeps the last tick despite float accumulation in v += step
const POINT_RADIUS = 3.5;
const LEGEND_ROW = 16; // px per legend entry
const LINE_DASH = [6, 5];
const LEGEND_DASH = [4, 3];

/** Smallest |y| shown on a log axis: below double-precision round-off for ΔE/E₀. */
export const LOG_FLOOR = 1e-16;

const fmt = (v, step) => {
    if (v === 0) return '0';
    const decimals = Math.max(0, -Math.floor(Math.log10(step)));
    return Math.abs(v) >= 1e4 ? v.toExponential(1) : v.toFixed(Math.min(decimals, 6));
};

/**
 * Draws a chart inside `rect` = { x, y, width, height } of the canvas.
 *
 * options:
 *   title, xLabel, yLabel
 *   xRange: [min, max]; yRange: [min, max] (on a log axis: decades, e.g. [-16, 1])
 *   xScale, yScale: 'linear' | 'log'   (log plots log10(|v|), floored at LOG_FLOOR)
 *   series: [{ label, color, points: [[x, y], …], dashed?, mode?: 'line'|'points',
 *              breakIfJumpX?: number   // start a new segment when |Δx| exceeds this }]
 *   note: optional text drawn bottom-right inside the plot
 *   legend: 'top-right' (default) | 'top-left'
 *   compact: smaller margins for small inset charts
 */
export function drawChart(ctx, rect, options) {
    const { title, xLabel, yLabel, series = [], note, legend = 'top-right', compact = false } = options;
    const frame = chartFrame(rect, options);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(frame.plot.x, frame.plot.y, frame.plot.w, frame.plot.h);

    drawXTicks(ctx, frame, options);
    drawYTicks(ctx, frame, options);
    drawLabels(ctx, rect, frame.plot, { title, xLabel, yLabel, compact });
    drawSeries(ctx, frame, series);
    drawLegend(ctx, frame.plot, series, legend);
    if (note) {
        ctx.fillStyle = '#888';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(note, frame.plot.x + frame.plot.w - 8, frame.plot.y + frame.plot.h - 8);
    }
    return frame;
}

/** The plot rectangle inside `rect` and the data → pixel transforms for both axes. */
function chartFrame(rect, { xRange, yRange, xScale = 'linear', yScale = 'linear', compact = false }) {
    const pad = compact ? PAD_COMPACT : PAD;
    const plot = {
        x: rect.x + pad.left,
        y: rect.y + pad.top,
        w: Math.max(MIN_PLOT_SIZE, rect.width - pad.left - pad.right),
        h: Math.max(MIN_PLOT_SIZE, rect.height - pad.top - pad.bottom),
    };
    const [x0, x1] = xRange;
    const [y0, y1] = yRange;
    const toLog = (v) => Math.log10(Math.max(Math.abs(v), LOG_FLOOR));
    const tx = xScale === 'log' ? toLog : (v) => v;
    const ty = yScale === 'log' ? toLog : (v) => v;
    const toX = (v) => plot.x + ((tx(v) - x0) / (x1 - x0 || 1)) * plot.w;
    const toY = (v) => plot.y + plot.h - ((ty(v) - y0) / (y1 - y0 || 1)) * plot.h;
    return { plot, toX, toY };
}

function gridLine(ctx, color, x0, y0, x1, y1) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
}

/** Vertical grid lines and labels: every decade on a log axis, a 1/2/5 step otherwise. */
function drawXTicks(ctx, { plot, toX }, { xRange: [x0, x1], xScale = 'linear' }) {
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tick = (px, text) => {
        gridLine(ctx, GRID_COLOR, px, plot.y, px, plot.y + plot.h);
        ctx.fillText(text, px, plot.y + plot.h + 4);
    };
    if (xScale === 'log') {
        for (let d = Math.ceil(x0); d <= x1; d++) tick(plot.x + ((d - x0) / (x1 - x0)) * plot.w, `1e${d}`);
        return;
    }
    const step = niceStep((x1 - x0) / Math.max(2, Math.floor(plot.w / X_TICK_SPACING)));
    for (let v = Math.ceil(x0 / step) * step; v <= x1 + TICK_EPSILON; v += step) tick(toX(v), fmt(v, step));
}

/** Horizontal grid lines and labels; on a linear axis the zero line is drawn brighter. */
function drawYTicks(ctx, { plot, toY }, { yRange: [y0, y1], yScale = 'linear' }) {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const tick = (py, text, color = GRID_COLOR) => {
        gridLine(ctx, color, plot.x, py, plot.x + plot.w, py);
        ctx.fillText(text, plot.x - 6, py);
    };
    if (yScale === 'log') {
        const decades = Math.max(1, Math.ceil((y1 - y0) / Math.max(2, Math.floor(plot.h / LOG_Y_TICK_SPACING))));
        for (let d = Math.ceil(y0); d <= y1; d += decades) tick(plot.y + plot.h - ((d - y0) / (y1 - y0)) * plot.h, `1e${d}`);
        return;
    }
    const step = niceStep((y1 - y0) / Math.max(2, Math.floor(plot.h / Y_TICK_SPACING)));
    for (let v = Math.ceil(y0 / step) * step; v <= y1 + TICK_EPSILON; v += step) {
        tick(toY(v), fmt(v, step), Math.abs(v) < step * 1e-6 ? AXIS_COLOR : GRID_COLOR);
    }
}

function drawLabels(ctx, rect, plot, { title, xLabel, yLabel, compact }) {
    ctx.fillStyle = '#ddd';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (title) ctx.fillText(title, rect.x + 10, rect.y + 18);
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = 'center';
    if (xLabel) ctx.fillText(xLabel, plot.x + plot.w / 2, rect.y + rect.height - 6);
    if (yLabel) {
        ctx.save();
        ctx.translate(rect.x + (compact ? 9 : 12), plot.y + plot.h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();
    }
}

/** Lines and point sets, clipped to the plot so off-scale data visibly leaves the frame. */
function drawSeries(ctx, { plot, toX, toY }, series) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(plot.x, plot.y, plot.w, plot.h);
    ctx.clip();
    for (const s of series) {
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.color;
        ctx.lineWidth = s.lineWidth ?? 1.75;
        ctx.setLineDash(s.dashed ? LINE_DASH : []);
        if (s.mode === 'points') {
            for (const [x, y] of s.points) {
                if (!Number.isFinite(y)) continue;
                ctx.beginPath();
                ctx.arc(toX(x), toY(y), POINT_RADIUS, 0, Math.PI * 2);
                ctx.fill();
            }
            continue;
        }
        // Non-finite samples (a blown-up run) and large x jumps (a wrapped angle) lift the pen.
        ctx.beginPath();
        let penDown = false;
        let prevX = null;
        for (const [x, y] of s.points) {
            if (!Number.isFinite(x) || !Number.isFinite(y)) { penDown = false; continue; }
            const jump = s.breakIfJumpX && prevX !== null && Math.abs(x - prevX) > s.breakIfJumpX;
            if (!penDown || jump) ctx.moveTo(toX(x), toY(y)); else ctx.lineTo(toX(x), toY(y));
            penDown = true;
            prevX = x;
        }
        ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
}

/** Legend box inside the plot (top-right or top-left) for every series with a label. */
function drawLegend(ctx, plot, series, corner) {
    const labelled = series.filter((s) => s.label);
    if (!labelled.length) return;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const boxW = Math.max(...labelled.map((s) => ctx.measureText(s.label).width)) + 38;
    const boxX = corner === 'top-left' ? plot.x + 4 : plot.x + plot.w - boxW - 4;
    ctx.fillStyle = 'rgba(10,10,18,0.82)';
    ctx.fillRect(boxX, plot.y + 3, boxW, labelled.length * LEGEND_ROW + 6);
    labelled.forEach((s, i) => {
        const ly = plot.y + 12 + i * LEGEND_ROW;
        const lx = boxX + boxW - 4;
        ctx.fillStyle = '#ddd';
        ctx.fillText(s.label, lx - 22, ly);
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.color;
        ctx.lineWidth = 2;
        ctx.setLineDash(s.dashed ? LEGEND_DASH : []);
        ctx.beginPath();
        if (s.mode === 'points') {
            ctx.arc(lx - 9, ly, POINT_RADIUS, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.moveTo(lx - 18, ly);
            ctx.lineTo(lx, ly);
            ctx.stroke();
        }
        ctx.setLineDash([]);
    });
}

/** Wraps an angle in radians into (−π, π]. */
export const wrapAngle = (a) => {
    const w = ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    return w === -Math.PI ? Math.PI : w;
};
