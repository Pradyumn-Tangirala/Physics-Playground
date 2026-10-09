// Physical constants and reference values used as defaults across the labs.
// Every value is SI. Models take these as parameters; nothing in the physics
// depends on a constant silently.

/** m/s². Standard gravity, 9.80665 m/s² (ISO 80000-3), to the 3 significant figures the labs display. */
export const STANDARD_GRAVITY = 9.81;

/** kg/m³. Dry air at sea level and 15 °C (International Standard Atmosphere). */
export const SEA_LEVEL_AIR_DENSITY = 1.225;

/** Dimensionless. Drag coefficient of a smooth sphere for Reynolds numbers ~10³–2×10⁵. */
export const SMOOTH_SPHERE_DRAG_COEFFICIENT = 0.47;

/** A regulation baseball: mass (kg) and cross-sectional area π·r² with r = 3.66 cm (m²). */
export const BASEBALL = { mass: 0.145, area: 0.0042 };

/** m/s. Speed of light in vacuum (2.99792458×10⁸, to 4 s.f.); in air it is 0.03% lower. */
export const SPEED_OF_LIGHT = 2.998e8;

/** m/s. Speed of sound in dry air at 20 °C. */
export const SPEED_OF_SOUND_AIR = 343;

/** m/s. Typical speed of the short surface waves in a ripple tank (about 1 cm deep water, f ≈ 10–20 Hz). */
export const RIPPLE_TANK_WAVE_SPEED = 0.25;
