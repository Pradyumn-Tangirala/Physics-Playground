import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import HomeButton from '../components/HomeButton';
import ParamSlider from '../components/ParamSlider';
import SimulationCanvas from '../components/SimulationCanvas';
import SimulationControls from '../components/SimulationControls';
import ExperimentBar from '../components/ExperimentBar';
import ValidationPanel from '../components/ValidationPanel';
import DataLogPanel from '../components/DataLogPanel';
import ModelCard from '../components/ModelCard';
import controls from '../components/SimulationControls.module.css';
import { useSimulation } from '../simulation/useSimulation';
import { useLiveValue } from '../simulation/useLiveValue';
import { recordSample } from '../simulation/dataLog';
import { useDataLog } from '../simulation/dataLogStore';
import {
    oscillatorSimulation, holdAt, validationRows, smallAngleComparison, logColumns, logRow,
} from '../simulation/oscillatorSimulation';
import { OSCILLATOR_LAB, sliderProps } from '../experiments/labs';
import { useExperimentFromUrl, useExperimentUrl } from '../experiments/useExperiment';
import { MODEL_CARDS } from '../experiments/modelCards';
import { INTEGRATORS, INTEGRATOR_LIST } from '../physics/integrators';
import { renderOscillator } from '../rendering/oscillatorRenderer';
import { cssSize } from '../rendering/canvasSize';
import {
    BLOCK_SIZE, BOB_RADIUS, oscillatorLayout, bobPosition, blockTop,
} from '../rendering/oscillatorLayout';
import { TIMESTEP_OPTIONS } from '../utils/timeStep';
import { clamp } from '../utils/math';
import { formatMeasurement, formatPercent } from '../utils/format';
import { degToRad, radToDeg } from '../utils/units';
import styles from './OscillatorLab.module.css';

const FIELDS = OSCILLATOR_LAB.fields;
const DRAG_HIT_SLOP = 10; // px beyond the bob radius that still counts as a grab
const MODES = [
    { id: 'pendulum', label: 'Pendulum' },
    { id: 'spring', label: 'Spring' },
];

const OscillatorLab = () => {
    const canvasRef = useRef(null);
    const { params: initial, rejected } = useExperimentFromUrl(OSCILLATOR_LAB);
    const [params, setParams] = useState(initial);
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef(null);
    const link = useExperimentUrl(OSCILLATOR_LAB, params);
    const { mode } = params;
    // One log per mode: their columns differ, and switching mode keeps the other mode's rows.
    const log = useDataLog(`oscillator-${mode}`, logColumns(mode));
    const set = (key) => (value) => setParams((p) => ({ ...p, [key]: value }));

    const { simRef, isPaused, togglePause, resume, pause, reset } = useSimulation(oscillatorSimulation, params, {
        render: (state) => {
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx) renderOscillator(ctx, state, params, { isDragging });
        },
        onSample: (t, y) => recordSample(log, t, () => logRow(t, y, params)),
    });
    const validation = useLiveValue(() => validationRows(simRef.current.getState(), params));
    const smallAngle = useLiveValue(() => smallAngleComparison(simRef.current.getState(), params));

    // ---------- direct manipulation (pointer events: mouse, pen and touch) ----------

    const pointerPosition = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        return { mx: e.clientX - rect.left, my: e.clientY - rect.top };
    };

    const handlePointerDown = (e) => {
        const canvas = canvasRef.current;
        const { mx, my } = pointerPosition(e);
        const { width, height } = cssSize(canvas); // pointer coordinates are CSS pixels
        const layout = oscillatorLayout(width, height);
        const [x] = simRef.current.getState().y;

        let hit;
        if (mode === 'pendulum') {
            const bob = bobPosition(layout, x, params.lengthM);
            hit = Math.hypot(mx - bob.x, my - bob.y) < BOB_RADIUS + DRAG_HIT_SLOP;
        } else {
            const top = blockTop(layout, x);
            hit = Math.abs(mx - layout.centerX) < BLOCK_SIZE / 2 && my > top && my < top + BLOCK_SIZE;
        }
        if (!hit) return;

        canvas.setPointerCapture(e.pointerId);
        dragRef.current = { layout };
        pause();
        setIsDragging(true);
    };

    const handlePointerMove = (e) => {
        if (!dragRef.current) return;
        const { mx, my } = pointerPosition(e);
        const { layout } = dragRef.current;
        const state = simRef.current.getState();
        const round2 = (v) => Math.round(v * 100) / 100;

        if (mode === 'pendulum') {
            const dx = mx - layout.centerX;
            const dy = my - layout.pivotY;
            const angleDeg = Math.round(clamp(radToDeg(Math.atan2(dx, dy)), FIELDS.startAngleDeg.min, FIELDS.startAngleDeg.max));
            const lengthM = round2(clamp(Math.hypot(dx, dy) / layout.pxPerM, FIELDS.lengthM.min, FIELDS.lengthM.max));
            setParams((p) => ({ ...p, startAngleDeg: angleDeg, lengthM }));
            holdAt(state, degToRad(angleDeg));
        } else {
            const { max } = FIELDS.amplitudeM;
            const displacement = clamp((my - BLOCK_SIZE / 2 - layout.centerY) / layout.pxPerM, -max, max);
            set('amplitudeM')(Math.max(FIELDS.amplitudeM.min, round2(Math.abs(displacement))));
            holdAt(state, displacement);
        }
    };

    const endDrag = () => {
        if (!dragRef.current) return;
        dragRef.current = null;
        setIsDragging(false);
        resume(); // letting go releases the bob/block
    };

    // ---------- controls ----------

    const switchMode = (next) => {
        if (next === mode) return;
        const nextParams = { ...params, mode: next };
        setParams(nextParams);
        reset(nextParams);
    };

    // Start angle / amplitude are initial conditions, so changing them restarts
    // from rest; every other parameter applies to the motion in progress.
    const restartWith = (key) => (value) => {
        const nextParams = { ...params, [key]: value };
        setParams(nextParams);
        reset(nextParams);
    };

    const slider = (key, onChange = set(key), accentColor) => (
        <ParamSlider {...sliderProps(FIELDS[key])} value={params[key]} onChange={onChange} accentColor={accentColor} />
    );

    const report = () => ({
        name: `oscillator-${mode}-${params.integrator}`,
        metadata: [
            ['experiment', `${OSCILLATOR_LAB.title}: ${mode}`],
            ['model', MODEL_CARDS[mode].equations[0]],
            ['method', INTEGRATORS[params.integrator].name],
            ['link', link],
            ['exported', new Date().toISOString()],
        ],
    });

    return (
        <div className={styles.page}>
            <div className={styles.stage}>
                <SimulationCanvas
                    canvasRef={canvasRef}
                    role="img"
                    aria-label={mode === 'pendulum' ? 'Pendulum simulation' : 'Spring-mass simulation'}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    style={{ touchAction: 'none' }}
                />
                <HomeButton />
            </div>

            <SimulationControls title="Oscillator Lab" placement="sidebar-right" titleGradient="linear-gradient(90deg, #f1c40f, #e67e22)">
                <ExperimentBar lab={OSCILLATOR_LAB} params={params} link={link} rejected={rejected} />

                <div role="group" aria-label="Oscillator type" className={styles.modeSwitch}>
                    {MODES.map(({ id, label }) => (
                        <button key={id} type="button" data-mode={id} aria-pressed={mode === id} onClick={() => switchMode(id)}>
                            {label}
                        </button>
                    ))}
                </div>

                {mode === 'pendulum' ? (
                    <>
                        {slider('lengthM', undefined, '#f1c40f')}
                        {slider('startAngleDeg', restartWith('startAngleDeg'), '#4facfe')}
                        {slider('gravity', undefined, '#2ecc71')}
                    </>
                ) : (
                    <>
                        {slider('mass', undefined, '#e74c3c')}
                        {slider('k', undefined, '#e74c3c')}
                        {slider('amplitudeM', restartWith('amplitudeM'), '#4facfe')}
                    </>
                )}
                {slider('damping', undefined, '#aaa')}

                <div className={controls.selectRow}>
                    <label htmlFor="osc-integrator">Integrator</label>
                    <select id="osc-integrator" className={controls.select} value={params.integrator} onChange={(e) => set('integrator')(e.target.value)}>
                        {INTEGRATOR_LIST.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                </div>
                <div className={controls.selectRow}>
                    <label htmlFor="osc-dt">Timestep Δt</label>
                    <select id="osc-dt" className={controls.select} value={params.dt} onChange={(e) => set('dt')(Number(e.target.value))}>
                        {TIMESTEP_OPTIONS.map((v) => <option key={v} value={v}>{v * 1000} ms</option>)}
                    </select>
                </div>

                <div className={controls.buttonRow}>
                    <button className={controls.primaryButton} onClick={togglePause}>
                        {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
                    </button>
                    <button className={controls.secondaryButton} onClick={() => reset(params)}>
                        ↺ RESET
                    </button>
                </div>
                <p className={controls.note}>
                    {mode === 'pendulum'
                        ? 'Drag the bob to set length and angle.'
                        : 'Vertical spring measured from equilibrium, so gravity does not affect the motion. Drag the block to set the amplitude.'}
                    {' '}Changing the start angle/amplitude restarts from rest; other parameters apply to the motion in progress.
                </p>

                <div className={styles.panels}>
                    <ValidationPanel compact title="Verification" rows={validation}
                        caption="Period: time between downward zero crossings, located within the step by cubic Hermite interpolation. Updated four times a second." />
                    {smallAngle && (
                        <p className={`${controls.note} ${controls.noteTight}`}>
                            Small-angle formula 2π√(L/g) = {formatMeasurement(smallAngle.smallAngle)} s. The exact period
                            is {formatPercent(smallAngle.longerBy)} longer: that is the sin θ ≈ θ approximation, not a numerical error.
                        </p>
                    )}
                    <DataLogPanel key={`oscillator-${mode}`} log={log} report={report} />
                </div>
                <p className={controls.note}>
                    <Link to="/numerical-methods">Compare Euler, symplectic Euler and RK4 side by side →</Link>
                </p>
            </SimulationControls>

            <div className={styles.below}>
                <ModelCard id="oscillator" model={MODEL_CARDS[mode]} />
            </div>
        </div>
    );
};

export default OscillatorLab;
