import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSimulation } from '../../src/simulation/useSimulation';
import { runFrames, pendingFrames } from './frames';

// A minimal simulation: a clock that advances with dt.
const clock = {
    init: (params) => ({ t: 0, start: params.start }),
    step(state, params, dt) {
        state.t += dt * params.speed;
        return state.t >= 1 && !state.done ? ((state.done = true), { type: 'reached-one' }) : null;
    },
};

function setup(params = { start: 0, speed: 1 }) {
    const renders = [];
    const events = [];
    const hook = renderHook(({ p }) => useSimulation(clock, p, {
        render: (state) => renders.push(state.t),
        onEvent: (e) => events.push(e),
    }), { initialProps: { p: params } });
    return { hook, renders, events };
}

describe('useSimulation (React adapter for the lifecycle)', () => {
    it('runs exactly one animation loop, stepping and rendering every frame', () => {
        const { renders } = setup();
        expect(pendingFrames()).toBe(1);
        runFrames(60);
        expect(pendingFrames()).toBe(1);
        expect(renders).toHaveLength(60);
        expect(renders.at(-1)).toBeCloseTo(59 / 60, 9); // the first frame has dt = 0
    });

    it('pause freezes the state, resume continues from it', () => {
        const { hook, renders } = setup();
        runFrames(10);
        act(() => hook.result.current.pause());
        expect(hook.result.current.isPaused).toBe(true);
        const frozen = renders.at(-1);
        runFrames(30);
        expect(renders.at(-1)).toBe(frozen); // still rendering, not stepping
        act(() => hook.result.current.resume());
        runFrames(1);
        expect(renders.at(-1)).toBeCloseTo(frozen + 1 / 60, 9);
    });

    it('togglePause flips between the two', () => {
        const { hook } = setup();
        act(() => hook.result.current.togglePause());
        expect(hook.result.current.isPaused).toBe(true);
        act(() => hook.result.current.togglePause());
        expect(hook.result.current.isPaused).toBe(false);
    });

    it('reset re-initialises the state', () => {
        const { hook, renders } = setup();
        runFrames(30);
        act(() => hook.result.current.reset());
        runFrames(1);
        expect(renders.at(-1)).toBeCloseTo(1 / 60, 9);
    });

    it('reads the latest parameters every frame without restarting the loop', () => {
        const { hook, renders } = setup();
        runFrames(2);
        hook.rerender({ p: { start: 0, speed: 10 } });
        runFrames(1);
        expect(renders.at(-1) - renders.at(-2)).toBeCloseTo(10 / 60, 9);
        expect(pendingFrames()).toBe(1);
    });

    it('delivers events from the simulation', () => {
        const { events } = setup();
        runFrames(70);
        expect(events).toEqual([{ type: 'reached-one' }]);
    });

    it('cancels its loop on unmount', () => {
        const { hook } = setup();
        hook.unmount();
        expect(pendingFrames()).toBe(0);
    });
});
