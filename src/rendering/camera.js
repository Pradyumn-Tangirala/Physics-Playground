/**
 * Pixels-per-metre that fits a scene of the given extent (m) into the
 * available drawing area (px). Zero-sized extents (θ = 0 or 90°) are floored
 * at `minExtent` metres, and the zoom is capped at `maxScale`.
 */
export function fitScale(extentX, extentY, availW, availH, { minExtent = 1, maxScale = 40 } = {}) {
    const sx = Math.max(availW, 1) / Math.max(extentX, minExtent);
    const sy = Math.max(availH, 1) / Math.max(extentY, minExtent);
    return Math.min(sx, sy, maxScale);
}
