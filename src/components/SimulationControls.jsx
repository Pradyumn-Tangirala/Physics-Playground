import styles from './SimulationControls.module.css';

/**
 * Control panel shell shared by the simulation pages.
 *
 * placement:
 *   'inline'         — static card in normal page flow (projectile, wave and integrator labs)
 *   'sidebar-right'  — full-height column beside the canvas, stacked below it on narrow screens (oscillators)
 *
 * Panel action buttons use the classes in SimulationControls.module.css
 * (primaryButton, secondaryButton, buttonRow, note).
 */
export default function SimulationControls({
    title,
    titleGradient = 'linear-gradient(90deg, #fff, #aaa)',
    placement = 'inline',
    children,
}) {
    const placementClass = {
        'sidebar-right': styles.sidebarRight,
        inline: styles.inline,
    }[placement];

    return (
        <aside className={`${styles.panel} ${placementClass}`} aria-label={`${title} controls`}>
            <h2 className={styles.title} style={{ backgroundImage: titleGradient }}>{title}</h2>
            {children}
        </aside>
    );
}
