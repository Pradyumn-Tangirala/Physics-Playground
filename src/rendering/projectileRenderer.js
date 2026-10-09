// Draws the projectile scene: predicted paths for the next shot, the flying
// shots with their trails, and a live readout. Reads state; never mutates it.

import { RUNS } from '../simulation/projectileSimulation.js';
import { niceStep, formatMetres } from '../utils/format.js';
import { fitScale } from './camera.js';
import { beginFrame } from './canvasSize.js';

// Layout (px)
const GROUND_HEIGHT = 40;
const LAUNCH_X = 60;
const TOP_RESERVE = 120; // readout + headroom above the apex
const SIDE_MARGIN = 40;
const TICK_SPACING = 90; // target px between axis ticks
const BALL_RADIUS = { analytic: 9, numeric: 6, drag: 7 };
const COMPACT_WIDTH = 700; // below this canvas width the readout is abbreviated

/** Largest x and y (m) among the predicted paths and the trails of the current shot. */
export function sceneExtent(predictions, state) {
    let x = 0;
    let y = 0;
    const visit = ([px, py]) => {
        if (Number.isFinite(px) && Number.isFinite(py)) {
            x = Math.max(x, px);
            y = Math.max(y, py);
        }
    };
    for (const p of predictions) if (!p.diverged) p.path.forEach(visit);
    for (const run of state.runs ?? []) if (!run.diverged) run.trail.forEach(visit);
    return { x, y };
}

/** Visible drawing area and the px/m scale that fits a scene of `extent` metres. */
export function projectileCamera(width, height, extent) {
    const groundY = height - GROUND_HEIGHT;
    const availW = width - LAUNCH_X - 2 * SIDE_MARGIN;
    const availH = groundY - TOP_RESERVE;
    const scale = fitScale(extent.x, extent.y, availW, availH);
    return { groundY, scale, availW, availH };
}

/**
 * view = { launch, predictions, showTrails } — `launch` and `predictions` are
 * for the current parameters (predictFlights), shown as the next shot's path.
 */
export function renderProjectile(ctx, state, { launch, predictions, showTrails }) {
    const { width: W, height: H } = beginFrame(ctx);
    const { groundY, scale } = projectileCamera(W, H, sceneExtent(predictions, state));
    const toCanvas = ([x, y]) => [LAUNCH_X + x * scale, groundY - y * scale];

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, W, H);
    drawGrid(ctx, W, groundY, scale);

    const gradient = ctx.createLinearGradient(0, groundY, 0, H);
    gradient.addColorStop(0, '#2ecc71');
    gradient.addColorStop(1, '#27ae60');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, groundY, W, GROUND_HEIGHT);
    drawGroundTicks(ctx, W, groundY, scale);

    const shotLaunch = state.phase === 'idle' ? launch : state.launch;
    drawLauncher(ctx, groundY, shotLaunch.y0 * scale);

    // Predicted paths of the next shot (dashed)
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    for (const p of predictions) {
        if (p.diverged) continue;
        ctx.strokeStyle = withAlpha(RUNS[p.id].color, 0.3);
        strokePath(ctx, p.path, toCanvas);
    }
    ctx.setLineDash([]);

    if (state.phase !== 'idle') {
        if (showTrails) {
            for (const run of state.runs) {
                ctx.strokeStyle = withAlpha(RUNS[run.id].color, run.id === 'analytic' ? 0.45 : 0.9);
                ctx.lineWidth = run.id === 'analytic' ? 5 : 2;
                strokePath(ctx, run.trail, toCanvas);
            }
        }
        for (const run of state.runs) drawBall(ctx, run, toCanvas(run.y));
    }

    drawReadout(ctx, W, state, predictions);
}

function strokePath(ctx, points, toCanvas) {
    ctx.beginPath();
    let penDown = false;
    for (const p of points) {
        if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) { penDown = false; continue; }
        const [cx, cy] = toCanvas(p);
        if (penDown) ctx.lineTo(cx, cy); else ctx.moveTo(cx, cy);
        penDown = true;
    }
    ctx.stroke();
}

function drawBall(ctx, run, [cx, cy]) {
    const { color } = RUNS[run.id];
    ctx.beginPath();
    ctx.arc(cx, cy, BALL_RADIUS[run.id], 0, Math.PI * 2);
    if (run.id === 'analytic') {
        // Hollow ring, so a numerical ball sitting on top of it stays visible.
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
    } else {
        ctx.fillStyle = color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = color;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

function drawLauncher(ctx, groundY, heightPx) {
    const top = groundY - heightPx;
    if (heightPx > 0.5) {
        ctx.fillStyle = '#3d3d55';
        ctx.fillRect(LAUNCH_X - 12, top, 24, heightPx);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(LAUNCH_X - 12, top, 24, heightPx);
    }
    ctx.beginPath();
    ctx.arc(LAUNCH_X, top, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#4facfe';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#4facfe';
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawReadout(ctx, canvasWidth, state, predictions) {
    // Narrow canvases (phones) get short names and no speed column.
    const compact = canvasWidth < COMPACT_WIDTH;
    const label = (id) => (compact ? RUNS[id].short : RUNS[id].label);
    const rows = state.phase === 'idle'
        ? predictions.map((p) => ({ id: p.id, text: 'ready' }))
        : state.runs.map((run) => {
            const [x, y, vx, vy] = run.y;
            const status = run.diverged ? (compact ? ' ✗' : '  ✗ unstable') : run.landed ? (compact ? ' ✓' : '  ✓ landed') : '';
            const text = compact
                ? `x ${x.toFixed(0).padStart(4)} m  y ${y.toFixed(0).padStart(3)} m${status}`
                : `x ${x.toFixed(1).padStart(7)} m   y ${y.toFixed(1).padStart(6)} m   |v| ${Math.hypot(vx, vy).toFixed(1).padStart(5)} m/s${status}`;
            return { id: run.id, text };
        });

    const x0 = compact ? 8 : LAUNCH_X + 20;
    const y0 = compact ? 8 : 16;
    ctx.font = '12px monospace';
    const labelW = Math.max(...rows.map((r) => ctx.measureText(label(r.id)).width));
    const textW = Math.max(...rows.map((r) => ctx.measureText(r.text).width));
    const w = labelW + textW + 52;
    const h = 30 + rows.length * 18;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x0, y0, w, h, 10);
    ctx.fill();
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`t = ${(state.t ?? 0).toFixed(2)} s`, x0 + 12, y0 + 15);
    ctx.font = '12px monospace';
    rows.forEach((r, i) => {
        const ry = y0 + 34 + i * 18;
        ctx.fillStyle = RUNS[r.id].color;
        ctx.fillRect(x0 + 12, ry - 4, 12, 8);
        ctx.fillText(label(r.id), x0 + 30, ry);
        ctx.fillStyle = '#ddd';
        ctx.fillText(r.text, x0 + 40 + labelW, ry);
    });
}

function drawGrid(ctx, W, groundY, scale) {
    const step = niceStep(TICK_SPACING / scale);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let m = 0, x = LAUNCH_X; x < W; m += step, x = LAUNCH_X + m * scale) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, groundY); ctx.stroke();
    }
    for (let m = step, y = groundY - step * scale; y > 0; m += step, y = groundY - m * scale) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        ctx.fillText(`${formatMetres(m)} m`, LAUNCH_X - 16, y);
    }
}

function drawGroundTicks(ctx, W, groundY, scale) {
    const step = niceStep(TICK_SPACING / scale);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let m = step, x = LAUNCH_X + step * scale; x < W - 20; m += step, x = LAUNCH_X + m * scale) {
        ctx.fillText(`${formatMetres(m)} m`, x, groundY + GROUND_HEIGHT / 2);
    }
}

/** '#rrggbb' + alpha → 'rgba(…)'. */
function withAlpha(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
