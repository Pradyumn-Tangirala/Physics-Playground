import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import HomeButton from '../components/HomeButton';
import ParamSlider from '../components/ParamSlider';
import SimulationCanvas from '../components/SimulationCanvas';
import SimulationControls from '../components/SimulationControls';
import ProjectileModelNotes from '../components/ProjectileModelNotes';
import ExperimentBar from '../components/ExperimentBar';
import ModelCard from '../components/ModelCard';
import { downloadText, timestampedName } from '../components/download';
import controls from '../components/SimulationControls.module.css';
import { useSimulation } from '../simulation/useSimulation';
import {
    projectileSimulation, launch, predictFlights, launchFromParams, airFromParams, flightReport,
    PLAYBACK_SPEEDS, REPORT_COLUMNS,
} from '../simulation/projectileSimulation';
import { PROJECTILE_LAB, sliderProps } from '../experiments/labs';
import { useExperimentFromUrl, useExperimentUrl } from '../experiments/useExperiment';
import { MODEL_CARDS } from '../experiments/modelCards';
import { toCsv } from '../utils/csv';
import { renderProjectile } from '../rendering/projectileRenderer';
import { renderConvergence } from '../rendering/convergenceRenderer';
import { INTEGRATORS, INTEGRATOR_LIST } from '../physics/integrators';
import { dragConstant, terminalSpeed, dragStiffness, peakSpeed } from '../physics/projectile/drag';
import { impactVelocity } from '../physics/projectile/projectile';
import { TIMESTEP_OPTIONS } from '../utils/timeStep';
import { formatMilliseconds } from '../utils/format';
import FlightMetrics from './projectile/FlightMetrics';
import NumericalValidation from './projectile/NumericalValidation';
import ConvergenceStudy from './projectile/ConvergenceStudy';
import { useConvergenceStudy } from './projectile/useConvergenceStudy';
import styles from './LabPage.module.css';

const FIELDS = PROJECTILE_LAB.fields;


const ProjectileLab = () => {
    const canvasRef = useRef(null);
    const convergenceRef = useRef(null);
    const { params: initial, rejected } = useExperimentFromUrl(PROJECTILE_LAB);
    const [p, setP] = useState(initial);
    const link = useExperimentUrl(PROJECTILE_LAB, p);
    const [showTrails, setShowTrails] = useState(true);
    const [isFlying, setIsFlying] = useState(false);

    const set = (key) => (value) => setP((prev) => ({ ...prev, [key]: value }));
    const compare = p.mode === 'compare';
    const shot = launchFromParams(p);
    const k = dragConstant(airFromParams(p));
    const vt = terminalSpeed(p.gravity, k);
    const stiffness = dragStiffness(k, peakSpeed(p.velocity, impactVelocity(shot).speed, vt), p.dt);
    const integratorName = INTEGRATORS[p.integrator].name;

    // Full predicted flights for the current settings (same solver as a real shot).
    const predictions = useMemo(() => predictFlights(p), [p]);
    const study = useConvergenceStudy(p, k);

    const { simRef, reset } = useSimulation(projectileSimulation, p, {
        render: (state) => {
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx) renderProjectile(ctx, state, { launch: shot, predictions, showTrails });
            const chart = convergenceRef.current?.getContext('2d');
            if (chart) renderConvergence(chart, study.result, study.metric);
        },
        onEvent: (event) => {
            if (event.type === 'landed') setIsFlying(false);
        },
    });

    const handleFire = () => {
        simRef.current.setState(launch(p)); // launch parameters are snapshotted here
        setIsFlying(true);
    };
    const handleStop = () => {
        reset();
        setIsFlying(false);
    };
    const changeMode = (mode) => {
        set('mode')(mode);
        reset(); // clear the previous shot, which may show a different set of trajectories
    };

    const exportReport = () => downloadText(timestampedName(`projectile-${p.integrator}`), toCsv({
        metadata: [
            ['experiment', PROJECTILE_LAB.title],
            ['model', MODEL_CARDS.projectile.equations[2]],
            ['method', integratorName],
            ['link', link],
            ['exported', new Date().toISOString()],
        ],
        header: REPORT_COLUMNS,
        rows: flightReport(p),
    }));

    return (
        <div className={styles.shell}>
        <div className={styles.page}>
            <header className={styles.header}>
                <HomeButton variant="inline" />
                <div>
                    <h1>Projectile Lab</h1>
                    <p>
                        The closed-form ideal trajectory, the same launch integrated numerically, and the launch again with
                        quadratic air resistance. Compare them directly. <Link to="/projectile/problems">Worked solutions →</Link>
                    </p>
                </div>
            </header>

            <div className={styles.topRow}>
                <div className={`${styles.canvasCard} ${styles.sticky} ${styles.trajectoryCard}`}>
                    <SimulationCanvas canvasRef={canvasRef} role="img" aria-label="Projectile trajectories" />
                </div>

                <SimulationControls title="PROJECTILE CONTROL" placement="inline" titleGradient="linear-gradient(90deg, #ff6b6b, #feb47b)">
                    <ExperimentBar lab={PROJECTILE_LAB} params={p} link={link} rejected={rejected} />
                    <div className={`${controls.buttonRow} ${controls.topActions}`}>
                        <button
                            className={controls.primaryButton}
                            onClick={isFlying ? handleStop : handleFire}
                            style={{
                                '--button-bg': isFlying ? '#444' : 'linear-gradient(135deg, #ff6b6b, #ee5253)',
                                '--button-shadow': isFlying ? 'none' : '0 4px 15px rgba(255, 107, 107, 0.4)',
                            }}
                        >
                            {isFlying ? '■ STOP' : 'FIRE'}
                        </button>
                        <button
                            className={controls.secondaryButton}
                            onClick={() => setShowTrails(!showTrails)}
                            aria-pressed={showTrails}
                        >
                            Trails {showTrails ? 'on' : 'off'}
                        </button>
                    </div>

                    <div className={controls.selectRow}>
                        <label htmlFor="proj-mode">Model</label>
                        <select id="proj-mode" className={controls.select} value={p.mode} disabled={isFlying}
                            onChange={(e) => changeMode(e.target.value)}>
                            <option value="compare">Analytical vs numerical vs drag</option>
                            <option value="ideal">Ideal only (analytical)</option>
                        </select>
                    </div>
                    <div className={controls.selectRow}>
                        <label htmlFor="proj-speed">Playback speed</label>
                        <select id="proj-speed" className={controls.select} value={p.playbackSpeed}
                            onChange={(e) => set('playbackSpeed')(Number(e.target.value))}>
                            {PLAYBACK_SPEEDS.map((s) => <option key={s} value={s}>{s}× real time</option>)}
                        </select>
                    </div>

                    <p className={styles.groupLabel}>Launch</p>
                    <ParamSlider {...sliderProps(FIELDS.velocity)} value={p.velocity}
                        onChange={set('velocity')} disabled={isFlying} accentColor="#ff6b6b" />
                    <ParamSlider {...sliderProps(FIELDS.angleDeg)} value={p.angleDeg}
                        onChange={set('angleDeg')} disabled={isFlying} accentColor="#feca57" />
                    <ParamSlider {...sliderProps(FIELDS.height)} value={p.height}
                        onChange={set('height')} disabled={isFlying} accentColor="#a29bfe" />
                    <ParamSlider {...sliderProps(FIELDS.gravity)} value={p.gravity}
                        onChange={set('gravity')} disabled={isFlying} accentColor="#4facfe" />

                    {compare && (
                        <>
                            <p className={styles.groupLabel}>Air resistance</p>
                            <ParamSlider {...sliderProps(FIELDS.rho)} value={p.rho}
                                onChange={set('rho')} disabled={isFlying} accentColor="#ff9f43" />
                            <ParamSlider {...sliderProps(FIELDS.cd)} value={p.cd}
                                onChange={set('cd')} disabled={isFlying} accentColor="#ff9f43" />
                            <ParamSlider {...sliderProps(FIELDS.area)} value={p.area}
                                onChange={set('area')} disabled={isFlying} accentColor="#ff9f43" />
                            <ParamSlider {...sliderProps(FIELDS.mass)} value={p.mass}
                                onChange={set('mass')} disabled={isFlying} accentColor="#ff9f43" />
                            <dl className={controls.readout}>
                                <dt>k = ρC_dA / 2m</dt><dd>{k.toExponential(3)} m⁻¹</dd>
                                <dt>Terminal speed v_t = √(g/k)</dt><dd>{Number.isFinite(vt) ? `${vt.toFixed(1)} m/s` : '∞ (no drag)'}</dd>
                            </dl>

                            <p className={styles.groupLabel}>Numerical method</p>
                            <div className={controls.selectRow}>
                                <label htmlFor="proj-integrator">Integrator</label>
                                <select id="proj-integrator" className={controls.select} value={p.integrator} disabled={isFlying}
                                    onChange={(e) => set('integrator')(e.target.value)}>
                                    {INTEGRATOR_LIST.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div className={controls.selectRow}>
                                <label htmlFor="proj-dt">Timestep Δt</label>
                                <select id="proj-dt" className={controls.select} value={p.dt} disabled={isFlying}
                                    onChange={(e) => set('dt')(Number(e.target.value))}>
                                    {TIMESTEP_OPTIONS.map((v) => <option key={v} value={v}>{formatMilliseconds(v)}</option>)}
                                </select>
                            </div>
                            <p className={`${controls.note} ${controls.noteTight}`}>
                                Drag stiffness 2k·v·Δt = {stiffness.toFixed(3)}, where v is the highest speed of the flight.
                                Linear stability limits: 2 for the Euler methods, 2.79 for RK4.
                            </p>
                            {stiffness > 1 && (
                                <p className={styles.warning} role="status">
                                    Drag changes the velocity faster than this Δt can resolve (2k·v·Δt = {stiffness.toFixed(2)}).
                                    {stiffness > 2
                                        ? ' Explicit and symplectic Euler overshoot and reverse the velocity, so they will likely be flagged unstable.'
                                        : ' Expect large errors in the first steps.'}
                                    {stiffness > 2.79 && ' This is also past RK4’s linear stability limit (2.79). Just past it, drag slows the'
                                        + ' projectile fast enough that RK4 survives with wrong first steps; further past it RK4 blows up too.'}
                                    {' '}Reduce Δt.
                                </p>
                            )}
                        </>
                    )}
                    {isFlying && <p className={controls.note}>Settings are locked during flight.</p>}
                </SimulationControls>
            </div>




            <FlightMetrics p={p} predictions={predictions} integratorName={integratorName} onExport={exportReport} />
            {compare && <NumericalValidation p={p} predictions={predictions} integratorName={integratorName} />}
            {compare && <ConvergenceStudy study={study} canvasRef={convergenceRef} />}

            <ModelCard id="projectile" model={MODEL_CARDS.projectile} />
            <ProjectileModelNotes />
        </div>
        </div>
    );
};

export default ProjectileLab;
