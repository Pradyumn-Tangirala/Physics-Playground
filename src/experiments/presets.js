// Guided experiments: each opens a lab with every parameter set, and says what
// to look for. The quoted numbers are checked by tests/validation/presets.test.js.

import { OSCILLATOR_LAB, METHODS_LAB, WAVE_LAB, PROJECTILE_LAB, experimentPath } from './labs.js';
import { defaultParams } from './urlParams.js';
import { setupParams } from './waveSetups.js';

const preset = (lab, overrides, info) => ({
    ...info,
    lab,
    params: { ...defaultParams(lab.fields), ...overrides },
});

export const PRESETS = [
    preset(OSCILLATOR_LAB, { mode: 'pendulum', startAngleDeg: 5, lengthM: 1, gravity: 9.81, damping: 0, integrator: 'rk4', dt: 0.005 }, {
        id: 'small-angle-pendulum',
        title: 'Small-angle pendulum',
        summary: 'A 1 m pendulum released at 5°.',
        lookFor: 'The measured period, 2.0070 s, is within 0.05% of the small-angle formula T₀ = 2π√(L/g) = 2.0061 s: at 5°, sin θ ≈ θ is an excellent approximation.',
    }),
    preset(OSCILLATOR_LAB, { mode: 'pendulum', startAngleDeg: 90, lengthM: 1, gravity: 9.81, damping: 0, integrator: 'rk4', dt: 0.005 }, {
        id: 'nonlinear-pendulum',
        title: 'Nonlinear pendulum',
        summary: 'The same pendulum released at 90°.',
        lookFor: 'The period is now 2.3678 s, 18% longer than the small-angle formula predicts, and it matches the exact elliptic-integral period. For larger angles (up to 170°), use the Numerical Methods Lab.',
    }),
    preset(METHODS_LAB, { amplitudeDeg: 30, lengthM: 1, gravity: 9.81, damping: 0, dt: 0.02, methods: ['euler', 'symplectic'] }, {
        id: 'euler-energy-drift',
        title: 'Euler energy drift',
        summary: 'Explicit and symplectic Euler at Δt = 20 ms.',
        lookFor: 'Explicit Euler gains energy every step and the swing grows without limit. Symplectic Euler costs the same per step, but its energy error stays bounded and oscillates.',
    }),
    preset(METHODS_LAB, { amplitudeDeg: 60, lengthM: 1, gravity: 9.81, damping: 0, dt: 0.01, methods: ['rk4'] }, {
        id: 'rk4-accuracy',
        title: 'RK4 accuracy',
        summary: 'RK4 at Δt = 10 ms against the exact solution.',
        lookFor: 'RK4’s period agrees with the exact period to about 1 part in 10⁷, and over the first 10 s its angle stays within 2×10⁻⁷ rad of the exact elliptic-function solution, while costing 4 derivative evaluations per step.',
    }),
    preset(WAVE_LAB, { ...setupParams('laser', 'double'), wavelength: 600e-9, slitSeparation: 0.2e-3, slitWidth: 0.04e-3, screenDistance: 1 }, {
        id: 'double-slit',
        title: 'Double-slit interference',
        summary: 'λ = 600 nm, d = 0.2 mm, a = 0.04 mm, D = 1 m.',
        lookFor: 'Fringes 3.0 mm apart (β = λD/d), under a single-slit envelope whose first zero at λD/a = 15 mm removes the 5th order.',
    }),
    preset(WAVE_LAB, { ...setupParams('laser', 'single'), wavelength: 600e-9, slitWidth: 0.1e-3, screenDistance: 1 }, {
        id: 'single-slit',
        title: 'Single-slit diffraction',
        summary: 'λ = 600 nm through one 0.1 mm slit, D = 1 m.',
        lookFor: 'A central maximum 12 mm wide (2λD/a), twice the width of the side maxima, which fall off as sinc².',
    }),
    preset(PROJECTILE_LAB, { mode: 'compare', velocity: 30, angleDeg: 45, height: 0, gravity: 9.81, rho: 0, integrator: 'rk4', dt: 0.01, playbackSpeed: 1 }, {
        id: 'projectile-no-drag',
        title: 'Projectile without drag',
        summary: '30 m/s at 45° with air density set to zero.',
        lookFor: 'Range v₀²/g = 91.74 m. RK4 matches the closed form to round-off, because the exact path is a parabola; switch to Euler to see a first-order error.',
    }),
    preset(PROJECTILE_LAB, { mode: 'compare', velocity: 60, angleDeg: 45, height: 0, gravity: 9.81, rho: 1.225, integrator: 'rk4', dt: 0.01, playbackSpeed: 2 }, {
        id: 'projectile-drag',
        title: 'Projectile with drag',
        summary: 'A baseball launched at 60 m/s and 45° through sea-level air.',
        lookFor: 'Drag cuts the range from 367 m to 127 m and makes the path asymmetric: it comes down more steeply than it went up.',
    }),
];

export const presetPath = (p) => experimentPath(p.lab, p.params);

export const presetsFor = (lab) => PRESETS.filter((p) => p.lab === lab);
