import React, { useRef, useEffect, useState } from 'react';

const WaveInterference = () => {
  const canvasRef = useRef(null);
  const screenCanvasRef = useRef(null);
  const graphCanvasRef = useRef(null);
  const containerRef = useRef(null);

  const [separation, setSeparation] = useState(50);
  const [frequency, setFrequency] = useState(10);
  const [phase, setPhase] = useState(0);
  const [wallMode, setWallMode] = useState(true);
  const [isTorchOn, setIsTorchOn] = useState(true);
  const [colorTheme, setColorTheme] = useState('laser-red');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [hoveredLabel, setHoveredLabel] = useState(null);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    // Define trigger zones
    // Source: Left area before the wall
    const isSourceZone = x < width * 0.14;

    // Slit: Around the wall (15%)
    const isSlitZone = Math.abs(x - width * 0.15) < width * 0.05;

    if (isSourceZone) {
      setHoveredLabel('source');
    } else if (isSlitZone) {
      setHoveredLabel('slit');
    } else {
      setHoveredLabel(null);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const screenCanvas = screenCanvasRef.current;
    const graphCanvas = graphCanvasRef.current;
    const container = containerRef.current;

    const ctx = canvas.getContext('2d', { alpha: false }); // Optimize: alpha false
    const screenCtx = screenCanvas.getContext('2d');
    const graphCtx = graphCanvas.getContext('2d');

    let animationFrameId;
    let time = 0;

    // Performance Optimization: Render at lower resolution and scale up
    const RESOLUTION_SCALE = 0.5;

    const render = () => {
      // Dynamic resizing with resolution scaling
      const targetWidth = Math.floor(container.clientWidth * RESOLUTION_SCALE);
      const targetHeight = Math.floor(container.clientHeight * RESOLUTION_SCALE);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        // Screen and Graph can stay higher res as they are less intensive
        screenCanvas.height = container.clientHeight;
        graphCanvas.height = container.clientHeight;
      }

      const width = canvas.width;
      const height = canvas.height;

      // Create ImageData
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      if (!isTorchOn) {
        // Render darkness/noise if torch is off
        for (let i = 0; i < data.length; i += 4) {
          const noise = Math.random() * 10;
          data[i] = noise;
          data[i + 1] = noise;
          data[i + 2] = noise;
          data[i + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);

        // Clear other canvases
        screenCtx.fillStyle = '#050505';
        screenCtx.fillRect(0, 0, screenCanvas.width, screenCanvas.height);
        graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);

        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // Source positions (Scaled coordinates)
      const centerY = height / 2;
      const centerX = width / 2;
      const wallX = width * 0.15; // Wall at 15% from left

      let source1X, source1Y, source2X, source2Y;

      if (wallMode) {
        // Vertical separation along the wall line
        const separationPx = (separation / 100) * (height / 2.5);
        source1X = wallX;
        source2X = wallX;
        source1Y = centerY - separationPx;
        source2Y = centerY + separationPx;
      } else {
        // Horizontal separation centered on screen
        const separationPx = (separation / 100) * (width / 2.5);
        source1X = centerX - separationPx;
        source2X = centerX + separationPx;
        source1Y = centerY;
        source2Y = centerY;
      }

      // Wave parameters
      const freq = frequency * 0.08;
      const phaseRad = (phase * Math.PI) / 180;

      // We need to store intensities for the screen/graph
      // Since we are rendering at low res, we'll upscale the y-index for the high-res screen
      const rightEdgeIntensities = new Float32Array(height);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;

          // Wall rendering
          if (wallMode) {
            if (Math.abs(x - wallX) < 2) { // Thicker wall (scaled)
              // Wall line
              if (Math.abs(y - source1Y) > 2 && Math.abs(y - source2Y) > 2) {
                // Dark wall color
                data[index] = 20; data[index + 1] = 20; data[index + 2] = 25; data[index + 3] = 255;
                continue;
              }
            }
          }

          let val = 0;

          if (wallMode && x < wallX) {
            // Plane wave coming from left
            val = Math.sin((x - wallX) * freq - time);
          } else {
            // Point sources (or interference on right side of wall)

            // Distance from sources
            const d1 = Math.sqrt((x - source1X) ** 2 + (y - source1Y) ** 2);
            const d2 = Math.sqrt((x - source2X) ** 2 + (y - source2Y) ** 2);

            // Attenuation
            const att1 = 1 / (1 + d1 * 0.005);
            const att2 = 1 / (1 + d2 * 0.005);

            // Directional Factor (Single Slit Envelope Simulation)
            const angle1 = Math.atan2(y - source1Y, x - source1X);
            const angle2 = Math.atan2(y - source2Y, x - source2X);

            const dir1 = Math.max(0, Math.cos(angle1));
            const dir2 = Math.max(0, Math.cos(angle2));

            const beamSharpness = 1.5;
            const env1 = Math.pow(dir1, beamSharpness);
            const env2 = Math.pow(dir2, beamSharpness);

            // Calculate wave amplitude
            const val1 = Math.sin(d1 * freq - time) * att1 * env1;
            const val2 = Math.sin(d2 * freq - time + phaseRad) * att2 * env2;

            val = val1 + val2;
          }

          // Capture intensity at the right edge
          if (x === width - 1) {
            rightEdgeIntensities[y] = val;
          }

          // Color Mapping
          const gain = 120;
          const intensity = Math.min(255, Math.floor(Math.abs(val) * gain));

          let r = 0, g = 0, b = 0;

          switch (colorTheme) {
            case 'laser-red':
              r = intensity;
              if (intensity > 200) { g = (intensity - 200) * 2; }
              break;
            case 'cyan-magenta':
              if (val > 0) { r = 0; g = intensity; b = intensity; }
              else { r = intensity; g = 0; b = intensity; }
              break;
            case 'laser-green':
              g = intensity;
              if (intensity > 200) { r = intensity - 200; b = intensity - 200; }
              break;
            case 'golden-fire':
              if (val > 0) { r = intensity; g = intensity * 0.8; b = 0; }
              else { r = intensity * 0.8; g = 0; b = 0; }
              break;
            case 'grayscale':
              r = intensity; g = intensity; b = intensity;
              break;
            case 'rainbow':
              // Map phase/value to hue
              const hue = (val + 1) * 180; // 0 to 360
              // Simple HSV to RGB conversion for performance
              const s = 1, v = intensity / 255;
              const c = v * s;
              const x_col = c * (1 - Math.abs(((hue / 60) % 2) - 1));
              const m = v - c;
              let r1 = 0, g1 = 0, b1 = 0;
              if (hue < 60) { r1 = c; g1 = x_col; b1 = 0; }
              else if (hue < 120) { r1 = x_col; g1 = c; b1 = 0; }
              else if (hue < 180) { r1 = 0; g1 = c; b1 = x_col; }
              else if (hue < 240) { r1 = 0; g1 = x_col; b1 = c; }
              else if (hue < 300) { r1 = x_col; g1 = 0; b1 = c; }
              else { r1 = c; g1 = 0; b1 = x_col; }
              r = (r1 + m) * 255; g = (g1 + m) * 255; b = (b1 + m) * 255;
              break;
            case 'electric-blue':
              r = intensity * 0.2; g = intensity * 0.6; b = intensity;
              break;
            case 'sunset':
              if (val > 0) { r = intensity; g = intensity * 0.5; b = intensity * 0.2; } // Orange/Gold
              else { r = intensity * 0.5; g = 0; b = intensity * 0.5; } // Purple
              break;
            default:
              r = intensity; g = intensity; b = intensity;
          }

          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // --- Render Projection Screen (High Res) ---
      const sWidth = screenCanvas.width;
      const sHeight = screenCanvas.height;
      const sImageData = screenCtx.createImageData(sWidth, sHeight);
      const sData = sImageData.data;

      for (let y = 0; y < sHeight; y++) {
        // Map high-res Y to low-res Y
        const lowResY = Math.floor(y * RESOLUTION_SCALE);
        const val = rightEdgeIntensities[Math.min(lowResY, height - 1)];

        const intensity = Math.min(255, Math.floor(Math.abs(val) * 200));

        let r = 0, g = 0, b = 0;
        switch (colorTheme) {
          case 'laser-red':
            r = intensity;
            if (intensity > 200) { g = (intensity - 200) * 2; }
            break;
          case 'cyan-magenta':
            if (val > 0) { r = 0; g = intensity; b = intensity; }
            else { r = intensity; g = 0; b = intensity; }
            break;
          case 'laser-green':
            g = intensity;
            if (intensity > 200) { r = intensity - 200; b = intensity - 200; }
            break;
          case 'golden-fire':
            if (val > 0) { r = intensity; g = intensity * 0.8; b = 0; }
            else { r = intensity * 0.8; g = 0; b = 0; }
            break;
          case 'grayscale':
            r = intensity; g = intensity; b = intensity;
            break;
          case 'rainbow':
            const hue = (val + 1) * 180;
            const s = 1, v = intensity / 255;
            const c = v * s;
            const x_col = c * (1 - Math.abs(((hue / 60) % 2) - 1));
            const m = v - c;
            let r1 = 0, g1 = 0, b1 = 0;
            if (hue < 60) { r1 = c; g1 = x_col; b1 = 0; }
            else if (hue < 120) { r1 = x_col; g1 = c; b1 = 0; }
            else if (hue < 180) { r1 = 0; g1 = c; b1 = x_col; }
            else if (hue < 240) { r1 = 0; g1 = x_col; b1 = c; }
            else if (hue < 300) { r1 = x_col; g1 = 0; b1 = c; }
            else { r1 = c; g1 = 0; b1 = x_col; }
            r = (r1 + m) * 255; g = (g1 + m) * 255; b = (b1 + m) * 255;
            break;
          case 'electric-blue':
            r = intensity * 0.2; g = intensity * 0.6; b = intensity;
            break;
          case 'sunset':
            if (val > 0) { r = intensity; g = intensity * 0.5; b = intensity * 0.2; }
            else { r = intensity * 0.5; g = 0; b = intensity * 0.5; }
            break;
        }

        for (let x = 0; x < sWidth; x++) {
          const idx = (y * sWidth + x) * 4;
          sData[idx] = r;
          sData[idx + 1] = g;
          sData[idx + 2] = b;
          sData[idx + 3] = 255;
        }
      }
      screenCtx.putImageData(sImageData, 0, 0);

      // --- Render Vertical Intensity Graph (High Res) ---
      const gWidth = graphCanvas.width;
      const gHeight = graphCanvas.height;
      graphCtx.clearRect(0, 0, gWidth, gHeight);

      graphCtx.strokeStyle = colorTheme === 'laser-red' ? '#ff3333' : '#ffff00';
      graphCtx.lineWidth = 2;
      graphCtx.shadowBlur = 5;
      graphCtx.shadowColor = graphCtx.strokeStyle;
      graphCtx.beginPath();

      for (let y = 0; y < gHeight; y++) {
        const lowResY = Math.floor(y * RESOLUTION_SCALE);
        const intensity = Math.abs(rightEdgeIntensities[Math.min(lowResY, height - 1)]);
        const xPos = gWidth - (intensity * gWidth * 0.8);

        if (y === 0) graphCtx.moveTo(xPos, y);
        else graphCtx.lineTo(xPos, y);
      }
      graphCtx.stroke();
      graphCtx.shadowBlur = 0;

      time += 0.05; // Time step
      animationFrameId = requestAnimationFrame(render);
    };

    // Initial size setup
    const handleResize = () => {
      screenCanvas.width = 50;
      graphCanvas.width = 180;
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [separation, frequency, phase, wallMode, isTorchOn, colorTheme]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: 'black', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>

      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        style={{
          position: 'absolute',
          top: '15px',
          left: '15px',
          zIndex: 20,
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '4px',
          color: 'white',
          padding: '5px 10px',
          cursor: 'pointer',
          fontSize: '1.2rem',
          backdropFilter: 'blur(5px)'
        }}
      >
        ☰
      </button>

      {/* Left Sidebar Controls */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '320px',
        height: '100%',
        background: 'rgba(10, 10, 15, 0.6)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.05)',
        padding: '30px',
        paddingTop: '70px',
        boxSizing: 'border-box',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: '25px',
        color: '#eee',
        transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
        boxShadow: '10px 0 30px rgba(0,0,0,0.3)'
      }}>
        <button
          onClick={() => window.location.href = '/'}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: '500',
            alignSelf: 'flex-start',
            marginBottom: '-10px',
            padding: '5px 0',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            transition: 'color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.color = '#fff'}
          onMouseOut={(e) => e.target.style.color = 'rgba(255,255,255,0.5)'}
        >
          &larr; Home
        </button>

        <h2 style={{
          margin: '0 0 10px 0',
          fontSize: '1.8rem',
          fontWeight: '800',
          background: 'linear-gradient(to right, #fff, #aaa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textAlign: 'center',
          letterSpacing: '-1px'
        }}>WAVE LAB</h2>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
          <button
            onClick={() => setIsTorchOn(!isTorchOn)}
            style={{
              background: isTorchOn
                ? 'linear-gradient(135deg, #ff3333, #aa0000)'
                : 'rgba(255,255,255,0.05)',
              color: isTorchOn ? 'white' : 'rgba(255,255,255,0.3)',
              border: isTorchOn ? 'none' : '1px solid rgba(255,255,255,0.1)',
              padding: '12px 30px',
              borderRadius: '30px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '0.9rem',
              boxShadow: isTorchOn ? '0 0 20px rgba(255, 51, 51, 0.4)' : 'none',
              transition: 'all 0.3s ease',
              letterSpacing: '1px'
            }}
          >
            {isTorchOn ? 'LASER ACTIVE' : 'LASER OFF'}
          </button>
        </div>

        <div className="control-group">
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '600' }}>
            Visualization Theme
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={colorTheme}
              onChange={(e) => setColorTheme(e.target.value)}
              className="premium-select"
            >
              <option value="laser-red">Laser Red</option>
              <option value="laser-green">Laser Green</option>
              <option value="cyan-magenta">Interference (Cyan/Magenta)</option>
              <option value="golden-fire">Golden Fire</option>
              <option value="electric-blue">Electric Blue</option>
              <option value="sunset">Sunset</option>
              <option value="rainbow">Rainbow</option>
              <option value="grayscale">Grayscale</option>
            </select>
          </div>
        </div>

        <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)', width: '100%' }}></div>

        <div className="control-group">
          <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center', fontSize: '0.8rem', color: '#ccc' }}>
            <span>Slit Separation</span>
            <input
              type="number"
              min="0"
              max="100"
              value={separation}
              onChange={(e) => setSeparation(Number(e.target.value))}
              className="premium-input"
            />
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={separation}
            onChange={(e) => setSeparation(Number(e.target.value))}
            className="premium-slider"
          />
        </div>

        <div className="control-group">
          <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center', fontSize: '0.8rem', color: '#ccc' }}>
            <span>Frequency</span>
            <input
              type="number"
              min="1"
              max="20"
              value={frequency}
              onChange={(e) => setFrequency(Number(e.target.value))}
              className="premium-input"
            />
          </label>
          <input
            type="range"
            min="1"
            max="20"
            value={frequency}
            onChange={(e) => setFrequency(Number(e.target.value))}
            className="premium-slider"
          />
        </div>

        <div className="control-group">
          <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center', fontSize: '0.8rem', color: '#ccc' }}>
            <span>Phase Shift</span>
            <input
              type="number"
              min="0"
              max="360"
              value={phase}
              onChange={(e) => setPhase(Number(e.target.value))}
              className="premium-input"
            />
          </label>
          <input
            type="range"
            min="0"
            max="360"
            value={phase}
            onChange={(e) => setPhase(Number(e.target.value))}
            className="premium-slider"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Double Slit Barrier</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={wallMode}
              onChange={(e) => setWallMode(e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        </div>

        <div style={{ marginTop: 'auto', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center', letterSpacing: '1px' }}>
          INTERACTIVE PHYSICS LAB v1.0
        </div>
      </div>

      {/* Main Content Container (Animated) */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          height: '100%',
          // Animation Logic
          width: isSidebarOpen ? 'calc(100vw - 320px)' : '100vw',
          transition: 'width 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
          overflow: 'hidden',
          boxShadow: 'inset 0 0 150px rgba(0,0,0,0.9)' // Vignette
        }}
      >
        {/* Main Simulation Canvas - Scaled via CSS for performance */}
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            imageRendering: 'pixelated' // Optional: keeps it sharp or 'auto' for smooth
          }}
        />

        {/* Visual Annotations */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '10%',
          transform: 'translateY(-50%)',
          color: 'rgba(255,255,255,0.9)',
          pointerEvents: 'none',
          zIndex: 5,
          opacity: hoveredLabel === 'source' ? 1 : 0,
          transition: 'opacity 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            fontSize: '0.8rem',
            letterSpacing: '1px'
          }}>LIGHT SOURCE</div>
          <div style={{ width: '40px', height: '1px', background: 'rgba(255,255,255,0.4)' }}></div>
        </div>

        <div style={{
          position: 'absolute',
          top: '15%',
          left: '16%',
          color: 'rgba(255,255,255,0.9)',
          pointerEvents: 'none',
          zIndex: 5,
          opacity: hoveredLabel === 'slit' ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }}>
          <div style={{
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            fontSize: '0.8rem',
            letterSpacing: '1px'
          }}>DOUBLE SLIT</div>
        </div>

        {/* Vertical Intensity Graph */}
        <div style={{
          position: 'absolute',
          top: 0,
          right: '50px', // Just left of the screen strip
          width: '180px',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 5
        }}>
          <canvas ref={graphCanvasRef} style={{ width: '100%', height: '100%' }} />
          <div style={{
            position: 'absolute',
            bottom: '30px',
            right: '10px',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '0.7rem',
            letterSpacing: '1px',
            textAlign: 'right'
          }}>
            DIFFRACTION<br />INTENSITY
          </div>
        </div>

        {/* Projection Screen Strip */}
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '50px',
          height: '100%',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          background: '#050505',
          zIndex: 5,
          boxShadow: '-10px 0 30px rgba(0,0,0,0.8)'
        }}>
          <canvas ref={screenCanvasRef} style={{ width: '100%', height: '100%' }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-90deg)',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '12px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            letterSpacing: '3px',
            fontWeight: '600'
          }}>SCREEN</div>
        </div>
      </div>

      <style>{`
        .premium-slider {
            -webkit-appearance: none;
            width: 100%;
            height: 4px;
            background: rgba(255,255,255,0.1);
            border-radius: 2px;
            outline: none;
            cursor: pointer;
        }
        .premium-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #fff;
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
            cursor: pointer;
            transition: transform 0.1s;
            margin-top: -6px; /* center on track */
        }
        .premium-slider::-webkit-slider-runnable-track {
            width: 100%;
            height: 4px;
            cursor: pointer;
            background: rgba(255,255,255,0.1);
            border-radius: 2px;
        }
        .premium-slider:hover::-webkit-slider-thumb {
            transform: scale(1.2);
            box-shadow: 0 0 15px rgba(255, 255, 255, 1);
        }

        .premium-input {
            background: transparent;
            border: none;
            border-bottom: 1px solid rgba(255,255,255,0.2);
            color: #fff;
            font-family: inherit;
            font-size: 0.9rem;
            width: 50px;
            text-align: center;
            padding: 2px;
            transition: border-color 0.3s;
        }
        .premium-input:focus {
            outline: none;
            border-bottom: 1px solid #fff;
        }

        .premium-select {
            width: 100%;
            padding: 10px;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            color: white;
            font-family: inherit;
            cursor: pointer;
            outline: none;
            transition: all 0.3s;
        }
        .premium-select:hover {
            background: rgba(255,255,255,0.05);
            border-color: rgba(255,255,255,0.3);
        }
        .premium-select option {
            background: #1a1a1a;
            color: white;
        }

        /* Toggle Switch */
        .toggle-switch {
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
        }
        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(255,255,255,0.1);
            transition: .4s;
            border-radius: 24px;
        }
        .slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }
        input:checked + .slider {
            background-color: #ff3333;
            box-shadow: 0 0 10px rgba(255, 51, 51, 0.4);
        }
        input:checked + .slider:before {
            transform: translateX(20px);
        }
      `}</style>
    </div>
  );
};

export default WaveInterference;
