// Draws the oscillator lab: body (pendulum or spring), live graph, phase plot
// and energy bars, arranged by oscillatorLayout (wide or compact). Reads
// state; never mutates it. Positions are metres (spring) or degrees
// (pendulum) in the graphs — SI, independent of the drawing scale.

import { radToDeg } from '../utils/units.js';
import { GRAPH_SAMPLES, GRAPH_SAMPLE_DT } from '../simulation/oscillatorSimulation.js';
import { oscillatorLayout } from './oscillatorLayout.js';
import { drawPendulum } from './pendulumRenderer.js';
import { drawSpring } from './springRenderer.js';
import { drawChart } from './charts.js';
import { beginFrame } from './canvasSize.js';

export function renderOscillator(ctx, state, params, { isDragging = false } = {}) {
    const { width, height } = beginFrame(ctx);
    const layout = oscillatorLayout(width, height);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    if (params.mode === 'pendulum') drawPendulum(ctx, layout, state, params, isDragging);
    else drawSpring(ctx, layout, state, isDragging);

    let timeRect = layout.timeGraph;
    let phaseRect = layout.phasePlot;
    if (!layout.compact) {
        // Wide: time graph (left) and phase-space plot (right) along the bottom.
        const stripWidth = width - 2 * layout.margin;
        const phaseWidth = Math.min(260, Math.max(170, stripWidth * 0.32));
        timeRect = { x: layout.margin, y: layout.stripTop, width: stripWidth - phaseWidth - 10, height: 150 };
        phaseRect = { x: layout.margin + stripWidth - phaseWidth, y: layout.stripTop, width: phaseWidth, height: 150 };
    }
    drawGraph(ctx, timeRect, params.mode, state.history, layout.compact);
    drawPhase(ctx, phaseRect, params.mode, state.phase);
    drawEnergyBars(ctx, state.energy, state.energyRef, layout.energyBars);
}

function drawPhase(ctx, rect, mode, phase) {
    const pendulum = mode === 'pendulum';
    const pts = phase.map(([x, v]) => (pendulum ? [radToDeg(x), v] : [x, v]));
    let xMax = pendulum ? 1 : 0.05;
    let vMax = 0.1;
    for (const [x, v] of pts) {
        xMax = Math.max(xMax, Math.abs(x));
        vMax = Math.max(vMax, Math.abs(v));
    }
    drawChart(ctx, rect, {
        title: 'Phase space',
        xLabel: pendulum ? 'θ (°)' : 'x (m)',
        yLabel: pendulum ? 'ω (rad/s)' : 'v (m/s)',
        xRange: [-xMax * 1.1, xMax * 1.1],
        yRange: [-vMax * 1.1, vMax * 1.1],
        series: [{ color: pendulum ? '#f1c40f' : '#e74c3c', points: pts }],
        compact: true,
    });
}

function drawGraph(ctx, { x: graphX, y: graphY, width: graphWidth, height: graphHeight }, mode, history, compact) {
    const midY = graphY + graphHeight / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(graphX, graphY, graphWidth, graphHeight);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX, graphY, graphWidth, graphHeight);

    ctx.beginPath();
    ctx.moveTo(graphX, midY);
    ctx.lineTo(graphX + graphWidth, midY);
    ctx.stroke();

    // Auto-scale to the largest value in the visible window (with a floor) so
    // small and large motions are both readable.
    const pendulum = mode === 'pendulum';
    const toUnits = pendulum ? radToDeg : (v) => v;
    const unit = pendulum ? '°' : ' m';
    const digits = pendulum ? 1 : 2;
    let peak = pendulum ? 1 : 0.05;
    for (const v of history) peak = Math.max(peak, Math.abs(toUnits(v)));
    const scaleY = (graphHeight / 2 - 12) / peak;

    ctx.fillStyle = '#aaa';
    ctx.font = `${compact ? 11 : 12}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const window = (GRAPH_SAMPLES * GRAPH_SAMPLE_DT).toFixed(0);
    ctx.fillText(
        compact ? `${pendulum ? 'θ' : 'x'} vs time (${window} s)` : `${pendulum ? 'Angle θ' : 'Displacement x'} vs time (last ${window} s)`,
        graphX + 10, graphY + 18,
    );
    ctx.textAlign = 'right';
    ctx.fillText(`+${peak.toFixed(digits)}${unit}`, graphX + graphWidth - 8, graphY + 18);
    ctx.fillText(`−${peak.toFixed(digits)}${unit}`, graphX + graphWidth - 8, graphY + graphHeight - 8);

    ctx.beginPath();
    ctx.strokeStyle = pendulum ? '#f1c40f' : '#e74c3c';
    ctx.lineWidth = 2;
    const xStep = graphWidth / GRAPH_SAMPLES;
    history.forEach((v, i) => {
        // Spring x grows downward on screen; plot positive displacement upward.
        const value = pendulum ? toUnits(v) : -toUnits(v);
        const px = graphX + i * xStep;
        const py = midY - value * scaleY;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();
}

function drawEnergyBars(ctx, { ke, pe }, energyRef, { x: barX, y: barY, barW, gap, barH, small }) {
    const total = ke + pe;
    const bars = [['KE', ke, '#2ecc71'], ['PE', pe, '#e67e22'], ['E', total, '#9b59b6']];
    const hasRef = energyRef > 1e-12;

    ctx.font = `${small ? 10 : 12}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    bars.forEach(([label, value, color], i) => {
        const x = barX + i * gap;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(x, barY, barW, barH);

        // Scaled to E_ref (energy at release / last parameter change). Nothing
        // is rescaled to hide errors: a value above E_ref overshoots its track.
        const h = hasRef ? (value / energyRef) * barH : 0;
        ctx.fillStyle = color;
        ctx.fillRect(x, barY + barH - h, barW, h);

        ctx.fillStyle = '#fff';
        ctx.fillText(label, x + barW / 2, barY + barH + (small ? 12 : 15));
    });

    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(barX - 4, barY);
    ctx.lineTo(barX + 2 * gap + barW + 4, barY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#aaa';
    ctx.font = `${small ? 10 : 11}px monospace`;
    const pct = hasRef ? ((total / energyRef) * 100).toFixed(2) : '—';
    if (small) {
        ctx.fillText(`${pct}%`, barX + gap + barW / 2, barY + barH + 26);
    } else {
        ctx.fillText(`E = ${total.toFixed(3)} J`, barX + gap + barW / 2, barY + barH + 34);
        ctx.fillText(`${pct}% of E_ref`, barX + gap + barW / 2, barY + barH + 50);
    }
}
