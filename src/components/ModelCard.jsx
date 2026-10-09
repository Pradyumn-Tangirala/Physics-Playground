import ScrollRegion from './ScrollRegion';
import styles from './ModelCard.module.css';

/** Equations, assumptions, units and limitations of a lab's model (data in experiments/modelCards.js). */
export default function ModelCard({ model, id }) {
    const titleId = `${id}-model-title`;
    return (
        <section className={styles.card} aria-labelledby={titleId}>
            <h2 id={titleId}>{model.title}</h2>
            <div className={styles.grid}>
                <div>
                    <h3>Equations</h3>
                    <pre className={styles.equations}>{model.equations.join('\n')}</pre>
                </div>
                <div>
                    <h3>Assumptions</h3>
                    <ul>{model.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
                </div>
                <div>
                    <h3>Units</h3>
                    <ScrollRegion label="Units">
                        <table className={styles.units}>
                            <thead><tr><th scope="col">Symbol</th><th scope="col">Quantity</th><th scope="col">Unit</th></tr></thead>
                            <tbody>
                                {model.units.map(([symbol, quantity, unit]) => (
                                    <tr key={symbol}><td>{symbol}</td><td>{quantity}</td><td>{unit}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </ScrollRegion>
                </div>
                <div>
                    <h3>Limitations</h3>
                    <ul>{model.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
                </div>
            </div>
        </section>
    );
}
