import { useState } from 'react';
import { solveDoubleSlit } from '../physics/waves/doubleSlit';
import { parseNumber } from '../utils/validation';
import SimulateLink from '../components/SimulateLink';
import {
    SolverPage, SolverCard, NumberField, SelectField, CalculateButton, SolutionBody, SolutionSteps,
} from '../components/SolverPage';
import { WAVE_LAB } from '../experiments/labs';
import { WAVE_MEDIA } from '../experiments/waveSetups';

const PROBLEM_TYPES = [
    ['fringe-width', 'Find Fringe Width (β)'],
    ['maxima', 'Find Position of Maxima'],
    ['minima', 'Find Position of Minima'],
];

const DoubleSlitSolver = () => {
    const [problemType, setProblemType] = useState('fringe-width');
    const [wavelength, setWavelength] = useState('500'); // nm
    const [slitSeparation, setSlitSeparation] = useState('0.5'); // mm
    const [screenDistance, setScreenDistance] = useState('1.0'); // m
    const [order, setOrder] = useState('1');
    const [solution, setSolution] = useState(null);

    const calculate = () => {
        setSolution(solveDoubleSlit({
            type: problemType,
            wavelengthNm: parseNumber(wavelength),
            slitSeparationMm: parseNumber(slitSeparation),
            screenDistanceM: parseNumber(screenDistance),
            order: parseNumber(order),
        }));
    };

    return (
        <SolverPage title="Double-Slit Solver" accent="#4facfe">
            <SolverCard title="Parameters">
                <SelectField id="problem-type" label="Problem Type" value={problemType} options={PROBLEM_TYPES}
                    onChange={(type) => { setProblemType(type); setSolution(null); }} />
                <NumberField label="Wavelength (λ) [nm]" value={wavelength} onChange={setWavelength} />
                <NumberField label="Slit Separation (d) [mm]" value={slitSeparation} onChange={setSlitSeparation} />
                <NumberField label="Screen Distance (D) [m]" value={screenDistance} onChange={setScreenDistance} />
                {problemType !== 'fringe-width' && (
                    <NumberField label={`Order (n) [${problemType === 'maxima' ? '0 = central maximum' : 'n ≥ 1'}]`}
                        value={order} onChange={setOrder} />
                )}
                <CalculateButton onClick={calculate} />
            </SolverCard>

            <SolverCard title="Solution">
                <SolutionBody solution={solution}>
                    {(s) => (
                        <>
                            <h3>{s.title}</h3>
                            <SolutionSteps formula={s.formula} steps={s.steps} />
                            <SimulateLink lab={WAVE_LAB}
                                params={{ ...s.setup, setupId: 'laser', waveSpeed: WAVE_MEDIA.light.speed, view: 'intensity' }}
                                description="Opens the wave lab with these λ, d and D, and narrow slits (a = 0)." />
                        </>
                    )}
                </SolutionBody>
            </SolverCard>
        </SolverPage>
    );
};

export default DoubleSlitSolver;
