import { useEffect, useState } from 'react';
import { DataLogContext, anyUnsavedRows } from '../simulation/dataLogStore';

/**
 * Keeps the data logs for the whole session (see simulation/dataLogStore.js),
 * and asks the browser to confirm a reload or close while a log holds rows
 * that have not been exported: those exist only in this tab's memory.
 */
export default function DataLogProvider({ children }) {
    const [logs] = useState(() => new Map());

    useEffect(() => {
        const warn = (event) => {
            if (!anyUnsavedRows(logs)) return;
            event.preventDefault();
            event.returnValue = ''; // still required by some browsers to show the prompt
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [logs]);

    return <DataLogContext value={logs}>{children}</DataLogContext>;
}
