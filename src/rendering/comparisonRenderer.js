// Visuals for the integrator comparison lab. Reads state; never mutates it.

import { peakAngularVelocity } from '../physics/pendulum/pendulum.js';
import { degToRad, radToDeg } from '../utils/units.js';
import { ENERGY_WINDOW } from '../simulation/integratorComparison.js';
import { drawChart, wrapAngle, LOG_FLOOR } from './charts.js';
import { beginFrame, cssSize } from './canvasSize.js';

export const METHOD_COLORS = { euler: '#ff6b6b', symplectic: '#feca57', rk4: '#48dbfb' };
const REFERENCE_COLOR = 'rgba(255,255,255,0.55)';

const fullRect = (ctx) => ({ x: 0, y: 0, ...cssSize(ctx.canvas) });
/** Begins the frame and fills the background; returns the size in CSS pixels. */
const clear = (ctx, color = '#11111b') => {
    const size = beginFrame(ctx);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size.width, size.height);
    return size;
};

/** Three pendulums side by side, one per integrator, all at the same simulated time. */
export function renderComparisonPendulums(ctx, state, params, visible) {
    const { width, height } = clear(ctx);
    const columns = state.runs.length;
    const colW = width / columns;
    const pivotY = 52;
    const lengthPx = Math.max(20, Math.min(colW * 0.42, (height - pivotY - 50) * 0.92));

    state.runs.forEach((run, i) => {
        const cx = colW * (i + 0.5);
        const color = METHOD_COLORS[run.id];
        const shown = visible[run.id];

        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.fillStyle = shown ? color : '#555';
        ctx.fillText(run.integrator.name, cx, 22);

        if (i > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath(); ctx.moveTo(colW * i, 0); ctx.lineTo(colW * i, height); ctx.stroke();
        }
        if (!shown) {
            ctx.font = '12px Inter, sans-serif';
            ctx.fillStyle = '#555';
            ctx.fillText('hidden', cx, height / 2);
            return;
        }

        // Release angle guide
        const a0 = degToRad(params.amplitudeDeg);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(cx, pivotY, lengthPx, Math.PI / 2 - Math.abs(a0), Math.PI / 2 + Math.abs(a0));
        ctx.stroke();
        ctx.setLineDash([]);

        const [theta, omega] = run.y;
        const bx = cx + lengthPx * Math.sin(theta);
        const by = pivotY + lengthPx * Math.cos(theta);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, pivotY); ctx.lineTo(bx, by); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, pivotY, 4, 0, Math.PI * 2); ctx.fillStyle = '#aaa'; ctx.fill();
        ctx.beginPath(); ctx.arc(bx, by, 13, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();

        ctx.font = '11px monospace';
        ctx.fillStyle = '#bbb';
        ctx.fillText(`θ = ${radToDeg(wrapAngle(theta)).toFixed(1)}°   ω = ${omega.toFixed(2)} rad/s`, cx, height - 26);
        ctx.fillText(`ΔE/E₀ = ${Number.isFinite(run.drift) ? run.drift.toExponential(2) : '—'}`, cx, height - 10);
    });

    ctx.font = '11px monospace';
    ctx.fillStyle = '#777';
    ctx.textAlign = 'left';
    ctx.fillText(`t = ${state.t.toFixed(2)} s   Δt = ${params.dt} s`, 8, height - 42);
}

/** Log-scale y range (in decades) covering the non-zero |values| of the given series. */
function logRange(seriesPoints) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const points of seriesPoints) for (const [, v] of points) {
        if (!Number.isFinite(v) || v === 0) continue;
        const l = Math.log10(Math.abs(v));
        lo = Math.min(lo, l);
        hi = Math.max(hi, l);
    }
    lo = Number.isFinite(lo) ? Math.max(Math.log10(LOG_FLOOR), Math.floor(lo)) : -16;
    hi = Number.isFinite(hi) ? Math.min(4, Math.ceil(hi)) : 0;
    return [Math.min(lo, hi - 3), hi]; // at least three decades
}

/** Symmetric linear y range covering the series, with 15% headroom. */
function linearRange(seriesPoints, fallback) {
    let m = 0;
    for (const points of seriesPoints) for (const [, v] of points) if (Number.isFinite(v)) m = Math.max(m, Math.abs(v));
    m = m > 0 ? m * 1.15 : fallback;
    return [-m, m];
}

/** A quantity over the last ENERGY_WINDOW seconds, one line per visible method. */
function renderRunHistory(ctx, state, visible, { samplesOf, logScale, title, yLabel, note, nonNegative }) {
    clear(ctx);
    const runs = state.runs.filter((r) => visible[r.id]);
    const tMax = Math.max(state.t, 10);
    const series = runs.map((r) => samplesOf(r));
    let yRange = logScale ? logRange(series) : linearRange(series, 1e-3);
    if (!logScale && nonNegative) yRange = [0, yRange[1]];
    drawChart(ctx, fullRect(ctx), {
        title,
        xLabel: 'time t (s)',
        yLabel,
        xRange: [Math.max(0, tMax - ENERGY_WINDOW), tMax],
        yRange,
        yScale: logScale ? 'log' : 'linear',
        series: runs.map((r, i) => ({ label: r.integrator.name, color: METHOD_COLORS[r.id], points: series[i] })),
        note,
    });
}

/** ΔE/E₀ over time for each visible method; log scale shows |ΔE/E₀|. */
export function renderEnergyDrift(ctx, state, params, visible, logScale) {
    renderRunHistory(ctx, state, visible, {
        samplesOf: (r) => r.energySamples,
        logScale,
        title: logScale ? 'Energy error |ΔE/E₀| (log scale)' : 'Energy error ΔE/E₀',
        yLabel: logScale ? '|ΔE / E₀|' : 'ΔE / E₀',
        note: params.damping > 0 ? 'includes physical damping loss (γ > 0)' : undefined,
    });
}

/** |θ − θ_reference| over time for each visible method. */
export function renderTrajectoryError(ctx, state, params, visible, logScale) {
    renderRunHistory(ctx, state, visible, {
        samplesOf: (r) => r.errorSamples,
        logScale,
        nonNegative: true,
        title: `Angle error |θ − θ_ref|${logScale ? ' (log scale)' : ''}`,
        yLabel: '|Δθ| (rad)',
        note: params.damping > 0 ? 'reference: RK4 at Δt/20 (no closed form with damping)' : 'reference: exact elliptic-function solution',
    });
}

/** Phase portrait: θ (wrapped to ±180°) against ω, with the exact undamped orbit as reference. */
export function renderPhaseSpace(ctx, state, params, visible) {
    clear(ctx);
    const a0 = Math.abs(degToRad(params.amplitudeDeg));
    const thetaSpan = Math.min(180, 1.3 * radToDeg(a0) + 5);
    const omegaSpan = 1.3 * peakAngularVelocity(Math.max(a0, degToRad(4)), params.lengthM, params.gravity) + 0.05;

    // Exact orbit of the undamped pendulum: ½L²ω² = gL(cos θ − cos θ₀) → ω = ±√(2g/L·(cos θ − cos θ₀))
    const reference = [];
    const N = 240;
    for (const sign of [1, -1]) {
        for (let i = 0; i <= N; i++) {
            const th = -a0 + (2 * a0 * i) / N;
            const w = Math.sqrt(Math.max(0, (2 * params.gravity / params.lengthM) * (Math.cos(th) - Math.cos(a0))));
            reference.push([radToDeg(sign > 0 ? th : -th), sign * w]);
        }
    }

    drawChart(ctx, fullRect(ctx), {
        title: 'Phase space (θ, ω)',
        xLabel: 'angle θ (°)',
        yLabel: 'angular velocity ω (rad/s)',
        xRange: [-thetaSpan, thetaSpan],
        yRange: [-omegaSpan, omegaSpan],
        series: [
            ...(params.damping === 0
                ? [{ label: 'exact orbit (γ = 0)', color: REFERENCE_COLOR, points: reference, dashed: true, lineWidth: 1.25 }]
                : []),
            ...state.runs.filter((r) => visible[r.id]).map((r) => ({
                label: r.integrator.name,
                color: METHOD_COLORS[r.id],
                points: r.phase.map(([th, w]) => [radToDeg(wrapAngle(th)), w]),
                breakIfJumpX: 180,
            })),
        ],
    });
}
