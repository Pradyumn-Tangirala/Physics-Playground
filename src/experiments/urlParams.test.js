import { describe, it, expect } from 'vitest';
import {
    checkParams, decodeParams, defaultParams, encodeParams, formatParamValue, sameParams,
} from './urlParams';
import { LABS, OSCILLATOR_LAB, METHODS_LAB, WAVE_LAB, experimentPath } from './labs';

const SCHEMA = {
    length: { param: 'L', kind: 'number', min: 0.5, max: 4, unit: 'm', default: 1, label: 'Length' },
    method: { param: 'method', kind: 'choice', choices: ['euler', 'rk4'], default: 'rk4', label: 'Method' },
    dt: { param: 'dt', kind: 'choice', choices: [0.001, 0.005, 0.01], default: 0.005, label: 'Timestep' },
    shown: { param: 'show', kind: 'set', choices: ['a', 'b', 'c'], default: ['a', 'b', 'c'], label: 'Shown' },
};

describe('encode / decode', () => {
    it('round-trips every lab’s defaults exactly, with nothing rejected', () => {
        for (const lab of LABS) {
            const params = defaultParams(lab.fields);
            const decoded = decodeParams(lab.fields, encodeParams(lab.fields, params));
            expect(decoded.rejected).toEqual([]);
            expect(decoded.params).toEqual(params);
        }
    });

    it('writes readable links: schema order, short numbers, commas kept', () => {
        expect(encodeParams(SCHEMA, { length: 0.1 + 0.2 + 1, method: 'euler', dt: 0.01, shown: ['a', 'c'] }))
            .toBe('L=1.3&method=euler&dt=0.01&show=a,c');
        expect(formatParamValue(600e-9)).toBe('6e-7');
    });

    it('accepts scientific notation such as wavelength=600e-9', () => {
        const { params, rejected } = decodeParams(WAVE_LAB.fields, '?setup=laser&wavelength=600e-9&separation=2e-4');
        expect(rejected).toEqual([]);
        expect(params.wavelength).toBe(6e-7);
        expect(params.slitSeparation).toBe(2e-4);
    });

    it('fills missing parameters with defaults and ignores unknown ones', () => {
        expect(decodeParams(SCHEMA, '?L=2&utm_source=x')).toEqual({
            params: { length: 2, method: 'rk4', dt: 0.005, shown: ['a', 'b', 'c'] },
            rejected: [],
        });
    });

    it('matches numeric choices despite float noise, and orders sets canonically', () => {
        const { params } = decodeParams(SCHEMA, '?dt=0.0050000000001&show=c,a');
        expect(params.dt).toBe(0.005);
        expect(params.shown).toEqual(['a', 'c']);
        expect(decodeParams(SCHEMA, '?show=').params.shown).toEqual([]);
    });
});

describe('rejection, never silent clamping', () => {
    it.each([
        ['L=9', 'length', /outside 0\.5–4 m/],
        ['L=abc', 'length', /not a number/],
        ['L=', 'length', /not a number/],
        ['method=verlet', 'method', /not one of euler, rk4/],
        ['dt=0.002', 'dt', /not one of/],
        ['show=a,z', 'shown', /contains values other than/],
    ])('%s is rejected and the default kept', (query, key, reason) => {
        const { params, rejected } = decodeParams(SCHEMA, query);
        expect(params[key]).toEqual(SCHEMA[key].default);
        expect(rejected).toEqual([expect.objectContaining({ key, label: SCHEMA[key].label, reason: expect.stringMatching(reason) })]);
    });

    it('bounds that depend on other parameters: the wave lab’s range follows its setup', () => {
        expect(decodeParams(WAVE_LAB.fields, '?setup=ripple&wavelength=6e-7').rejected).toHaveLength(1);
        expect(decodeParams(WAVE_LAB.fields, '?setup=laser&wavelength=6e-7').rejected).toEqual([]);
        // Light is the only medium for the optical setup.
        expect(decodeParams(WAVE_LAB.fields, '?setup=laser&wavelength=6e-7&c=343').rejected[0].key).toBe('waveSpeed');
    });

    it('checkParams lists what a lab cannot reproduce', () => {
        const params = { ...defaultParams(OSCILLATOR_LAB.fields), startAngleDeg: 120 };
        expect(checkParams(OSCILLATOR_LAB.fields, params).map((r) => r.key)).toEqual(['startAngleDeg']);
    });
});

describe('experiment links', () => {
    it('build a router path with the lab’s query', () => {
        const params = { ...defaultParams(METHODS_LAB.fields), methods: ['rk4'], dt: 0.02 };
        expect(experimentPath(METHODS_LAB, params)).toBe('/numerical-methods?angle=60&length=1&g=9.81&damping=0&dt=0.02&show=rk4');
    });

    it('sameParams compares what the link would contain', () => {
        const a = defaultParams(OSCILLATOR_LAB.fields);
        expect(sameParams(OSCILLATOR_LAB.fields, a, { ...a, lengthM: 2.0000000000001 })).toBe(true);
        expect(sameParams(OSCILLATOR_LAB.fields, a, { ...a, lengthM: 2.01 })).toBe(false);
    });
});
