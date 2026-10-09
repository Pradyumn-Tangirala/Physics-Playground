// Worked solutions for Young's double slit (small-angle approximation, D ≫ d).
// The formulas are the ones the wave lab uses (interference.js), so a solved
// problem can be opened in the lab with exactly the same model. Returns either
// { error } or a result with un-numbered steps; the page numbers them.

import { nmToM, mmToM, mToMm } from '../../utils/units.js';
import { firstError, requirePositive, requireInteger } from '../../utils/validation.js';
import { ordinal } from '../../utils/format.js';
import { fringeSpacing, predictedMaximum, predictedMinimum } from './interference.js';

/**
 * The lab setup for a solver problem: two narrow slits (point sources, a = 0),
 * in phase, equal amplitudes: the assumptions behind β = λD/d.
 */
const setupFor = ({ wavelengthNm, slitSeparationMm, screenDistanceM }) => ({
    mode: 'double',
    wavelength: nmToM(wavelengthNm),
    slitSeparation: mmToM(slitSeparationMm),
    slitWidth: 0,
    screenDistance: screenDistanceM,
    phase: 0,
    amplitude1: 1,
    amplitude2: 1,
});

/** type: 'fringe-width' | 'maxima' | 'minima' */
export function solveDoubleSlit({ type, wavelengthNm, slitSeparationMm, screenDistanceM, order }) {
    const error = firstError(
        requirePositive(wavelengthNm, 'Wavelength'),
        requirePositive(slitSeparationMm, 'Slit separation'),
        requirePositive(screenDistanceM, 'Screen distance'),
    );
    if (error) return { error };

    const setup = setupFor({ wavelengthNm, slitSeparationMm, screenDistanceM });
    const conversions = [
        `Convert wavelength (λ) to metres: ${wavelengthNm} nm = ${wavelengthNm} × 10⁻⁹ m`,
        `Convert slit separation (d) to metres: ${slitSeparationMm} mm = ${slitSeparationMm} × 10⁻³ m`,
    ];

    let title, formula, result, steps;

    if (type === 'fringe-width') {
        title = 'Fringe Width (β)';
        formula = 'β = (λ × D) / d';
        result = fringeSpacing(setup);
        steps = [
            ...conversions,
            `Apply formula: β = (${wavelengthNm}e-9 × ${screenDistanceM}) / ${slitSeparationMm}e-3`,
            `Calculate: β = ${result.toExponential(3)} m`,
        ];
    } else if (type === 'maxima' || type === 'minima') {
        // Bright fringes are counted from n = 0 (central maximum); dark fringes from n = 1.
        const orderError = requireInteger(order, 'Order', type === 'maxima' ? 0 : 1);
        if (orderError) return { error: orderError };
        const n = order;
        if (type === 'maxima') {
            title = `Position of ${n}${ordinal(n)} Maximum (yₙ)`;
            formula = 'yₙ = (n × λ × D) / d';
            result = predictedMaximum(setup, n).smallAngle;
        } else {
            title = `Position of ${n}${ordinal(n)} Minimum (yₙ)`;
            formula = 'yₙ = ((n − ½) × λ × D) / d';
            result = predictedMinimum(setup, n).smallAngle;
        }
        const factor = type === 'maxima' ? `${n}` : `(${n} − 0.5)`;
        steps = [
            `Identify order: n = ${n}`,
            ...conversions,
            `Apply formula: yₙ = ${factor} × ${wavelengthNm}e-9 × ${screenDistanceM} / ${slitSeparationMm}e-3`,
            `Calculate: yₙ = ${result.toExponential(3)} m`,
        ];
    } else {
        return { error: `Unknown problem type "${type}".` };
    }

    const resultMm = mToMm(result);
    steps.push(`Final result: ${resultMm.toFixed(4)} mm`);
    return { title, formula, steps, resultM: result, resultMm, setup };
}
