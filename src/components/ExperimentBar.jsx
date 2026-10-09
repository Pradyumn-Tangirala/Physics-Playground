import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { presetsFor, presetPath } from '../experiments/presets';
import { sameParams } from '../experiments/urlParams';
import styles from './ExperimentBar.module.css';

const COPIED_MESSAGE_MS = 2500;

/**
 * Experiment controls shared by every lab: guided presets, the shareable link
 * (from useExperimentUrl, which also keeps it in the address bar) and a notice
 * when an opened link contained values the lab could not use.
 */
export default function ExperimentBar({ lab, params, link, rejected = [] }) {
    const navigate = useNavigate();
    const [copyState, setCopyState] = useState(null); // null | 'copied' | 'manual'
    const presets = presetsFor(lab);
    const active = presets.find((p) => sameParams(lab.fields, p.params, params));

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopyState('copied');
            setTimeout(() => setCopyState((s) => (s === 'copied' ? null : s)), COPIED_MESSAGE_MS);
        } catch {
            setCopyState('manual'); // clipboard blocked (permissions, insecure context): show the link instead
        }
    };

    return (
        <div className={styles.bar}>
            {presets.length > 0 && (
                <div className={styles.row}>
                    <label htmlFor={`${lab.id}-preset`}>Guided experiment</label>
                    <select
                        id={`${lab.id}-preset`}
                        className={styles.select}
                        value={active?.id ?? ''}
                        onChange={(e) => {
                            const chosen = presets.find((p) => p.id === e.target.value);
                            if (chosen) navigate(presetPath(chosen));
                        }}
                    >
                        <option value="">Custom settings</option>
                        {presets.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                </div>
            )}
            {active && <p className={styles.lookFor}><strong>Look for:</strong> {active.lookFor}</p>}

            <button type="button" className={styles.copy} onClick={copy}>Copy Experiment Link</button>
            <span aria-live="polite" className={styles.status}>{copyState === 'copied' ? 'Link copied to the clipboard.' : ''}</span>
            {copyState === 'manual' && (
                <label className={styles.manual}>
                    Copy this link:
                    <input readOnly value={link} onFocus={(e) => e.target.select()} />
                </label>
            )}

            {rejected.length > 0 && (
                <div role="alert" className={styles.rejected}>
                    The link contained values this lab cannot use, so their defaults were kept:
                    <ul>
                        {rejected.map((r) => <li key={r.key}>{r.label} = “{r.value}”: {r.reason}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
}
