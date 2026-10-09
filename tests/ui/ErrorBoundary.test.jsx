import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from '../../src/components/ErrorBoundary';

let shouldThrow = true;
function Fragile() {
    if (shouldThrow) throw new Error('canvas exploded');
    return <p>Page content</p>;
}

describe('ErrorBoundary', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {}); // React logs caught errors
    afterEach(() => { shouldThrow = true; });

    it('replaces a crashed page with an accessible recovery screen, without a stack trace', () => {
        render(<ErrorBoundary><Fragile /></ErrorBoundary>);
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Something went wrong on this page');
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Back to home' })).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/\bat \S+ \(|\.jsx?:\d+/); // no stack frames
    });

    it('Try again re-renders the page once the problem is gone', async () => {
        render(<ErrorBoundary><Fragile /></ErrorBoundary>);
        shouldThrow = false;
        await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(screen.getByText('Page content')).toBeInTheDocument();
    });

    it('Back to home calls the navigation handler', async () => {
        const onHome = vi.fn();
        render(<ErrorBoundary onHome={onHome}><Fragile /></ErrorBoundary>);
        await userEvent.click(screen.getByRole('button', { name: 'Back to home' }));
        expect(onHome).toHaveBeenCalledOnce();
    });

    it('a failed lazy chunk offers a reload instead', () => {
        function Chunk() { throw new TypeError('Failed to fetch dynamically imported module: /assets/Lab.js'); }
        render(<ErrorBoundary><Chunk /></ErrorBoundary>);
        expect(screen.getByRole('alert')).toHaveTextContent('This page could not be loaded');
        expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    });

    it('changing the route clears the error', () => {
        function Harness() {
            const [route, setRoute] = useState('/a');
            return (
                <>
                    <button type="button" onClick={() => { shouldThrow = false; setRoute('/b'); }}>go</button>
                    <ErrorBoundary resetKey={route}><Fragile /></ErrorBoundary>
                </>
            );
        }
        render(<Harness />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
        screen.getByRole('button', { name: 'go' }).click();
        return screen.findByText('Page content');
    });

    void quiet;
});
