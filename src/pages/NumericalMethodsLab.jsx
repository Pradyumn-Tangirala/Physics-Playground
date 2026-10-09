import { useRef, useState } from 'react';
import HomeButton from '../components/HomeButton';
import ParamSlider from '../components/ParamSlider';
import SimulationCanvas from '../components/SimulationCanvas';
import SimulationControls from '../components/SimulationControls';
import ExperimentBar from '../components/ExperimentBar';
import ValidationPanel from '../components/ValidationPanel';
import DataLogPanel from '../components/DataLogPanel';
import ModelCard from '../components/ModelCard';
import ScrollRegion from '../components/ScrollRegion';
import NumericalMethodsExplainer from '../components/NumericalMethodsExplainer';
import controls from '../components/SimulationControls.module.css';
import { useSimulation } from '../simulation/useSimulation';
import { useLiveValue } from '../simulation/useLiveValue';
import { createDataLog, recordSample } from '../simulation/dataLog';
import { integratorComparison, evaluations, LOG_COLUMNS, logRows } from '../simulation/integratorComparison';
import { METHODS_LAB, sliderProps } from '../experiments/labs';
import { useExperimentFromUrl, useExperimentUrl } from '../experiments/useExperiment';
import { MODEL_CARDS } from '../experiments/modelCards';
import { TIMESTEP_OPTIONS } from '../utils/timeStep';
import { formatScientific } from '../utils/format';
import { INTEGRATORS, INTEGRATOR_LIST } from '../physics/integrators';
import { smallAnglePeriod, exactPeriod } from '../physics/pendulum/pendulum';
import { periodVsAmplitude, accuracyVsCost } from '../physics/pendulum/experiments';
import { degToRad } from '../utils/units';
import {
    METHOD_COLORS, renderComparisonPendulums, renderEnergyDrift, renderTrajectoryError, renderPhaseSpace,
} from '../rendering/comparisonRenderer';
import { renderPeriodExperiment } from '../rendering/periodExperimentRenderer';
import { renderAccuracyVsCost } from '../rendering/accuracyCostRenderer';
import styles from './LabPage.module.css';

const FIELDS = METHODS_LAB.fields;
const PERIOD_AMPLITUDES = Array.from({ length: 35 }, (_, i) => 5 + 5 * i); // 5°…175°
const PERIOD_TABLE_AMPLITUDES = [10, 30, 60, 90, 120, 150, 170];
/** Simulated time of each accuracy-vs-cost run (s): about five periods of a 1 m pendulum. */
const COST_DURATION = 10;

const ms = (dt) => `${Number((dt * 1000).toFixed(3))} ms`;

/** Live per-method numbers for the comparison table (read a few times a second). */
const liveRuns = (state) => state.runs.map((run) => ({
    id: run.id,
    steps: run.steps,
    evaluations: evaluations(run),
    error: run.error,
    maxError: run.maxError,
    drift: run.drift,
    period: run.detector.periods.at(-1) ?? null,
}));

const NumericalMethodsLab = () => {
    const pendulumRef = useRef(null);
    const energyRef = useRef(null);
    const errorRef = useRef(null);
    const phaseRef = useRef(null);
    const costRef = useRef(null);
    const periodRef = useRef(null);

    const { params: initial, rejected } = useExperimentFromUrl(METHODS_LAB);
    const [params, setParams] = useState(initial);
    const [logScale, setLogScale] = useState(true);
    const [periodMethod, setPeriodMethod] = useState('rk4');
    const [periodStudy, setPeriodStudy] = useState(null);
    const [costStudy, setCostStudy] = useState(null); // { rows, key }
    const [log] = useState(() => createDataLog(LOG_COLUMNS));
    const link = useExperimentUrl(METHODS_LAB, params);
    const { amplitudeDeg, lengthM, gravity, damping, dt } = params;
    const visible = Object.fromEntries(INTEGRATOR_LIST.map((m) => [m.id, params.methods.includes(m.id)]));

    const { simRef, reset, isPaused, togglePause } = useSimulation(integratorComparison, params, {
        render: (state) => {
            const draw = (ref, fn) => {
                const ctx = ref.current?.getContext('2d');
                if (ctx) fn(ctx);
            };
            draw(pendulumRef, (ctx) => renderComparisonPendulums(ctx, state, params, visible));
            draw(energyRef, (ctx) => renderEnergyDrift(ctx, state, params, visible, logScale));
            draw(errorRef, (ctx) => renderTrajectoryError(ctx, state, params, visible, logScale));
            draw(phaseRef, (ctx) => renderPhaseSpace(ctx, state, params, visible));
            draw(costRef, (ctx) => renderAccuracyVsCost(ctx, costStudy?.rows ?? null));
            draw(periodRef, (ctx) => renderPeriodExperiment(ctx, periodStudy));
        },
        onSample: (t, data) => recordSample(log, t, () => logRows(t, data, params)),
    });
    const runs = useLiveValue(() => liveRuns(simRef.current.getState()));

    // Every physical or numerical change restarts all three runs, so they
    // always share identical initial conditions and the same Δt.
    const restartWith = (key) => (value) => {
        const next = { ...params, [key]: value };
        setParams(next);
        reset(next);
    };
    const toggleMethod = (id, shown) => setParams((p) => ({
        ...p,
        methods: INTEGRATOR_LIST.map((m) => m.id).filter((m) => (m === id ? shown : p.methods.includes(m))),
    }));

    const costKey = JSON.stringify([amplitudeDeg, lengthM, gravity]);
    const runCostStudy = () => setCostStudy({
        key: costKey,
        rows: accuracyVsCost({
            amplitude: degToRad(amplitudeDeg), length: lengthM, g: gravity,
            integrators: INTEGRATOR_LIST, dts: TIMESTEP_OPTIONS, duration: COST_DURATION,
            now: () => performance.now(),
        }),
    });
    const runPeriodStudy = () => {
        const integrator = INTEGRATORS[periodMethod];
        const rows = periodVsAmplitude({ amplitudesDeg: PERIOD_AMPLITUDES, length: lengthM, g: gravity, integrator, dt });
        setPeriodStudy({ rows, integratorId: integrator.id, integratorName: integrator.name, dt });
    };

    const T0 = smallAnglePeriod(lengthM, gravity);
    const Texact = exactPeriod(degToRad(amplitudeDeg), lengthM, gravity);
    const periodRows = INTEGRATOR_LIST.map((m) => {
        const run = runs.find((r) => r.id === m.id);
        return damping > 0
            ? { quantity: `Period, ${m.name}`, reference: 'exact', unavailable: 'No closed form with damping (γ > 0).' }
            : { quantity: `Period, ${m.name}`, reference: `exact, θ₀ = ${amplitudeDeg}°`, analytical: Texact, simulated: run.period ?? NaN, unit: 's' };
    });

    const report = () => ({
        name: 'numerical-methods',
        metadata: [
            ['experiment', METHODS_LAB.title],
            ['model', MODEL_CARDS.methods.equations[0]],
            ['reference', damping > 0 ? 'RK4 at Δt/20' : 'exact elliptic-function solution'],
            ['link', link],
            ['exported', new Date().toISOString()],
        ],
    });

    const slider = (key, accentColor) => (
        <ParamSlider {...sliderProps(FIELDS[key])} value={params[key]} onChange={restartWith(key)} accentColor={accentColor} />
    );

    return (
        <div className={styles.shell}>
        <div className={styles.page}>
            <header className={styles.header}>
                <HomeButton variant="inline" />
                <div>
                    <h1>Numerical Methods Lab</h1>
                    <p>
                        The same nonlinear pendulum, θ″ = −(g/L)·sin θ − 2γθ′, solved by explicit Euler, symplectic Euler and
                        RK4 from identical initial conditions with the same timestep, and measured against the exact solution.
                    </p>
                </div>
            </header>

            <div className={styles.topRow}>
                <div className={`${styles.canvasCard} ${styles.stageCompact}`}>
                    <SimulationCanvas canvasRef={pendulumRef} role="img" aria-label="Three pendulums, one per integrator" />
                </div>

                <SimulationControls title="Experiment setup" placement="inline" titleGradient="linear-gradient(90deg, #48dbfb, #feca57)">
                    <ExperimentBar lab={METHODS_LAB} params={params} link={link} rejected={rejected} />
                    {slider('amplitudeDeg', '#48dbfb')}
                    {slider('lengthM', '#f1c40f')}
                    {slider('gravity', '#2ecc71')}
                    {slider('damping', '#aaa')}
                    <div className={controls.selectRow}>
                        <label htmlFor="lab-dt">Timestep Δt</label>
                        <select id="lab-dt" className={controls.select} value={dt}
                            onChange={(e) => restartWith('dt')(Number(e.target.value))}>
                            {TIMESTEP_OPTIONS.map((v) => <option key={v} value={v}>{ms(v)}</option>)}
                        </select>
                    </div>
                    <p className={`${controls.note} ${controls.noteTight}`}>
                        ω₀Δt = {(Math.sqrt(gravity / lengthM) * dt).toFixed(4)} (stability: symplectic Euler &lt; 2, RK4 &lt; 2.83,
                        explicit Euler grows at any Δt)
                    </p>

                    <fieldset className={styles.methods}>
                        <legend>Show methods</legend>
                        {INTEGRATOR_LIST.map((m) => (
                            <label key={m.id} style={{ '--method': METHOD_COLORS[m.id] }}>
                                <input type="checkbox" checked={visible[m.id]} onChange={(e) => toggleMethod(m.id, e.target.checked)} />
                                {m.name}
                            </label>
                        ))}
                    </fieldset>

                    <div className={controls.buttonRow}>
                        <button className={controls.primaryButton} onClick={togglePause}>
                            {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
                        </button>
                        <button className={controls.secondaryButton} onClick={() => reset(params)}>↺ RESTART</button>
                    </div>
                    <p className={controls.note}>Changing any setting restarts all three runs from θ₀ at rest.</p>
                    <DataLogPanel log={log} report={report} />
                </SimulationControls>
            </div>

            <section className={styles.card} aria-labelledby="live-title">
                <h2 id="live-title">Error and cost, live</h2>
                <p className={styles.caption}>
                    Error is |θ − θ_ref| against {damping > 0
                        ? 'RK4 with Δt/20 (there is no closed form with damping)'
                        : 'the exact solution, sin(θ/2) = sin(θ₀/2)·cd(ω₀t | sin²(θ₀/2))'}.
                    Cost is counted in derivative evaluations f(y): RK4 does four per step, the Euler methods one.
                </p>
                <ScrollRegion label="Error and cost per method">
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Method</th><th>Order</th><th>f per step</th><th>Steps</th><th>f evaluations</th>
                                <th>|Δθ| now (rad)</th><th>max |Δθ| (rad)</th><th>ΔE/E₀</th>
                            </tr>
                        </thead>
                        <tbody>
                            {INTEGRATOR_LIST.map((m) => {
                                const run = runs.find((r) => r.id === m.id);
                                return (
                                    <tr key={m.id}>
                                        <td style={{ color: METHOD_COLORS[m.id] }}>{m.name}</td>
                                        <td>{m.order}</td>
                                        <td>{m.evaluationsPerStep}</td>
                                        <td>{run.steps.toLocaleString('en')}</td>
                                        <td>{run.evaluations.toLocaleString('en')}</td>
                                        <td>{formatScientific(run.error)}</td>
                                        <td>{formatScientific(run.maxError)}</td>
                                        <td>{formatScientific(run.drift)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </ScrollRegion>
                <ValidationPanel title="Validation: measured period" rows={periodRows}
                    caption={`Period: time between downward zero crossings of θ, interpolated within the step. Small-angle T₀ = 2π√(L/g) = ${T0.toFixed(5)} s for comparison.`} />
            </section>

            <div className={styles.chartRow}>
                <div className={`${styles.canvasCard} ${styles.chart}`}>
                    <SimulationCanvas canvasRef={errorRef} role="img" aria-label="Angle error against the reference solution over time for each integrator" />
                </div>
                <div className={`${styles.canvasCard} ${styles.chart}`}>
                    <SimulationCanvas canvasRef={energyRef} role="img" aria-label="Energy error over time for each integrator" />
                    <label className={styles.chartToggle}>
                        <input type="checkbox" checked={logScale} onChange={(e) => setLogScale(e.target.checked)} />
                        log scale
                    </label>
                </div>
            </div>
            <div className={`${styles.canvasCard} ${styles.chart}`}>
                <SimulationCanvas canvasRef={phaseRef} role="img" aria-label="Phase-space trajectories for each integrator" />
            </div>

            <section className={styles.card} aria-labelledby="cost-title">
                <h2 id="cost-title">Experiment: accuracy vs cost</h2>
                <p className={styles.caption}>
                    Integrates the undamped pendulum (θ₀ = {amplitudeDeg}°, L = {lengthM} m, g = {gravity} m/s²) for {COST_DURATION} s
                    with every method at every Δt from 0.5 ms to 100 ms, and records the largest angle error against the exact
                    solution, the derivative evaluations used and the measured time. A method is better when its line lies further
                    down and to the left: less error for the same work.
                </p>
                <div className={styles.experimentControls}>
                    <button className={`${controls.primaryButton} ${controls.actionButton}`} onClick={runCostStudy}>
                        Run accuracy vs cost
                    </button>
                </div>
                {costStudy && costStudy.key !== costKey && (
                    <p className={styles.caption} role="status">The settings have changed since this run. Press Run again to update it.</p>
                )}
                <div className={`${styles.canvasCard} ${styles.chartLarge}`}>
                    <SimulationCanvas canvasRef={costRef} role="img" aria-label="Largest angle error against derivative evaluations, log-log" />
                </div>
                {costStudy && <CostTable rows={costStudy.rows} />}
            </section>

            <section className={styles.card} aria-labelledby="pva-title">
                <h2 id="pva-title">Experiment: period vs amplitude</h2>
                <p className={styles.caption}>
                    Releases the undamped pendulum from rest at θ₀ = 5°, 10°, …, 175° and measures one full period with the
                    chosen method at the current L, g and Δt (= {ms(dt)}). The small-angle formula predicts the same
                    period for every amplitude; the exact period grows without bound as θ₀ → 180°.
                </p>
                <div className={styles.experimentControls}>
                    <label htmlFor="pva-method">Method</label>
                    <select id="pva-method" className={controls.select} value={periodMethod} onChange={(e) => setPeriodMethod(e.target.value)}>
                        {INTEGRATOR_LIST.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <button className={`${controls.primaryButton} ${controls.actionButton}`} onClick={runPeriodStudy}>
                        Run experiment
                    </button>
                </div>
                <div className={`${styles.canvasCard} ${styles.chart}`}>
                    <SimulationCanvas canvasRef={periodRef} role="img" aria-label="Period divided by small-angle period, against release amplitude" />
                </div>
                {periodStudy && <PeriodTable study={periodStudy} />}
            </section>

            <ModelCard id="methods" model={MODEL_CARDS.methods} />
            <NumericalMethodsExplainer />
        </div>
        </div>
    );
};

function CostTable({ rows }) {
    return (
        <ScrollRegion label="Accuracy and cost per method and timestep">
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Δt</th>
                        {INTEGRATOR_LIST.map((m) => (
                            <th key={m.id} style={{ color: METHOD_COLORS[m.id] }}>{m.name}: max |Δθ| · f evals · time</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {TIMESTEP_OPTIONS.map((dt) => (
                        <tr key={dt}>
                            <td>{ms(dt)}</td>
                            {INTEGRATOR_LIST.map((m) => {
                                const r = rows.find((row) => row.method === m.id && row.dt === dt);
                                const error = Number.isFinite(r.maxError) ? formatScientific(r.maxError) : 'blew up';
                                return <td key={m.id}>{error} · {r.evaluations.toLocaleString('en')} · {(r.seconds * 1e6).toFixed(0)} µs</td>;
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </ScrollRegion>
    );
}

function PeriodTable({ study }) {
    return (
        <>
            <ScrollRegion label="Period against amplitude">
                <table className={styles.table}>
                    <thead>
                        <tr><th>θ₀</th><th>Simulated T (s)</th><th>Exact T (s)</th><th>Exact T / T₀</th><th>(T_sim − T_exact)/T_exact</th></tr>
                    </thead>
                    <tbody>
                        {study.rows.filter((r) => PERIOD_TABLE_AMPLITUDES.includes(r.amplitudeDeg)).map((r) => (
                            <tr key={r.amplitudeDeg}>
                                <td>{r.amplitudeDeg}°</td>
                                <td>{Number.isFinite(r.simulated) ? r.simulated.toFixed(5) : 'no full period'}</td>
                                <td>{r.exact.toFixed(5)}</td>
                                <td>{r.exactRatio.toFixed(4)}</td>
                                <td>{Number.isFinite(r.relativeError) ? r.relativeError.toExponential(2) : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </ScrollRegion>
            {study.rows.some((r) => !Number.isFinite(r.simulated)) && (
                <p className={styles.caption}>
                    "No full period": the method added so much energy that the pendulum went over the top and never
                    crossed θ = 0 downward again.
                </p>
            )}
        </>
    );
}

export default NumericalMethodsLab;
