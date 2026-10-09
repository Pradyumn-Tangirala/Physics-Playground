import SimulationCanvas from '../../components/SimulationCanvas';
import ScrollRegion from '../../components/ScrollRegion';
import controls from '../../components/SimulationControls.module.css';
import { METHOD_COLORS } from '../../rendering/comparisonRenderer';
import { INTEGRATOR_LIST } from '../../physics/integrators';
import { ERROR_METRICS, REFERENCE_DT } from '../../physics/projectile/experiments';
import { TIMESTEP_OPTIONS } from '../../utils/timeStep';
import { formatMilliseconds } from '../../utils/format';
import styles from '../LabPage.module.css';

/** Controls, chart and table of the convergence study (the chart is drawn by the page's animation loop). */
export default function ConvergenceStudy({ study, canvasRef }) {
    const { result } = study;
    return (
        <section className={styles.card} aria-labelledby="convergence-title">
            <h2 id="convergence-title">Experiment: timestep convergence</h2>
            <p className={styles.caption}>
                Flies the current launch with every method at every Δt from 0.5 ms to 100 ms and measures the error
                against a reference. Without drag the reference is the analytical solution. With drag there is no
                closed form, so the reference is RK4 at Δt = {REFERENCE_DT * 1000} ms (its own range error is about
                10⁻¹¹ m; see PROJECTILE_MODEL.md). On a log–log plot, error ∝ Δtⁿ is a straight line of slope n.
            </p>
            <div className={styles.experimentControls}>
                <label htmlFor="conv-drag">Air resistance</label>
                <select id="conv-drag" className={controls.select} value={study.drag ? 'on' : 'off'}
                    onChange={(e) => study.setDrag(e.target.value === 'on')}>
                    <option value="off">Off (reference: analytical)</option>
                    <option value="on">On (reference: fine-step RK4)</option>
                </select>
                <label htmlFor="conv-metric">Error</label>
                <select id="conv-metric" className={controls.select} value={study.metric}
                    onChange={(e) => study.setMetric(e.target.value)}>
                    {Object.entries(ERROR_METRICS).map(([key, m]) => <option key={key} value={key}>{m.label}</option>)}
                </select>
                <button className={`${controls.primaryButton} ${controls.actionButton}`} onClick={study.run}>
                    Run convergence study
                </button>
            </div>
            {study.stale && (
                <p className={styles.caption} role="status">
                    The settings have changed since this run. Press Run again to update it.
                </p>
            )}
            <div className={`${styles.canvasCard} ${styles.chartLarge}`}>
                <SimulationCanvas canvasRef={canvasRef} role="img" aria-label="Numerical error against timestep, log-log" />
            </div>
            {result && (
                <ScrollRegion label="Convergence study results">
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Δt</th>
                                {INTEGRATOR_LIST.map((m) => (
                                    <th key={m.id} style={{ color: METHOD_COLORS[m.id] }}>{m.name} ({ERROR_METRICS[study.metric].unit})</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {TIMESTEP_OPTIONS.map((dt) => (
                                <tr key={dt}>
                                    <td>{formatMilliseconds(dt)}</td>
                                    {INTEGRATOR_LIST.map((m) => {
                                        const row = result.rows.find((r) => r.method === m.id && r.dt === dt);
                                        return <td key={m.id}>{row.diverged ? 'unstable' : Math.abs(row[study.metric]).toExponential(2)}</td>;
                                    })}
                                </tr>
                            ))}
                            <tr>
                                <td><strong>Observed order</strong></td>
                                {INTEGRATOR_LIST.map((m) => {
                                    const order = result.orders[m.id][study.metric];
                                    return <td key={m.id}><strong>{order === null ? 'round-off only' : order.toFixed(2)}</strong></td>;
                                })}
                            </tr>
                        </tbody>
                    </table>
                </ScrollRegion>
            )}
            {result && (
                <p className={styles.caption}>
                    Observed order: the slope of a least-squares fit of log error against log Δt, leaving out errors below
                    10⁻¹¹ × the size of the trajectory (round-off). Expected: 1 for both Euler methods and 4 for RK4.
                    {result.referenceKind === 'analytical'
                        ? ' Without drag both Euler methods have the same error size with opposite signs, so their lines'
                          + ' coincide. RK4 has no truncation error to measure: its points between 10⁻¹³ and 10⁻¹¹ m are'
                          + ' floating-point round-off, which grows slowly as smaller steps mean more of them.'
                        : ' With drag, RK4 reaches the round-off floor (about 10⁻¹² m) near Δt = 2 ms, and smaller steps'
                          + ' cannot improve it.'}
                </p>
            )}
        </section>
    );
}
