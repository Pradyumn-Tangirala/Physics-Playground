import { describe, it, expect } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectileLab from '../../src/pages/ProjectileLab';
import WaveInterferenceLab from '../../src/pages/WaveInterferenceLab';
import WaveEquationLab from '../../src/pages/WaveEquationLab';
import { renderPage, nextFrameSignature, nextFramePixels, textOnNextFrame } from './render';
import { runFrames } from './frames';

const firstTableRow = (name) => screen.getAllByRole('row').find((r) => r.textContent.startsWith(name));

describe('Projectile Lab', () => {
    it('shows predicted metrics that follow the controls', () => {
        renderPage(<ProjectileLab />);
        expect(firstTableRow('Analytical, no drag')).toHaveTextContent('366.972'); // v²/g at 60 m/s, 45°, g = 9.81
        fireEvent.change(screen.getByRole('slider', { name: /initial velocity/i }), { target: { value: '40' } });
        expect(firstTableRow('Analytical, no drag')).toHaveTextContent('163.099'); // 40²/9.81
    });

    it('fire starts a shot, locks the launch controls, and it lands', async () => {
        renderPage(<ProjectileLab />);
        const canvas = screen.getByRole('img', { name: 'Projectile trajectories' });
        await userEvent.click(screen.getByRole('button', { name: 'FIRE' }));
        expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
        expect(screen.getByRole('slider', { name: /initial velocity/i })).toBeDisabled();
        runFrames(30);
        expect(nextFrameSignature(canvas)).not.toBe(nextFrameSignature(canvas)); // in flight
        runFrames(300); // 8.7 s of flight at 2× playback
        expect(screen.getByRole('button', { name: 'FIRE' })).toBeInTheDocument();
        expect(textOnNextFrame(canvas).some((t) => t.includes('landed'))).toBe(true);
    });

    it('stop cancels the shot and unlocks the controls', async () => {
        renderPage(<ProjectileLab />);
        await userEvent.click(screen.getByRole('button', { name: 'FIRE' }));
        runFrames(10);
        await userEvent.click(screen.getByRole('button', { name: /stop/i }));
        expect(screen.getByRole('slider', { name: /initial velocity/i })).toBeEnabled();
    });

    it('ideal mode hides the drag and numerical controls and sections', async () => {
        renderPage(<ProjectileLab />);
        expect(screen.getByRole('slider', { name: /air density/i })).toBeInTheDocument();
        await userEvent.selectOptions(screen.getByLabelText('Model'), 'ideal');
        expect(screen.queryByRole('slider', { name: /air density/i })).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Integrator')).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: /convergence/i })).not.toBeInTheDocument();
        const metrics = screen.getByRole('region', { name: 'Flight metrics table' });
        expect(within(metrics).getAllByRole('row')).toHaveLength(2); // header + the analytical shot
    });

    it('runs the convergence study and reports observed orders', async () => {
        renderPage(<ProjectileLab />);
        await userEvent.click(screen.getByRole('button', { name: /run convergence study/i }));
        const orders = firstTableRow('Observed order');
        expect(orders).toHaveTextContent(/1\.00/);
        expect(orders).toHaveTextContent('round-off only'); // RK4 without drag
    });

    it('warns when the drag is too stiff for the timestep', async () => {
        renderPage(<ProjectileLab />);
        fireEvent.change(screen.getByRole('slider', { name: /mass m/i }), { target: { value: '0.01' } });
        fireEvent.change(screen.getByRole('slider', { name: /cross-section/i }), { target: { value: '0.05' } });
        await userEvent.selectOptions(screen.getByLabelText('Timestep Δt'), '0.1');
        expect(screen.getByRole('status')).toHaveTextContent(/2k·v·Δt/);
    });
});

describe('Wave Interference (analytical)', () => {
    it('switching to single slit hides the separation and phase controls', async () => {
        renderPage(<WaveInterferenceLab />);
        expect(screen.getByRole('slider', { name: /slit separation/i })).toBeInTheDocument();
        await userEvent.selectOptions(screen.getByLabelText('Experiment'), 'single');
        expect(screen.queryByRole('slider', { name: /slit separation/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('slider', { name: /phase difference/i })).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /central maximum/i })).toBeInTheDocument();
    });

    it('changing λ updates the predicted fringe spacing', () => {
        renderPage(<WaveInterferenceLab />);
        const spacing = () => firstTableRow('Fringe spacing β').textContent;
        expect(spacing()).toContain('λD/d20 cm'); // λD/d = 0.02·1/0.1
        fireEvent.change(screen.getByRole('slider', { name: /wavelength/i }), { target: { value: '30' } });
        expect(spacing()).toContain('λD/d30 cm');
    });

    it('the laser preset explains why the 2-D field is not drawn', async () => {
        renderPage(<WaveInterferenceLab />);
        await userEvent.selectOptions(screen.getByLabelText('Setup'), 'laser');
        const field = screen.getByRole('img', { name: /wave field|intensity behind/i });
        expect(textOnNextFrame(field).join(' ')).toMatch(/cannot be drawn to scale/);
        expect(firstTableRow('Fringe spacing β')).toHaveTextContent('2.5312 mm');
    });

    it('the measurement markers report Δy in fringes', async () => {
        renderPage(<WaveInterferenceLab />);
        runFrames(2);
        const chart = screen.getByRole('img', { name: /screen intensity chart/i });
        chart.focus();
        await userEvent.keyboard('{Enter}{ArrowRight}{ArrowRight}{Enter}');
        expect(screen.getByText(/Δy =/)).toBeInTheDocument();
        await userEvent.keyboard('{Escape}');
        expect(screen.queryByText(/Δy =/)).not.toBeInTheDocument();
    });

    it('the field animates, and freeze stops it', async () => {
        renderPage(<WaveInterferenceLab />);
        const field = screen.getByRole('img', { name: /wave field/i });
        runFrames(2);
        const before = nextFramePixels(field);
        expect(before).not.toBeNull();
        expect(nextFramePixels(field)).not.toBe(before); // the phase rotates every frame
        await userEvent.click(screen.getByRole('button', { name: /freeze/i }));
        const frozen = nextFramePixels(field);
        runFrames(5);
        expect(nextFramePixels(field)).toBe(frozen);
    });
});

describe('Numerical Wave Equation Lab', () => {
    it('warns immediately when the Courant number breaks the CFL condition, and reports the blow-up', () => {
        renderPage(<WaveEquationLab />);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        fireEvent.change(screen.getByRole('slider', { name: /courant/i }), { target: { value: '0.8' } });
        expect(screen.getByRole('alert')).toHaveTextContent('violates the CFL condition');
        runFrames(120);
        expect(screen.getByRole('status')).toHaveTextContent(/blew up after \d+ steps/);
    });

    it('restart clears a blown-up run', async () => {
        renderPage(<WaveEquationLab />);
        fireEvent.change(screen.getByRole('slider', { name: /courant/i }), { target: { value: '0.8' } });
        runFrames(120);
        fireEvent.change(screen.getByRole('slider', { name: /courant/i }), { target: { value: '0.5' } });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('labels itself as the numerical solver and shows the grid it built', () => {
        renderPage(<WaveEquationLab />);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Numerical Wave Equation Lab (FDTD)');
        expect(screen.getByText('500 × 301 = 151k cells')).toBeInTheDocument();
        runFrames(3);
        const field = screen.getByRole('img', { name: /fdtd wave field/i });
        expect(textOnNextFrame(field).some((t) => t.startsWith('FDTD solution'))).toBe(true);
    });
});
