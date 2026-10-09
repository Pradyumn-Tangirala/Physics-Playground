// Step-by-step worked solution for the projectile "Calc" page.

import { degToRad } from '../../utils/units.js';
import { firstError, requirePositive, requireInRange } from '../../utils/validation.js';
import { flightTime, maxHeight, range } from './projectile.js';

export function solveProjectile({ velocity, angleDeg, gravity }) {
    const error = firstError(
        requirePositive(velocity, 'Velocity'),
        requireInRange(angleDeg, 'Angle', 0, 90, '°'),
        requirePositive(gravity, 'Gravity'),
    );
    if (error) return { error };

    const theta = degToRad(angleDeg);
    const launch = { v0: velocity, theta, g: gravity };
    const T = flightTime(launch);
    const H = maxHeight(launch);
    const R = range(launch);
    const s = Math.sin(theta);

    return {
        timeOfFlight: T,
        maxHeight: H,
        range: R,
        steps: [
            `Convert angle to radians: ${angleDeg}° = ${theta.toFixed(4)} rad`,
            `Time of flight: T = 2·v₀·sin θ / g = (2 × ${velocity} × ${s.toFixed(4)}) / ${gravity} = ${T.toFixed(2)} s`,
            `Max height: H = v₀²·sin²θ / 2g = (${velocity}² × ${(s * s).toFixed(4)}) / (2 × ${gravity}) = ${H.toFixed(2)} m`,
            `Range: R = v₀²·sin 2θ / g = (${velocity}² × ${Math.sin(2 * theta).toFixed(4)}) / ${gravity} = ${R.toFixed(2)} m`,
        ],
    };
}
