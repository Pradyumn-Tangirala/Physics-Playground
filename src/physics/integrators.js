// Numerical integrators for first-order ODE systems  dy/dt = f(y, t).
//
// Every integrator has the same API:
//
//     integrator.step(y, f, h, t = 0) → y_next
//
//   y : number[]               current state vector (not modified)
//   f : (y, t) → number[]      derivative function, returns dy/dt
//   h : number                 step size (s)
//
// They know nothing about pendulums or springs: a model only supplies `f`.
// Pure functions: no React, no Canvas, no hidden state.

/** y + s·k, element-wise (returns a new array). */
const addScaled = (y, k, s) => y.map((yi, i) => yi + s * k[i]);

/**
 * Explicit (forward) Euler:  y₁ = y₀ + h·f(y₀, t₀)
 * One derivative evaluation per step. Local error O(h²), global error O(h).
 */
export const explicitEuler = {
    id: 'euler',
    name: 'Explicit Euler',
    order: 1,
    evaluationsPerStep: 1,
    step(y, f, h, t = 0) {
        return addScaled(y, f(y, t), h);
    },
};

/**
 * Symplectic (semi-implicit) Euler, "kick then drift":
 *     v₁ = v₀ + h·a(q₀, v₀)        (velocity update uses the old position)
 *     q₁ = q₀ + h·v₁               (position update uses the NEW velocity)
 *
 * Requires the state to be laid out as [q₁…qₘ, v₁…vₘ] with dq/dt = v, i.e. a
 * second-order mechanical system written in first-order form. That is true for
 * every model in this project. For forces that do not depend on velocity it is
 * area-preserving in phase space (symplectic), so energy errors stay bounded.
 * One derivative evaluation per step. Global error O(h).
 */
export const symplecticEuler = {
    id: 'symplectic',
    name: 'Symplectic Euler',
    order: 1,
    evaluationsPerStep: 1,
    step(y, f, h, t = 0) {
        const m = y.length / 2;
        const dydt = f(y, t);
        const next = new Array(y.length);
        for (let i = 0; i < m; i++) {
            next[m + i] = y[m + i] + h * dydt[m + i]; // kick:  v₁ = v₀ + h·a(q₀, v₀)
            next[i] = y[i] + h * next[m + i];         // drift: q₁ = q₀ + h·v₁
        }
        return next;
    },
};

/**
 * Classical fourth-order Runge–Kutta. Four derivative evaluations per step:
 *     k₁ = f(y₀,            t₀)          slope at the start
 *     k₂ = f(y₀ + h/2·k₁,   t₀ + h/2)    slope at the midpoint, using k₁
 *     k₃ = f(y₀ + h/2·k₂,   t₀ + h/2)    slope at the midpoint, using k₂
 *     k₄ = f(y₀ + h·k₃,     t₀ + h)      slope at the end, using k₃
 *     y₁ = y₀ + h/6·(k₁ + 2k₂ + 2k₃ + k₄)
 * The 1-2-2-1 weights make the update match the Taylor series of the exact
 * solution through the h⁴ term: local error O(h⁵), global error O(h⁴).
 */
export const rk4 = {
    id: 'rk4',
    name: 'RK4',
    order: 4,
    evaluationsPerStep: 4,
    step(y, f, h, t = 0) {
        const k1 = f(y, t);
        const k2 = f(addScaled(y, k1, h / 2), t + h / 2);
        const k3 = f(addScaled(y, k2, h / 2), t + h / 2);
        const k4 = f(addScaled(y, k3, h), t + h);
        return y.map((yi, i) => yi + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    },
};

export const INTEGRATORS = {
    [explicitEuler.id]: explicitEuler,
    [symplecticEuler.id]: symplecticEuler,
    [rk4.id]: rk4,
};

export const INTEGRATOR_LIST = [explicitEuler, symplecticEuler, rk4];

/** Integrates from t = 0 for `steps` steps; returns the final state. Handy for tests and experiments. */
export function integrate(integrator, y0, f, h, steps) {
    let y = y0;
    for (let n = 0; n < steps; n++) y = integrator.step(y, f, h, n * h);
    return y;
}
