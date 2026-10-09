import { useRef, useState } from 'react';
import { createSimulation } from './simulationState.js';
import { useAnimationLoop } from './useAnimationLoop.js';

/**
 * Connects a simulation definition to React:
 * - the mutable simulation lives in a ref (it changes every frame and must
 *   not trigger re-renders),
 * - one animation loop calls tick → onEvent → render with the latest
 *   `params`, `render`, `onEvent` and `onSample` from the current render (no
 *   stale closures); `onSample(t, data)` runs after every integration step,
 * - `isPaused` is mirrored into React state only so the UI can show it.
 *
 * Returns { simRef, isPaused, pause, resume, togglePause, reset }.
 */
export function useSimulation(definition, params, { render, onEvent, onSample } = {}) {
    const simRef = useRef(null);
    if (simRef.current === null) {
        simRef.current = createSimulation(definition, params);
    }
    const [isPaused, setIsPaused] = useState(false);

    useAnimationLoop((dt) => {
        const sim = simRef.current;
        const event = sim.tick(dt, params, onSample);
        if (event) onEvent?.(event);
        render?.(sim.getState(), params);
    });

    const pause = () => {
        simRef.current.pause();
        setIsPaused(true);
    };
    const resume = () => {
        simRef.current.resume();
        setIsPaused(false);
    };

    return {
        simRef,
        isPaused,
        pause,
        resume,
        togglePause: () => (simRef.current.isPaused() ? resume() : pause()),
        reset: (nextParams = params) => simRef.current.reset(nextParams),
    };
}
