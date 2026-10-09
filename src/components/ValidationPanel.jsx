import { errorAgainst } from '../physics/analysis';
import { formatMeasurement, formatPercent, formatScientific } from '../utils/format';
import ScrollRegion from './ScrollRegion';
import styles from './ValidationPanel.module.css';

/**
 * Analytical result vs simulated result, with absolute and relative error.
 *
 * rows: [{ quantity, reference (how the analytical value is obtained),
 *          analytical, simulated, unit, scale? (what the relative error is relative to),
 *          unavailable? (text shown instead of numbers) }]
 */
export default function ValidationPanel({ title = 'Validation', rows, caption, compact = false }) {
    return (
        <section className={`${styles.panel} ${compact ? styles.compact : ''}`} aria-label={title}>
            <h3 className={styles.title}>{title}</h3>
            <ScrollRegion label={`${title} table`}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th scope="col">Quantity</th>
                            <th scope="col">Analytical</th>
                            <th scope="col">Simulated</th>
                            <th scope="col">Abs. error</th>
                            <th scope="col">Rel. error</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => <ValidationRow key={row.quantity} {...row} />)}
                    </tbody>
                </table>
            </ScrollRegion>
            {caption && <p className={styles.caption}>{caption}</p>}
        </section>
    );
}

function ValidationRow({ quantity, reference, analytical, simulated, unit = '', scale, unavailable }) {
    const label = (
        <th scope="row">
            {quantity}
            {reference && <span className={styles.reference}>{reference}</span>}
        </th>
    );
    if (unavailable) {
        return <tr>{label}<td colSpan={4} className={styles.unavailable}>{unavailable}</td></tr>;
    }
    const ready = Number.isFinite(analytical) && Number.isFinite(simulated);
    const { absolute, relative } = ready ? errorAgainst(analytical, simulated, scale) : { absolute: NaN, relative: NaN };
    const withUnit = (text) => (text === '—' || !unit ? text : `${text} ${unit}`);
    return (
        <tr>
            {label}
            <td>{withUnit(formatMeasurement(analytical))}</td>
            <td>{Number.isFinite(simulated) ? withUnit(formatMeasurement(simulated)) : 'measuring…'}</td>
            <td>{ready ? withUnit(formatScientific(absolute)) : '—'}</td>
            <td>{ready ? formatPercent(relative) : '—'}</td>
        </tr>
    );
}
