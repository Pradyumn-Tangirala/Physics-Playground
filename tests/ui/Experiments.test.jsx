// Experiment links, presets, "Simulate this", validation panels, data logging
// and CSV export, exercised through the pages as a user would.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
import OscillatorLab from '../../src/pages/OscillatorLab';
import ExperimentsPage from '../../src/pages/ExperimentsPage';
import NumericalMethodsLab from '../../src/pages/NumericalMethodsLab';
import { renderPage } from './render';
import { runFrames } from './frames';

const numberField = (name) => screen.getByRole('spinbutton', { name: new RegExp(`^${name} value`, 'i') });

/** Captures what downloadText() saves: stubs the object-URL API and anchor clicks. */
function captureDownloads() {
    const files = [];
    globalThis.URL.createObjectURL = vi.fn((blob) => {
        files.push({ blob });
        return 'blob:test';
    });
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
        files.at(-1).name = this.download;
    });
    return files;
}

afterEach(() => vi.restoreAllMocks());

describe('opening an experiment link', () => {
    it('loads every parameter from the query', () => {
        renderPage(<OscillatorLab />, '/shm', '?mode=spring&k=20&mass=4&amplitude=0.5&damping=0.1&method=symplectic&dt=0.002');
        expect(screen.getByRole('button', { name: 'Spring' })).toHaveAttribute('aria-pressed', 'true');
        expect(numberField('Spring Constant \\(k\\)')).toHaveValue(20);
        expect(numberField('Mass')).toHaveValue(4);
        expect(numberField('Amplitude A')).toHaveValue(0.5);
        expect(screen.getByLabelText('Integrator')).toHaveValue('symplectic');
        expect(screen.getByLabelText('Timestep Δt')).toHaveValue('0.002');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('says which values it could not use instead of clamping them', () => {
        renderPage(<OscillatorLab />, '/shm', '?length=12&method=leapfrog');
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Length L = “12”: outside 0.5–4 m');
        expect(alert).toHaveTextContent('Integrator = “leapfrog”');
        expect(numberField('Length L')).toHaveValue(2); // the default
    });
});

describe('Copy Experiment Link', () => {
    it('copies a link that reproduces the current settings', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        renderPage(<OscillatorLab />, '/shm', '?angle=12');
        await userEvent.click(screen.getByRole('button', { name: 'Copy Experiment Link' }));
        expect(writeText).toHaveBeenCalledTimes(1);
        expect(writeText.mock.calls[0][0]).toMatch(/#\/shm\?mode=pendulum&angle=12&length=2&g=9\.81&.*method=rk4&dt=0\.005$/);
        expect(await screen.findByText('Link copied to the clipboard.')).toBeInTheDocument();
    });

    it('shows the link for manual copying when the clipboard is blocked', async () => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
        renderPage(<OscillatorLab />, '/shm');
        await userEvent.click(screen.getByRole('button', { name: 'Copy Experiment Link' }));
        expect((await screen.findByLabelText('Copy this link:')).value).toContain('#/shm?mode=pendulum');
    });
});

describe('the address bar follows the experiment (real App, hash routing)', () => {
    beforeEach(() => { window.location.hash = ''; });

    it('writes changed parameters into the URL after a short pause', async () => {
        window.location.hash = '#/shm?angle=10';
        render(<App />);
        await screen.findByRole('heading', { name: 'Oscillator Lab' });
        expect(numberField('Start Angle')).toHaveValue(10);
        fireEvent.change(screen.getByRole('slider', { name: 'Start Angle' }), { target: { value: '25' } });
        await waitFor(() => expect(window.location.hash).toContain('angle=25'), { timeout: 2000 });
    });

    it('choosing a guided experiment loads it and says what to look for', async () => {
        window.location.hash = '#/shm';
        render(<App />);
        await screen.findByRole('heading', { name: 'Oscillator Lab' });
        await userEvent.selectOptions(screen.getByLabelText('Guided experiment'), 'nonlinear-pendulum');
        await waitFor(() => expect(numberField('Start Angle')).toHaveValue(90));
        expect(window.location.hash).toContain('angle=90');
        expect(screen.getByText(/18% longer than the small-angle formula/)).toBeInTheDocument();
        expect(screen.getByLabelText('Guided experiment')).toHaveValue('nonlinear-pendulum');
        // Moving a slider makes it a custom experiment again.
        fireEvent.change(screen.getByRole('slider', { name: 'Gravity' }), { target: { value: '5' } });
        expect(screen.getByLabelText('Guided experiment')).toHaveValue('');
    });

    it('keeps the data log when a guided experiment remounts the lab, and guards a reload until it is exported', async () => {
        const files = captureDownloads();
        const reloadIsGuarded = () => {
            const event = new Event('beforeunload', { cancelable: true });
            window.dispatchEvent(event);
            return event.defaultPrevented;
        };
        window.location.hash = '#/shm';
        render(<App />);
        await screen.findByRole('heading', { name: 'Oscillator Lab' });
        const panel = () => screen.getByRole('region', { name: 'Data logging' });
        const stored = () => Number(within(panel()).getByText(/rows stored/).textContent.match(/([\d,]+) rows/)[1].replace(/,/g, ''));

        await userEvent.click(within(panel()).getByRole('button', { name: '● Start logging' }));
        runFrames(30);
        await waitFor(() => expect(stored()).toBeGreaterThan(0)); // the counter refreshes on a timer
        const before = stored();
        expect(reloadIsGuarded()).toBe(true);

        await userEvent.selectOptions(screen.getByLabelText('Guided experiment'), 'nonlinear-pendulum');
        await waitFor(() => expect(numberField('Start Angle')).toHaveValue(90)); // remounted from the new link
        runFrames(30); // still recording: the new experiment continues the log as run 2
        await userEvent.click(within(panel()).getByRole('button', { name: '■ Stop logging' }));
        expect(stored()).toBeGreaterThan(before);
        expect(within(panel()).getByText(/rows stored/)).toHaveTextContent('not yet exported');

        await userEvent.click(within(panel()).getByRole('button', { name: 'Export CSV' }));
        const lines = (await files[0].blob.text()).split('\r\n');
        expect(lines.some((l) => l.startsWith('1,'))).toBe(true);
        expect(lines.some((l) => l.startsWith('2,'))).toBe(true);
        expect(within(panel()).getByText(/rows stored/)).toHaveTextContent('all exported');
        expect(reloadIsGuarded()).toBe(false);
    });
});

describe('Simulate this', () => {
    beforeEach(() => { window.location.hash = ''; });

    it('opens the projectile lab with the solved launch and no drag', async () => {
        window.location.hash = '#/projectile/problems';
        render(<App />);
        await screen.findByRole('heading', { name: 'Projectile Solver' });
        await userEvent.clear(screen.getByLabelText('Velocity (v₀) [m/s]'));
        await userEvent.type(screen.getByLabelText('Velocity (v₀) [m/s]'), '35');
        await userEvent.click(screen.getByRole('button', { name: 'Calculate' }));
        await userEvent.click(screen.getByRole('link', { name: 'Simulate this →' }));
        await screen.findByRole('heading', { name: 'Projectile Lab' });
        expect(numberField('Initial velocity v₀')).toHaveValue(35);
        expect(numberField('Launch angle θ')).toHaveValue(45);
        expect(numberField('Air density ρ')).toHaveValue(0);
    });

    it('opens the wave lab with the solved λ, d and D', async () => {
        window.location.hash = '#/problems';
        render(<App />);
        await screen.findByRole('heading', { name: 'Double-Slit Solver' });
        await userEvent.click(screen.getByRole('button', { name: 'Calculate' }));
        await userEvent.click(screen.getByRole('link', { name: 'Simulate this →' }));
        await screen.findByRole('heading', { name: /Wave Interference/ });
        expect(screen.getByLabelText('Setup')).toHaveValue('laser');
        expect(numberField('Wavelength λ')).toHaveValue(500);
        expect(numberField('Slit separation d')).toHaveValue(0.5);
        expect(numberField('Slit width a')).toHaveValue(0);
    });

    it('explains when the lab cannot show the solved problem', async () => {
        window.location.hash = '#/shm/problems';
        render(<App />);
        await screen.findByRole('heading', { name: 'Pendulum Solver' });
        await userEvent.clear(screen.getByLabelText('Release angle (θ₀) [deg]'));
        await userEvent.type(screen.getByLabelText('Release angle (θ₀) [deg]'), '120');
        await userEvent.click(screen.getByRole('button', { name: 'Calculate' }));
        expect(screen.queryByRole('link', { name: 'Simulate this →' })).not.toBeInTheDocument();
        expect(screen.getByRole('note')).toHaveTextContent('Start Angle = 120 is outside -90–90 °');
    });
});

describe('validation, logging and export in the Oscillator Lab', () => {
    it('shows analytical vs simulated values with absolute and relative errors', async () => {
        renderPage(<OscillatorLab />, '/shm', '?angle=20&length=1&g=9.81');
        runFrames(200); // > 1.5 periods
        const panel = screen.getByRole('region', { name: 'Verification' });
        await waitFor(() => expect(within(panel).getAllByRole('row')[1]).toHaveTextContent(/^Period Texact.*2\.0\d+ s.*2\.0\d+ s.*%$/));
        expect(within(panel).getByRole('columnheader', { name: 'Rel. error' })).toBeInTheDocument();
    });

    it('logs samples between start and stop, and exports them as CSV', async () => {
        const files = captureDownloads();
        renderPage(<OscillatorLab />, '/shm');
        const panel = screen.getByRole('region', { name: 'Data logging' });
        expect(within(panel).getByRole('button', { name: 'Export CSV' })).toBeDisabled();

        await userEvent.click(within(panel).getByRole('button', { name: '● Start logging' }));
        runFrames(30); // 0.5 s at 60 fps → 100 steps of 5 ms
        await userEvent.click(within(panel).getByRole('button', { name: '■ Stop logging' }));
        const stored = Number(within(panel).getByText(/rows stored/).textContent.match(/(\d+) rows/)[1]);
        expect(stored).toBeGreaterThanOrEqual(95);
        runFrames(30);
        expect(within(panel).getByText(/rows stored/)).toHaveTextContent(`${stored} rows`);

        await userEvent.click(within(panel).getByRole('button', { name: 'Export CSV' }));
        expect(files).toHaveLength(1);
        expect(files[0].name).toMatch(/^oscillator-pendulum-rk4-.*\.csv$/);
        const lines = (await files[0].blob.text()).split('\r\n');
        expect(lines).toContain('run,t (s),θ (rad),ω (rad/s),KE (J),PE (J),E (J),method,Δt (s),L (m),g (m/s²),m (kg),γ (1/s)');
        expect(lines.find((l) => l.startsWith('# link'))).toMatch(/#\/shm\?mode=pendulum/);
        expect(lines.filter((l) => /^1,0\.\d+,/.test(l))).toHaveLength(stored);

        await userEvent.click(within(panel).getByRole('button', { name: 'Clear' }));
        expect(within(panel).getByText(/rows stored/)).toHaveTextContent('0 rows');
    });
});

describe('Numerical Methods Lab', () => {
    it('runs the accuracy-vs-cost experiment and tabulates it', async () => {
        renderPage(<NumericalMethodsLab />, '/numerical-methods');
        await userEvent.click(screen.getByRole('button', { name: 'Run accuracy vs cost' }));
        const table = await screen.findByRole('region', { name: 'Accuracy and cost per method and timestep' }, { timeout: 5000 });
        expect(within(table).getAllByRole('row')).toHaveLength(1 + 8);
        expect(within(table).getByText(/^7\.30×10⁻⁴ · 400 · \d+ µs$/)).toBeInTheDocument(); // RK4, Δt = 100 ms
    });
});

describe('guided experiments page and model cards', () => {
    it('lists all eight experiments with links into the labs', () => {
        renderPage(<ExperimentsPage />, '/experiments');
        const links = screen.getAllByRole('link', { name: /^Open experiment:/ });
        expect(links).toHaveLength(8);
        expect(links[0]).toHaveAttribute('href', expect.stringMatching(/^\/shm\?mode=pendulum&angle=5&/));
    });

    it('every lab states its equations, assumptions, units and limitations', () => {
        renderPage(<OscillatorLab />, '/shm');
        const card = screen.getByRole('region', { name: /^Model:/ });
        for (const name of ['Equations', 'Assumptions', 'Units', 'Limitations']) {
            expect(within(card).getByRole('heading', { name })).toBeInTheDocument();
        }
    });
});
