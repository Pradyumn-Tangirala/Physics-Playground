import { useState } from 'react';
import { solvePendulum } from '../physics/pendulum/solver';
import { parseNumber } from '../utils/validation';
import { STANDARD_GRAVITY } from '../physics/constants';
import SimulateLink from '../components/SimulateLink';
import {
    SolverPage, SolverCard, NumberField, CalculateButton, SolverNote, SolutionBody, ResultTiles, SolutionSteps,
} from '../components/SolverPage';
import { OSCILLATOR_LAB } from '../experiments/labs';

const PendulumSolver = () => {
    const [length, setLength] = useState('1.0');
    const [gravity, setGravity] = useState(String(STANDARD_GRAVITY));
    const [amplitude, setAmplitude] = useState('5');
    const [solution, setSolution] = useState(null);

    const calculate = () => {
        const inputs = { length: parseNumber(length), gravity: parseNumber(gravity), amplitudeDeg: parseNumber(amplitude) };
        setSolution({ ...solvePendulum(inputs), inputs });
    };

    return (
        <SolverPage title="Pendulum Solver" accent="#f1c40f">
            <SolverCard title="Parameters">
                <NumberField label="Length (L) [m]" value={length} onChange={setLength} />
                <NumberField label="Gravity (g) [m/s²]" value={gravity} onChange={setGravity} />
                <NumberField label="Release angle (θ₀) [deg]" value={amplitude} onChange={setAmplitude} />
                <CalculateButton onClick={calculate} />
                <SolverNote>
                    The small-angle period is within 1% of the exact period for amplitudes up to about 23°; the exact
                    period holds at any angle below 180°.
                </SolverNote>
            </SolverCard>

            <SolverCard title="Solution">
                <SolutionBody solution={solution}>
                    {(s) => (
                        <>
                            <ResultTiles items={[
                                ['Small-angle T₀', `${s.period.toFixed(4)} s`],
                                [`Exact T at ${s.inputs.amplitudeDeg}°`, `${s.exactPeriod.toFixed(4)} s`],
                                ['Frequency 1/T₀', `${s.frequency.toFixed(4)} Hz`],
                            ]} />
                            <SolutionSteps steps={s.steps} />
                            <SimulateLink lab={OSCILLATOR_LAB}
                                params={{ mode: 'pendulum', lengthM: s.inputs.length, gravity: s.inputs.gravity, startAngleDeg: s.inputs.amplitudeDeg, damping: 0, integrator: 'rk4' }}
                                description="Opens the Oscillator Lab with this pendulum, undamped, solved with RK4." />
                        </>
                    )}
                </SolutionBody>
            </SolverCard>
        </SolverPage>
    );
};

export default PendulumSolver;
