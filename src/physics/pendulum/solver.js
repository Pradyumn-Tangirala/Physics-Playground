// Step-by-step worked solution for the pendulum "Calc" page: the small-angle
// period, and the exact period at the given release angle from the same
// model the Oscillator Lab validates against (pendulum.js).

import { firstError, requirePositive, requireInRange } from '../../utils/validation.js';
import { degToRad } from '../../utils/units.js';
import { exactPeriod, smallAnglePeriod } from './pendulum.js';

/** The exact period diverges at 180° (the pendulum balances upside down). */
const MAX_RELEASE_ANGLE_DEG = 179;

export function solvePendulum({ length, gravity, amplitudeDeg = 5 }) {
    const error = firstError(
        requirePositive(length, 'Length'),
        requirePositive(gravity, 'Gravity'),
        requireInRange(amplitudeDeg, 'Release angle', 0, MAX_RELEASE_ANGLE_DEG, '°'),
    );
    if (error) return { error };

    const ratio = length / gravity;
    const period = smallAnglePeriod(length, gravity);
    const frequency = 1 / period;
    const exact = exactPeriod(degToRad(amplitudeDeg), length, gravity);
    const k = Math.sin(degToRad(amplitudeDeg) / 2);

    return {
        period,
        frequency,
        exactPeriod: exact,
        steps: [
            'Small-angle period: T₀ = 2π·√(L/g)',
            `Substitute: T₀ = 2π·√(${length} / ${gravity})`,
            `Inside the root: ${length} / ${gravity} = ${ratio.toFixed(4)}`,
            `Square root: √${ratio.toFixed(4)} = ${Math.sqrt(ratio).toFixed(4)}`,
            `Multiply by 2π: T₀ = ${period.toFixed(4)} s`,
            `Frequency: f = 1/T₀ = ${frequency.toFixed(4)} Hz`,
            `Exact period at θ₀ = ${amplitudeDeg}°: T = 4·√(L/g)·K(k²) with k = sin(θ₀/2) = ${k.toFixed(4)}, so T = ${exact.toFixed(4)} s`,
            `The small-angle formula is off by ${(100 * (exact - period) / exact).toFixed(3)}% at this amplitude`,
        ],
    };
}
