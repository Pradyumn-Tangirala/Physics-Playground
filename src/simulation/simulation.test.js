import { describe, it, expect } from 'vitest';
import { createSimulation } from './simulationState';
import { projectileSimulation, launch, predictFlights } from './projectileSimulation';
import { oscillatorSimulation, holdAt, GRAPH_SAMPLE_DT } from './oscillatorSimulation';
import { TIMESTEP_OPTIONS } from '../utils/timeStep';
import { integratorComparison } from './integratorComparison';
import { exactPeriod } from '../physics/pendulum/pendulum';
import { waveSimulation, DISPLAY_FREQUENCY, slowMotionFactor } from './waveSimulation';
import { flightTime, range } from '../physics/projectile/projectile';

const pendulumParams = {
    mode: 'pendulum', startAngleDeg: 30, lengthM: 2, gravity: 9.8, amplitudeM: 1, mass: 2, k: 10, damping: 0,
    integrator: 'rk4', dt: 0.005,
};

/** Runs `seconds` of frames at `fps` and returns the last event seen. */
function run(sim, params, seconds, fps = 60) {
    let event = null;
    for (let i = 0; i < Math.round(seconds * fps); i++) event = sim.tick(1 / fps, params) ?? event;
    return event;
}

describe('simulation lifecycle (createSimulation)', () => {
    it('initialize → step → pause → resume → reset', () => {
        const sim = createSimulation(oscillatorSimulation, pendulumParams);
        const x0 = sim.getState().y[0];
        expect(x0).toBeCloseTo((30 * Math.PI) / 180, 12);

        run(sim, pendulumParams, 0.5);
        const moving = sim.getState().y[0];
        expect(moving).not.toBeCloseTo(x0, 3);

        sim.pause();
        run(sim, pendulumParams, 2);
        expect(sim.getState().y[0]).toBe(moving); // frozen while paused

        sim.resume();
        sim.tick(1 / 60, pendulumParams);
        expect(Math.abs(sim.getState().y[0] - moving)).toBeLessThan(0.05); // continues, no jump

        sim.reset(pendulumParams);
        expect(sim.getState().y[0]).toBe(x0);
        expect(sim.getState().history).toEqual([]);
    });
});

describe('projectileSimulation', () => {
    const params = {
        mode: 'compare', velocity: 60, angleDeg: 45, height: 0, gravity: 9.8,
        rho: 1.225, cd: 0.47, area: 0.0042, mass: 0.145, integrator: 'rk4', dt: 0.01, playbackSpeed: 2,
    };
    /** Fires a shot and runs frames until every trajectory has landed; returns { sim, frames, event }. */
    const fly = (p, fps = 60) => {
        const sim = createSimulation(projectileSimulation, p);
        sim.setState(launch(p));
        let frames = 0;
        let event = null;
        while (sim.getState().phase === 'flying' && frames < 1e6) {
            event = sim.tick(1 / fps, p) ?? event;
            frames++;
        }
        return { sim, frames, event };
    };

    it('stays idle until launched', () => {
        const sim = createSimulation(projectileSimulation, params);
        run(sim, params, 1);
        expect(sim.getState()).toMatchObject({ phase: 'idle', t: 0 });
    });

    it('ideal mode flies one closed-form shot; compare mode flies three', () => {
        expect(launch({ ...params, mode: 'ideal' }).runs.map((r) => r.id)).toEqual(['analytic']);
        expect(launch(params).runs.map((r) => r.id)).toEqual(['analytic', 'numeric', 'drag']);
    });

    it('the analytical shot lands exactly at (R, 0) after T and emits one landed event', () => {
        const { sim, event } = fly(params);
        const analytic = sim.getState().runs[0];
        const l = sim.getState().launch;
        expect(event).toEqual({ type: 'landed' });
        expect(analytic.y[0]).toBeCloseTo(range(l), 9);
        expect(analytic.y[1]).toBe(0);
        expect(flightTime(l)).toBeCloseTo(3600 * Math.SQRT2 / 60 / 9.8, 9);
    });

    it('live numerical shots land exactly where the prediction says, at any frame rate and playback speed', () => {
        const predicted = predictFlights(params);
        for (const [fps, playbackSpeed] of [[30, 1], [144, 10], [60, 0.5]]) {
            const { sim } = fly({ ...params, playbackSpeed }, fps);
            for (const id of ['numeric', 'drag']) {
                const run = sim.getState().runs.find((r) => r.id === id);
                const metrics = predicted.find((r) => r.id === id).metrics;
                expect(run.flight.landing.state[0]).toBe(metrics.range); // bit-for-bit: same steps, same solver
                expect(run.flight.landing.t).toBe(metrics.time);
            }
        }
    });

    it('uses the launch snapshot, not later parameter changes', () => {
        const sim = createSimulation(projectileSimulation, params);
        sim.setState(launch(params));
        run(sim, { ...params, velocity: 10, gravity: 25, dt: 0.1, integrator: 'euler' }, 1);
        const state = sim.getState();
        expect(state.launch.v0).toBe(60);
        expect(state.h).toBe(0.01);
        expect(state.integrator.id).toBe('rk4');
    });

    it('a diverging numerical shot ends the flight instead of running forever', () => {
        // k = 2·2·0.05/(2·0.01) = 10 m⁻¹, so 2k·v·Δt = 2·10·60·0.1 = 120 ≫ 2: explicit Euler blows up.
        const stiff = { ...params, rho: 2, cd: 2, area: 0.05, mass: 0.01, integrator: 'euler', dt: 0.1 };
        const { sim, frames } = fly(stiff);
        expect(sim.getState().phase).toBe('landed');
        expect(frames).toBeLessThan(10000);
        const drag = sim.getState().runs.find((r) => r.id === 'drag');
        expect(drag.diverged || drag.landed).toBe(true);
    });
});

describe('oscillatorSimulation', () => {
    it('samples the graph on simulated time, independent of frame rate', () => {
        const samples = (fps) => {
            const sim = createSimulation(oscillatorSimulation, pendulumParams);
            run(sim, pendulumParams, 2, fps);
            return sim.getState().history.length;
        };
        expect(samples(60)).toBe(Math.floor(2 / GRAPH_SAMPLE_DT));
        expect(Math.abs(samples(144) - samples(60))).toBeLessThanOrEqual(1);
    });

    it('keeps KE + PE equal to E_ref without damping', () => {
        const sim = createSimulation(oscillatorSimulation, { ...pendulumParams, startAngleDeg: 80 });
        run(sim, { ...pendulumParams, startAngleDeg: 80 }, 5);
        const { energy, energyRef } = sim.getState();
        expect(Math.abs(energy.total - energyRef) / energyRef).toBeLessThan(1e-6);
    });

    it('re-references energy when a parameter changes, without resetting the motion', () => {
        const sim = createSimulation(oscillatorSimulation, pendulumParams);
        run(sim, pendulumParams, 0.7);
        const before = sim.getState().y[0];
        const shorter = { ...pendulumParams, lengthM: 1 };
        sim.tick(0, shorter);
        const { y: [x], energy, energyRef } = sim.getState();
        expect(x).toBe(before);
        expect(energyRef).toBeCloseTo(energy.total, 12);
    });

    it('holdAt places the body at rest and syncs energy even while paused', () => {
        const sim = createSimulation(oscillatorSimulation, pendulumParams);
        sim.pause();
        holdAt(sim.getState(), 0.5);
        sim.tick(1 / 60, pendulumParams);
        const s = sim.getState();
        expect(s.y).toEqual([0.5, 0]);
        expect(s.energy.ke).toBe(0);
        expect(s.energyRef).toBeCloseTo(s.energy.pe, 12);
    });

    it('spring mode starts at the amplitude', () => {
        const params = { ...pendulumParams, mode: 'spring', amplitudeM: 0.8 };
        expect(createSimulation(oscillatorSimulation, params).getState().y[0]).toBe(0.8);
    });
});

describe('waveSimulation', () => {
    const params = { mode: 'double', wavelength: 0.02, waveSpeed: 0.25 };

    it('advances the display phase by 2π·DISPLAY_FREQUENCY·dt, whatever the physical frequency', () => {
        const sim = createSimulation(waveSimulation, params);
        sim.tick(0.1, params);
        expect(sim.getState().wavePhase).toBeCloseTo(2 * Math.PI * DISPLAY_FREQUENCY * 0.1, 12);
        expect(slowMotionFactor(12.5)).toBeCloseTo(12.5 / DISPLAY_FREQUENCY, 12);
    });

    it('does not advance while paused', () => {
        const sim = createSimulation(waveSimulation, params);
        sim.pause();
        sim.tick(0.1, params);
        expect(sim.getState().wavePhase).toBe(0);
    });
});

describe('oscillatorSimulation: energy reference', () => {
    it('after a reset, E_ref is the energy at release, not after the first frame', () => {
        const params = { ...pendulumParams, startAngleDeg: 60, integrator: 'euler', dt: 0.01 };
        const releaseEnergy = (p) => {
            const L = p.lengthM;
            return PENDULUM_MASS_FOR_TEST * p.gravity * L * (1 - Math.cos((p.startAngleDeg * Math.PI) / 180));
        };
        const sim = createSimulation(oscillatorSimulation, params);
        run(sim, params, 2); // running, so the next tick steps before it syncs
        sim.reset(params);
        sim.tick(1 / 60, params);
        expect(sim.getState().energyRef).toBeCloseTo(releaseEnergy(params), 12);
        // Euler gains energy every step, so a late reference would hide part of the drift.
        expect(sim.getState().energy.total).toBeGreaterThan(sim.getState().energyRef);
    });

    it('after a drag (holdAt), E_ref is the energy where the bob was released', () => {
        const params = { ...pendulumParams, integrator: 'euler', dt: 0.01 };
        const sim = createSimulation(oscillatorSimulation, params);
        run(sim, params, 1);
        holdAt(sim.getState(), (45 * Math.PI) / 180);
        sim.tick(1 / 60, params);
        expect(sim.getState().energyRef).toBeCloseTo(releaseEnergy45(params), 12);
    });
});

const PENDULUM_MASS_FOR_TEST = 1;
const releaseEnergy45 = (p) => PENDULUM_MASS_FOR_TEST * p.gravity * p.lengthM * (1 - Math.cos(Math.PI / 4));

describe('oscillatorSimulation: integrator and timestep', () => {
    it('emits measured periods close to the exact value with RK4', () => {
        const params = { ...pendulumParams, startAngleDeg: 60 };
        const sim = createSimulation(oscillatorSimulation, params);
        const periods = [];
        for (let i = 0; i < 60 * 12; i++) {
            const e = sim.tick(1 / 60, params);
            if (e?.type === 'period') periods.push(e.period);
        }
        const exact = exactPeriod(Math.PI / 3, params.lengthM, params.gravity);
        expect(periods.length).toBeGreaterThanOrEqual(2);
        periods.forEach((p) => expect(Math.abs(p - exact) / exact).toBeLessThan(1e-6));
    });

    it('the result does not depend on the frame rate, only on Δt', () => {
        const at = (fps) => {
            const sim = createSimulation(oscillatorSimulation, pendulumParams);
            run(sim, pendulumParams, 3, fps);
            return sim.getState();
        };
        const a = at(60);
        const b = at(144);
        // Same number of fixed steps (± one leftover step in the accumulator).
        expect(Math.abs(a.t - b.t)).toBeLessThanOrEqual(pendulumParams.dt + 1e-9);
    });

    it('explicit Euler gains energy where RK4 does not (same Δt)', () => {
        const drift = (integrator) => {
            const params = { ...pendulumParams, integrator, dt: 0.01 };
            const sim = createSimulation(oscillatorSimulation, params);
            run(sim, params, 10);
            const { energy, energyRef } = sim.getState();
            return (energy.total - energyRef) / energyRef;
        };
        expect(drift('euler')).toBeGreaterThan(0.1);
        expect(Math.abs(drift('rk4'))).toBeLessThan(1e-6);
    });

    it('keeps up with real time at the smallest Δt', () => {
        const params = { ...pendulumParams, dt: TIMESTEP_OPTIONS[0] };
        const sim = createSimulation(oscillatorSimulation, params);
        sim.tick(0.1, params); // longest allowed frame
        // No time is dropped: completed steps plus the carried remainder equal the frame.
        const { t, accumulator } = sim.getState();
        expect(t + accumulator).toBeCloseTo(0.1, 9);
        expect(accumulator).toBeLessThan(params.dt + 1e-12);
    });
});

describe('integratorComparison', () => {
    const params = { lengthM: 1, gravity: 9.81, damping: 0, amplitudeDeg: 60, dt: 0.01 };
    const byId = (state) => Object.fromEntries(state.runs.map((r) => [r.id, r]));

    it('starts all three methods from identical initial conditions', () => {
        const sim = createSimulation(integratorComparison, params);
        const runs = sim.getState().runs;
        expect(runs.map((r) => r.id)).toEqual(['euler', 'symplectic', 'rk4']);
        runs.forEach((r) => expect(r.y).toEqual(runs[0].y));
        runs.forEach((r) => expect(r.E0).toBe(runs[0].E0));
    });

    it('advances the methods in lock-step and separates their energy behaviour', () => {
        const sim = createSimulation(integratorComparison, params);
        run(sim, params, 20);
        const r = byId(sim.getState());
        expect(sim.getState().t).toBeCloseTo(20, 1);
        expect(r.euler.drift).toBeGreaterThan(0.2); // grows
        expect(Math.abs(r.symplectic.drift)).toBeLessThan(0.02); // bounded band ≈ ω₀Δt
        expect(Math.abs(r.rk4.drift)).toBeLessThan(1e-6); // conserved
        expect(r.rk4.energySamples.length).toBeGreaterThan(500);
        expect(r.rk4.phase.length).toBeGreaterThan(500);
    });

    it('reports measured periods per method; RK4 matches the exact period', () => {
        const sim = createSimulation(integratorComparison, params);
        const periods = {};
        for (let i = 0; i < 60 * 10; i++) {
            const e = sim.tick(1 / 60, params);
            if (e?.type === 'periods') Object.assign(periods, e.periods);
        }
        const exact = exactPeriod(Math.PI / 3, 1, 9.81);
        expect(Math.abs(periods.rk4 - exact) / exact).toBeLessThan(1e-6);
        expect(periods.euler).toBeGreaterThan(exact); // energy gain lengthens the period
    });
});
