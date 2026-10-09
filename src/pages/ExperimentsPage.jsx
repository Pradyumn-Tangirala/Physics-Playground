import { Link } from 'react-router-dom';
import HomeButton from '../components/HomeButton';
import { LABS } from '../experiments/labs';
import { presetsFor, presetPath } from '../experiments/presets';
import styles from './LabPage.module.css';
import own from './ExperimentsPage.module.css';

/** Every guided experiment, grouped by lab. Each card opens the lab with all parameters set. */
const ExperimentsPage = () => (
    <div className={styles.shell}>
        <main className={styles.page}>
            <header className={styles.header}>
                <HomeButton variant="inline" />
                <div>
                    <h1>Guided experiments</h1>
                    <p>
                        Each experiment opens a lab with every parameter set, and says what to look for. The address of
                        the lab then describes the experiment, so it can be bookmarked or shared.
                    </p>
                </div>
            </header>
            {LABS.map((lab) => {
                const presets = presetsFor(lab);
                if (!presets.length) return null;
                return (
                    <section key={lab.id} className={styles.card} aria-labelledby={`${lab.id}-presets`}>
                        <h2 id={`${lab.id}-presets`}>{lab.title}</h2>
                        <ul className={own.grid}>
                            {presets.map((p) => (
                                <li key={p.id} className={own.preset}>
                                    <h3>{p.title}</h3>
                                    <p className={own.summary}>{p.summary}</p>
                                    <p className={own.lookFor}>{p.lookFor}</p>
                                    <Link className={own.open} to={presetPath(p)} aria-label={`Open experiment: ${p.title}`}>
                                        Open experiment →
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                );
            })}
        </main>
    </div>
);

export default ExperimentsPage;
