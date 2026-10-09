import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import HomeButton from '../components/HomeButton';
import ParamSlider from '../components/ParamSlider';
import SimulationCanvas from '../components/SimulationCanvas';
import SimulationControls from '../components/SimulationControls';
import FdtdNotes from '../components/FdtdNotes';
import ExperimentBar from '../components/ExperimentBar';
import ModelCard from '../components/ModelCard';
import { FDTD_LAB, sliderProps } from '../experiments/labs';
import { useExperimentFromUrl, useExperimentUrl } from '../experiments/useExperiment';
import { MODEL_CARDS } from '../experiments/modelCards';
import { FDTD_MEDIA } from '../experiments/waveSetups';
import controls from '../components/SimulationControls.module.css';
import { useSimulation } from '../simulation/useSimulation';
import { fdtdSimulation, gridKey, gridSpacing, DOMAIN, BARRIER_X, DETECTOR_X } from '../simulation/fdtdSimulation';
import { createFdtdRenderer, formatTime, FDTD_COLOR, ANALYTIC_COLOR } from '../rendering/fdtdRenderer';
import { COURANT_LIMIT, phaseVelocityError, snapOpening } from '../physics/waves/fdtd';
import styles from './LabPage.module.css';

const FIELDS = FDTD_LAB.fields;
/** The page shows lengths in centimetres; the parameters are in metres. */
const CM_PER_M = 100;
const toCm = (m) => Number((m * CM_PER_M).toPrecision(10));

const SCENES = {
    double: 'Plane wave → double slit',
    single: 'Plane wave → single slit',
    'two-point': 'Two point sources (in phase)',
    point: 'One point source',
};


const THEMES = [
    ['cyan-magenta', 'Cyan / Magenta (sign of u)'],
    ['electric-blue', 'Electric Blue'],
    ['sunset', 'Sunset'],
    ['grayscale', 'Grayscale'],
];

const cm = (m) => `${(m * 100).toFixed(2)} cm`;

const WaveEquationLab = () => {
    const fieldRef = useRef(null);
    const detectorRef = useRef(null);
    const [renderer] = useState(createFdtdRenderer);
    const { params: initial, rejected } = useExperimentFromUrl(FDTD_LAB);
    const [params, setParams] = useState(initial);
    const link = useExperimentUrl(FDTD_LAB, params);
    const [theme, setTheme] = useState('cyan-magenta');
    const [blewUp, setBlewUp] = useState(null);

    const { isPaused, togglePause, reset } = useSimulation(fdtdSimulation, params, {
        render: (state) => {
            if (fieldRef.current) renderer.renderField(fieldRef.current, state, params, { theme });
            if (detectorRef.current) renderer.renderDetector(detectorRef.current, state, params);
        },
        onEvent: (event) => {
            if (event.type === 'unstable') setBlewUp(event.steps);
        },
    });

    // Anything baked into the grid restarts the run; steps per frame does not.
    const change = (key) => (value) => {
        const next = { ...params, [key]: value };
        setParams(next);
        if (gridKey(next) !== gridKey(params)) {
            reset(next);
            setBlewUp(null);
        }
    };
    const restart = () => {
        reset(params);
        setBlewUp(null);
    };

    /** Slider for a length stored in metres and shown in centimetres (0.1 mm resolution). */
    const cmSlider = (key, { step = 0.1, label = FIELDS[key].label, ...rest }) => (
        <ParamSlider label={label} unit="cm" step={step}
            min={toCm(FIELDS[key].min)} max={toCm(FIELDS[key].max)}
            value={Math.round(params[key] * CM_PER_M * 10) / 10}
            onChange={(v) => change(key)(Math.round(v * 10) / (10 * CM_PER_M))} {...rest} />
    );

    const dx = gridSpacing(params);
    const nx = Math.round(DOMAIN.width / dx);
    const ny = 2 * Math.round(DOMAIN.height / dx / 2) + 1;
    const dt = (params.courant * dx) / params.waveSpeed;
    const cellsPerWavelength = params.wavelength / dx;
    const dispersion = phaseVelocityError(cellsPerWavelength, Math.min(params.courant, COURANT_LIMIT));
    const unstable = params.courant > COURANT_LIMIT;
    const slitScene = params.scene === 'double' || params.scene === 'single';
    const snapped = slitScene ? snapOpening(ny, dx, 0, params.slitWidth).width : null;

    return (
        <div className={styles.shell}>
        <div className={styles.page}>
            <header className={styles.header}>
                <HomeButton variant="inline" />
                <div>
                    <h1>Numerical Wave Equation Lab (FDTD)</h1>
                    <p>
                        A numerical solver: the 2-D wave equation ∂²u/∂t² = c²(∂²u/∂x² + ∂²u/∂y²) stepped forward in time by
                        finite differences on a grid. Nothing on this page uses an interference formula; the pattern
                        emerges from the equation. Compare with the <Link to="/simulation">analytical
                        interference model →</Link>
                    </p>
                </div>
            </header>

            <div className={styles.topRow}>
                <div className={`${styles.canvasCard} ${styles.sticky} ${styles.stage}`}>
                    <SimulationCanvas canvasRef={fieldRef} role="img" aria-label="FDTD wave field, numerical solution" />
                </div>

                <SimulationControls title="FDTD SOLVER" placement="inline" titleGradient="linear-gradient(90deg, #ff9f43, #feca57)">
                    <ExperimentBar lab={FDTD_LAB} params={params} link={link} rejected={rejected} />
                    <div className={`${controls.buttonRow} ${controls.topActions}`}>
                        <button className={controls.primaryButton} onClick={togglePause}
                            style={{ '--button-bg': 'linear-gradient(135deg, #ff9f43, #ee5253)' }}>
                            {isPaused ? '▶ RUN' : '⏸ PAUSE'}
                        </button>
                        <button className={controls.secondaryButton} onClick={restart}>↺ RESTART</button>
                    </div>

                    <div className={controls.selectRow}>
                        <label htmlFor="fdtd-scene">Scene</label>
                        <select id="fdtd-scene" className={controls.select} value={params.scene} onChange={(e) => change('scene')(e.target.value)}>
                            {Object.entries(SCENES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                        </select>
                    </div>
                    <div className={controls.selectRow}>
                        <label htmlFor="fdtd-medium">Wave speed c</label>
                        <select id="fdtd-medium" className={controls.select} value={params.waveSpeed}
                            onChange={(e) => change('waveSpeed')(Number(e.target.value))}>
                            {FDTD_MEDIA.map(({ speed, label }) => <option key={speed} value={speed}>{label}</option>)}
                        </select>
                    </div>

                    <p className={styles.groupLabel}>Geometry</p>
                    {cmSlider('wavelength', { accentColor: '#48dbfb' })}
                    {params.scene !== 'point' && params.scene !== 'single' && (
                        cmSlider('slitSeparation', { accentColor: '#a29bfe', step: 0.5, label: params.scene === 'two-point' ? 'Source separation d' : FIELDS.slitSeparation.label })
                    )}
                    {slitScene && (
                        cmSlider('slitWidth', { accentColor: '#ff9f43', hint: `built as ${cm(snapped)}` })
                    )}

                    <p className={styles.groupLabel}>Numerics</p>
                    <ParamSlider {...sliderProps(FIELDS.cellsPerWavelength)} value={params.cellsPerWavelength}
                        onChange={change('cellsPerWavelength')} accentColor="#2ecc71"
                        hint={Math.abs(cellsPerWavelength - params.cellsPerWavelength) > 0.05 ? `capped at ${cellsPerWavelength.toFixed(1)}` : undefined} />
                    <ParamSlider {...sliderProps(FIELDS.courant)} value={params.courant}
                        onChange={change('courant')} accentColor={unstable ? '#ff6b6b' : '#feca57'} />
                    {unstable && (
                        <p className={styles.warning} role="alert">
                            C = {params.courant.toFixed(2)} violates the CFL condition C ≤ 1/√2 ≈ 0.707 for this 2-D scheme.
                            The shortest waves on the grid will grow every step, and the solution will blow up.
                        </p>
                    )}
                    <div className={controls.selectRow}>
                        <label htmlFor="fdtd-boundary">Boundary</label>
                        <select id="fdtd-boundary" className={controls.select} value={params.boundary} onChange={(e) => change('boundary')(e.target.value)}>
                            <option value="absorbing">Absorbing (sponge + Mur)</option>
                            <option value="reflective">Reflective (rigid, u = 0)</option>
                        </select>
                    </div>
                    <ParamSlider {...sliderProps(FIELDS.stepsPerFrame)} value={params.stepsPerFrame}
                        onChange={(v) => setParams((p) => ({ ...p, stepsPerFrame: v }))} accentColor="#aaa" />

                    <dl className={controls.readout}>
                        <dt>Grid</dt><dd>{nx} × {ny} = {(nx * ny / 1000).toFixed(0)}k cells</dd>
                        <dt>Δx</dt><dd>{(dx * 1000).toFixed(2)} mm</dd>
                        <dt>Δt = CΔx/c</dt><dd>{formatTime(dt)}</dd>
                        <dt>Frequency f = c/λ</dt><dd>{(params.waveSpeed / params.wavelength).toPrecision(4)} Hz</dd>
                        <dt>Phase-speed error (axis / diagonal)</dt>
                        <dd>{(100 * dispersion.axis).toFixed(2)}% / {(100 * dispersion.diagonal).toFixed(2)}%</dd>
                    </dl>

                    <div className={controls.selectRow}>
                        <label htmlFor="fdtd-theme">Colours</label>
                        <select id="fdtd-theme" className={controls.select} value={theme} onChange={(e) => setTheme(e.target.value)}>
                            {THEMES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                        </select>
                    </div>
                    <p className={controls.note}>
                        Domain {DOMAIN.width} m × {DOMAIN.height} m. Barrier (or sources) at x = {BARRIER_X} m, detector at
                        x = {DETECTOR_X} m. Changing the geometry or numerics restarts the run.
                    </p>
                </SimulationControls>
            </div>

            {blewUp !== null && (
                <p className={styles.warning} role="status">
                    The run blew up after {blewUp} steps (C = {params.courant.toFixed(2)}). Lower the Courant number and restart.
                </p>
            )}

            <section className={styles.card} aria-labelledby="detector-title">
                <h2 id="detector-title">Detector line: numerical vs analytical</h2>
                <p className={styles.caption}>
                    <span style={{ color: FDTD_COLOR }}>FDTD</span>: the running average of u² over about four periods at
                    x = {DETECTOR_X} m. <span style={{ color: ANALYTIC_COLOR }}>Analytical</span>: the Huygens–Fresnel phasor
                    sum from the wave interference page for the same geometry as built on the grid. The two are computed in
                    completely different ways. Expect differences from barrier reflections and thickness, the edges of the
                    slits, numerical dispersion ({(100 * dispersion.axis).toFixed(2)}% at this resolution) and residual
                    boundary reflection.
                </p>
                <div className={`${styles.canvasCard} ${styles.stageCompact}`}>
                    <SimulationCanvas canvasRef={detectorRef} role="img" aria-label="Detector intensity: FDTD against the analytical model" />
                </div>
            </section>

            <ModelCard id="fdtd" model={MODEL_CARDS.fdtd} />
            <FdtdNotes />
        </div>
        </div>
    );
};

export default WaveEquationLab;
