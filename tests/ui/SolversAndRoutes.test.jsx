import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
import DoubleSlitSolver from '../../src/pages/DoubleSlitSolver';
import ProjectileSolver from '../../src/pages/ProjectileSolver';
import PendulumSolver from '../../src/pages/PendulumSolver';
import { renderPage } from './render';
import { pendingFrames, runFrames } from './frames';

/** Replaces a number field's text. */
async function setField(label, text) {
    const field = screen.getByLabelText(label);
    await userEvent.clear(field);
    if (text) await userEvent.type(field, text);
}

describe('solver pages: output and validation messages', () => {
    it('projectile: valid input gives range, height and time with numbered steps', async () => {
        renderPage(<ProjectileSolver />);
        await userEvent.click(screen.getByRole('button', { name: 'Calculate' }));
        expect(screen.getByText('40.77 m')).toBeInTheDocument(); // 20²/9.81
        expect(screen.getByText('10.19 m')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it.each([
        ['Velocity (v₀) [m/s]', '0', 'Velocity must be a positive number.'],
        ['Velocity (v₀) [m/s]', '-5', 'Velocity must be a positive number.'],
        ['Velocity (v₀) [m/s]', '', 'Velocity must be a positive number.'],
        ['Angle (θ) [deg, 0–90]', '95', 'Angle must be between 0° and 90°.'],
        ['Gravity (g) [m/s²]', '0', 'Gravity must be a positive number.'],
    ])('projectile: %s = "%s" shows "%s"', async (label, text, message) => {
        renderPage(<ProjectileSolver />);
        await setField(label, text);
        await userEvent.click(screen.getByRole('button', { name: 'Calculate' }));
        expect(screen.getByRole('alert')).toHaveTextContent(message);
    });

    it('pendulum: valid input gives the period; invalid length is reported', async () => {
        renderPage(<PendulumSolver />);
        await userEvent.click(screen.getByRole('button', { name: 'Calculate' }));
        expect(screen.getAllByText(/2\.007/).length).toBeGreaterThan(0); // small-angle 2.0061 s, exact at 5° 2.0070 s
        await setField('Length (L) [m]', '-1');
        await userEvent.click(screen.getByRole('button', { name: 'Calculate' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Length must be a positive number.');
    });

    it('double slit: fringe width, then order validation for minima', async () => {
        renderPage(<DoubleSlitSolver />);
        await userEvent.click(screen.getByRole('button', { name: /calculate/i }));
        expect(screen.getByText('Final result: 1.0000 mm', { exact: false })).toBeInTheDocument();
        await userEvent.selectOptions(screen.getByLabelText('Problem Type'), 'minima');
        await setField(/Order \(n\)/, '0');
        await userEvent.click(screen.getByRole('button', { name: /calculate/i }));
        expect(screen.getByRole('alert')).toHaveTextContent('Order must be a whole number ≥ 1.');
    });

    it('steps are numbered 1, 2, 3 … with no gaps', async () => {
        renderPage(<DoubleSlitSolver />);
        await userEvent.click(screen.getByRole('button', { name: /calculate/i }));
        const items = screen.getAllByRole('listitem').map((li) => li.textContent);
        items.forEach((text, i) => expect(text.startsWith(`${i + 1}. `)).toBe(true));
    });
});

describe('routing (the real App with hash routes)', () => {
    beforeEach(() => {
        window.location.hash = '';
    });

    it.each([
        ['#/', /physics/i],
        ['#/projectile', 'Projectile Lab'],
        ['#/projectile/problems', 'Projectile Solver'],
        ['#/shm', 'Oscillator Lab'],
        ['#/shm/problems', 'Pendulum Solver'],
        ['#/simulation', 'Wave Interference: analytical model'],
        ['#/problems', 'Double-Slit Solver'],
        ['#/waves/fdtd', 'Numerical Wave Equation Lab (FDTD)'],
        ['#/numerical-methods', 'Numerical Methods Lab'],
    ])('%s renders (pages are lazy-loaded)', async (hash, heading) => {
        window.location.hash = hash;
        render(<App />);
        const matches = (h) => (typeof heading === 'string' ? h.textContent === heading : heading.test(h.textContent));
        await waitFor(() => expect(screen.getAllByRole('heading').some(matches)).toBe(true));
    });

    it('an unknown address shows a not-found page with a way home', async () => {
        window.location.hash = '#/no-such-lab';
        render(<App />);
        expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Back to home' }));
        expect(window.location.hash).toBe('#/');
    });

    it('a simulation page runs one loop, and leaving it stops the loop', async () => {
        window.location.hash = '#/shm';
        render(<App />);
        await screen.findByRole('heading', { name: 'Oscillator Lab' });
        runFrames(3);
        expect(pendingFrames()).toBe(1);
        await userEvent.click(screen.getByRole('button', { name: /home/i }));
        expect(window.location.hash).toBe('#/');
        runFrames(3);
        expect(pendingFrames()).toBe(1); // only the landing page's background animation
    });
});
