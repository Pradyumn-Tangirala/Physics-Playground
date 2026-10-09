// Unit conversions. Every physics module works in SI units; these helpers are
// used at the boundary between UI values and the physics layer.

export const degToRad = (deg) => (deg * Math.PI) / 180;
export const radToDeg = (rad) => (rad * 180) / Math.PI;
export const nmToM = (nm) => nm * 1e-9;
export const mmToM = (mm) => mm * 1e-3;
export const mToMm = (m) => m * 1e3;
