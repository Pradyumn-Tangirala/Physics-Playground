import React, { useRef, useEffect, useState } from 'react';

const ProjectileSimulator = () => {
    const canvasRef = useRef(null);
    const [velocity, setVelocity] = useState(60);
    const [angle, setAngle] = useState(45);
    const [gravity, setGravity] = useState(9.8);
    const [isAnimating, setIsAnimating] = useState(false);
    const [showTrails, setShowTrails] = useState(true);
    const [lastResult, setLastResult] = useState(null);
    const [finalPos, setFinalPos] = useState(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId;
        let t = 0;

        const calculatePosition = (v0, theta, g, time) => {
            const x = v0 * Math.cos(theta) * time;
            const y = v0 * Math.sin(theta) * time - 0.5 * g * time * time;
            return { x, y };
        };

        const drawHUD = (ctx, time, x, y) => {
            const centerX = canvas.width / 2;
            const hudY = 40;

            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const text = `T: ${time.toFixed(2)}s   H: ${y.toFixed(1)}m   R: ${x.toFixed(1)}m`;
            const textWidth = ctx.measureText(text).width + 40;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.beginPath();

            const rx = centerX - textWidth / 2;
            const ry = hudY - 20;
            const rw = textWidth;
            const rh = 40;
            const rr = 20;

            ctx.moveTo(rx + rr, ry);
            ctx.lineTo(rx + rw - rr, ry);
            ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rr);
            ctx.lineTo(rx + rw, ry + rh - rr);
            ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rr, ry + rh);
            ctx.lineTo(rx + rr, ry + rh);
            ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rr);
            ctx.lineTo(rx, ry + rr);
            ctx.quadraticCurveTo(rx, ry, rx + rr, ry);
            ctx.closePath();

            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.stroke();

            ctx.fillStyle = 'white';
            ctx.fillText(text, centerX, hudY);
        };

        const render = () => {
            ctx.fillStyle = isAnimating && showTrails ? 'rgba(0, 0, 0, 0.2)' : 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const groundHeight = 40;
            const startX = 50;
            const startY = canvas.height - groundHeight;
            const scale = 5;

            // Grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            const gridSize = 50;
            for (let x = 0; x < canvas.width; x += gridSize) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += gridSize) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
            }

            // Ground
            const gradient = ctx.createLinearGradient(0, canvas.height - groundHeight, 0, canvas.height);
            gradient.addColorStop(0, '#2ecc71');
            gradient.addColorStop(1, '#27ae60');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, canvas.height - groundHeight, canvas.width, groundHeight);

            const v0 = velocity;
            const theta = (angle * Math.PI) / 180;
            const g = gravity;

            // Always Draw Prediction Line
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.setLineDash([10, 10]);
            ctx.lineWidth = 4;

            let predT = 0;
            let predY = 0;
            ctx.moveTo(startX, startY);

            let maxSteps = 2000;
            let step = 0;

            while (predY >= -0.1 && step < maxSteps) {
                const pos = calculatePosition(v0, theta, g, predT);
                predY = pos.y;
                const canvasX = startX + pos.x * scale;
                const canvasY = startY - pos.y * scale;

                if (pos.y < -0.1 && predT > 0.1) break;

                ctx.lineTo(canvasX, canvasY);
                predT += 0.1;
                step++;
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw Cannon
            ctx.beginPath();
            ctx.arc(startX, startY, 15, 0, Math.PI * 2);
            ctx.fillStyle = '#4facfe';
            ctx.fill();
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#4facfe';
            ctx.fill();
            ctx.shadowBlur = 0;

            let currentX = 0;
            let currentY = 0;
            let currentTime = 0;

            if (isAnimating) {
                const pos = calculatePosition(v0, theta, g, t);
                const canvasX = startX + pos.x * scale;
                const canvasY = startY - pos.y * scale;

                currentX = pos.x;
                currentY = Math.max(0, pos.y);
                currentTime = t;

                // Draw Ball
                ctx.beginPath();
                ctx.arc(canvasX, canvasY, 10, 0, Math.PI * 2);
                ctx.fillStyle = '#ff6b6b';
                ctx.fill();

                ctx.shadowBlur = 15;
                ctx.shadowColor = '#ff6b6b';
                ctx.beginPath();
                ctx.arc(canvasX, canvasY, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Dynamic Labels
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'left';
                const labelX = canvasX + 20;
                const labelY = canvasY;
                ctx.fillText(`H: ${pos.y.toFixed(1)}m`, labelX, labelY - 10);
                ctx.fillText(`D: ${pos.x.toFixed(1)}m`, labelX, labelY + 10);

                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(canvasX + 10, canvasY); ctx.lineTo(labelX - 5, labelY); ctx.stroke();

                // Check collision
                if (t > 0.1 && pos.y <= 0) {
                    setIsAnimating(false);
                    setFinalPos({ x: pos.x, y: 0, t: t });

                    const timeOfFlight = (2 * v0 * Math.sin(theta)) / g;
                    const range = (v0 * v0 * Math.sin(2 * theta)) / g;
                    const maxHeight = (v0 * v0 * Math.sin(theta) * Math.sin(theta)) / (2 * g);

                    setLastResult({
                        time: timeOfFlight,
                        range: range,
                        height: maxHeight
                    });

                    t = 0;
                } else {
                    t += 0.02; // Slower speed
                    animationId = requestAnimationFrame(render);
                }

                drawHUD(ctx, currentTime, currentX, currentY);

            } else if (finalPos) {
                const canvasX = startX + finalPos.x * scale;
                const canvasY = startY - finalPos.y * scale;

                // Draw Ball
                ctx.beginPath();
                ctx.arc(canvasX, canvasY, 10, 0, Math.PI * 2);
                ctx.fillStyle = '#ff6b6b';
                ctx.fill();

                drawHUD(ctx, finalPos.t, finalPos.x, finalPos.y);
            } else {
                // Initial state: Draw nothing extra, or maybe ball inside cannon?
                // Current logic draws cannon only.
                drawHUD(ctx, 0, 0, 0);
            }
        };

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            requestAnimationFrame(render);
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        if (isAnimating) {
            requestAnimationFrame(render);
        } else {
            requestAnimationFrame(render);
        }

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            cancelAnimationFrame(animationId);
        };
    }, [velocity, angle, gravity, isAnimating, showTrails, finalPos]);

    const handleFire = () => {
        setIsAnimating(true);
        setFinalPos(null);
        setLastResult(null);
    };

    return (
        <div style={{ width: '100vw', height: '100vh', background: 'black', position: 'relative', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
            <canvas ref={canvasRef} style={{ display: 'block' }} />

            <button
                onClick={() => window.location.href = '/'}
                style={{
                    position: 'absolute', top: '20px', left: '20px', zIndex: 10,
                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white', padding: '10px 20px', borderRadius: '30px', cursor: 'pointer',
                    backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '600'
                }}
            >
                ← Home
            </button>

            {lastResult && !isAnimating && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(25, 25, 35, 0.95)',
                    padding: '40px',
                    borderRadius: '24px',
                    border: '1px solid rgba(79, 172, 254, 0.3)',
                    color: 'white',
                    textAlign: 'center',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(20px)',
                    animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}>
                    <h2 style={{ margin: '0 0 20px 0', fontSize: '2rem', background: 'linear-gradient(90deg, #4facfe, #00f2fe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        FLIGHT RESULTS
                    </h2>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px' }}>
                            <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '5px' }}>Max Height</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ff6b6b' }}>{lastResult.height.toFixed(2)} m</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px' }}>
                            <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '5px' }}>Total Range</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#feca57' }}>{lastResult.range.toFixed(2)} m</div>
                        </div>
                        <div style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px' }}>
                            <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '5px' }}>Time of Flight</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4facfe' }}>{lastResult.time.toFixed(2)} s</div>
                        </div>
                    </div>

                    <button
                        onClick={handleFire}
                        style={{
                            padding: '14px 40px',
                            background: 'white',
                            color: 'black',
                            border: 'none',
                            borderRadius: '50px',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            boxShadow: '0 5px 20px rgba(255,255,255,0.2)'
                        }}
                    >
                        Fire Again ↺
                    </button>
                </div>
            )}

            <style>{`
                @keyframes popIn {
                    from { opacity: 0; transform: translate(-50%, -40%) scale(0.9); }
                    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
            `}</style>

            <div style={{
                position: 'absolute',
                top: '50%',
                right: '20px',
                transform: 'translateY(-50%)',
                background: 'rgba(25, 25, 35, 0.85)',
                backdropFilter: 'blur(15px)',
                padding: '30px',
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'white',
                width: '320px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
            }}>
                <h2 style={{
                    marginTop: 0,
                    marginBottom: '25px',
                    fontSize: '1.5rem',
                    background: 'linear-gradient(90deg, #ff6b6b, #feb47b)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: '800'
                }}>
                    PROJECTILE CONTROL
                </h2>

                <div className="control-group" style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                        <label style={{ color: '#aaa', fontSize: '0.9rem' }}>Launch Velocity</label>
                        <input
                            type="number"
                            min="10" max="100"
                            value={velocity}
                            onChange={(e) => setVelocity(Math.min(100, Math.max(10, Number(e.target.value))))}
                            style={{
                                background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px',
                                color: 'white', padding: '2px 5px', width: '60px', textAlign: 'right', fontWeight: 'bold'
                            }}
                        />
                    </div>
                    <input
                        type="range" min="10" max="100" value={velocity}
                        onChange={(e) => setVelocity(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#ff6b6b', height: '6px', borderRadius: '3px' }}
                    />
                </div>

                <div className="control-group" style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                        <label style={{ color: '#aaa', fontSize: '0.9rem' }}>Launch Angle</label>
                        <input
                            type="number"
                            min="0" max="90"
                            value={angle}
                            onChange={(e) => setAngle(Math.min(90, Math.max(0, Number(e.target.value))))}
                            style={{
                                background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px',
                                color: 'white', padding: '2px 5px', width: '60px', textAlign: 'right', fontWeight: 'bold'
                            }}
                        />
                    </div>
                    <input
                        type="range" min="0" max="90" value={angle}
                        onChange={(e) => setAngle(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#feca57', height: '6px', borderRadius: '3px' }}
                    />
                </div>

                <div className="control-group" style={{ marginBottom: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                        <label style={{ color: '#aaa', fontSize: '0.9rem' }}>Gravity</label>
                        <input
                            type="number"
                            min="1" max="25"
                            step="0.1"
                            value={gravity}
                            onChange={(e) => setGravity(Math.min(25, Math.max(1, Number(e.target.value))))}
                            style={{
                                background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px',
                                color: 'white', padding: '2px 5px', width: '60px', textAlign: 'right', fontWeight: 'bold'
                            }}
                        />
                    </div>
                    <input
                        type="range" min="1" max="25" step="0.1" value={gravity}
                        onChange={(e) => setGravity(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#4facfe', height: '6px', borderRadius: '3px' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handleFire}
                        disabled={isAnimating}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: isAnimating ? '#333' : 'linear-gradient(135deg, #ff6b6b, #ee5253)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            fontWeight: 'bold',
                            cursor: isAnimating ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: isAnimating ? 'none' : '0 4px 15px rgba(255, 107, 107, 0.4)'
                        }}
                    >
                        {isAnimating ? 'FIRING...' : 'FIRE CANNON'}
                    </button>

                    <button
                        onClick={() => setShowTrails(!showTrails)}
                        style={{
                            padding: '12px',
                            background: showTrails ? 'rgba(255,255,255,0.1)' : 'transparent',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '8px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '1.2rem'
                        }}
                        title="Toggle Motion Trails"
                    >
                        {showTrails ? '👻' : '🚫'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProjectileSimulator;
