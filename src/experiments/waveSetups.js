// Physical setups for the analytical wave lab, all in SI units. Shared by the
// page (sliders), the experiment links (allowed ranges) and the solver.

import { RIPPLE_TANK_WAVE_SPEED, SPEED_OF_LIGHT, SPEED_OF_SOUND_AIR } from '../physics/constants.js';

/** Wave speeds c (m/s) of the media the analytical lab offers. */
export const WAVE_MEDIA = {
    water: { label: 'Water (0.25 m/s)', speed: RIPPLE_TANK_WAVE_SPEED },
    sound: { label: 'Air, sound (343 m/s)', speed: SPEED_OF_SOUND_AIR },
    light: { label: 'Light (2.998×10⁸ m/s)', speed: SPEED_OF_LIGHT },
};

/** The FDTD lab needs a wavelength of many grid cells, so it offers only the macroscopic media. */
export const FDTD_MEDIA = [
    { label: 'Water ripples (c = 0.25 m/s)', speed: RIPPLE_TANK_WAVE_SPEED },
    { label: 'Sound in air (c = 343 m/s)', speed: SPEED_OF_SOUND_AIR },
];

/**
 * Real experiments. "macro" setups have wavelengths of centimetres, so the 2-D
 * field can be drawn to scale; the optical one cannot (see WAVE_MODEL.md).
 */
export const WAVE_SETUPS = {
    ripple: { label: 'Ripple tank (water)', regime: 'macro', medium: 'water', wavelength: 0.02, slitSeparation: 0.1, slitWidth: 0.01, screenDistance: 1 },
    microwave: { label: 'Microwaves (10.5 GHz)', regime: 'macro', medium: 'light', wavelength: 0.0285, slitSeparation: 0.12, slitWidth: 0.02, screenDistance: 1.2 },
    sound: { label: 'Sound (17 kHz)', regime: 'macro', medium: 'sound', wavelength: 0.02, slitSeparation: 0.1, slitWidth: 0.015, screenDistance: 1.5 },
    laser: { label: 'He-Ne laser (632.8 nm)', regime: 'optical', medium: 'light', wavelength: 632.8e-9, slitSeparation: 0.25e-3, slitWidth: 0.05e-3, screenDistance: 1 },
};

/** Slider ranges per regime, in display units; `factor` converts a display value to SI. */
export const WAVE_RANGES = {
    macro: {
        wavelength: { unit: 'mm', factor: 1e-3, min: 5, max: 60, step: 0.5 },
        slitSeparation: { unit: 'mm', factor: 1e-3, min: 10, max: 400, step: 1 },
        slitWidth: { unit: 'mm', factor: 1e-3, min: 0, max: 60, step: 0.5 },
    },
    optical: {
        wavelength: { unit: 'nm', factor: 1e-9, min: 380, max: 750, step: 1 },
        slitSeparation: { unit: 'mm', factor: 1e-3, min: 0.05, max: 2, step: 0.01 },
        slitWidth: { unit: 'mm', factor: 1e-3, min: 0, max: 0.3, step: 0.005 },
    },
};

/** Screen distance range (m), the same for every setup. */
export const SCREEN_DISTANCE_RANGE = { min: 0.2, max: 5, step: 0.05 };

export const regimeOf = (setupId) => WAVE_SETUPS[setupId].regime;

/** SI bounds of a slider quantity in the given setup's regime. */
export function siRange(setupId, key) {
    const r = WAVE_RANGES[regimeOf(setupId)][key];
    return { min: r.min * r.factor, max: r.max * r.factor };
}

/** Wave speeds allowed in a setup: any medium for macroscopic waves, light only for the laser. */
export const allowedSpeeds = (setupId) =>
    (regimeOf(setupId) === 'optical' ? [WAVE_MEDIA.light.speed] : Object.values(WAVE_MEDIA).map((m) => m.speed));

/** Lab parameters for a setup, with equal in-phase sources. */
export function setupParams(setupId, mode = 'double') {
    const s = WAVE_SETUPS[setupId];
    return {
        setupId,
        mode,
        wavelength: s.wavelength,
        waveSpeed: WAVE_MEDIA[s.medium].speed,
        slitSeparation: s.slitSeparation,
        slitWidth: s.slitWidth,
        screenDistance: s.screenDistance,
        phase: 0,
        amplitude1: 1,
        amplitude2: 1,
    };
}
