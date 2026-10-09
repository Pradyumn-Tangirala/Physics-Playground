// Damped simple pendulum, full nonlinear form:
//
//     θ'' = −(g/L)·sin θ − 2γ·θ'
//
// written as a first-order system with state y = [θ, ω]:
//
//     dθ/dt = ω
//     dω/dt = −(g/L)·sin θ − 2γ·ω
//
// Assumptions: point mass on a massless rigid rod, frictionless pivot, uniform
// gravity, linear (viscous) damping with rate γ (1/s). θ in radians, ω in rad/s.
// params = { g (m/s²), length L (m), damping γ (1/s), mass m (kg) }

import { ellipticK, jacobiElliptic } from '../elliptic.js';

/**
 * kg. Bob mass used where the labs show energies. The motion does not depend on
 * the mass, and every energy comparison is relative (ΔE/E₀), so 1 kg only sets the scale.
 */
export const BOB_MASS = 1;

/** Derivative function f(y) for the integrators. */
export const derivative = ({ g, length, damping }) => ([theta, omega]) => [
    omega,
    -(g / length) * Math.sin(theta) - 2 * damping * omega,
];

/**
 * Mechanical energy (J), with PE measured from the lowest point:
 *     E = ½·m·L²·ω² + m·g·L·(1 − cos θ)
 */
export function energy([theta, omega], { g, length, mass }) {
    const ke = 0.5 * mass * length * length * omega * omega;
    const pe = mass * g * length * (1 - Math.cos(theta));
    return { ke, pe, total: ke + pe };
}

/** Small-angle (linearised, sin θ ≈ θ) period T₀ = 2π·√(L/g). */
export const smallAnglePeriod = (length, g) => 2 * Math.PI * Math.sqrt(length / g);

/**
 * Exact period of the undamped nonlinear pendulum released from rest at
 * amplitude θ₀ (rad):  T = 4·√(L/g)·K(k²),  k = sin(θ₀/2). Diverges as θ₀ → π.
 */
export function exactPeriod(amplitude, length, g) {
    const k = Math.sin(Math.abs(amplitude) / 2);
    return 4 * Math.sqrt(length / g) * ellipticK(k * k);
}

/**
 * Exact state [θ, ω] at time t of the undamped pendulum released from rest at
 * θ₀ (|θ₀| < π). With k = sin(θ₀/2), m = k², ω₀ = √(g/L) and u = ω₀t:
 *
 *     sin(θ/2) = k·cd(u|m)            (cd = cn/dn; cd(0) = 1 gives θ(0) = θ₀)
 *     ω        = −2kω₀·√(1 − m)·sn(u|m)/dn(u|m)
 *
 * This is the reference the numerical methods are measured against.
 */
export function exactMotion(amplitude, length, g, t) {
    const k = Math.sin(Math.abs(amplitude) / 2);
    const m = k * k;
    const w0 = Math.sqrt(g / length);
    const { sn, cn, dn } = jacobiElliptic(w0 * t, m);
    const sign = Math.sign(amplitude) || 1;
    const theta = 2 * Math.asin(Math.max(-1, Math.min(1, (k * cn) / dn)));
    const omega = (-2 * k * w0 * Math.sqrt(1 - m) * sn) / dn;
    return [sign * theta, sign * omega];
}

/** Peak angular speed for an undamped release from rest at θ₀ (from energy conservation). */
export const peakAngularVelocity = (amplitude, length, g) =>
    Math.sqrt((2 * g * (1 - Math.cos(amplitude))) / length);
