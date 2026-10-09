// Damped spring-mass oscillator about its equilibrium position:
//
//     x'' = −(k/m)·x − 2γ·x'
//
// as a first-order system with state y = [x, v]. Linear, so it has an exact
// solution, which makes it the reference problem for testing integrators.
// For a vertical spring, gravity only shifts the equilibrium, so it does not appear.
// params = { k (N/m), mass (kg), damping γ (1/s) }

export const derivative = ({ k, mass, damping }) => ([x, v]) => [v, -(k / mass) * x - 2 * damping * v];

/** E = ½·m·v² + ½·k·x² (J) */
export function energy([x, v], { k, mass }) {
    const ke = 0.5 * mass * v * v;
    const pe = 0.5 * k * x * x;
    return { ke, pe, total: ke + pe };
}

/** Natural angular frequency ω₀ = √(k/m). Critical damping occurs at γ = ω₀. */
export const naturalFrequency = ({ k, mass }) => Math.sqrt(k / mass);

/** Undamped period T₀ = 2π·√(m/k) (exact for this linear model). */
export const period = (params) => (2 * Math.PI) / naturalFrequency(params);

/**
 * Exact solution for release from rest at x₀, for all three damping regimes:
 * underdamped (γ < ω₀), critically damped (γ = ω₀), overdamped (γ > ω₀).
 */
export function exactPosition(x0, params, t) {
    const w0 = naturalFrequency(params);
    const g = params.damping;
    if (Math.abs(g - w0) < 1e-12 * w0) return x0 * (1 + w0 * t) * Math.exp(-w0 * t);
    if (g < w0) {
        const wd = Math.sqrt(w0 * w0 - g * g);
        return x0 * Math.exp(-g * t) * (Math.cos(wd * t) + (g / wd) * Math.sin(wd * t));
    }
    const s = Math.sqrt(g * g - w0 * w0);
    const r1 = -g + s;
    const r2 = -g - s;
    return (x0 / (r2 - r1)) * (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t));
}
