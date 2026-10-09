import { useEffect, useRef, useState } from 'react';

/** Refresh rate for numbers read from a running simulation: readable, and cheap in React renders. */
const READOUT_REFRESH_MS = 250;

/**
 * Re-reads `read()` every `intervalMs` and returns the latest result, for
 * text readouts of values that change every frame (the canvas shows them
 * live; React only needs to refresh the numbers a few times a second).
 */
export function useLiveValue(read, intervalMs = READOUT_REFRESH_MS) {
    const readRef = useRef(read);
    useEffect(() => {
        readRef.current = read;
    });
    const [value, setValue] = useState(read);
    useEffect(() => {
        const timer = setInterval(() => setValue(readRef.current()), intervalMs);
        return () => clearInterval(timer);
    }, [intervalMs]);
    return value;
}
