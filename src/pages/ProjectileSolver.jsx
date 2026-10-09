import { useState } from 'react';
import { solveProjectile } from '../physics/projectile/solver';
import { parseNumber } from '../utils/validation';
import { STANDARD_GRAVITY } from '../physics/constants';
import SimulateLink from '../components/SimulateLink';
import {
    SolverPage, SolverCard, NumberField, CalculateButton, SolverNote, SolutionBody, ResultTiles, SolutionSteps,
} from '../components/SolverPage';
import { PROJECTILE_LAB } from '../experiments/labs';

const ProjectileSolver = () => {
    const [velocity, setVelocity] = useState('20');
    const [angle, setAngle] = useState('45');
    const [gravity, setGravity] = useState(String(STANDARD_GRAVITY));
    const [solution, setSolution] = useState(null);

    const calculate = () => {
        const inputs = { velocity: parseNumber(velocity), angleDeg: parseNumber(angle), gravity: parseNumber(gravity) };
        setSolution({ ...solveProjectile(inputs), inputs });
    };

    return (
        <SolverPage title="Projectile Solver" accent="#e74c3c">
            <SolverCard title="Parameters">
                <NumberField label="Velocity (v₀) [m/s]" value={velocity} onChange={setVelocity} />
                <NumberField label="Angle (θ) [deg, 0–90]" value={angle} onChange={setAngle} />
                <NumberField label="Gravity (g) [m/s²]" value={gravity} onChange={setGravity} />
                <CalculateButton onClick={calculate} />
                <SolverNote>Assumes level ground and no air resistance.</SolverNote>
            </SolverCard>

            <SolverCard title="Solution">
                <SolutionBody solution={solution}>
                    {(s) => (
                        <>
                            <ResultTiles items={[
                                ['Range', `${s.range.toFixed(2)} m`],
                                ['Height', `${s.maxHeight.toFixed(2)} m`],
                                ['Time', `${s.timeOfFlight.toFixed(2)} s`],
                            ]} />
                            <SolutionSteps steps={s.steps} />
                            <SimulateLink lab={PROJECTILE_LAB}
                                params={{ ...s.inputs, mode: 'compare', height: 0, rho: 0 }}
                                description="Opens the Projectile Lab with this launch and no air resistance (ρ = 0)." />
                        </>
                    )}
                </SolutionBody>
            </SolverCard>
        </SolverPage>
    );
};

export default ProjectileSolver;
