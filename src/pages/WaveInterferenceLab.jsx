import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import HomeButton from '../components/HomeButton';
import ParamSlider from '../components/ParamSlider';
import SimulationCanvas from '../components/SimulationCanvas';
import SimulationControls from '../components/SimulationControls';
import WaveModelNotes from '../components/WaveModelNotes';
import ExperimentBar from '../components/ExperimentBar';
import ValidationPanel from '../components/ValidationPanel';
import ModelCard from '../components/ModelCard';
import ScrollRegion from '../components/ScrollRegion';
import { downloadText, timestampedName } from '../components/download';
import { WAVE_LAB } from '../experiments/labs';
import { WAVE_MEDIA, WAVE_SETUPS, WAVE_RANGES, regimeOf, setupParams } from '../experiments/waveSetups';
import { useExperimentFromUrl, useExperimentUrl } from '../experiments/useExperiment';
import { MODEL_CARDS } from '../experiments/modelCards';
import { toCsv } from '../utils/csv';
import { formatScientific } from '../utils/format';
import controls from '../components/SimulationControls.module.css';
import { useSimulation } from '../simulation/useSimulation';
import { waveSimulation, slowMotionFactor } from '../simulation/waveSimulation';
import { createWaveRenderer, lengthUnit, SIMULATED_COLOR, THEORY_COLOR } from '../rendering/waveRenderer';
import {
    analyseScreen, frequency, fringeSpacing, envelopeZero, predictedMaximum, fringeComparison,
    fraunhoferDistance, apertureSize, fraunhoferIntensity,
} from '../physics/waves/interference';
import { degToRad, radToDeg } from '../utils/units';
import { useScreenMeasurement } from './waves/useScreenMeasurement';
import styles from './LabPage.module.css';

const THEMES = [
    ['electric-blue', 'Electric Blue'],
    ['laser-red', 'Laser Red'],
    ['laser-green', 'Laser Green'],
    ['cyan-magenta', 'Cyan / Magenta (sign of u)'],
    ['golden-fire', 'Golden Fire'],
    ['sunset', 'Sunset'],
    ['grayscale', 'Grayscale'],
];

const FIELDS = WAVE_LAB.fields;

const clean = (v) => Number(v.toPrecision(10)); // strip float noise from unit conversion

const WaveInterferenceLab = () => {
    const fieldRef = useRef(null);
    const chartRef = useRef(null);
    const [renderer] = useState(createWaveRenderer); // owns render-side caches for this page

    const { params: initial, rejected } = useExperimentFromUrl(WAVE_LAB);
    // The view is display-only, so it is kept apart from `setup`, the parameters the physics sees.
    const [setup, setSetup] = useState(() => {
        const { view: _view, ...physical } = initial;
        return physical;
    });
    const [viewMode, setViewMode] = useState(initial.view);
    const params = { ...setup, view: viewMode };
    const link = useExperimentUrl(WAVE_LAB, params);
    const [theme, setTheme] = useState('electric-blue');

    const regime = regimeOf(setup.setupId);
    const sliders = WAVE_RANGES[regime];
    const double = setup.mode === 'double';
    const update = (patch) => {
        setSetup((prev) => ({ ...prev, ...patch }));
        measure.clearMarkers();
    };
    const chooseSetup = (id) => {
        setSetup((prev) => ({ ...setupParams(id, prev.mode), phase: prev.phase, amplitude1: prev.amplitude1, amplitude2: prev.amplitude2 }));
        measure.reset();
    };

    const setupKey = JSON.stringify(setup);
    const analysis = useMemo(() => analyseScreen(setup), [setup]);
    const unit = lengthUnit(analysis.halfWidth);
    const f = frequency(setup);
    const beta = double ? fringeSpacing(setup) : NaN;
    const centre = double ? predictedMaximum(setup, 0).smallAngle : 0;
    const measure = useScreenMeasurement(analysis, { origin: centre, screenYAt: renderer.screenYAt });
    const { cursor, markers } = measure;
    const farField = fraunhoferDistance(apertureSize(setup), setup.wavelength);

    const { isPaused, togglePause } = useSimulation(waveSimulation, setup, {
        render: (state) => {
            if (fieldRef.current) renderer.renderField(fieldRef.current, state, setup, { mode: viewMode, theme, setupKey });
            if (chartRef.current) renderer.renderChart(chartRef.current, { analysis, setup, setupKey, theme, cursor, markers });
        },
    });

    const fmtY = (yv) => `${(yv * unit.factor).toFixed(unit.name === 'mm' ? 3 : 2)} ${unit.name}`;
    const patternUnit = double ? beta : envelopeZero(setup);

    const fringeRows = fringeComparison(setup, analysis);

    const quantity = double ? 'Fringe spacing β (from dark fringes)' : 'Central maximum width (between first minima)';
    const validationRows = [
        { quantity, reference: double ? 'small angle, λD/d' : 'small angle, 2λD/a', analytical: analysis.predicted * unit.factor, simulated: analysis.measured * unit.factor, unit: unit.name },
        { quantity, reference: 'Fraunhofer curve (exact angles, far field)', analytical: analysis.fraunhofer * unit.factor, simulated: analysis.measured * unit.factor, unit: unit.name },
    ];
    const exportPattern = () => downloadText(timestampedName(`screen-pattern-${setup.mode}-slit`), toCsv({
        metadata: [
            ['experiment', `${WAVE_LAB.title}: ${setup.mode} slit`],
            ['model', MODEL_CARDS.waves.equations[0]],
            ...Object.entries(FIELDS).map(([key, field]) => [`${field.label}${field.unit ? ` (${field.unit})` : ''}`, params[key]]),
            ['link', link],
            ['exported', new Date().toISOString()],
        ],
        header: ['y (m)', 'I simulated (phasor sum)', 'I theory (Fraunhofer)'],
        rows: analysis.y.map((y, i) => [y, analysis.intensity[i], fraunhoferIntensity(setup, y)]),
    }));

    const sliderValue = (key) => clean(setup[key] / sliders[key].factor);
    const slider = (key, label, extra = {}) => (
        <ParamSlider label={label} unit={sliders[key].unit} value={sliderValue(key)}
            min={sliders[key].min} max={sliders[key].max} step={sliders[key].step}
            onChange={(v) => update({ [key]: clean(v * sliders[key].factor) })} {...extra} />
    );

    return (
        <div className={styles.shell}>
        <div className={styles.page}>
            <header className={styles.header}>
                <HomeButton variant="inline" />
                <div>
                    <h1>Wave Interference: analytical model</h1>
                    <p>
                        Huygens–Fresnel phasor sum for one or two slits, in SI units. This page evaluates the analytical
                        solution; it does not solve the wave equation. For that, see
                        the <Link to="/waves/fdtd">Numerical Wave Equation Lab (FDTD) →</Link>
                        {' '}or the <Link to="/problems">worked solutions</Link>.
                    </p>
                </div>
            </header>

            <div className={styles.topRow}>
                <div className={`${styles.canvasCard} ${styles.sticky} ${styles.stage}`}>
                    <SimulationCanvas canvasRef={fieldRef} role="img"
                        aria-label={viewMode === 'field' ? 'Instantaneous wave field behind the slits' : 'Time-averaged intensity behind the slits'} />
                </div>

                <SimulationControls title="WAVE LAB" placement="inline" titleGradient="linear-gradient(90deg, #48dbfb, #a29bfe)">
                    <ExperimentBar lab={WAVE_LAB} params={params} link={link} rejected={rejected} />
                    <div className={`${controls.buttonRow} ${controls.topActions}`}>
                        <button className={controls.primaryButton} onClick={togglePause}
                            style={{ '--button-bg': 'linear-gradient(135deg, #0abde3, #6c5ce7)' }}>
                            {isPaused ? '▶ ANIMATE' : '⏸ FREEZE'}
                        </button>
                    </div>

                    <div className={controls.selectRow}>
                        <label htmlFor="wave-mode">Experiment</label>
                        <select id="wave-mode" className={controls.select} value={setup.mode}
                            onChange={(e) => update({ mode: e.target.value })}>
                            <option value="double">Double slit</option>
                            <option value="single">Single slit</option>
                        </select>
                    </div>
                    <div className={controls.selectRow}>
                        <label htmlFor="wave-preset">Setup</label>
                        <select id="wave-preset" className={controls.select} value={setup.setupId} onChange={(e) => chooseSetup(e.target.value)}>
                            {Object.entries(WAVE_SETUPS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
                        </select>
                    </div>
                    <div className={controls.selectRow}>
                        <label htmlFor="wave-medium">Wave speed c</label>
                        <select id="wave-medium" className={controls.select} disabled={regime === 'optical'}
                            value={Object.keys(WAVE_MEDIA).find((m) => WAVE_MEDIA[m].speed === setup.waveSpeed)}
                            onChange={(e) => update({ waveSpeed: WAVE_MEDIA[e.target.value].speed })}>
                            {Object.entries(WAVE_MEDIA).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
                        </select>
                    </div>

                    <p className={styles.groupLabel}>Geometry</p>
                    {slider('wavelength', 'Wavelength λ', { accentColor: '#48dbfb' })}
                    {double && slider('slitSeparation', 'Slit separation d', { accentColor: '#a29bfe' })}
                    {slider('slitWidth', 'Slit width a', { accentColor: '#ff9f43', hint: setup.slitWidth === 0 ? 'point source' : undefined })}
                    <ParamSlider label={FIELDS.screenDistance.label} unit="m" value={setup.screenDistance}
                        min={FIELDS.screenDistance.min} max={FIELDS.screenDistance.max} step={FIELDS.screenDistance.step}
                        onChange={(v) => update({ screenDistance: v })} accentColor="#2ecc71" />

                    <p className={styles.groupLabel}>Sources</p>
                    <ParamSlider label={double ? 'Amplitude A₁ (slit 1, upper)' : 'Source amplitude A'} value={setup.amplitude1} min={FIELDS.amplitude1.min} max={FIELDS.amplitude1.max} step={FIELDS.amplitude1.step}
                        onChange={(v) => update({ amplitude1: v })} accentColor="#fff" />
                    {double && (
                        <>
                            <ParamSlider label="Amplitude A₂ (slit 2, lower)" value={setup.amplitude2} min={FIELDS.amplitude2.min} max={FIELDS.amplitude2.max} step={FIELDS.amplitude2.step}
                                onChange={(v) => update({ amplitude2: v })} accentColor="#fff" />
                            <ParamSlider label="Phase difference φ (slit 2)" unit="°" value={Math.round(radToDeg(setup.phase))} min={-180} max={180} step={1}
                                onChange={(v) => update({ phase: degToRad(v) })} accentColor="#feca57" />
                        </>
                    )}

                    <dl className={controls.readout}>
                        <dt>Frequency f = c/λ</dt><dd>{formatScientific(f)} Hz</dd>
                        <dt>Animation slowed by</dt><dd>{formatScientific(slowMotionFactor(f))}×</dd>
                        {double && <><dt>Fringe spacing λD/d</dt><dd>{fmtY(beta)}</dd></>}
                        {setup.slitWidth > 0 && <><dt>Envelope zero λD/a</dt><dd>{setup.slitWidth > setup.wavelength ? fmtY(envelopeZero(setup)) : 'none (a < λ)'}</dd></>}
                        <dt>Far-field ratio D / (L²/λ)</dt><dd>{(setup.screenDistance / farField).toPrecision(3)}</dd>
                    </dl>

                    <p className={styles.groupLabel}>Display</p>
                    <div className={controls.selectRow}>
                        <label htmlFor="wave-view">Field view</label>
                        <select id="wave-view" className={controls.select} value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
                            <option value="field">Instantaneous field u</option>
                            <option value="intensity">Time-averaged intensity |U|²</option>
                        </select>
                    </div>
                    <div className={controls.selectRow}>
                        <label htmlFor="wave-theme">Colours</label>
                        <select id="wave-theme" className={controls.select} value={theme} onChange={(e) => setTheme(e.target.value)}>
                            {THEMES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                        </select>
                    </div>
                    <p className={controls.note}>
                        The field view is drawn to scale. The animation runs at a fixed display rate; intensities are time
                        averages and do not depend on it.
                    </p>
                </SimulationControls>
            </div>

            <section className={styles.card} aria-labelledby="screen-title">
                <h2 id="screen-title">Screen pattern: simulated vs theory</h2>
                <p className={styles.caption}>
                    <span style={{ color: SIMULATED_COLOR }}>Simulated</span>: the phasor sum evaluated on the screen at
                    x = D. <span style={{ color: THEORY_COLOR }}>Theory</span>: the Fraunhofer (far-field) formula
                    {double ? ' I = cos θ·[A₁² + A₂² + 2A₁A₂ cos(kd sin θ + φ)]·sinc²(ka sin θ/2)' : ' I = cos θ·A²·sinc²(ka sin θ/2)'}.
                    {' '}Measure with the cursor: click (or focus the chart and press Enter) to place markers A and B; arrow keys
                    move the cursor{measure.snap ? ' from fringe to fringe' : ''}; Escape clears.
                </p>
                <div className={styles.experimentControls}>
                    <label>
                        <input type="checkbox" checked={measure.snap} onChange={(e) => measure.setSnap(e.target.checked)} /> Snap to bright and dark fringes
                    </label>
                    {markers.length > 0 && (
                        <button className={`${controls.secondaryButton} ${controls.smallButton}`}
                            onClick={measure.clearMarkers}>Clear markers</button>
                    )}
                    <button className={`${controls.secondaryButton} ${controls.smallButton}`}
                        onClick={exportPattern}>Export pattern (CSV)</button>
                </div>
                <div className={`${styles.canvasCard} ${styles.chart}`}>
                    <SimulationCanvas
                        canvasRef={chartRef}
                        role="img"
                        tabIndex={0}
                        aria-label="Screen intensity chart. Arrow keys move the measurement cursor, Enter places a marker, Escape clears markers."
                        className={styles.measureCanvas}
                        {...measure.chartHandlers}
                    />
                </div>
                <div className={styles.measureRow} aria-live="polite">
                    {cursor !== null ? (
                        <span>
                            Cursor y = <strong>{fmtY(cursor)}</strong> · I<sub>sim</sub> = {measure.intensityAt(cursor).toFixed(4)} ·
                            I<sub>theory</sub> = {fraunhoferIntensity(setup, cursor).toFixed(4)}
                            {double && <> · (y − y₀)/β = {((cursor - centre) / beta).toFixed(3)}</>}
                        </span>
                    ) : <span>Move over the chart to read positions and intensities.</span>}
                    {markers.length > 0 && (
                        <span>
                            A = {fmtY(markers[0])}
                            {markers.length === 2 && (
                                <> · B = {fmtY(markers[1])} · <strong>Δy = {fmtY(Math.abs(markers[1] - markers[0]))}</strong>
                                    {' '}= {(Math.abs(markers[1] - markers[0]) / patternUnit).toFixed(3)} × {double ? 'λD/d' : 'λD/a'}</>
                            )}
                        </span>
                    )}
                </div>
            </section>

            <section className={styles.card} aria-labelledby="measure-title">
                <h2 id="measure-title">{double ? 'Fringe spacing: predicted vs measured' : 'Central maximum: predicted vs measured'}</h2>
                <ValidationPanel title="Verification: phasor-sum simulation vs analytical formulas" rows={validationRows} />
                <p className={styles.caption}>
                    Profile error, RMS(simulated − theory) / theoretical peak over the whole screen shown:
                    <strong> {analysis.profileErrorPct.toFixed(3)}%</strong>. "Sim vs formula" includes the small-angle
                    approximation (sin θ ≈ tan θ ≈ θ); "Sim vs Fraunhofer" isolates near-field (Fresnel) effects, which shrink as
                    D grows past L²/λ = {fmtY(farField)} (currently D = {(setup.screenDistance / farField).toPrecision(3)} × L²/λ).
                </p>

                <h3 className={styles.subTitle}>{double ? 'Bright fringe positions' : 'Dark fringe (minimum) positions'}</h3>
                <ScrollRegion label="Fringe positions">
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Order m</th>
                                <th>{double ? 'Small angle (m − φ/2π)λD/d' : 'Small angle mλD/a'}</th>
                                <th>Fraunhofer {double ? 'maximum' : 'minimum'}</th>
                                <th>Simulated</th>
                                <th>Sim − Fraunhofer</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fringeRows.map((r) => (
                                <tr key={r.m}>
                                    <td>{r.m}</td>
                                    <td>{fmtY(r.smallAngle)}</td>
                                    <td>{r.missing ? 'missing order' : fmtY(r.fraunhofer)}</td>
                                    <td>{r.missing ? '—' : fmtY(r.simulated)}</td>
                                    <td>{Number.isFinite(r.simulated - r.fraunhofer) ? `${((100 * (r.simulated - r.fraunhofer)) / patternUnit).toFixed(3)}% of ${double ? 'β' : 'λD/a'}` : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </ScrollRegion>
                {double && fringeRows.some((r) => r.missing) && (
                    <p className={styles.caption}>
                        A missing order falls on a zero of the single-slit envelope: there the two-slit maximum is multiplied
                        by zero (it happens when d/a is a whole number).
                    </p>
                )}
                {double && (
                    <p className={styles.caption}>
                        Bright fringes are pulled slightly towards the centre by the sloping envelope, which is why the spacing
                        above is measured from the dark fringes. The Fraunhofer column includes this pull; the small-angle
                        column does not.
                    </p>
                )}
            </section>

            <ModelCard id="waves" model={MODEL_CARDS.waves} />
            <WaveModelNotes />
        </div>
        </div>
    );
};

export default WaveInterferenceLab;
