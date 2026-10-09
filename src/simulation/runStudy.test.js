import { describe, it, expect, vi, afterEach } from 'vitest';
import { STUDIES } from './studies';

const COST = { amplitude: Math.PI / 3, length: 1, g: 9.81, integratorIds: ['rk4'], dts: [0.1], duration: 10 };

/** A stand-in for Worker that runs the study in-process, asynchronously, as the real worker would. */
class FakeWorker {
    static created = 0;
    constructor() {
        FakeWorker.created += 1;
    }
    postMessage({ id, name, args }) {
        setTimeout(() => this.onmessage({ data: { id, result: STUDIES[name](args) } }), 0);
    }
    terminate() {}
}

/** A Worker whose script fails to load. */
class BrokenWorker {
    postMessage() {
        setTimeout(() => this.onerror({ preventDefault() {} }), 0);
    }
    terminate() {}
}

async function freshRunStudy() {
    vi.resetModules(); // runStudy keeps one worker per page; start each test from none
    return (await import('./runStudy')).runStudy;
}

afterEach(() => vi.unstubAllGlobals());

describe('runStudy', () => {
    it('runs on the main thread where there are no workers, with the same result', async () => {
        vi.stubGlobal('Worker', undefined);
        const runStudy = await freshRunStudy();
        const [row] = await runStudy('accuracyVsCost', COST);
        expect(row.method).toBe('rk4');
        expect(row.evaluations).toBe(400);
        expect(row.maxError).toBeCloseTo(7.30e-4, 5);
        expect(row.seconds).toBeGreaterThan(0); // timed with performance.now
    });

    it('posts studies to one reused worker', async () => {
        FakeWorker.created = 0;
        vi.stubGlobal('Worker', FakeWorker);
        const runStudy = await freshRunStudy();
        const [cost, periods] = await Promise.all([
            runStudy('accuracyVsCost', COST),
            runStudy('periodVsAmplitude', { amplitudesDeg: [30, 90], length: 1, g: 9.81, integratorId: 'rk4', dt: 0.01 }),
        ]);
        expect(cost).toHaveLength(1);
        expect(periods.map((r) => r.amplitudeDeg)).toEqual([30, 90]);
        periods.forEach((r) => expect(Math.abs(r.relativeError)).toBeLessThan(1e-7));
        expect(FakeWorker.created).toBe(1);
    });

    it('falls back to the main thread if the worker fails to start', async () => {
        vi.stubGlobal('Worker', BrokenWorker);
        const runStudy = await freshRunStudy();
        const [row] = await runStudy('accuracyVsCost', COST);
        expect(row.maxError).toBeCloseTo(7.30e-4, 5);
    });
});
