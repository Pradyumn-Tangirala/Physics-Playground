// Screen geometry shared by the oscillator renderers and the page's pointer
// hit-testing. Pure functions of the canvas size (CSS pixels) and state.
//
// Two arrangements:
//   wide    (≥ COMPACT_WIDTH): body in the upper area, the time graph and the
//           phase plot side by side along the bottom, energy bars on the right.
//   compact (< COMPACT_WIDTH, phones): the graphs stacked full-width at the
//           bottom and small energy bars in the top-right corner.
// The drawing scale (px per metre) shrinks when the canvas is too short for
// the longest pendulum or the largest spring amplitude, so the whole motion
// always fits; every position in this file goes through `layout.pxPerM`.

import { MAX_LENGTH_M, MAX_AMPLITUDE_M } from '../simulation/oscillatorSimulation.js';

const MAX_PX_PER_M = 100;
export const BLOCK_SIZE = 50;
export const BOB_RADIUS = 20;
export const COMPACT_WIDTH = 640;
const MIN_PX_PER_M = 20;

export function oscillatorLayout(width, height) {
    const compact = width < COMPACT_WIDTH;
    const margin = compact ? 12 : 20;
    const graph = compact
        ? { time: { height: 100 }, phase: { height: 130 }, gap: 10 }
        : { time: { height: 150 }, phase: { height: 150 }, gap: 10 };
    const stripHeight = compact ? graph.time.height + graph.gap + graph.phase.height : graph.time.height;
    const bodyBottom = height - stripHeight - margin - 10; // lowest y the moving body may reach
    const pivotY = compact ? 56 : 100; // also the spring's mount

    // Fit the longest pendulum, and the spring at full amplitude either way.
    const pendulumFit = (bodyBottom - pivotY - BOB_RADIUS - 4) / MAX_LENGTH_M;
    const springFit = (bodyBottom - pivotY - 20 - BLOCK_SIZE) / (2 * MAX_AMPLITUDE_M);
    const pxPerM = Math.max(MIN_PX_PER_M, Math.min(MAX_PX_PER_M, pendulumFit, springFit));

    // Spring equilibrium: centred in the room the block has to move.
    const centerY = (pivotY + 20 + bodyBottom - BLOCK_SIZE) / 2;
    const stripTop = height - stripHeight - margin;

    return {
        compact,
        width,
        height,
        pxPerM,
        pivotY,
        centerX: width / 2,
        centerY,
        timeGraph: compact
            ? { x: margin, y: stripTop, width: width - 2 * margin, height: graph.time.height }
            : null, // wide: positioned next to the phase plot by the renderer
        phasePlot: compact
            ? { x: margin, y: stripTop + graph.time.height + graph.gap, width: width - 2 * margin, height: graph.phase.height }
            : null,
        stripTop,
        margin,
        energyBars: compact
            ? { x: width - margin - 3 * 18, y: 40, barW: 12, gap: 18, barH: 90, small: true }
            : { x: width - 3 * 30 - 20, y: 100, barW: 20, gap: 30, barH: 200, small: false },
    };
}

/** Pendulum bob centre (px) for angle θ (rad) and string length (m). */
export const bobPosition = (layout, theta, lengthM) => ({
    x: layout.centerX + lengthM * layout.pxPerM * Math.sin(theta),
    y: layout.pivotY + lengthM * layout.pxPerM * Math.cos(theta),
});

/** Top edge (px) of the spring block for displacement x (m, positive = down). */
export const blockTop = (layout, x) => layout.centerY + x * layout.pxPerM;
