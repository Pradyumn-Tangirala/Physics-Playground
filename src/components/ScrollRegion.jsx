import styles from './ScrollRegion.module.css';

/**
 * Horizontally scrollable wrapper for wide tables on narrow screens. It is
 * focusable and labelled so keyboard users can scroll it too (WCAG 2.1.1).
 */
export default function ScrollRegion({ label, children }) {
    return (
        <div className={styles.region} role="region" aria-label={label} tabIndex={0}>
            {children}
        </div>
    );
}
