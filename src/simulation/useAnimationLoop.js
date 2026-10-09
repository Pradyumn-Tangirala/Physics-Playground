import { useEffect, useRef } from 'react';
import { frameDelta } from '../utils/timeStep.js';

/**
 * Runs `callback(dt, now)` once per display frame using exactly one
 * requestAnimationFrame chain for the lifetime of the component.
 *
 * - `dt` is the real elapsed time since the previous frame in seconds,
 *   clamped by `frameDelta` (0 on the first frame).
 * - The callback is read from a ref each frame, so it always sees the
 *   latest props/state (no stale closures) and re-renders never restart
 *   the loop or reset simulation state.
 * - The single pending frame is cancelled on unmount (cleanup).
 */
export function useAnimationLoop(callback) {
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    });

    useEffect(() => {
        let frameId = 0;
        let last = null;

        const tick = (now) => {
            const dt = frameDelta(now, last);
            last = now;
            callbackRef.current(dt, now);
            frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameId);
    }, []);
}
