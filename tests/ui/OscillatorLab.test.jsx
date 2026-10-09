import { describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OscillatorLab from '../../src/pages/OscillatorLab';
import NumericalMethodsLab from '../../src/pages/NumericalMethodsLab';
import { renderPage, nextFrameSignature, textOnNextFrame } from './render';
import { runFrames, pendingFrames } from './frames';

const canvas = () => screen.getByRole('img', { name: /simulation/i });

describe('Oscillator Lab (SHM page)', () => {
    it('starts animating with a single loop', () => {
        renderPage(<OscillatorLab />);
        expect(pendingFrames()).toBe(1);
        runFrames(2);
        expect(nextFrameSignature(canvas())).not.toBe(nextFrameSignature(canvas()));
    });

    it('pause freezes the picture; resume moves it again', async () => {
        renderPage(<OscillatorLab />);
        runFrames(10);
        await userEvent.click(screen.getByRole('button', { name: /pause/i }));
        expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
        const a = nextFrameSignature(canvas());
        runFrames(20);
        expect(nextFrameSignature(canvas())).toBe(a);
        await userEvent.click(screen.getByRole('button', { name: /resume/i }));
        expect(nextFrameSignature(canvas())).not.toBe(a);
    });

    it('reset returns the pendulum to its release state', async () => {
        renderPage(<OscillatorLab />);
        runFrames(1); // first frame: dt = 0
        const afterOneStep = nextFrameSignature(canvas());
        runFrames(90);
        await userEvent.click(screen.getByRole('button', { name: /reset/i }));
        expect(nextFrameSignature(canvas())).toBe(afterOneStep);
    });

    it('switching to the spring swaps the controls and the drawing', async () => {
        renderPage(<OscillatorLab />);
        expect(screen.getByRole('slider', { name: /length/i })).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Spring' }));
        expect(screen.getByRole('button', { name: 'Spring' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByRole('slider', { name: /length/i })).not.toBeInTheDocument();
        expect(screen.getByRole('slider', { name: /spring constant/i })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Spring-mass simulation' })).toBeInTheDocument();
        expect(textOnNextFrame(canvas())).toContain('x (m)');
    });

    it('controls update their values and the readouts', async () => {
        renderPage(<OscillatorLab />);
        fireEvent.change(screen.getByRole('slider', { name: /gravity/i }), { target: { value: '20' } });
        expect(screen.getByRole('spinbutton', { name: /gravity value/i })).toHaveValue(20);
        await userEvent.selectOptions(screen.getByLabelText('Integrator'), 'euler');
        expect(screen.getByLabelText('Integrator')).toHaveValue('euler');
    });

    it('draws the phase diagram with labelled axes', () => {
        renderPage(<OscillatorLab />);
        runFrames(30);
        const text = textOnNextFrame(canvas());
        expect(text).toContain('Phase space');
        expect(text).toContain('θ (°)');
        expect(text).toContain('ω (rad/s)');
    });

    it('Home returns to the landing page', async () => {
        renderPage(<OscillatorLab />);
        await userEvent.click(screen.getByRole('button', { name: /home/i }));
        expect(screen.getByRole('heading', { name: 'Landing page' })).toBeInTheDocument();
        expect(pendingFrames()).toBe(0); // the page's loop stopped when it unmounted
    });
});

describe('Numerical Methods Lab', () => {
    const phaseCanvas = () => screen.getByRole('img', { name: /phase-space/i });

    it('draws the phase portrait for all three methods', () => {
        renderPage(<NumericalMethodsLab />);
        runFrames(20);
        const text = textOnNextFrame(phaseCanvas());
        expect(text).toContain('Phase space (θ, ω)');
        expect(text).toEqual(expect.arrayContaining(['Explicit Euler', 'Symplectic Euler', 'RK4']));
    });

    it('measures periods as it runs, and restart clears them', async () => {
        renderPage(<NumericalMethodsLab />);
        runFrames(400); // > 2 periods of a 1 m pendulum
        const periodRows = () => screen.getAllByRole('row').map((r) => r.textContent).filter((t) => t.startsWith('Period, '));
        await waitFor(() => expect(periodRows().find((t) => t.startsWith('Period, RK4'))).toMatch(/2\.152\d+ s.*2\.152\d+ s/)); // exact T at 60° is 2.15287 s
        await userEvent.click(screen.getByRole('button', { name: /restart/i }));
        await waitFor(() => expect(periodRows().filter((t) => t.includes('measuring…'))).toHaveLength(3));
    });

    it('runs the period-vs-amplitude experiment and tabulates it', async () => {
        renderPage(<NumericalMethodsLab />);
        await userEvent.click(screen.getByRole('button', { name: /run experiment/i }));
        const rows = screen.getAllByRole('row').map((r) => r.textContent);
        expect(rows.some((t) => t.startsWith('90°') && t.includes('1.1803'))).toBe(true); // exact T/T₀ at 90°
        const chart = screen.getByRole('img', { name: /period divided by small-angle period/i });
        expect(textOnNextFrame(chart).length).toBeGreaterThan(3);
    });

    it('hiding a method removes it from the charts', async () => {
        renderPage(<NumericalMethodsLab />);
        await userEvent.click(screen.getByRole('checkbox', { name: 'Explicit Euler' }));
        runFrames(5);
        expect(textOnNextFrame(phaseCanvas())).not.toContain('Explicit Euler');
    });
});
