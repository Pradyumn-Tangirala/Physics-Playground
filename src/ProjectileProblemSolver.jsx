import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ProjectileProblemSolver = () => {
    const navigate = useNavigate();
    const [velocity, setVelocity] = useState(20);
    const [angle, setAngle] = useState(45);
    const [gravity, setGravity] = useState(9.8);
    const [solution, setSolution] = useState(null);

    const calculate = () => {
        const v0 = Number(velocity);
        const theta = (Number(angle) * Math.PI) / 180;
        const g = Number(gravity);

        // Calculations
        const range = (v0 * v0 * Math.sin(2 * theta)) / g;
        const maxHeight = (v0 * v0 * Math.pow(Math.sin(theta), 2)) / (2 * g);
        const timeOfFlight = (2 * v0 * Math.sin(theta)) / g;

        const steps = [
            `1. Convert Angle to Radians: ${angle}° = ${theta.toFixed(4)} rad`,
            `2. Calculate Time of Flight (T): (2 * v₀ * sin(θ)) / g`,
            `   T = (2 * ${v0} * ${Math.sin(theta).toFixed(4)}) / ${g} = ${timeOfFlight.toFixed(2)} s`,
            `3. Calculate Max Height (H): (v₀² * sin²(θ)) / 2g`,
            `   H = (${v0}² * ${Math.pow(Math.sin(theta), 2).toFixed(4)}) / (2 * ${g}) = ${maxHeight.toFixed(2)} m`,
            `4. Calculate Range (R): (v₀² * sin(2θ)) / g`,
            `   R = (${v0}² * ${Math.sin(2 * theta).toFixed(4)}) / ${g} = ${range.toFixed(2)} m`
        ];

        setSolution({ range, maxHeight, timeOfFlight, steps });
    };

    return (
        <div style={{
            width: '100vw',
            minHeight: '100vh',
            background: '#1a1a2e',
            color: 'white',
            fontFamily: "'Inter', sans-serif",
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '40px 20px'
        }}>
            <div style={{ width: '100%', maxWidth: '800px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <h1 style={{ color: '#e74c3c' }}>Projectile Solver</h1>
                <button onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '20px', cursor: 'pointer' }}>&larr; Home</button>
            </div>

            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '1000px' }}>
                <div style={{ flex: '1 1 300px', background: 'rgba(255,255,255,0.05)', padding: '30px', borderRadius: '20px' }}>
                    <h3>Parameters</h3>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Velocity (v₀) [m/s]</label>
                        <input type="number" value={velocity} onChange={(e) => setVelocity(e.target.value)} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid #444', color: 'white', borderRadius: '5px' }} />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Angle (θ) [deg]</label>
                        <input type="number" value={angle} onChange={(e) => setAngle(e.target.value)} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid #444', color: 'white', borderRadius: '5px' }} />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Gravity (g) [m/s²]</label>
                        <input type="number" value={gravity} onChange={(e) => setGravity(e.target.value)} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid #444', color: 'white', borderRadius: '5px' }} />
                    </div>
                    <button onClick={calculate} style={{ width: '100%', padding: '12px', background: '#e74c3c', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Calculate</button>
                </div>

                <div style={{ flex: '1 1 400px', background: 'rgba(255,255,255,0.05)', padding: '30px', borderRadius: '20px' }}>
                    <h3>Solution</h3>
                    {solution ? (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                                <div style={{ background: 'rgba(231, 76, 60, 0.2)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Range</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{solution.range.toFixed(2)} m</div>
                                </div>
                                <div style={{ background: 'rgba(231, 76, 60, 0.2)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Height</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{solution.maxHeight.toFixed(2)} m</div>
                                </div>
                                <div style={{ background: 'rgba(231, 76, 60, 0.2)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Time</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{solution.timeOfFlight.toFixed(2)} s</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {solution.steps.map((step, i) => (
                                    <div key={i} style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '5px', fontFamily: 'monospace' }}>{step}</div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p style={{ color: '#aaa' }}>Enter values and calculate to see results.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectileProblemSolver;
