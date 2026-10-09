import ScrollRegion from '../../components/ScrollRegion';
import controls from '../../components/SimulationControls.module.css';
import { RUNS } from '../../simulation/projectileSimulation';
import { formatMilliseconds } from '../../utils/format';
import { radToDeg } from '../../utils/units';
import styles from '../LabPage.module.css';

const fixed = (v, digits) => (Number.isFinite(v) ? v.toFixed(digits) : '—');

/** Predicted range, height, time and impact of every trajectory, plus the CSV export. */
export default function FlightMetrics({ p, predictions, integratorName, onExport }) {
    const ideal = predictions.find((r) => r.id === 'analytic').metrics;
    const drag = predictions.find((r) => r.id === 'drag');
    return (
    <section className={styles.card} aria-labelledby="metrics-title">
        <h2 id="metrics-title">Flight metrics</h2>
        <p className={styles.caption}>
        Predicted for the current settings with the same solver a shot uses, so they update as you move the
        sliders. Range is the horizontal displacement at impact; the live horizontal displacement x, height y
        and speed |v| of each shot are shown on the canvas during flight.
        </p>
        <ScrollRegion label="Flight metrics table">
        <table className={styles.table}>
            <thead>
                <tr>
                    <th>Trajectory</th><th>Solver</th><th>Range (m)</th><th>Max height (m)</th>
                    <th>Time of flight (s)</th><th>Impact speed (m/s)</th><th>Impact angle</th>
                </tr>
            </thead>
            <tbody>
                {predictions.map((r) => (
                    <tr key={r.id}>
                        <td style={{ color: RUNS[r.id].color }}>{RUNS[r.id].label}</td>
                        <td>{r.id === 'analytic' ? 'closed form' : `${integratorName}, Δt = ${formatMilliseconds(p.dt)}`}</td>
                        <td>{fixed(r.metrics.range, 3)}</td>
                        <td>{fixed(r.metrics.maxHeight, 3)}</td>
                        <td>{fixed(r.metrics.time, 4)}</td>
                        <td>{fixed(r.metrics.impactSpeed, 3)}</td>
                        <td>{Number.isFinite(r.metrics.impactAngle) ? `${radToDeg(r.metrics.impactAngle).toFixed(2)}°` : '—'}</td>
                    </tr>
                ))}
            </tbody>
        </table>
        </ScrollRegion>
        {drag?.metrics.landed && ideal.range > 0 && (
        <p className={styles.caption}>
            Drag shortens the range by <strong>{(100 * (1 - drag.metrics.range / ideal.range)).toFixed(1)}%</strong>
            {ideal.maxHeight > p.height && (
                <>, lowers the rise above the launch point by <strong>
                    {(100 * (1 - (drag.metrics.maxHeight - p.height) / (ideal.maxHeight - p.height))).toFixed(1)}%</strong></>
            )} and cuts the impact speed from {fixed(ideal.impactSpeed, 1)} to {fixed(drag.metrics.impactSpeed, 1)} m/s.
            It comes down at {radToDeg(drag.metrics.impactAngle).toFixed(1)}° after launching at {p.angleDeg}°, because
            drag has removed horizontal speed by then.
        </p>
        )}
        {predictions.some((r) => !r.metrics.landed) && (
        <p className={styles.caption}>
            "—" means the numerical solution {predictions.some((r) => r.diverged)
                ? 'went unstable (it moved faster than physically possible or reversed direction; reduce Δt)'
                : 'did not land within the time limit'}.
        </p>
        )}
        <div className={styles.experimentControls}>
        <button type="button" className={`${controls.secondaryButton} ${controls.actionButton}`} onClick={onExport}>
            Export flight data (CSV)
        </button>
        <span>Every integration step of every trajectory: t, position, velocity, energy, method and parameters.</span>
        </div>
    </section>
    );
}
