import styles from './Explainer.module.css';

/** A titled list of collapsible explanations; the first one starts open. */
export default function ExplainerSections({ id, title, sections }) {
    return (
        <section className={styles.explainer} aria-labelledby={`${id}-title`}>
            <h2 id={`${id}-title`}>{title}</h2>
            {sections.map((s, i) => (
                <details key={s.id} open={i === 0}>
                    <summary>{s.title}</summary>
                    <div className={styles.body}>{s.body}</div>
                </details>
            ))}
        </section>
    );
}
