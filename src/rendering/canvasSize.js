// High-DPI canvas support. SimulationCanvas sizes each canvas's backing store
// to CSS size × devicePixelRatio and records the ratio in data-dpr; renderers
// call beginFrame() so all their drawing code keeps working in CSS pixels
// while text and lines are rasterised at full device resolution.

/** Highest device-pixel ratio rendered at; 3× phones are drawn at 2× (sharp, and 2.25× fewer pixels). */
export const MAX_PIXEL_RATIO = 2;

/** Device pixels per CSS pixel of this canvas's backing store (1 when unknown). */
const pixelRatio = (canvas) => Number(canvas.dataset?.dpr) || 1;

/** The canvas size in CSS pixels: the coordinate system every renderer draws in. */
export function cssSize(canvas) {
    const r = pixelRatio(canvas);
    return { width: canvas.width / r, height: canvas.height / r };
}

/** Starts a frame: maps CSS pixels onto device pixels and returns the size in CSS pixels. */
export function beginFrame(ctx) {
    const r = pixelRatio(ctx.canvas);
    ctx.setTransform(r, 0, 0, r, 0, 0);
    return cssSize(ctx.canvas);
}
