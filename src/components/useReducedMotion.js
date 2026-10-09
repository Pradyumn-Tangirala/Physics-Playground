import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const subscribe = (onChange) => {
    const mq = window.matchMedia?.(QUERY);
    mq?.addEventListener('change', onChange);
    return () => mq?.removeEventListener('change', onChange);
};
const getSnapshot = () => window.matchMedia?.(QUERY).matches ?? false;

/** True when the user asked the system for reduced motion; updates live if the setting changes. */
export function useReducedMotion() {
    return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
