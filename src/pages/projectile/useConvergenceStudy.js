import { useState } from 'react';
import { launchFromParams } from '../../simulation/projectileSimulation';
import { INTEGRATOR_LIST } from '../../physics/integrators';
import { convergenceStudy } from '../../physics/projectile/experiments';
import { TIMESTEP_OPTIONS } from '../../utils/timeStep';

/**
 * State of the timestep-convergence experiment for launch parameters `p` and
 * drag constant `k`: the last result, whether the settings have changed since,
 * and the chosen drag setting and error metric.
 */
export function useConvergenceStudy(p, k) {
    const [drag, setDrag] = useState(false);
    const [metric, setMetric] = useState('rangeError');
    const [last, setLast] = useState(null); // { result, key }
    const key = JSON.stringify([p.velocity, p.angleDeg, p.height, p.gravity, drag ? k : 0]);
    const run = () => setLast({
        key,
        result: convergenceStudy({ launch: launchFromParams(p), k: drag ? k : 0, integrators: INTEGRATOR_LIST, dts: TIMESTEP_OPTIONS }),
    });
    return { result: last?.result ?? null, stale: last !== null && last.key !== key, drag, setDrag, metric, setMetric, run };
}
