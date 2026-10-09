import HomeButton from './HomeButton';
import styles from './SolverPage.module.css';

// Building blocks shared by the three worked-solution pages: a titled page
// with an inputs card and a solution card, labelled number fields, result
// tiles and numbered steps. `accent` colours the page (a CSS variable).

export function SolverPage({ title, accent, children }) {
    return (
        <main className={styles.page} style={{ '--accent': accent }}>
            <header className={styles.header}>
                <h1>{title}</h1>
                <HomeButton variant="inline" />
            </header>
            <div className={styles.columns}>{children}</div>
        </main>
    );
}

export function SolverCard({ title, children }) {
    return (
        <section className={styles.card} aria-label={title}>
            <h2>{title}</h2>
            {children}
        </section>
    );
}

/** A labelled numeric input kept as text, so it can be cleared while typing. */
export function NumberField({ label, value, onChange }) {
    return (
        <label className={styles.field}>
            <span>{label}</span>
            <input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
        </label>
    );
}

export function SelectField({ id, label, value, onChange, options }) {
    return (
        <div className={styles.field}>
            <label htmlFor={id}>{label}</label>
            <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
                {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
            </select>
        </div>
    );
}

export function CalculateButton({ onClick }) {
    return <button type="button" className={styles.calculate} onClick={onClick}>Calculate</button>;
}

export const SolverNote = ({ children }) => <p className={styles.note}>{children}</p>;

/** Placeholder, validation error, or `children(solution)` once there is a valid solution. */
export function SolutionBody({ solution, children }) {
    if (!solution) return <p className={styles.empty}>Enter values and press Calculate to see the worked solution.</p>;
    if (solution.error) return <p role="alert" className={styles.error}>⚠ {solution.error}</p>;
    return children(solution);
}

/** Headline results, e.g. [['Range', '40.82 m'], …]. */
export function ResultTiles({ items }) {
    return (
        <dl className={styles.tiles}>
            {items.map(([label, value]) => (
                <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                </div>
            ))}
        </dl>
    );
}

/** Steps numbered in the text itself, so copied or read-out steps keep their numbers. */
export function SolutionSteps({ steps, formula }) {
    return (
        <>
            {formula && <p className={styles.formula}>{formula}</p>}
            <ol className={styles.steps}>
                {steps.map((step, i) => <li key={i}>{i + 1}. {step}</li>)}
            </ol>
        </>
    );
}
