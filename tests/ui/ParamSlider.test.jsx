import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ParamSlider from '../../src/components/ParamSlider';

/** A ParamSlider wired to real state, as the pages use it. */
function Controlled({ initial = 9.8, onChange = () => {}, ...props }) {
    const [value, setValue] = useState(initial);
    return (
        <ParamSlider label="Gravity" unit="m/s²" value={value} min={1} max={25} step={0.1}
            onChange={(v) => { setValue(v); onChange(v); }} {...props} />
    );
}

describe('ParamSlider', () => {
    it('labels the slider and the number field accessibly', () => {
        render(<Controlled />);
        expect(screen.getByRole('slider', { name: /gravity/i })).toHaveAttribute('aria-valuetext', '9.8 m/s²');
        expect(screen.getByRole('spinbutton', { name: 'Gravity value in m/s²' })).toHaveValue(9.8);
    });

    it('moving the slider updates the value and the number field', () => {
        const onChange = vi.fn();
        render(<Controlled onChange={onChange} />);
        fireEvent.change(screen.getByRole('slider'), { target: { value: '12.5' } });
        expect(onChange).toHaveBeenLastCalledWith(12.5);
        expect(screen.getByRole('spinbutton')).toHaveValue(12.5);
    });

    it('typing a valid number applies it live', async () => {
        const onChange = vi.fn();
        render(<Controlled onChange={onChange} />);
        const field = screen.getByRole('spinbutton');
        await userEvent.clear(field);
        await userEvent.type(field, '15');
        expect(onChange).toHaveBeenLastCalledWith(15);
        expect(screen.getByRole('slider')).toHaveValue('15');
    });

    it('an out-of-range number shows an error and clamps on Enter', async () => {
        const onChange = vi.fn();
        render(<Controlled onChange={onChange} />);
        const field = screen.getByRole('spinbutton');
        await userEvent.clear(field);
        await userEvent.type(field, '30');
        expect(screen.getByRole('alert')).toHaveTextContent('Must be between 1 and 25.');
        expect(field).toHaveAttribute('aria-invalid', 'true');
        await userEvent.keyboard('{Enter}');
        expect(onChange).toHaveBeenLastCalledWith(25);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('text that is not a number is rejected and reverted on blur', async () => {
        const onChange = vi.fn();
        render(<Controlled onChange={onChange} />);
        const field = screen.getByRole('spinbutton');
        await userEvent.clear(field);
        expect(screen.getByRole('alert')).toHaveTextContent('Enter a number.');
        await userEvent.tab();
        expect(field).toHaveValue(9.8);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('Escape abandons an edit that was never valid', async () => {
        // Every prefix of "0.5" is below the minimum of 1, so nothing is applied live.
        const onChange = vi.fn();
        render(<Controlled onChange={onChange} />);
        const field = screen.getByRole('spinbutton');
        await userEvent.clear(field);
        await userEvent.type(field, '0.5{Escape}');
        expect(field).toHaveValue(9.8);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('a one-step slider change is applied (real arrow-key stepping is checked in the E2E suite)', () => {
        const onChange = vi.fn();
        render(<Controlled onChange={onChange} />);
        fireEvent.change(screen.getByRole('slider'), { target: { value: '9.9' } });
        expect(onChange).toHaveBeenLastCalledWith(9.9);
    });

    it('disabled controls cannot be edited', () => {
        render(<Controlled disabled />);
        expect(screen.getByRole('slider')).toBeDisabled();
        expect(screen.getByRole('spinbutton')).toBeDisabled();
    });
});
