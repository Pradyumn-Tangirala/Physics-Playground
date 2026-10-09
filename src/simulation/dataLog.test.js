import { describe, it, expect } from 'vitest';
import { clearLog, createDataLog, logHeader, recordSample, startLogging, stopLogging } from './dataLog';

const COLUMNS = [{ key: 't', label: 't', unit: 's' }, { key: 'x', label: 'x', unit: 'm' }, { key: 'method', label: 'method' }];
const feed = (log, times) => times.forEach((t) => recordSample(log, t, () => [t, 2 * t, 'rk4']));
const steps = (n, h) => Array.from({ length: n }, (_, i) => Number(((i + 1) * h).toFixed(10)));

describe('data log', () => {
    it('stores nothing until logging starts, and nothing after it stops', () => {
        const log = createDataLog(COLUMNS);
        feed(log, [0.1, 0.2]);
        expect(log.rows).toEqual([]);
        startLogging(log);
        feed(log, [0.3]);
        stopLogging(log);
        feed(log, [0.4]);
        expect(log.rows).toEqual([[1, 0.3, 0.6, 'rk4']]);
    });

    it('does not even build a row when no sample is due', () => {
        const log = createDataLog(COLUMNS);
        let built = 0;
        recordSample(log, 1, () => { built++; return [1, 2, 'x']; });
        expect(built).toBe(0);
    });

    it('records every step, or one sample per interval of simulated time', () => {
        const every = createDataLog(COLUMNS);
        startLogging(every, 0);
        feed(every, steps(100, 0.005));
        expect(every.rows).toHaveLength(100);

        const sparse = createDataLog(COLUMNS);
        startLogging(sparse, 0.05);
        feed(sparse, steps(100, 0.005)); // 0.005 … 0.5 s
        expect(sparse.rows.map((r) => r[1])).toEqual([0.005, 0.055, 0.105, 0.155, 0.205, 0.255, 0.305, 0.355, 0.405, 0.455]);
    });

    it('starts a new run when the simulation clock goes back (a reset)', () => {
        const log = createDataLog(COLUMNS);
        startLogging(log);
        feed(log, [0.1, 0.2, 0.05, 0.1]);
        expect(log.rows.map((r) => r[0])).toEqual([1, 1, 2, 2]);
    });

    it('stores several rows per sample (one per method)', () => {
        const log = createDataLog(COLUMNS);
        startLogging(log);
        recordSample(log, 0.1, () => [[0.1, 1, 'euler'], [0.1, 2, 'rk4']]);
        expect(log.rows).toEqual([[1, 0.1, 1, 'euler'], [1, 0.1, 2, 'rk4']]);
    });

    it('stops itself at the row limit and refuses to restart until cleared', () => {
        const log = createDataLog(COLUMNS, { maxRows: 3 });
        startLogging(log);
        feed(log, steps(10, 0.1));
        expect(log.rows).toHaveLength(3);
        expect(log).toMatchObject({ full: true, recording: false });
        startLogging(log);
        expect(log.recording).toBe(false);
        clearLog(log);
        expect(log).toMatchObject({ rows: [], full: false });
        startLogging(log);
        expect(log.recording).toBe(true);
    });

    it('labels columns with their units, after the run number', () => {
        expect(logHeader(createDataLog(COLUMNS))).toEqual(['run', 't (s)', 'x (m)', 'method']);
    });
});
