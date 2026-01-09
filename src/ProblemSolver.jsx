import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ProblemSolver = () => {
    const navigate = useNavigate();
    const [problemType, setProblemType] = useState('fringe-width');
    const [wavelength, setWavelength] = useState(500); // nm
    const [slitSeparation, setSlitSeparation] = useState(0.5); // mm
    const [screenDistance, setScreenDistance] = useState(1.0); // m
    const [order, setOrder] = useState(1);
    const [solution, setSolution] = useState(null);

    const calculate = () => {
        // Convert units to meters
        const lambda = wavelength * 1e-9;
        const d = slitSeparation * 1e-3;
        const D = screenDistance;
        const n = parseInt(order);

        let result = 0;
        let steps = [];
        let formula = '';
        let title = '';

        if (problemType === 'fringe-width') {
            title = 'Fringe Width (β)';
            formula = 'β = (λ × D) / d';
            result = (lambda * D) / d;

            steps = [
                `1. Convert Wavelength (λ) to meters: ${wavelength} nm = ${wavelength} × 10⁻⁹ m`,
                `2. Convert Slit Separation (d) to meters: ${slitSeparation} mm = ${slitSeparation} × 10⁻³ m`,
                `3. Apply Formula: β = (${wavelength}e-9 × ${screenDistance}) / ${slitSeparation}e-3`,
                `4. Calculate: β = ${result.toExponential(2)} m`
            ];
        } else if (problemType === 'maxima') {
            title = `Position of ${n}${getOrdinal(n)} Maxima (yₙ)`;
            formula = 'yₙ = (n × λ × D) / d';
            result = (n * lambda * D) / d;

            steps = [
                `1. Identify Order (n): n = ${n}`,
                `2. Convert Wavelength (λ) to meters: ${wavelength} nm = ${wavelength} × 10⁻⁹ m`,
                `3. Convert Slit Separation (d) to meters: ${slitSeparation} mm = ${slitSeparation} × 10⁻³ m`,
                `4. Apply Formula: yₙ = (${n} × ${wavelength}e-9 × ${screenDistance}) / ${slitSeparation}e-3`,
                `5. Calculate: yₙ = ${result.toExponential(2)} m`
            ];
        } else if (problemType === 'minima') {
            title = `Position of ${n}${getOrdinal(n)} Minima (yₙ)`;
            formula = 'yₙ = ((n - 0.5) × λ × D) / d';
            result = ((n - 0.5) * lambda * D) / d;

            steps = [
                `1. Identify Order (n): n = ${n}`,
                `2. Convert Wavelength (λ) to meters: ${wavelength} nm = ${wavelength} × 10⁻⁹ m`,
                `3. Convert Slit Separation (d) to meters: ${slitSeparation} mm = ${slitSeparation} × 10⁻³ m`,
                `4. Apply Formula: yₙ = ((${n} - 0.5) × ${wavelength}e-9 × ${screenDistance}) / ${slitSeparation}e-3`,
                `5. Calculate: yₙ = ${result.toExponential(2)} m`
            ];
        }

        // Convert result to mm for easier reading
        const resultMm = (result * 1000).toFixed(4);
        steps.push(`6. Final Result (in mm): ${resultMm} mm`);

        setSolution({ title, formula, steps, result: resultMm });
    };

    const getOrdinal = (n) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    };

    return (
        <div style={{
            width: '100vw',
            minHeight: '100vh',
            background: 'black',
            color: 'white',
            fontFamily: "'Inter', sans-serif",
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '40px 20px',
            boxSizing: 'border-box',
            overflowY: 'auto'
        }}>
            {/* Header */}
            <div style={{
                width: '100%',
                maxWidth: '800px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '40px'
            }}>
                <h1 style={{
                    fontSize: '2.5rem',
                    fontWeight: '800',
                    background: 'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    margin: 0
                }}>PHYSICS SOLVER</h1>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '30px',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        backdropFilter: 'blur(10px)'
                    }}
                    onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
                    onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                >
                    &larr; Back to Home
                </button>
            </div>

            {/* Main Content */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '30px',
                width: '100%',
                maxWidth: '1000px',
                justifyContent: 'center'
            }}>

                {/* Input Card */}
                <div style={{
                    flex: '1 1 400px',
                    background: 'rgba(20, 20, 30, 0.6)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px',
                    padding: '30px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
                }}>
                    <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#ccc' }}>Parameters</h2>

                    <div className="input-group">
                        <label>Problem Type</label>
                        <select
                            value={problemType}
                            onChange={(e) => setProblemType(e.target.value)}
                            className="solver-input"
                        >
                            <option value="fringe-width">Find Fringe Width (β)</option>
                            <option value="maxima">Find Position of Maxima</option>
                            <option value="minima">Find Position of Minima</option>
                        </select>
                    </div>

                    <div className="input-group">
                        <label>Wavelength (λ) [nm]</label>
                        <input
                            type="number"
                            value={wavelength}
                            onChange={(e) => setWavelength(Number(e.target.value))}
                            className="solver-input"
                        />
                    </div>

                    <div className="input-group">
                        <label>Slit Separation (d) [mm]</label>
                        <input
                            type="number"
                            value={slitSeparation}
                            onChange={(e) => setSlitSeparation(Number(e.target.value))}
                            className="solver-input"
                        />
                    </div>

                    <div className="input-group">
                        <label>Screen Distance (D) [m]</label>
                        <input
                            type="number"
                            value={screenDistance}
                            onChange={(e) => setScreenDistance(Number(e.target.value))}
                            className="solver-input"
                        />
                    </div>

                    {problemType !== 'fringe-width' && (
                        <div className="input-group">
                            <label>Order (n)</label>
                            <input
                                type="number"
                                value={order}
                                onChange={(e) => setOrder(Number(e.target.value))}
                                className="solver-input"
                            />
                        </div>
                    )}

                    <button
                        onClick={calculate}
                        style={{
                            width: '100%',
                            marginTop: '20px',
                            padding: '15px',
                            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                            border: 'none',
                            borderRadius: '12px',
                            color: 'white',
                            fontSize: '1.1rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            boxShadow: '0 10px 20px rgba(0, 242, 254, 0.3)',
                            transition: 'transform 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.transform = 'scale(1.02)'}
                        onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                    >
                        Calculate Solution
                    </button>
                </div>

                {/* Solution Card */}
                <div style={{
                    flex: '1 1 400px',
                    background: 'rgba(20, 20, 30, 0.6)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px',
                    padding: '30px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    minHeight: '400px'
                }}>
                    {!solution ? (
                        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>?</div>
                            <p>Enter parameters and click Calculate to see the step-by-step solution.</p>
                        </div>
                    ) : (
                        <div className="solution-content">
                            <h3 style={{ color: '#4facfe', marginTop: 0 }}>{solution.title}</h3>

                            <div style={{
                                background: 'rgba(0,0,0,0.3)',
                                padding: '15px',
                                borderRadius: '8px',
                                marginBottom: '20px',
                                fontFamily: 'monospace',
                                fontSize: '1.2rem',
                                borderLeft: '4px solid #4facfe'
                            }}>
                                {solution.formula}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {solution.steps.map((step, index) => (
                                    <div key={index} style={{
                                        padding: '10px',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: '6px',
                                        fontSize: '0.95rem',
                                        color: index === solution.steps.length - 1 ? '#00f2fe' : '#ddd',
                                        fontWeight: index === solution.steps.length - 1 ? '700' : '400'
                                    }}>
                                        {step}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

            </div>

            <style>{`
        .input-group {
          margin-bottom: 15px;
        }
        .input-group label {
          display: block;
          margin-bottom: 8px;
          color: rgba(255,255,255,0.7);
          font-size: 0.9rem;
        }
        .solver-input {
          width: 100%;
          padding: 12px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          borderRadius: 8px;
          color: white;
          font-family: inherit;
          font-size: 1rem;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.3s;
        }
        .solver-input:focus {
          border-color: #4facfe;
        }
        .solution-content {
          animation: fadeIn 0.5s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
};

export default ProblemSolver;
