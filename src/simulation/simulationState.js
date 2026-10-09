// Framework-free simulation lifecycle. A simulation *definition* is a plain
// object of functions; the controller wraps it with pause/resume/reset.
//
//   definition.init(params)            → state      initialize / reset
//   definition.step(state, params, dt, sample?) → event?
//                                                   advance by dt seconds (mutates state); calls
//                                                   sample(t, data) after every integration
//                                                   step, for data logging
//   definition.sync?(state, params)                 keep derived values in step with params;
//                                                   runs every tick, even while paused
//
// Rendering is not part of the definition: a renderer reads the state and
// draws it, and never changes it.

export function createSimulation(definition, params) {
    let state = definition.init(params);
    let paused = false;

    return {
        getState: () => state,
        /** Replace the state (e.g. launching a projectile or dragging a bob). */
        setState(next) {
            state = next;
        },
        reset(nextParams) {
            state = definition.init(nextParams);
        },
        pause() {
            paused = true;
        },
        resume() {
            paused = false;
        },
        isPaused: () => paused,
        /** One frame: step (unless paused), then sync. Returns the step's event, if any. */
        tick(dt, currentParams, sample) {
            const event = paused ? null : definition.step(state, currentParams, dt, sample) ?? null;
            definition.sync?.(state, currentParams);
            return event;
        },
    };
}
