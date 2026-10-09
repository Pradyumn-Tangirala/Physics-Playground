// Log–log plot of numerical error against timestep for the projectile
// convergence study. Pure drawing.

import { INTEGRATORS } from '../physics/integrators.js';
import { ERROR_METRICS, REFERENCE_DT } from '../physics/projectile/experiments.js';
import { drawChart, LOG_FLOOR } from './charts.js';
import { METHOD_COLORS } from './comparisonRenderer.js';
import { beginFrame } from './canvasSize.js';

const GUIDE_COLOR = 'rgba(255,255,255,0.35)';

/** study: result of convergenceStudy(), or null before the first run. */
export function renderConvergence(ctx, study, metricKey) {
    const { width, height } = beginFrame(ctx);
    ctx.fillStyle = '#11111b';
    ctx.fillRect(0, 0, width, height);

    if (!study) {
        ctx.fillStyle = '#888';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Press “Run convergence study” to measure error against Δt.', width / 2, height / 2);
        return;
    }

    const metric = ERROR_METRICS[metricKey];
    const byMethod = new Map();
    for (const row of study.rows) {
        if (!byMethod.has(row.method)) byMethod.set(row.method, []);
        if (!row.diverged && Number.isFinite(row[metricKey])) {
            byMethod.get(row.method).push([row.dt, Math.max(Math.abs(row[metricKey]), LOG_FLOOR)]);
        }
    }

    const all = [...byMethod.values()].flat();
    const dts = [...new Set(all.map(([dt]) => dt))].sort((a, b) => a - b);
    const errs = all.map(([, e]) => Math.log10(e));
    const xRange = [Math.log10(Math.min(...dts)) - 0.15, Math.log10(Math.max(...dts)) + 0.15];
    // Three spare decades on top keep the legend (top-left) clear of the data.
    const yRange = [Math.max(-16, Math.floor(Math.min(...errs))), Math.ceil(Math.max(...errs)) + 3];

    const series = [];
    for (const [id, points] of byMethod) {
        const color = METHOD_COLORS[id];
        // Without drag both Euler methods have the same |error| (opposite signs); the wider
        // explicit-Euler line stays visible as a halo around the symplectic one.
        series.push({ color, points, lineWidth: id === 'euler' ? 5 : 1.75 });
        series.push({ label: INTEGRATORS[id].name, color, points, mode: 'points' });
    }
    // Slope guides through the largest-Δt point of the first- and fourth-order
    // methods — only where that method shows truncation error at all.
    const guide = (id, order, label) => {
        const points = byMethod.get(id);
        if (!points?.length || study.orders[id]?.[metricKey] == null) return;
        const [dtMax, eMax] = points[points.length - 1];
        const anchor = eMax * 4;
        series.push({
            label,
            color: GUIDE_COLOR,
            dashed: true,
            lineWidth: 1,
            points: dts.map((dt) => [dt, anchor * (dt / dtMax) ** order]),
        });
    };
    guide('euler', 1, 'slope 1 (∝ Δt)');
    guide('rk4', 4, 'slope 4 (∝ Δt⁴)');

    const reference = study.referenceKind === 'analytical'
        ? 'reference: analytical solution'
        : `reference: RK4 at Δt = ${REFERENCE_DT * 1000} ms`;

    drawChart(ctx, { x: 0, y: 0, width, height }, {
        title: `${metric.label} vs timestep — ${reference}`,
        xLabel: 'timestep Δt (s, log scale)',
        yLabel: `error (${metric.unit}, log scale)`,
        xRange,
        yRange,
        xScale: 'log',
        yScale: 'log',
        series,
        legend: 'top-left', // errors grow with Δt, so the top-left corner is empty
    });
}
