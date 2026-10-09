import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { decodeParams, encodeParams } from './urlParams.js';
import { rememberShownSearch } from './shownExperiment.js';

/**
 * Wait this long after the last parameter change before rewriting the URL.
 * Writing on every slider movement would flood the history API (Safari
 * throws after 100 replaceState calls in 30 s).
 */
const URL_SYNC_DELAY_MS = 500;

/**
 * The experiment described by the current URL, read once when the page
 * mounts: { params, rejected }. Later URL changes remount the page (see
 * ExperimentRoute), so the page never has to merge them into live state.
 */
export function useExperimentFromUrl(lab) {
    const { pathname, search } = useLocation();
    const [experiment] = useState(() => {
        rememberShownSearch(pathname, search);
        return decodeParams(lab.fields, search);
    });
    return experiment;
}

/** Absolute link that reopens this experiment (works under any base path). */
const shareableLink = (path) => `${window.location.origin}${window.location.pathname}#${path}`;

/** The route and query currently in the hash, e.g. ['/shm', '?mode=spring']. */
function addressNow() {
    const hash = window.location.hash.slice(1);
    const q = hash.indexOf('?');
    return q === -1 ? [hash, ''] : [hash.slice(0, q), hash.slice(q)];
}

/**
 * Keeps the address bar's query in step with `params` (debounced, replacing
 * the history entry) and returns the shareable link for the current parameters.
 *
 * The history entry is rewritten directly rather than through the router: the
 * parameters are already in React state, so the router has nothing to do. A
 * write only happens while the address still shows what this page put there.
 * If the user has meanwhile navigated, even to the same route with other
 * parameters (a preset, the Back button), the pending write is dropped.
 */
export function useExperimentUrl(lab, params) {
    const { pathname, search } = useLocation();
    const owned = useRef(search); // the query this page instance was opened with or last wrote
    const query = encodeParams(lab.fields, params);

    useEffect(() => {
        const timer = setTimeout(() => {
            const [path, current] = addressNow();
            if (path !== pathname || current !== owned.current) return;
            owned.current = `?${query}`;
            rememberShownSearch(pathname, owned.current);
            const { pathname: base, search: pageSearch } = window.location;
            window.history.replaceState(window.history.state, '', `${base}${pageSearch}#${pathname}${owned.current}`);
        }, URL_SYNC_DELAY_MS);
        return () => clearTimeout(timer);
    }, [pathname, query]);

    return shareableLink(`${pathname}?${query}`);
}
