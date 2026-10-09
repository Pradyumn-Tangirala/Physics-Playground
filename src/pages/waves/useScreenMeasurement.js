import { useMemo, useState } from 'react';

/** A cursor within this fraction of the screen half-width of a fringe snaps onto it. */
const SNAP_FRACTION = 0.03;
/** Without snapping, an arrow key moves the cursor by this fraction of the half-width. */
const KEY_STEP_FRACTION = 0.01;
/** Positions closer than this (m) count as the same fringe when stepping with the keyboard. */
const SAME_POSITION = 1e-12;

/**
 * The screen chart's measurement tool: a cursor (pointer or arrow keys,
 * optionally snapping to bright and dark fringes) and up to two markers A, B.
 * `screenYAt(x)` maps a chart x (CSS px) to a screen position y (m).
 */
export function useScreenMeasurement(analysis, { origin, screenYAt }) {
    const [cursor, setCursor] = useState(null);
    const [markers, setMarkers] = useState([]);
    const [snap, setSnap] = useState(true);
    const extrema = useMemo(
        () => [...analysis.maxima, ...analysis.minima].map((e) => e.y).sort((a, b) => a - b),
        [analysis],
    );
    const half = analysis.halfWidth;

    const snapTo = (y) => {
        if (!snap || !extrema.length) return y;
        const nearest = extrema.reduce((best, e) => (Math.abs(e - y) < Math.abs(best - y) ? e : best));
        return Math.abs(nearest - y) < SNAP_FRACTION * half ? nearest : y;
    };
    const placeMarker = (y) => setMarkers((m) => (m.length >= 2 ? [y] : [...m, y]));

    /** Screen position under a pointer event on the chart canvas, or null outside the plot. */
    const pointerY = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const y = screenYAt(e.clientX - rect.left);
        return y === null ? null : snapTo(y);
    };

    const onKeyDown = (e) => {
        const current = cursor ?? origin;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const right = e.key === 'ArrowRight';
            const next = snap
                ? (right ? extrema.find((v) => v > current + SAME_POSITION) : extrema.findLast((v) => v < current - SAME_POSITION)) ?? current
                : Math.max(-half, Math.min(half, current + (right ? 1 : -1) * KEY_STEP_FRACTION * half));
            setCursor(next);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            placeMarker(current);
        } else if (e.key === 'Escape') {
            setMarkers([]);
        }
    };

    /** Simulated intensity at screen position y (nearest sample). */
    const intensityAt = (y) => {
        const i = Math.round(((y + half) / (2 * half)) * (analysis.y.length - 1));
        return analysis.intensity[Math.max(0, Math.min(analysis.y.length - 1, i))];
    };

    const reset = () => {
        setMarkers([]);
        setCursor(null);
    };

    return {
        cursor, markers, snap, setSnap, reset, intensityAt,
        clearMarkers: () => setMarkers([]),
        chartHandlers: {
            onPointerMove: (e) => setCursor(pointerY(e)),
            onPointerLeave: () => setCursor(null),
            onClick: (e) => { const y = pointerY(e); if (y !== null) placeMarker(y); },
            onKeyDown,
        },
    };
}
