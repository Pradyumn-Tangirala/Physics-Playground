// Work–precision diagram: largest angle error against derivative evaluations,
// log–log, one line per method (each point is one timestep). Lower-left is
// better: less error for less work. Pure drawing.

import { INTEGRATORS } from '../physics/integrators.js';
import { drawChart, LOG_FLOOR } from './charts.js';
import { METHOD_COLORS } from './comparisonRenderer.js';
import { beginFrame } from './canvasSize.js';

/** Errors above this mean the run went over the top or blew up; they are left off the chart. */
const MAX_PLOTTED_ERROR = Math.PI;

/** rows: result of accuracyVsCost(), or null before the first run. */
export function renderAccuracyVsCost(ctx, rows) {
    const { width, height } = beginFrame(ctx);
    ctx.fillStyle = '#11111b';
    ctx.fillRect(0, 0, width, height);

    if (!rows) {
        ctx.fillStyle = '#888';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Press “Run accuracy vs cost” to measure every method at every Δt.', width / 2, height / 2);
        return;
    }

    const byMethod = new Map();
    for (const r of rows) {
        if (!byMethod.has(r.method)) byMethod.set(r.method, []);
        if (r.maxError <= MAX_PLOTTED_ERROR) byMethod.get(r.method).push([r.evaluations, Math.max(r.maxError, LOG_FLOOR)]);
    }
    const all = [...byMethod.values()].flat();
    const logs = (i) => all.map((p) => Math.log10(p[i]));
    const xRange = [Math.floor(Math.min(...logs(0))), Math.ceil(Math.max(...logs(0)))];
    const yRange = [Math.max(-16, Math.floor(Math.min(...logs(1)))), Math.ceil(Math.max(...logs(1))) + 1];

    const series = [];
    for (const [id, points] of byMethod) {
        points.sort((a, b) => a[0] - b[0]);
        series.push({ color: METHOD_COLORS[id], points, lineWidth: 1.75 });
        series.push({ label: INTEGRATORS[id].name, color: METHOD_COLORS[id], points, mode: 'points' });
    }

    drawChart(ctx, { x: 0, y: 0, width, height }, {
        title: 'Accuracy vs cost: max |θ − θ_exact| against derivative evaluations',
        xLabel: 'derivative evaluations f(y) (log scale)',
        yLabel: 'max |Δθ| (rad, log scale)',
        xRange,
        yRange,
        xScale: 'log',
        yScale: 'log',
        series,
        legend: 'top-right',
    });
}
