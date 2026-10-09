// Ideal projectile (no drag) over flat ground at y = 0, launched from (0, y0).
// launch = { v0 (m/s), theta (rad), g (m/s²), y0 (m, default 0) }. All functions are pure.
//
//   x(t) = v0 cosθ · t
//   y(t) = y0 + v0 sinθ · t − ½ g t²

const parts = ({ v0, theta, g, y0 = 0 }) => ({ vx: v0 * Math.cos(theta), vy: v0 * Math.sin(theta), g, y0 });

export function position(launch, t) {
    const { vx, vy, g, y0 } = parts(launch);
    return { x: vx * t, y: y0 + vy * t - 0.5 * g * t * t };
}

export function velocity(launch, t) {
    const { vx, vy, g } = parts(launch);
    return { vx, vy: vy - g * t };
}

/** State vector [x, y, vx, vy] at time t (same layout as the numerical model). */
export function stateAt(launch, t) {
    const p = position(launch, t);
    const v = velocity(launch, t);
    return [p.x, p.y, v.vx, v.vy];
}

/**
 * Time until y = 0: the positive root of y0 + vy·t − ½gt² = 0,
 * t = (vy + √(vy² + 2g·y0)) / g. Zero when launched at ground level with vy ≤ 0.
 */
export function flightTime(launch) {
    const { vy, g, y0 } = parts(launch);
    if (y0 <= 0 && vy <= 0) return 0;
    return Math.max(0, (vy + Math.sqrt(vy * vy + 2 * g * y0)) / g);
}

/** Horizontal distance from the launch point to the impact point. */
export const range = (launch) => Math.max(0, parts(launch).vx * flightTime(launch));

/** Highest y reached: y0 + vy²/2g when launched upward, otherwise y0. */
export function maxHeight(launch) {
    const { vy, g, y0 } = parts(launch);
    return vy > 0 ? y0 + (vy * vy) / (2 * g) : y0;
}

/** Velocity at impact: speed √(v0² + 2g·y0) (energy conservation) and angle below the horizontal. */
export function impactVelocity(launch) {
    const { vx, vy } = velocity(launch, flightTime(launch));
    return { vx, vy, speed: Math.hypot(vx, vy), angle: Math.atan2(-vy, vx) };
}

/** Same shape as flightMetrics() in flight.js, so analytical and numerical results compare directly. */
export function flightSummary(launch) {
    const impact = impactVelocity(launch);
    return {
        landed: true,
        range: range(launch),
        maxHeight: maxHeight(launch),
        time: flightTime(launch),
        impactSpeed: impact.speed,
        impactAngle: impact.angle,
    };
}
