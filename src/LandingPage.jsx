import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PhysicsBackground from './PhysicsBackground';

const LandingPage = () => {
    const navigate = useNavigate();
    const [expandedTopic, setExpandedTopic] = useState(null);
    const scrollRef = useRef(null);

    const scrollToContent = () => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const topics = [
        {
            id: 'projectile',
            title: 'Projectile Motion',
            subtitle: 'Kinematics in Action',
            description: 'Master the parabolic paths of objects in flight. Visualize how velocity, angle, and gravity dictate trajectory in a real-time environment.',
            features: ['Trajectory Prediction', 'Motion Trails', 'Real-time Metrics'],
            simRoute: '/projectile',
            solverRoute: '/projectile/problems',
            color: '#ff6b6b',
            gradient: 'linear-gradient(135deg, #ff6b6b 0%, #ee5253 100%)',
            icon: '🚀'
        },
        {
            id: 'shm',
            title: 'Harmonic Motion',
            subtitle: 'Oscillations & Waves',
            description: 'Explore the rhythmic dance of energy. Analyze pendulums and springs with live graphs showing the interplay of potential and kinetic energy.',
            features: ['Phase Diagrams', 'Energy Conservation', 'Damping Control'],
            simRoute: '/shm',
            solverRoute: '/shm/problems',
            color: '#feca57',
            gradient: 'linear-gradient(135deg, #feca57 0%, #ff9f43 100%)',
            icon: '⏰'
        },
        {
            id: 'waves',
            title: 'Wave Interference',
            subtitle: 'Light & Diffraction',
            description: 'Unveil the quantum nature of light. Witness constructve and destructive interference patterns emerge from the Double Slit Experiment.',
            features: ['Diffraction Patterns', 'Heatmap Visualization', 'Wall & Slit Mode'],
            simRoute: '/simulation',
            solverRoute: '/problems',
            color: '#48dbfb',
            gradient: 'linear-gradient(135deg, #48dbfb 0%, #0abde3 100%)',
            icon: '🌊'
        }
    ];

    // 3D Tilt Hook
    const useTilt = () => {
        const ref = useRef(null);

        useEffect(() => {
            const card = ref.current;
            if (!card) return;

            const handleMove = (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = ((y - centerY) / centerY) * -5; // Max 5deg tilt
                const rotateY = ((x - centerX) / centerX) * 5;

                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;

                // Glow effect
                card.style.setProperty('--glow-x', `${x}px`);
                card.style.setProperty('--glow-y', `${y}px`);
            };

            const handleLeave = () => {
                card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
            };

            card.addEventListener('mousemove', handleMove);
            card.addEventListener('mouseleave', handleLeave);

            return () => {
                card.removeEventListener('mousemove', handleMove);
                card.removeEventListener('mouseleave', handleLeave);
            };
        }, []);

        return ref;
    };

    const TiltCard = ({ children, style, className }) => {
        const ref = useTilt();
        return (
            <div ref={ref} className={className} style={style}>
                {children}
            </div>
        );
    };

    return (
        <div style={{
            width: '100vw',
            minHeight: '100vh',
            position: 'relative',
            color: '#fff',
            fontFamily: "'Inter', sans-serif",
            overflowX: 'hidden'
        }}>
            <PhysicsBackground />

            {/* HERO SECTION */}
            <section style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
                zIndex: 1,
                padding: '20px',
                textAlign: 'center'
            }}>

                <h1 style={{
                    fontSize: 'clamp(3rem, 8vw, 6rem)',
                    fontWeight: '900',
                    lineHeight: '1.1',
                    marginBottom: '20px',
                    background: 'linear-gradient(to right, #fff, #a5b4fc)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 0 50px rgba(165, 180, 252, 0.3)',
                    letterSpacing: '-2px'
                }}>
                    THE PHYSICS<br />PLAYGROUND
                </h1>

                <p style={{
                    fontSize: 'clamp(1rem, 2vw, 1.5rem)',
                    color: 'rgba(255,255,255,0.7)',
                    maxWidth: '700px',
                    marginBottom: '50px',
                    lineHeight: '1.6'
                }}>
                    Explore the fundamental laws of the universe through interactive, high-fidelity simulations.
                    From quantum waves to orbital mechanics.
                </p>

                <button
                    onClick={scrollToContent}
                    style={{
                        padding: '16px 40px',
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        background: 'white',
                        color: 'black',
                        border: 'none',
                        borderRadius: '50px',
                        cursor: 'pointer',
                        boxShadow: '0 0 30px rgba(255,255,255,0.3)',
                        transition: 'transform 0.2s'
                    }}
                    onMouseOver={e => e.target.style.transform = 'scale(1.05)'}
                    onMouseOut={e => e.target.style.transform = 'scale(1)'}
                >
                    Start Experimenting
                </button>

                {/* Scroll Indicator */}
                <div style={{
                    position: 'absolute',
                    bottom: '40px',
                    animation: 'bounce 2s infinite',
                    opacity: 0.5
                }}>
                    Scrolldown
                    <div style={{ fontSize: '20px' }}>↓</div>
                </div>
            </section>

            {/* CONTENT SECTION */}
            <div ref={scrollRef} style={{
                position: 'relative',
                zIndex: 1,
                padding: '100px 20px',
                background: 'linear-gradient(to bottom, transparent, #000 20%)'
            }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                    gap: '40px',
                    maxWidth: '1200px',
                    margin: '0 auto'
                }}>
                    {topics.map((topic) => (
                        <TiltCard
                            key={topic.id}
                            className="tilt-card"
                            style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '24px',
                                padding: '40px',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'transform 0.1s ease-out',
                                minHeight: '400px'
                            }}
                        >
                            {/* Icon */}
                            <div style={{
                                width: '60px',
                                height: '60px',
                                borderRadius: '16px',
                                background: topic.gradient,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '30px',
                                marginBottom: '25px',
                                boxShadow: `0 10px 30px ${topic.color}44`
                            }}>
                                {topic.icon}
                            </div>

                            <h2 style={{ fontSize: '2rem', margin: '0 0 5px 0' }}>{topic.title}</h2>
                            <div style={{ color: topic.color, fontWeight: '600', marginBottom: '20px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                {topic.subtitle}
                            </div>

                            <p style={{ color: '#aaa', lineHeight: '1.7', marginBottom: '30px', flex: 1 }}>
                                {topic.description}
                            </p>

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <button
                                    onClick={() => navigate(topic.simRoute)}
                                    style={{
                                        flex: 2,
                                        padding: '12px',
                                        background: 'white',
                                        color: 'black',
                                        border: 'none',
                                        borderRadius: '12px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        transition: 'opacity 0.2s'
                                    }}
                                    onMouseOver={e => e.target.style.opacity = '0.9'}
                                    onMouseOut={e => e.target.style.opacity = '1'}
                                >
                                    Launch
                                </button>
                                <button
                                    onClick={() => navigate(topic.solverRoute)}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: 'rgba(255,255,255,0.1)',
                                        color: 'white',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '12px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseOver={e => e.target.style.background = 'rgba(255,255,255,0.2)'}
                                    onMouseOut={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
                                >
                                    Calc
                                </button>
                            </div>

                            {/* Glow Overlay handled by CSS var */}
                            <div style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                borderRadius: '24px',
                                background: `radial-gradient(400px circle at var(--glow-x, 50%) var(--glow-y, 50%), ${topic.color}22, transparent 40%)`,
                                opacity: 0.5,
                                pointerEvents: 'none',
                                zIndex: -1
                            }} />

                        </TiltCard>
                    ))}
                </div>

                {/* Footer Section */}
                <div style={{
                    marginTop: '150px',
                    textAlign: 'center',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    paddingTop: '60px',
                    color: '#666'
                }}>
                    <h3 style={{ color: 'white', marginBottom: '20px' }}>The Power of Simulation</h3>
                    <p style={{ maxWidth: '600px', margin: '0 auto 40px', lineHeight: '1.6' }}>
                        By visualizing complex mathematical models, we bridge the gap between abstract theory and
                        intuitive understanding. Built with React and HTML5 Canvas for maximum performance using high-precision physics engines.
                    </p>

                </div>
            </div>

            <style>{`
                @keyframes bounce {
                    0%, 20%, 50%, 80%, 100% {transform: translateY(0);}
                    40% {transform: translateY(-10px);}
                    60% {transform: translateY(-5px);}
                }
                .tilt-card {
                    transform-style: preserve-3d;
                }
            `}</style>
        </div>
    );
};

export default LandingPage;
