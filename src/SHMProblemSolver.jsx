import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SHMProblemSolver = () => {
    const navigate = useNavigate();
    const [length, setLength] = useState(1.0);
    const [gravity, setGravity] = useState(9.8);
    const [solution, setSolution] = useState(null);

    const calculate = () => {
        const L = Number(length);
        const g = Number(gravity);

        // Calculations
        const period = 2 * Math.PI * Math.sqrt(L / g);
        const frequency = 1 / period;

        const steps = [
            `1. Formula for Period (T): T = 2π * √(L/g)`,
            `2. Substitute values: T = 2π * √(${L} / ${g})`,
            `3. Calculate inside root: ${L}/${g} = ${(L / g).toFixed(4)}`,
            `4. Square root: √${(L / g).toFixed(4)} = ${Math.sqrt(L / g).toFixed(4)}`,
            `5. Multiply by 2π: T = ${period.toFixed(4)} s`,
            `6. Calculate Frequency (f): f = 1/T = ${frequency.toFixed(4)} Hz`
        ];

        setSolution({ period, frequency, steps });
    };

    return (
        <div style={{
            width: '100vw',
            minHeight: '100vh',
            background: '#2c3e50',
            color: 'white',
            fontFamily: "'Inter', sans-serif",
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '40px 20px'
        }}>
            <div style={{ width: '100%', maxWidth: '800px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <h1 style={{ color: '#f1c40f' }}>Pendulum Solver</h1>
                <button onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '20px', cursor: 'pointer' }}>&larr; Home</button>
            </div>

            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '1000px' }}>
                <div style={{ flex: '1 1 300px', background: 'rgba(0,0,0,0.2)', padding: '30px', borderRadius: '20px' }}>
                    <h3>Parameters</h3>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Length (L) [m]</label>
                        <input type="number" value={length} onChange={(e) => setLength(e.target.value)} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid #555', color: 'white', borderRadius: '5px' }} />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Gravity (g) [m/s²]</label>
                        <input type="number" value={gravity} onChange={(e) => setGravity(e.target.value)} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid #555', color: 'white', borderRadius: '5px' }} />
                    </div>
                    <button onClick={calculate} style={{ width: '100%', padding: '12px', background: '#f1c40f', border: 'none', borderRadius: '8px', color: '#2c3e50', fontWeight: 'bold', cursor: 'pointer' }}>Calculate</button>
                </div>

                <div style={{ flex: '1 1 400px', background: 'rgba(0,0,0,0.2)', padding: '30px', borderRadius: '20px' }}>
                    <h3>Solution</h3>
                    {solution ? (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                                <div style={{ background: 'rgba(241, 196, 15, 0.2)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Period (T)</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{solution.period.toFixed(4)} s</div>
                                </div>
                                <div style={{ background: 'rgba(241, 196, 15, 0.2)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Frequency (f)</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{solution.frequency.toFixed(4)} Hz</div>
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

export default SHMProblemSolver;
