// The long numerical studies of the Numerical Methods Lab, in a form that can
// be posted to a Web Worker: integrators are named by id (functions cannot be
// sent between threads), and the results are plain numbers.

import { accuracyVsCost, periodVsAmplitude } from '../physics/pendulum/experiments.js';
import { INTEGRATORS } from '../physics/integrators.js';

export const STUDIES = {
    /** args: { amplitude, length, g, integratorIds, dts, duration } → accuracyVsCost rows, timed */
    accuracyVsCost: ({ integratorIds, ...args }) => accuracyVsCost({
        ...args,
        integrators: integratorIds.map((id) => INTEGRATORS[id]),
        now: () => performance.now(),
    }),
    /** args: { amplitudesDeg, length, g, integratorId, dt } → periodVsAmplitude rows */
    periodVsAmplitude: ({ integratorId, ...args }) => periodVsAmplitude({ ...args, integrator: INTEGRATORS[integratorId] }),
};
