// Where the data logs live. A lab page is remounted whenever the address
// changes to another experiment (a guided preset, the Back button, an edited
// link), so a log owned by the page would be thrown away with it. The logs are
// kept here instead, above the routes, one per lab (and per mode where the
// columns differ), for as long as the tab is open.

import { createContext, useContext, useState } from 'react';
import { createDataLog, hasUnsavedRows } from './dataLog.js';

/** Map of log id → data log, provided by components/DataLogProvider.jsx. */
export const DataLogContext = createContext(null);

/**
 * The data log `id`, created with `columns` the first time it is asked for.
 * Without a provider (a page rendered on its own, as in unit tests) the log
 * belongs to the component and lives as long as it does.
 */
export function useDataLog(id, columns) {
    const shared = useContext(DataLogContext);
    const [own] = useState(() => new Map());
    const logs = shared ?? own;
    if (!logs.has(id)) logs.set(id, createDataLog(columns));
    return logs.get(id);
}

/** True when any log holds rows that have not been exported. */
export const anyUnsavedRows = (logs) => [...logs.values()].some(hasUnsavedRows);
