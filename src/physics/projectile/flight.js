// Numerical flight: integrates the drag model (k = 0 → ideal model) with any
// integrator from ../integrators.js on a fixed step h, and locates the apex
// (vy = 0) and the landing (y = 0) inside the step where they happen.
//
// Event location uses cubic Hermite interpolation between the two step
// endpoints (see analysis.js), not a straight line: for the ideal model the
// trajectory is a polynomial, so the landing point found this way is exact,
// and with drag its error is O(h⁴) — never larger than RK4's own error.

import { derivative, peakSpeed, terminalSpeed } from './drag.js';
import { locateCrossing } from '../analysis.js';

/** Flights that have not landed after this long are abandoned (s). */
export const MAX_FLIGHT_TIME = 600;

/** A numerical speed this far above the physical maximum means the method has gone unstable. */
const SPEED_MARGIN = 1.5;
/** m/s. A horizontal velocity this far below zero is a real sign reversal, not round-off. */
const REVERSAL_TOLERANCE = 1e-9;

/** State vector [x, y, vx, vy] at launch. */
export const initialState = ({ v0, theta, y0 = 0 }) => [0, y0, v0 * Math.cos(theta), v0 * Math.sin(theta)];

/**
 * A flight in progress. Time is kept as an integer step count (t = steps·h) so
 * it never accumulates round-off, and comparisons with the analytical
 * solution happen at exactly the same instants.
 *
 * `diverged` marks a solution that blew up or became non-physical: the exact
 * solution never moves faster than peakSpeed() (see drag.js) and never
 * reverses horizontally (vx' = −k|v|vx cannot change the sign of vx). An
 * explicit method with too large a step for the drag can violate both.
 */
export function createFlight(launch, k = 0) {
    const y = initialState(launch);
    const onGround = y[1] <= 0 && y[3] <= 0;
    const dragFreeImpact = Math.sqrt(launch.v0 ** 2 + 2 * launch.g * Math.max(0, y[1]));
    return {
        g: launch.g,
        k,
        y,
        maxSpeed: SPEED_MARGIN * peakSpeed(launch.v0, dragFreeImpact, terminalSpeed(launch.g, k)),
        steps: 0,
        t: 0,
        apex: y[3] > 0 ? null : { t: 0, state: y },
        landing: onGround ? { t: 0, state: y } : null,
        diverged: false,
    };
}

/** Advances one step of size h (mutates `flight`). Does nothing once landed or diverged. */
export function advanceFlight(flight, f, integrator, h) {
    if (flight.landing || flight.diverged) return;
    const t0 = flight.steps * h;
    const y0 = flight.y;
    const y1 = integrator.step(y0, f, h, t0);
    flight.steps += 1;
    flight.t = flight.steps * h;

    if (!y1.every(Number.isFinite) || Math.hypot(y1[2], y1[3]) > flight.maxSpeed || (y0[2] >= 0 && y1[2] < -REVERSAL_TOLERANCE)) {
        flight.diverged = true;
        return;
    }
    if (!flight.apex && y0[3] > 0 && y1[3] <= 0) {
        const { s, state } = locateCrossing(y0, f(y0), y1, f(y1), h, 3);
        flight.apex = { t: t0 + s * h, state };
    }
    if (y0[1] > 0 && y1[1] <= 0) {
        const { s, state } = locateCrossing(y0, f(y0), y1, f(y1), h, 1);
        state[1] = 0;
        flight.landing = { t: t0 + s * h, state };
        flight.t = flight.landing.t;
        flight.y = state;
        return;
    }
    flight.y = y1;
}

/**
 * Integrates a whole flight. `visit(t, y)` (optional) is called at launch and
 * after every step that ends in the air — i.e. at t = 0, h, 2h, … — which is
 * what error measurements against a reference need.
 */
export function simulateFlight({ launch, k = 0, integrator, dt, maxTime = MAX_FLIGHT_TIME, visit }) {
    const f = derivative({ g: launch.g, k });
    const flight = createFlight(launch, k);
    visit?.(0, flight.y);
    const maxSteps = Math.ceil(maxTime / dt);
    while (!flight.landing && !flight.diverged && flight.steps < maxSteps) {
        advanceFlight(flight, f, integrator, dt);
        if (!flight.landing && !flight.diverged) visit?.(flight.t, flight.y);
    }
    return flight;
}

/**
 * Range, max height, time of flight and impact velocity of a finished flight.
 * Every value is NaN if the flight went unstable or did not land within the time limit.
 */
export function flightMetrics(flight) {
    if (!flight.landing) {
        return { landed: false, range: NaN, maxHeight: NaN, time: NaN, impactSpeed: NaN, impactAngle: NaN };
    }
    const [x, , vx, vy] = flight.landing.state;
    return {
        landed: true,
        range: x,
        maxHeight: flight.apex ? flight.apex.state[1] : NaN,
        time: flight.landing.t,
        impactSpeed: Math.hypot(vx, vy),
        impactAngle: Math.atan2(-vy, vx),
    };
}
