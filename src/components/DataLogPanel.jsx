import { useEffect, useState } from 'react';
import {
    LOG_INTERVALS, MAX_LOG_ROWS, clearLog, logHeader, startLogging, stopLogging,
} from '../simulation/dataLog';
import { toCsv } from '../utils/csv';
import { downloadText, timestampedName } from './download';
import controls from './SimulationControls.module.css';
import styles from './DataLogPanel.module.css';

/** How often the row counter is refreshed while recording (the samples themselves are not throttled). */
const COUNTER_REFRESH_MS = 250;

const intervalLabel = (s) => (s === 0 ? 'every step' : `every ${s} s`);

/**
 * Start / stop / clear / export controls for a data log (simulation/dataLog.js).
 * `log` is the mutable log the simulation writes into; `report()` returns
 * { name, metadata } for the exported file.
 */
export default function DataLogPanel({ log, report }) {
    const [, setVersion] = useState(0);
    const refresh = () => setVersion((v) => v + 1);
    const [sampleInterval, setSampleInterval] = useState(log.interval);

    useEffect(() => {
        if (!log.recording) return undefined;
        const timer = setInterval(refresh, COUNTER_REFRESH_MS);
        return () => clearInterval(timer);
    }, [log, log.recording]);

    const exportCsv = () => {
        const { name, metadata } = report();
        downloadText(timestampedName(name), toCsv({
            metadata: [...metadata, ['rows', log.rows.length], ['sampling', intervalLabel(log.interval)]],
            header: logHeader(log),
            rows: log.rows,
        }));
    };

    const rows = log.rows.length;
    return (
        <section className={styles.panel} aria-label="Data logging">
            <h3 className={styles.title}>Data logging</h3>
            <div className={styles.row}>
                <label htmlFor="log-interval">Sample</label>
                <select id="log-interval" className={controls.select} value={sampleInterval} disabled={log.recording}
                    onChange={(e) => setSampleInterval(Number(e.target.value))}>
                    {LOG_INTERVALS.map((s) => <option key={s} value={s}>{intervalLabel(s)}</option>)}
                </select>
            </div>
            <div className={styles.buttons}>
                {log.recording ? (
                    <button type="button" className={styles.stop} onClick={() => { stopLogging(log); refresh(); }}>■ Stop logging</button>
                ) : (
                    <button type="button" className={styles.start} disabled={log.full}
                        onClick={() => { startLogging(log, sampleInterval); refresh(); }}>● Start logging</button>
                )}
                <button type="button" className={styles.secondary} disabled={rows === 0}
                    onClick={() => { clearLog(log); refresh(); }}>Clear</button>
                <button type="button" className={styles.secondary} disabled={rows === 0} onClick={exportCsv}>Export CSV</button>
            </div>
            <p className={styles.status} aria-live="polite">
                {log.recording ? 'Recording: ' : ''}{rows.toLocaleString('en')} rows stored
                {log.full && ` (limit of ${MAX_LOG_ROWS.toLocaleString('en')} reached; logging stopped)`}
            </p>
        </section>
    );
}
