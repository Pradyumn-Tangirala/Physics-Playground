import { Link } from 'react-router-dom';
import { experimentPath } from '../experiments/labs';
import { checkParams, defaultParams } from '../experiments/urlParams';
import styles from './SimulateLink.module.css';

/**
 * "Simulate this": opens `lab` with exactly these parameters (others at their
 * defaults). If the lab cannot represent a value, the link is not offered and
 * the reason is shown instead, so the simulation never quietly differs from
 * the solved problem.
 */
export default function SimulateLink({ lab, params, description }) {
    const full = { ...defaultParams(lab.fields), ...params };
    const problems = checkParams(lab.fields, full);
    if (problems.length) {
        return (
            <p className={styles.unavailable} role="note">
                Not available in the {lab.title} with these values: {problems.map((p) => `${p.label} = ${p.value} is ${p.reason}`).join('; ')}.
            </p>
        );
    }
    return (
        <div className={styles.wrap}>
            <Link className={styles.link} to={experimentPath(lab, full)}>Simulate this →</Link>
            {description && <span className={styles.description}>{description}</span>}
        </div>
    );
}
