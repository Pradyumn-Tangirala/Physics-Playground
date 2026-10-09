// Parameter schemas of every lab: what a lab can be configured with, the
// allowed range of each value, its default, and its name in an experiment
// link. The pages build their sliders from these fields, so the controls, the
// links and the presets can never disagree about a range or a default.
// See urlParams.js for the field format.

import { INTEGRATOR_LIST } from '../physics/integrators.js';
import { TIMESTEP_OPTIONS } from '../utils/timeStep.js';
import { DEFAULT_DT, MAX_LENGTH_M, MAX_AMPLITUDE_M } from '../simulation/oscillatorSimulation.js';
import { DEFAULT_PROJECTILE_DT, PLAYBACK_SPEEDS } from '../simulation/projectileSimulation.js';
import {
    STANDARD_GRAVITY, SEA_LEVEL_AIR_DENSITY, SMOOTH_SPHERE_DRAG_COEFFICIENT, BASEBALL,
} from '../physics/constants.js';
import { encodeParams } from './urlParams.js';
import {
    WAVE_SETUPS, WAVE_MEDIA, FDTD_MEDIA, SCREEN_DISTANCE_RANGE, allowedSpeeds, setupParams, siRange,
} from './waveSetups.js';

const METHOD_IDS = INTEGRATOR_LIST.map((m) => m.id);
const method = { param: 'method', kind: 'choice', choices: METHOD_IDS, default: 'rk4', label: 'Integrator' };
const timestep = (fallback) => ({ param: 'dt', kind: 'choice', choices: TIMESTEP_OPTIONS, default: fallback, unit: 's', label: 'Timestep Δt' });

export const OSCILLATOR_LAB = {
    id: 'oscillator',
    path: '/shm',
    title: 'Oscillator Lab',
    fields: {
        mode: { param: 'mode', kind: 'choice', choices: ['pendulum', 'spring'], default: 'pendulum', label: 'Oscillator' },
        startAngleDeg: { param: 'angle', kind: 'number', min: -90, max: 90, step: 1, unit: '°', default: 30, label: 'Start Angle' },
        lengthM: { param: 'length', kind: 'number', min: 0.5, max: MAX_LENGTH_M, step: 0.01, unit: 'm', default: 2, label: 'Length L' },
        gravity: { param: 'g', kind: 'number', min: 1, max: 25, step: 0.01, unit: 'm/s²', default: STANDARD_GRAVITY, label: 'Gravity' },
        amplitudeM: { param: 'amplitude', kind: 'number', min: 0.1, max: MAX_AMPLITUDE_M, step: 0.01, unit: 'm', default: 1, label: 'Amplitude A' },
        mass: { param: 'mass', kind: 'number', min: 1, max: 10, step: 0.5, unit: 'kg', default: 2, label: 'Mass' },
        k: { param: 'k', kind: 'number', min: 1, max: 50, step: 1, unit: 'N/m', default: 10, label: 'Spring Constant (k)' },
        damping: { param: 'damping', kind: 'number', min: 0, max: 1, step: 0.01, unit: 's⁻¹', default: 0, label: 'Damping γ' },
        integrator: method,
        dt: timestep(DEFAULT_DT),
    },
};

export const METHODS_LAB = {
    id: 'methods',
    path: '/numerical-methods',
    title: 'Numerical Methods Lab',
    fields: {
        amplitudeDeg: { param: 'angle', kind: 'number', min: 1, max: 170, step: 1, unit: '°', default: 60, label: 'Release angle θ₀' },
        lengthM: { param: 'length', kind: 'number', min: 0.2, max: 3, step: 0.1, unit: 'm', default: 1, label: 'Length L' },
        gravity: { param: 'g', kind: 'number', min: 1, max: 25, step: 0.01, unit: 'm/s²', default: STANDARD_GRAVITY, label: 'Gravity g' },
        damping: { param: 'damping', kind: 'number', min: 0, max: 1, step: 0.01, unit: 's⁻¹', default: 0, label: 'Damping γ' },
        dt: timestep(0.01),
        methods: { param: 'show', kind: 'set', choices: METHOD_IDS, default: METHOD_IDS, label: 'Methods shown' },
    },
};

// Defaults: a 60 m/s launch of a baseball through sea-level air.
export const PROJECTILE_LAB = {
    id: 'projectile',
    path: '/projectile',
    title: 'Projectile Lab',
    fields: {
        mode: { param: 'mode', kind: 'choice', choices: ['compare', 'ideal'], default: 'compare', label: 'Model' },
        velocity: { param: 'v', kind: 'number', min: 1, max: 100, step: 1, unit: 'm/s', default: 60, label: 'Initial velocity v₀' },
        angleDeg: { param: 'angle', kind: 'number', min: 0, max: 90, step: 1, unit: '°', default: 45, label: 'Launch angle θ' },
        height: { param: 'h', kind: 'number', min: 0, max: 100, step: 1, unit: 'm', default: 0, label: 'Launch height y₀' },
        gravity: { param: 'g', kind: 'number', min: 1, max: 25, step: 0.01, unit: 'm/s²', default: STANDARD_GRAVITY, label: 'Gravity g' },
        rho: { param: 'rho', kind: 'number', min: 0, max: 2, step: 0.005, unit: 'kg/m³', default: SEA_LEVEL_AIR_DENSITY, label: 'Air density ρ' },
        cd: { param: 'cd', kind: 'number', min: 0, max: 2, step: 0.01, unit: '', default: SMOOTH_SPHERE_DRAG_COEFFICIENT, label: 'Drag coefficient C_d' },
        area: { param: 'area', kind: 'number', min: 0.0005, max: 0.05, step: 0.0001, unit: 'm²', default: BASEBALL.area, label: 'Cross-section A' },
        mass: { param: 'mass', kind: 'number', min: 0.01, max: 10, step: 0.005, unit: 'kg', default: BASEBALL.mass, label: 'Mass m' },
        integrator: method,
        dt: timestep(DEFAULT_PROJECTILE_DT),
        playbackSpeed: { param: 'speed', kind: 'choice', choices: PLAYBACK_SPEEDS, default: 2, label: 'Playback speed' },
    },
};

const WAVE_DEFAULTS = setupParams('ripple', 'double');
const waveRange = (key, bound) => (p) => siRange(p.setupId, key)[bound];

export const WAVE_LAB = {
    id: 'waves',
    path: '/simulation',
    title: 'Wave Interference',
    fields: {
        setupId: { param: 'setup', kind: 'choice', choices: Object.keys(WAVE_SETUPS), default: WAVE_DEFAULTS.setupId, label: 'Setup' },
        mode: { param: 'mode', kind: 'choice', choices: ['double', 'single'], default: WAVE_DEFAULTS.mode, label: 'Experiment' },
        wavelength: { param: 'wavelength', kind: 'number', min: waveRange('wavelength', 'min'), max: waveRange('wavelength', 'max'), unit: 'm', default: WAVE_DEFAULTS.wavelength, label: 'Wavelength λ' },
        slitSeparation: { param: 'separation', kind: 'number', min: waveRange('slitSeparation', 'min'), max: waveRange('slitSeparation', 'max'), unit: 'm', default: WAVE_DEFAULTS.slitSeparation, label: 'Slit separation d' },
        slitWidth: { param: 'width', kind: 'number', min: waveRange('slitWidth', 'min'), max: waveRange('slitWidth', 'max'), unit: 'm', default: WAVE_DEFAULTS.slitWidth, label: 'Slit width a' },
        screenDistance: { param: 'distance', kind: 'number', ...SCREEN_DISTANCE_RANGE, unit: 'm', default: WAVE_DEFAULTS.screenDistance, label: 'Screen distance D' },
        waveSpeed: { param: 'c', kind: 'choice', choices: (p) => allowedSpeeds(p.setupId), default: WAVE_DEFAULTS.waveSpeed, unit: 'm/s', label: 'Wave speed c' },
        phase: { param: 'phase', kind: 'number', min: -Math.PI, max: Math.PI, unit: 'rad', default: 0, label: 'Phase difference φ' },
        amplitude1: { param: 'a1', kind: 'number', min: 0, max: 2, step: 0.05, default: 1, label: 'Amplitude A₁' },
        amplitude2: { param: 'a2', kind: 'number', min: 0, max: 2, step: 0.05, default: 1, label: 'Amplitude A₂' },
        view: { param: 'view', kind: 'choice', choices: ['field', 'intensity'], default: 'field', label: 'Field view' },
    },
};

export const FDTD_LAB = {
    id: 'fdtd',
    path: '/waves/fdtd',
    title: 'Numerical Wave Equation Lab',
    fields: {
        scene: { param: 'scene', kind: 'choice', choices: ['double', 'single', 'two-point', 'point'], default: 'double', label: 'Scene' },
        wavelength: { param: 'wavelength', kind: 'number', min: 0.015, max: 0.08, unit: 'm', default: 0.03, label: 'Wavelength λ' },
        slitSeparation: { param: 'separation', kind: 'number', min: 0.02, max: 0.3, unit: 'm', default: 0.1, label: 'Slit separation d' },
        slitWidth: { param: 'width', kind: 'number', min: 0.002, max: 0.12, unit: 'm', default: 0.012, label: 'Slit width a' },
        waveSpeed: { param: 'c', kind: 'choice', choices: FDTD_MEDIA.map((m) => m.speed), default: WAVE_MEDIA.water.speed, unit: 'm/s', label: 'Wave speed c' },
        cellsPerWavelength: { param: 'cells', kind: 'number', min: 6, max: 30, step: 1, default: 15, label: 'Cells per wavelength' },
        courant: { param: 'courant', kind: 'number', min: 0.1, max: 0.9, step: 0.01, default: 0.5, label: 'Courant number C = cΔt/Δx' },
        boundary: { param: 'boundary', kind: 'choice', choices: ['absorbing', 'reflective'], default: 'absorbing', label: 'Boundary' },
        stepsPerFrame: { param: 'speed', kind: 'number', min: 1, max: 20, step: 1, default: 3, label: 'Steps per frame' },
    },
};

export const LABS = [OSCILLATOR_LAB, METHODS_LAB, PROJECTILE_LAB, WAVE_LAB, FDTD_LAB];

/** Router path (with query) that opens `lab` with exactly these parameters. */
export const experimentPath = (lab, params) => `${lab.path}?${encodeParams(lab.fields, params)}`;

/** Slider props (label, unit, range, step) for a numeric field. */
export const sliderProps = ({ label, unit, min, max, step }) => ({ label, unit, min, max, step });
