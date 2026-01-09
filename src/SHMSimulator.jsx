import React, { useRef, useEffect, useState } from 'react';

const SHMSimulator = () => {
    const canvasRef = useRef(null);
    const [mode, setMode] = useState('pendulum'); // 'pendulum' or 'spring'

    // Joint State
    const [mass, setMass] = useState(2);        // For Spring
    const [k, setK] = useState(10);             // Spring Constant
    const [length, setLength] = useState(200);  // Pendulum Length
    const [gravity, setGravity] = useState(9.8);
    const [amplitude, setAmplitude] = useState(100); // Spring Amplitude (px) or Angle (deg) for pendulum
    const [damping, setDamping] = useState(0);

    const [isAnimating, setIsAnimating] = useState(true);
    const [isDraggingPendulum, setIsDraggingPendulum] = useState(false);
    const dragStartRef = useRef({ time: 0, x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationId;
        let time = 0;

        // Data History for Graph
        let positionHistory = [];
        const maxHistory = 300;

        const render = () => {
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Layout
            const simulationWidth = canvas.width * 0.7; // 70% for sim, 30% for controls
            const centerX = simulationWidth / 2;
            const centerY = canvas.height / 2;
            const springMntY = 100;

            let displacement = 0;
            let velocity = 0;
            let ke = 0;
            let pe = 0;
            let maxEnergy = 0;

            if (mode === 'pendulum') {
                // Theta(t) = Theta0 * cos(w*t) * e^(-b*t)
                const L_m = length / 100; // scale
                const omega = Math.sqrt(gravity / L_m);
                const theta0 = (amplitude * Math.PI) / 180;

                // Damping factor
                const dampFactor = Math.exp(-damping * time * 0.1);
                const currentAngle = theta0 * Math.cos(omega * time) * dampFactor;
                const currentOmega = -theta0 * omega * Math.sin(omega * time) * dampFactor; // Approx velocity

                displacement = currentAngle; // For graph (angle)
                velocity = currentOmega * L_m; // Tangential velocity

                // Positions
                const pivotX = centerX;
                const pivotY = 100;
                const bobX = pivotX + length * Math.sin(currentAngle);
                const bobY = pivotY + length * Math.cos(currentAngle);

                // Energy (Approx for simple pendulum)
                // PE = mgh = mgL(1 - cos(theta))
                // KE = 0.5 * m * v^2
                const h = L_m * (1 - Math.cos(currentAngle));
                pe = mass * gravity * h * 500; // Scale for visuals
                ke = 0.5 * mass * (velocity * velocity) * 500;
                maxEnergy = mass * gravity * (L_m * (1 - Math.cos(theta0))) * 500;

                // Draw String
                ctx.beginPath();
                ctx.moveTo(pivotX, pivotY);
                ctx.lineTo(bobX, bobY);
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Draw Bob
                ctx.beginPath();
                ctx.arc(bobX, bobY, 20, 0, Math.PI * 2);
                ctx.fillStyle = isDraggingPendulum ? '#ffed4e' : '#f1c40f';
                ctx.fill();

                // Add draggable indicator ring
                if (!isDraggingPendulum) {
                    ctx.strokeStyle = 'rgba(241, 196, 15, 0.4)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(bobX, bobY, 28, 0, Math.PI * 2);
                    ctx.stroke();
                }

                ctx.shadowBlur = isDraggingPendulum ? 25 : 15;
                ctx.shadowColor = '#f1c40f';

                // Draw Pivot
                ctx.beginPath();
                ctx.arc(pivotX, pivotY, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#aaa';
                ctx.fill();

            } else {
                // Spring Block
                // x(t) = A * cos(w*t) * e^(-b*t)
                const omega = Math.sqrt(k / mass);
                const dampFactor = Math.exp(-damping * time * 0.1);

                const x = amplitude * Math.cos(omega * time) * dampFactor;
                const v = -amplitude * omega * Math.sin(omega * time) * dampFactor;

                displacement = x; // For graph (pixels)
                velocity = v;

                // Energy
                // PE = 0.5 * k * x^2
                // KE = 0.5 * m * v^2
                pe = 0.5 * k * (x / 100) * (x / 100) * 5000; // Scale up
                ke = 0.5 * mass * (v / 100) * (v / 100) * 5000;
                maxEnergy = 0.5 * k * (amplitude / 100) * (amplitude / 100) * 5000;

                const blockY = centerY + x;
                const blockX = centerX;

                // Draw Spring (Zigzag)
                ctx.beginPath();
                ctx.moveTo(blockX, springMntY);
                const segments = 20;
                const springLen = blockY - springMntY;
                for (let i = 1; i <= segments; i++) {
                    const py = springMntY + (springLen * i) / segments;
                    const px = blockX + (i % 2 === 0 ? 10 : -10);
                    ctx.lineTo(px, py);
                }
                ctx.lineTo(blockX, blockY);
                ctx.strokeStyle = '#4facfe';
                ctx.lineWidth = 3;
                ctx.stroke();

                // Draw Support
                ctx.fillRect(blockX - 50, springMntY, 100, 5);

                // Draw Block
                ctx.fillStyle = isDraggingPendulum ? '#ff6b5b' : '#e74c3c';
                ctx.fillRect(blockX - 25, blockY, 50, 50);

                // Add draggable indicator border
                if (!isDraggingPendulum) {
                    ctx.strokeStyle = 'rgba(231, 76, 60, 0.4)';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(blockX - 25 - 4, blockY - 4, 50 + 8, 50 + 8);
                }

                ctx.shadowBlur = isDraggingPendulum ? 25 : 15;
                ctx.shadowColor = '#e74c3c';
            }

            // === VISUALIZATIONS ===

            // 1. Live Graph (Position vs Time)
            positionHistory.push(displacement);
            if (positionHistory.length > maxHistory) positionHistory.shift();

            const graphHeight = 150;
            const graphWidth = simulationWidth - 40;
            const graphX = 20;
            const graphY = canvas.height - graphHeight - 20;

            // Graph Background
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(graphX, graphY, graphWidth, graphHeight);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.strokeRect(graphX, graphY, graphWidth, graphHeight);

            // Graph Label
            ctx.fillStyle = '#aaa';
            ctx.font = '12px Inter, sans-serif';
            ctx.fillText(mode === 'pendulum' ? 'Angle (θ) vs Time' : 'Position (x) vs Time', graphX + 10, graphY + 20);

            // Center Line
            ctx.beginPath();
            ctx.moveTo(graphX, graphY + graphHeight / 2);
            ctx.lineTo(graphX + graphWidth, graphY + graphHeight / 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.stroke();

            // Plot Data
            ctx.beginPath();
            ctx.strokeStyle = mode === 'pendulum' ? '#f1c40f' : '#e74c3c';
            ctx.lineWidth = 2;
            const xStep = graphWidth / maxHistory;
            const scaleY = mode === 'pendulum' ? 1 : 0.5; // Scale down x-displacement for graph

            for (let i = 0; i < positionHistory.length; i++) {
                const px = graphX + i * xStep;
                const py = (graphY + graphHeight / 2) - positionHistory[i] * scaleY;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;


            // 2. Energy Bars (Right side of Sim)
            const barX = simulationWidth - 80;
            const barY = 100;
            const barW = 20;
            const barH = 200;

            // Backgrounds
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(barX, barY, barW, barH);
            ctx.fillRect(barX + 30, barY, barW, barH);

            // Labels
            ctx.fillStyle = '#fff';
            ctx.font = '12px sans-serif';
            ctx.fillText('KE', barX, barY + barH + 15);
            ctx.fillText('PE', barX + 30, barY + barH + 15);

            // Fill Bars
            // Clamping max to avoid overflow glitches on changing params
            const safeMax = Math.max(maxEnergy, pe + ke, 1);
            const keH = (ke / safeMax) * barH;
            const peH = (pe / safeMax) * barH;

            ctx.fillStyle = '#2ecc71'; // KE Green
            ctx.fillRect(barX, barY + barH - keH, barW, keH);

            ctx.fillStyle = '#e67e22'; // PE Orange
            ctx.fillRect(barX + 30, barY + barH - peH, barW, peH);


            // Update Time
            if (isAnimating && !isDraggingPendulum) {
                time += 0.05;
            }
            animationId = requestAnimationFrame(render);
        };

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            if (!isAnimating) requestAnimationFrame(render);
        };
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Mouse event handlers for pendulum dragging
        const handleMouseDown = (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const simulationWidth = canvas.width * 0.7;
            const centerX = simulationWidth / 2;
            const centerY = canvas.height / 2;
            const pivotY = 100;
            const springMntY = 100;

            if (mode === 'pendulum') {
                // Check if clicking on pendulum bob
                const L_m = length / 100;
                const omega = Math.sqrt(gravity / L_m);
                const theta0 = (amplitude * Math.PI) / 180;
                const dampFactor = Math.exp(-damping * time * 0.1);
                const currentAngle = theta0 * Math.cos(omega * time) * dampFactor;

                const bobX = centerX + length * Math.sin(currentAngle);
                const bobY = pivotY + length * Math.cos(currentAngle);

                const distance = Math.sqrt((mouseX - bobX) ** 2 + (mouseY - bobY) ** 2);

                if (distance < 30) {
                    setIsDraggingPendulum(true);
                    setIsAnimating(false);
                    dragStartRef.current = { x: mouseX, y: mouseY, pivotX: centerX, pivotY, isSpring: false };
                }
            } else {
                // Check if clicking on spring block
                const omega = Math.sqrt(k / mass);
                const dampFactor = Math.exp(-damping * time * 0.1);
                const x = amplitude * Math.cos(omega * time) * dampFactor;

                const blockY = centerY + x;
                const blockX = centerX;

                // Check if click is on block (50px wide, 50px tall)
                if (mouseX > blockX - 25 && mouseX < blockX + 25 && mouseY > blockY && mouseY < blockY + 50) {
                    setIsDraggingPendulum(true);
                    setIsAnimating(false);
                    dragStartRef.current = { x: mouseX, y: mouseY, isSpring: true, centerY };
                }
            }
        };

        const handleMouseMove = (e) => {
            if (!isDraggingPendulum) return;

            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const { isSpring } = dragStartRef.current;

            if (isSpring) {
                // For spring: update amplitude based on vertical drag
                const { centerY } = dragStartRef.current;
                const displacement = mouseY - centerY;
                const clampedAmplitude = Math.max(10, Math.min(200, Math.abs(displacement)));
                setAmplitude(Math.round(clampedAmplitude));
            } else {
                // For pendulum: update length and angle
                const { pivotX, pivotY } = dragStartRef.current;

                const deltaX = mouseX - pivotX;
                const deltaY = mouseY - pivotY;

                const newLength = Math.sqrt(deltaX ** 2 + deltaY ** 2);
                const newAngle = Math.atan2(deltaX, deltaY) * (180 / Math.PI);

                // Clamp length between reasonable values
                const clampedLength = Math.max(50, Math.min(400, newLength));
                // Allow movement in both directions (-90 to 90) - keep the sign!
                const clampedAngle = Math.max(-90, Math.min(90, newAngle));

                setLength(Math.round(clampedLength));
                setAmplitude(Math.round(clampedAngle));
            }
        };

        const handleMouseUp = () => {
            if (isDraggingPendulum) {
                setIsDraggingPendulum(false);
                setIsAnimating(true);
            }
        };

        canvas.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        render();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            canvas.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            cancelAnimationFrame(animationId);
        };
    }, [mass, k, length, gravity, amplitude, mode, damping, isAnimating, isDraggingPendulum]);


    return (
        <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', position: 'relative', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
            <canvas ref={canvasRef} style={{ display: 'block' }} />
            <button
                onClick={() => window.location.href = '/'}
                style={{
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    zIndex: 10,
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    backdropFilter: 'blur(5px)'
                }}
            >
                &larr; Home
            </button>

            {/* Sidebar Controls */}
            <div style={{
                position: 'absolute',
                top: '0',
                right: '0',
                height: '100%',
                width: '30%',
                background: 'rgba(25, 25, 35, 0.95)',
                borderLeft: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                padding: '40px',
                boxSizing: 'border-box',
                overflowY: 'auto'
            }}>
                <h2 style={{
                    marginTop: 0,
                    fontSize: '2rem',
                    background: 'linear-gradient(90deg, #f1c40f, #e67e22)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: '800'
                }}>
                    Oscillator Lab
                </h2>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', background: 'rgba(255,255,255,0.05)', padding: '5px', borderRadius: '10px' }}>
                    <button
                        onClick={() => { setMode('pendulum'); setAmplitude(30); }}
                        style={{
                            flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold',
                            background: mode === 'pendulum' ? '#f1c40f' : 'transparent',
                            color: mode === 'pendulum' ? 'black' : 'white',
                            transition: 'all 0.3s'
                        }}
                    >
                        Pendulum
                    </button>
                    <button
                        onClick={() => { setMode('spring'); setAmplitude(100); }}
                        style={{
                            flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold',
                            background: mode === 'spring' ? '#e74c3c' : 'transparent',
                            color: mode === 'spring' ? 'white' : 'white',
                            transition: 'all 0.3s'
                        }}
                    >
                        Spring
                    </button>
                </div>

                {mode === 'pendulum' ? (
                    <div className="control-group" style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                            <label style={{ color: '#aaa', fontSize: '0.9rem' }}>Length</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <input
                                    type="number"
                                    min="50" max="400"
                                    value={length}
                                    onChange={(e) => setLength(Math.min(400, Math.max(50, Number(e.target.value))))}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px',
                                        color: 'white', padding: '2px 5px', width: '50px', textAlign: 'right', fontWeight: 'bold'
                                    }}
                                />
                                <span style={{ fontWeight: 'bold' }}>px</span>
                            </div>
                        </div>
                        <input
                            type="range" min="50" max="400" value={length}
                            onChange={(e) => setLength(Number(e.target.value))}
                            style={{ width: '100%', accentColor: '#f1c40f' }}
                        />
                    </div>
                ) : (
                    <>
                        <div className="control-group" style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                                <label style={{ color: '#aaa', fontSize: '0.9rem' }}>Mass</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <input
                                        type="number"
                                        min="1" max="10" step="0.5"
                                        value={mass}
                                        onChange={(e) => setMass(Math.min(10, Math.max(1, Number(e.target.value))))}
                                        style={{
                                            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px',
                                            color: 'white', padding: '2px 5px', width: '50px', textAlign: 'right', fontWeight: 'bold'
                                        }}
                                    />
                                    <span style={{ fontWeight: 'bold' }}>kg</span>
                                </div>
                            </div>
                            <input
                                type="range" min="1" max="10" step="0.5" value={mass}
                                onChange={(e) => setMass(Number(e.target.value))}
                                style={{ width: '100%', accentColor: '#e74c3c' }}
                            />
                        </div>
                        <div className="control-group" style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                                <label style={{ color: '#aaa', fontSize: '0.9rem' }}>Spring Constant (k)</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <input
                                        type="number"
                                        min="1" max="50"
                                        value={k}
                                        onChange={(e) => setK(Math.min(50, Math.max(1, Number(e.target.value))))}
                                        style={{
                                            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px',
                                            color: 'white', padding: '2px 5px', width: '50px', textAlign: 'right', fontWeight: 'bold'
                                        }}
                                    />
                                    <span style={{ fontWeight: 'bold' }}>N/m</span>
                                </div>
                            </div>
                            <input
                                type="range" min="1" max="50" value={k}
                                onChange={(e) => setK(Number(e.target.value))}
                                style={{ width: '100%', accentColor: '#e74c3c' }}
                            />
                        </div>
                    </>
                )}

                <div className="control-group" style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                        <label style={{ color: '#aaa', fontSize: '0.9rem' }}>{mode === 'pendulum' ? 'Start Angle' : 'Amplitude'}</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <input
                                type="number"
                                min={mode === 'pendulum' ? -90 : 10} max={mode === 'pendulum' ? 90 : 200}
                                value={amplitude}
                                onChange={(e) => setAmplitude(Math.max(mode === 'pendulum' ? -90 : 10, Math.min(mode === 'pendulum' ? 90 : 200, Number(e.target.value))))}
                                style={{
                                    background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px',
                                    color: 'white', padding: '2px 5px', width: '50px', textAlign: 'right', fontWeight: 'bold'
                                }}
                            />
                            <span style={{ fontWeight: 'bold' }}>{mode === 'pendulum' ? '°' : 'px'}</span>
                        </div>
                    </div>
                    <input
                        type="range" min={mode === 'pendulum' ? -90 : 10} max={mode === 'pendulum' ? 90 : 200} value={amplitude}
                        onChange={(e) => setAmplitude(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#4facfe' }}
                    />
                </div>

                <div className="control-group" style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                        <label style={{ color: '#aaa', fontSize: '0.9rem' }}>Gravity</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <input
                                type="number"
                                min="1" max="25" step="0.1"
                                value={gravity}
                                onChange={(e) => setGravity(Math.min(25, Math.max(1, Number(e.target.value))))}
                                style={{
                                    background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px',
                                    color: 'white', padding: '2px 5px', width: '50px', textAlign: 'right', fontWeight: 'bold'
                                }}
                            />
                            <span style={{ fontWeight: 'bold' }}>m/s²</span>
                        </div>
                    </div>
                    <input
                        type="range" min="1" max="25" step="0.1" value={gravity}
                        onChange={(e) => setGravity(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#2ecc71' }}
                    />
                </div>

                <div className="control-group" style={{ marginBottom: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                        <label style={{ color: '#aaa', fontSize: '0.9rem' }}>Damping</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <input
                                type="number"
                                min="0" max="5" step="0.1"
                                value={damping}
                                onChange={(e) => setDamping(Math.min(5, Math.max(0, Number(e.target.value))))}
                                style={{
                                    background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px',
                                    color: 'white', padding: '2px 5px', width: '50px', textAlign: 'right', fontWeight: 'bold'
                                }}
                            />
                            <span style={{ fontWeight: 'bold' }}></span>
                        </div>
                    </div>
                    <input
                        type="range" min="0" max="5" step="0.1" value={damping}
                        onChange={(e) => setDamping(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#aaa' }}
                    />
                </div>

                <button
                    onClick={() => setIsAnimating(!isAnimating)}
                    style={{
                        width: '100%',
                        padding: '14px',
                        background: '#34495e',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: 'white',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        transition: 'all 0.2s'
                    }}
                >
                    {isAnimating ? '⏸ PAUSE' : '▶ RESUME'}
                </button>

            </div>
        </div>
    );
};

export default SHMSimulator;