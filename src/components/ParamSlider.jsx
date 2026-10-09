import { useId, useState } from 'react';
import { validateBoundedInput } from '../utils/validation.js';
import { formatForStep } from '../utils/format.js';
import styles from './ParamSlider.module.css';

/**
 * Labelled range slider with a synced numeric field.
 *
 * Keyboard: the slider supports ←/→/↑/↓ (one step), PageUp/PageDown and
 * Home/End natively; the number field supports ↑/↓ and typing.
 * Validation: typed values are applied live while they are inside
 * [min, max]; otherwise an inline error is shown. On blur/Enter an
 * out-of-range number is clamped and non-numbers are reverted. Escape reverts.
 */
export default function ParamSlider({
    label,
    value,
    min,
    max,
    step = 1,
    unit = '',
    onChange,
    hint,
    disabled = false,
    accentColor,
}) {
    const id = useId();
    const errorId = `${id}-error`;
    // null while the field is not being edited, so external changes
    // (slider, dragging, reset) always show through.
    const [draft, setDraft] = useState(null);
    const validation = draft === null ? null : validateBoundedInput(draft, { min, max, step });
    const error = validation && !validation.ok ? validation.error : null;
    const display = formatForStep(value, step);

    const commitDraft = () => {
        if (validation && !validation.ok && validation.fallback !== null) onChange(validation.fallback);
        setDraft(null);
    };

    const handleTyping = (text) => {
        setDraft(text);
        const result = validateBoundedInput(text, { min, max, step });
        if (result.ok && result.value !== value) onChange(result.value);
    };

    return (
        <div className={styles.param} style={accentColor ? { '--accent': accentColor } : undefined}>
            <div className={styles.header}>
                <label htmlFor={`${id}-range`} className={styles.label}>
                    {label}
                    {hint && <span className={styles.hint}> · {hint}</span>}
                </label>
                <span className={styles.valueGroup}>
                    <input
                        type="number"
                        className={styles.number}
                        aria-label={`${label} value${unit ? ` in ${unit}` : ''}`}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? errorId : undefined}
                        min={min}
                        max={max}
                        step={step}
                        disabled={disabled}
                        value={draft ?? display}
                        onFocus={() => setDraft(display)}
                        onChange={(e) => handleTyping(e.target.value)}
                        onBlur={commitDraft}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') commitDraft();
                            if (e.key === 'Escape') setDraft(null);
                        }}
                    />
                    {unit && <span className={styles.unit}>{unit}</span>}
                </span>
            </div>
            <input
                id={`${id}-range`}
                type="range"
                className={styles.range}
                min={min}
                max={max}
                step={step}
                value={value}
                disabled={disabled}
                aria-valuetext={`${display}${unit ? ` ${unit}` : ''}`}
                onChange={(e) => onChange(Number(e.target.value))}
            />
            {error && (
                <div id={errorId} role="alert" className={styles.error}>
                    {error}
                </div>
            )}
        </div>
    );
}
