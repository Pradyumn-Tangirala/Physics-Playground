// Data logging: stores simulation samples while recording is on. Pure data —
// the simulation calls recordSample() from its step loop, the UI starts,
// stops, clears and exports.
//
// Samples are taken at the simulation's own steps (not at display frames), at
// most one per `interval` of simulated time (0 = every step). If the
// simulation clock runs backwards (a reset), a new run starts and the run
// number in the first column increases.

/** Rows kept before logging stops itself; ~200 k rows of 15 numbers is about 25 MB of JS arrays. */
export const MAX_LOG_ROWS = 200_000;

/** Sampling intervals offered in the UI (s of simulated time); 0 means every integration step. */
export const LOG_INTERVALS = [0, 0.01, 0.05, 0.1];

/** columns: [{ key, label, unit? }], not counting the run column added in front. */
export function createDataLog(columns, { maxRows = MAX_LOG_ROWS } = {}) {
    return { columns, rows: [], recording: false, interval: 0, run: 0, nextTime: 0, lastTime: -Infinity, full: false, maxRows };
}

export function startLogging(log, interval = log.interval) {
    if (log.full) return;
    log.recording = true;
    log.interval = interval;
    log.run += 1;
    log.nextTime = -Infinity;
    log.lastTime = -Infinity;
}

export function stopLogging(log) {
    log.recording = false;
}

export function clearLog(log) {
    log.rows = [];
    log.run = log.recording ? 1 : 0;
    log.full = false;
    log.nextTime = -Infinity;
    log.lastTime = -Infinity;
}

/** Tolerance for "is it time for a sample yet", so t = 0.03 is not skipped as 0.0299999. */
const TIME_EPSILON = 1e-9;

/**
 * Offers a sample at simulated time t. `makeRows()` is called only if a
 * sample is due and returns one row or several (e.g. one per integrator), each
 * an array of column values. Returns true if anything was stored.
 */
export function recordSample(log, t, makeRows) {
    if (!log.recording) return false;
    if (t < log.lastTime) {
        log.run += 1;
        log.nextTime = -Infinity;
    }
    log.lastTime = t;
    if (t < log.nextTime - TIME_EPSILON) return false;
    if (log.interval <= 0) {
        log.nextTime = t;
    } else {
        // Stay on a regular grid of sample times; restart it after a gap (e.g. a drag).
        log.nextTime = Number.isFinite(log.nextTime) ? log.nextTime + log.interval : t + log.interval;
        if (log.nextTime <= t) log.nextTime = t + log.interval;
    }

    const made = makeRows();
    const rows = Array.isArray(made[0]) ? made : [made];
    for (const row of rows) {
        if (log.rows.length >= log.maxRows) {
            log.full = true;
            log.recording = false;
            return true;
        }
        log.rows.push([log.run, ...row]);
    }
    return true;
}

/** Header labels including units, e.g. "t (s)". */
export const logHeader = (log) => ['run', ...log.columns.map((c) => (c.unit ? `${c.label} (${c.unit})` : c.label))];
