// Point-mass projectile with quadratic air resistance. SI units throughout.
//
//   F_drag = −½ ρ C_d A |v| v
//   a      = (0, −g) − k |v| v,      k = ρ C_d A / (2m)   [1/m]
//
// State vector y = [x, y, vx, vy] (positions first, then velocities, so the
// generic integrators — including symplectic Euler — apply unchanged).
//
// air = { rho (kg/m³), cd (–), area (m²), mass (kg) }. k = 0 is the ideal model.

/** k = ρ C_d A / (2m) in 1/m; zero when there is no air (or no drag area). */
export const dragConstant = ({ rho, cd, area, mass }) => (rho * cd * area) / (2 * mass);

/** Terminal speed √(g/k) (m/s), where drag balances weight; Infinity without drag. */
export const terminalSpeed = (g, k) => (k > 0 ? Math.sqrt(g / k) : Infinity);

/** dy/dt for the state [x, y, vx, vy] with gravity g and drag constant k. */
export const derivative = ({ g, k }) => ([, , vx, vy]) => {
    const speed = Math.hypot(vx, vy);
    return [vx, vy, -k * speed * vx, -g - k * speed * vy];
};

/** Mechanical energy relative to the ground: KE = ½m|v|², PE = m·g·y. */
export function energy([, y, vx, vy], { g, mass }) {
    const ke = 0.5 * mass * (vx * vx + vy * vy);
    const pe = mass * g * y;
    return { ke, pe, total: ke + pe };
}

/** Rate at which drag removes mechanical energy: P = F·v = −m·k·|v|³ (W, never positive). */
export const dragPower = ([, , vx, vy], { k, mass }) => -mass * k * Math.hypot(vx, vy) ** 3;

/**
 * Exact results for a purely vertical launch with drag (used to validate the
 * numerical solver — there is no closed form for the general 2-D case).
 * Going up, v' = −g(1 + v²/v_t²), which integrates to
 *   t_apex = (v_t/g)·atan(v0/v_t),   h_apex = (v_t²/2g)·ln(1 + v0²/v_t²).
 */
export function verticalApex(v0, g, k) {
    const vt = terminalSpeed(g, k);
    return {
        time: (vt / g) * Math.atan(v0 / vt),
        height: ((vt * vt) / (2 * g)) * Math.log1p((v0 * v0) / (vt * vt)),
    };
}

/** Exact speed after falling from rest for time t with drag: v_t·tanh(g t / v_t). */
export const fallSpeed = (t, g, k) => {
    const vt = terminalSpeed(g, k);
    return vt * Math.tanh((g * t) / vt);
};

/**
 * Stiffness number λ·Δt of the drag term at a given speed. Linearising
 * a = −k|v|v about speed v gives decay rates k·v (across the path) and 2k·v
 * (along it). Explicit and symplectic Euler are stable for 2k·v·Δt < 2,
 * RK4 for < 2.79 (where its stability region meets the negative real axis).
 * These are linear limits at speed v; because drag itself lowers v, a method
 * just past its limit is inaccurate in the first steps rather than blowing up
 * (measured in PROJECTILE_MODEL.md).
 */
export const dragStiffness = (k, speed, dt) => 2 * k * speed * dt;

/**
 * Upper bound on the speed during a flight with drag. Above v_t the speed can
 * only fall (drag outweighs gravity), and drag only removes energy, so the
 * speed never exceeds max(v0, min(v_t, drag-free impact speed)).
 */
export const peakSpeed = (v0, impactSpeedWithoutDrag, vt) => Math.max(v0, Math.min(impactSpeedWithoutDrag, vt));
