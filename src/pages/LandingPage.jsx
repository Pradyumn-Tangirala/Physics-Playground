import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PhysicsBackground from '../components/PhysicsBackground';
import { useReducedMotion } from '../components/useReducedMotion';
import styles from './LandingPage.module.css';
import TiltCard from '../components/TiltCard';

const topics = [
    {
        id: 'projectile',
        title: 'Projectile Motion',
        subtitle: 'Analytical vs Numerical',
        description: 'Fly the closed-form parabola next to Euler, symplectic Euler and RK4 solutions, add quadratic air resistance, and measure how the numerical error shrinks with the timestep.',
        features: ['Quadratic Drag', 'Error vs Exact Solution', 'Convergence Study'],
        simRoute: '/projectile',
        solverRoute: '/projectile/problems',
        color: '#ff6b6b',
        gradient: 'linear-gradient(135deg, #ff6b6b 0%, #ee5253 100%)',
        icon: '🚀'
    },
    {
        id: 'shm',
        title: 'Harmonic Motion',
        subtitle: 'Oscillations',
        description: 'Explore pendulums and springs with a live motion graph, a phase-space plot and energy bars showing kinetic and potential energy trading places.',
        features: ['Phase-Space Plot', 'Energy Bars', 'Integrator Choice'],
        simRoute: '/shm',
        solverRoute: '/shm/problems',
        color: '#feca57',
        gradient: 'linear-gradient(135deg, #feca57 0%, #ff9f43 100%)',
        icon: '⏰'
    },
    {
        id: 'waves',
        title: 'Wave Interference',
        subtitle: 'Interference & Diffraction',
        description: 'Double- and single-slit patterns from a phasor sum in SI units, checked against the Fraunhofer formulas, with a measurement cursor for fringe positions.',
        features: ['Phasor-Based Interference', 'Single-Slit Diffraction', 'Fringe Measurement'],
        simRoute: '/simulation',
        solverRoute: '/problems',
        color: '#48dbfb',
        gradient: 'linear-gradient(135deg, #48dbfb 0%, #0abde3 100%)',
        icon: '🌊'
    },
    {
        id: 'fdtd',
        title: 'Wave Equation Lab',
        subtitle: 'Numerical Solver (FDTD)',
        description: 'Solve the 2-D wave equation by finite differences: watch waves propagate, reflect and diffract through slits, and see the scheme blow up when the CFL condition is broken.',
        features: ['FDTD Solver', 'CFL Stability', 'Absorbing Boundaries'],
        simRoute: '/waves/fdtd',
        color: '#ff9f43',
        gradient: 'linear-gradient(135deg, #ff9f43 0%, #ee5253 100%)',
        icon: '≋'
    },
    {
        id: 'numerics',
        title: 'Numerical Methods Lab',
        subtitle: 'Euler · Symplectic Euler · RK4',
        description: 'Solve the same pendulum three ways from identical initial conditions and measure each against the exact solution: angle error, energy drift, and accuracy for the work done.',
        features: ['Error vs Exact Solution', 'Energy Drift', 'Accuracy vs Cost'],
        simRoute: '/numerical-methods',
        color: '#a29bfe',
        gradient: 'linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)',
        icon: '∫'
    }
];

const LandingPage = () => {
    const navigate = useNavigate();
    const scrollRef = useRef(null);
    const reducedMotion = useReducedMotion();

    const scrollToContent = () => {
        scrollRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
        scrollRef.current?.focus({ preventScroll: true }); // keyboard users land on the labs
    };

    return (
        <div className={styles.page}>
            <PhysicsBackground />

            <header className={styles.hero}>
                <h1 className={styles.title}>
                    THE PHYSICS<br />PLAYGROUND
                </h1>
                <p className={styles.lead}>
                    Explore projectile motion, oscillations and wave interference through interactive simulations.
                </p>
                <button type="button" className={styles.start} onClick={scrollToContent}>
                    Start Experimenting
                </button>
                <div className={styles.scrollHint} aria-hidden="true">
                    Scroll down
                    <div>↓</div>
                </div>
            </header>

            <main ref={scrollRef} tabIndex={-1} className={styles.content} aria-label="Labs">
                <div className={styles.grid}>
                    {topics.map((topic) => (
                        <TiltCard key={topic.id} className={styles.card}>
                            <div className={styles.icon} style={{ background: topic.gradient, boxShadow: `0 10px 30px ${topic.color}44` }} aria-hidden="true">
                                {topic.icon}
                            </div>

                            <h2 className={styles.cardTitle}>{topic.title}</h2>
                            <div className={styles.subtitle} style={{ color: topic.color }}>{topic.subtitle}</div>
                            <p className={styles.description}>{topic.description}</p>

                            <div className={styles.actions}>
                                <button
                                    type="button"
                                    className={styles.launch}
                                    onClick={() => navigate(topic.simRoute)}
                                    aria-label={`Launch ${topic.title}`}
                                >
                                    Launch
                                </button>
                                {topic.solverRoute && (
                                    <button
                                        type="button"
                                        className={styles.calc}
                                        onClick={() => navigate(topic.solverRoute)}
                                        aria-label={`${topic.title} problem solver`}
                                    >
                                        Calc
                                    </button>
                                )}
                            </div>

                            {/* Glow follows the pointer through CSS variables set by TiltCard. */}
                            <div
                                className={styles.glow}
                                style={{ background: `radial-gradient(400px circle at var(--glow-x, 50%) var(--glow-y, 50%), ${topic.color}22, transparent 40%)` }}
                            />
                        </TiltCard>
                    ))}
                </div>

                <section className={styles.experiments} aria-labelledby="guided-title">
                    <h2 id="guided-title">Guided experiments</h2>
                    <p>
                        Eight ready-made experiments, from the small-angle pendulum to Euler’s energy drift and single-slit
                        diffraction. Each opens a lab with every parameter set and says what to look for.
                    </p>
                    <button type="button" className={styles.launch} onClick={() => navigate('/experiments')}>
                        Browse experiments
                    </button>
                </section>

                <footer className={styles.footer}>
                    <h2>The Power of Simulation</h2>
                    <p>
                        By visualizing mathematical models, we bridge the gap between abstract theory and
                        intuitive understanding. Built with React and the HTML5 Canvas API.
                    </p>
                </footer>
            </main>
        </div>
    );
};

export default LandingPage;
