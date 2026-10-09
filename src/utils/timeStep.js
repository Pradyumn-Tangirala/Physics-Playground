// Time-stepping helpers. The animation loop measures real elapsed time; these
// turn it into safe, frame-rate-independent simulation steps.

/** Longest frame delta handed to a simulation (s); avoids jumps after a tab was hidden. */
export const MAX_FRAME_DT = 0.1;

/** Fixed integration steps offered in the UI (s). */
export const TIMESTEP_OPTIONS = [0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1];

/** Enough steps of size dt to keep up with the longest allowed frame, sped up `speed`×. */
export const maxStepsFor = (dt, speed = 1) => Math.ceil((MAX_FRAME_DT * speed) / dt) + 1;

/** Converts two rAF timestamps (ms) into a clamped delta in seconds. */
export const frameDelta = (nowMs, lastMs) =>
    lastMs === null ? 0 : Math.min(Math.max(0, (nowMs - lastMs) / 1000), MAX_FRAME_DT);

/**
 * Fixed-timestep accumulator. Advances `state` by `elapsed` seconds in steps
 * of exactly `h` using `step(state, h)`, carrying the remainder in the
 * returned `accumulator`. Work per call is capped at `maxSteps`; any backlog
 * beyond that is dropped instead of spiralling.
 */
export function advanceFixed(state, step, elapsed, accumulator, { h, maxSteps }) {
    let acc = accumulator + elapsed;
    let next = state;
    let steps = 0;
    while (acc >= h && steps < maxSteps) {
        next = step(next, h);
        acc -= h;
        steps++;
    }
    if (steps === maxSteps) acc = 0;
    return { state: next, accumulator: acc };
}
