// Period-vs-amplitude chart: exact nonlinear curve, small-angle line, and
// simulated points from the chosen integrator. Reads data only.

import { exactPeriodRatio } from '../physics/pendulum/experiments.js';
import { degToRad } from '../utils/units.js';
import { drawChart } from './charts.js';
import { METHOD_COLORS } from './comparisonRenderer.js';
import { beginFrame } from './canvasSize.js';

// The exact curve depends only on θ₀, so it is computed once.
const EXACT_CURVE = Array.from({ length: 175 }, (_, i) => {
    const deg = 1 + i;
    return [deg, exactPeriodRatio(degToRad(deg))];
});

export function renderPeriodExperiment(ctx, experiment) {
    ctx.fillStyle = '#11111b';
    const { width, height } = beginFrame(ctx);
    ctx.fillRect(0, 0, width, height);

    const simulated = experiment
        ? experiment.rows.filter((r) => Number.isFinite(r.simulatedRatio)).map((r) => [r.amplitudeDeg, r.simulatedRatio])
        : [];
    const maxRatio = Math.max(2.6, ...simulated.map(([, y]) => y));

    drawChart(ctx, { x: 0, y: 0, width, height }, {
        title: 'Period vs amplitude: T(θ₀) / T₀',
        xLabel: 'release amplitude θ₀ (°)',
        yLabel: 'T / T₀',
        xRange: [0, 180],
        yRange: [0.9, Math.min(4, maxRatio * 1.05)],
        series: [
            { label: 'small-angle T₀', color: 'rgba(255,255,255,0.35)', points: [[0, 1], [180, 1]], dashed: true, lineWidth: 1 },
            { label: 'exact (elliptic integral)', color: 'rgba(255,255,255,0.8)', points: EXACT_CURVE, lineWidth: 1.5 },
            ...(experiment
                ? [{ label: `simulated (${experiment.integratorName}, Δt = ${experiment.dt} s)`, color: METHOD_COLORS[experiment.integratorId], points: simulated, mode: 'points' }]
                : []),
        ],
        note: experiment ? undefined : 'press "Run experiment" to add simulated points',
    });
}
