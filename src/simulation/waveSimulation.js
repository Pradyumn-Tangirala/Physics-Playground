// Analytical wave lab: the field is a pure function of the parameters (see
// physics/waves/field.js), so the only state is the accumulated phase ωt.
//
// Real frequencies (12 Hz ripples to 5×10¹⁴ Hz light) cannot be shown at
// 60 frames per second, so the animation always runs at DISPLAY_FREQUENCY and
// the page reports the slow-motion factor f / DISPLAY_FREQUENCY. Nothing
// measured depends on this: intensities are time averages.

export const DISPLAY_FREQUENCY = 0.6; // cycles per second of wall time
const TWO_PI = 2 * Math.PI;

/** How much slower than reality the animation runs. */
export const slowMotionFactor = (f) => f / DISPLAY_FREQUENCY;

export const waveSimulation = {
    init: () => ({ wavePhase: 0 }),

    step(state, params, dt) {
        state.wavePhase = (state.wavePhase + TWO_PI * DISPLAY_FREQUENCY * dt) % TWO_PI;
        return null;
    },
};
