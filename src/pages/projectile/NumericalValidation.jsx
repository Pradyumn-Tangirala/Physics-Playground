import { useMemo } from 'react';
import ValidationPanel from '../../components/ValidationPanel';
import ScrollRegion from '../../components/ScrollRegion';
import { launchFromParams } from '../../simulation/projectileSimulation';
import { METHOD_COLORS } from '../../rendering/comparisonRenderer';
import { INTEGRATORS, INTEGRATOR_LIST } from '../../physics/integrators';
import { analyticalReference, measureErrors } from '../../physics/projectile/experiments';
import { formatMilliseconds } from '../../utils/format';
import styles from '../LabPage.module.css';

const signed = (v) => (Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toExponential(2)}` : '—');

const VALIDATED_QUANTITIES = [
    ['Range R', 'v₀ cos θ · T', 'range', 'm'],
    ['Max height H', 'y₀ + v₀² sin²θ / 2g', 'maxHeight', 'm'],
    ['Time of flight T', 'positive root of y(T) = 0', 'time', 's'],
    ['Impact speed', '√(v₀² + 2g·y₀)', 'impactSpeed', 'm/s'],
];

/**
 * Without drag the exact solution is known: the selected method's flight
 * against the closed form, and every method's errors at the current Δt.
 */
export default function NumericalValidation({ p, predictions, integratorName }) {
    const validation = useMemo(() => {
        const launch = launchFromParams(p);
        const reference = analyticalReference(launch);
        return INTEGRATOR_LIST.map((integrator) => measureErrors({ launch, integrator, dt: p.dt, reference }));
    }, [p]);
    const ideal = predictions.find((r) => r.id === 'analytic').metrics;
    const numeric = predictions.find((r) => r.id === 'numeric').metrics;
    const validationRows = VALIDATED_QUANTITIES.map(([quantity, reference, key, unit]) => (
        { quantity, reference, analytical: ideal[key], simulated: numeric[key], unit }
    ));

    return (
        <section className={styles.card} aria-labelledby="validation-title">
            <h2 id="validation-title">Verification: numerical vs analytical (no drag)</h2>
            <ValidationPanel title={`${integratorName} at Δt = ${formatMilliseconds(p.dt)} vs the closed form`} rows={validationRows} />
            <p className={styles.caption}>
                With drag switched off the exact solution is known, so each method's error can be measured directly,
                here at Δt = {formatMilliseconds(p.dt)}. Position and velocity errors are the largest differences at the same instants
                during the flight. The other columns are numerical minus exact.
            </p>
            <ScrollRegion label="Numerical vs analytical errors">
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Method</th><th>max |Δr| (m)</th><th>max |Δv| (m/s)</th><th>ΔRange (m)</th>
                            <th>ΔTime of flight (s)</th><th>ΔImpact speed (m/s)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {validation.map((row) => (
                            <tr key={row.method}>
                                <td style={{ color: METHOD_COLORS[row.method] }}>{INTEGRATORS[row.method].name}</td>
                                <td>{row.positionError.toExponential(2)}</td>
                                <td>{row.velocityError.toExponential(2)}</td>
                                <td>{signed(row.rangeError)}</td>
                                <td>{signed(row.timeError)}</td>
                                <td>{signed(row.impactSpeedError)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </ScrollRegion>
            <p className={styles.caption}>
                Without drag the acceleration is constant, so the velocity is linear in time and every method gets it
                right; the velocity column is pure round-off. The Euler methods put the position off by ½·g·Δt·t,
                explicit Euler too high and symplectic Euler too low, so one lands late and the other early. The exact
                path is a parabola, and RK4 is exact for polynomials up to degree 4, so its error is round-off too.
                Its fourth-order convergence shows up once drag is on, in the study below.
            </p>
        </section>
    );
}
