// Manual requestAnimationFrame for UI tests: frames run only when a test asks.

import { act } from '@testing-library/react';

let queue = new Map();
let nextId = 1;
let now = 0;

export function installFrameScheduler() {
    globalThis.requestAnimationFrame = (cb) => {
        const id = nextId++;
        queue.set(id, cb);
        return id;
    };
    globalThis.cancelAnimationFrame = (id) => {
        queue.delete(id);
    };
}

export function resetFrames() {
    queue = new Map();
    now = 0;
}

/** Callbacks waiting for the next frame — one per running animation loop. */
export const pendingFrames = () => queue.size;

/** Runs `n` frames, `dtMs` apart, flushing React updates after each. */
export function runFrames(n, dtMs = 1000 / 60) {
    for (let i = 0; i < n; i++) {
        const callbacks = [...queue.values()];
        queue = new Map();
        now += dtMs;
        act(() => {
            for (const cb of callbacks) cb(now);
        });
    }
}
