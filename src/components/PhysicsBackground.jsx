import { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { useAnimationLoop } from '../simulation/useAnimationLoop';
import { beginFrame } from '../rendering/canvasSize';
import { useReducedMotion } from './useReducedMotion';
import SimulationCanvas from './SimulationCanvas';
import styles from './PhysicsBackground.module.css';

// Decorative particle network for the landing page. Speeds are tuned in
// px per 60 Hz frame and scaled by real elapsed time, so the motion looks the
// same on any refresh rate. All coordinates are CSS pixels.
//
// Motion is optional: it is off for users who ask for reduced motion, and a
// visible button pauses it (WCAG 2.2.2). When it is off, one still frame is
// drawn and redrawn only if the canvas is resized.
const PARTICLE_COUNT = 120;
const CONNECTION_DISTANCE = 120;
const POINTER_DISTANCE = 250;
const REPULSION = 0.1;
const MAX_SPEED = 2;
const OFFSCREEN = -1000;
const REFERENCE_FPS = 60;

class Particle {
    constructor(width, height) {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 2 + 0.5;
        this.baseColor = Math.random() > 0.5 ? '100, 200, 255' : '150, 100, 255'; // Blue or Purple
        this.opacity = Math.random() * 0.5 + 0.2;
    }

    update(width, height, pointer, frames) {
        this.x += this.vx * frames;
        this.y += this.vy * frames;

        // Bounce off edges; clamp so particles outside a shrunken canvas don't jitter.
        if (this.x < 0 || this.x > width) {
            this.vx *= -1;
            this.x = Math.min(Math.max(this.x, 0), width);
        }
        if (this.y < 0 || this.y > height) {
            this.vy *= -1;
            this.y = Math.min(Math.max(this.y, 0), height);
        }

        // Pointer repulsion (skipped at zero distance, where the direction is undefined).
        const dx = pointer.x - this.x;
        const dy = pointer.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0 && distance < POINTER_DISTANCE) {
            const force = ((POINTER_DISTANCE - distance) / POINTER_DISTANCE) * REPULSION * frames;
            this.vx -= (dx / distance) * force;
            this.vy -= (dy / distance) * force;
        }

        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > MAX_SPEED) {
            this.vx = (this.vx / speed) * MAX_SPEED;
            this.vy = (this.vy / speed) * MAX_SPEED;
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.baseColor}, ${this.opacity})`;
        ctx.fill();
    }
}

function drawConnections(ctx, particles) {
    ctx.lineWidth = 0.5;
    // Distinct pairs only (j > i: no self-pairs, no duplicates).
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < CONNECTION_DISTANCE) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(100, 150, 255, ${(1 - distance / CONNECTION_DISTANCE) * 0.2})`;
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
}

const PhysicsBackground = () => {
    const canvasRef = useRef(null);
    const particlesRef = useRef([]);
    const pointerRef = useRef({ x: OFFSCREEN, y: OFFSCREEN });
    const stillSizeRef = useRef(''); // canvas size the still frame was drawn at
    const reducedMotion = useReducedMotion();
    const [paused, setPaused] = useState(false);
    const animate = !reducedMotion && !paused;

    useEffect(() => {
        const pointer = pointerRef.current;
        const handleMove = (e) => {
            pointer.x = e.clientX;
            pointer.y = e.clientY;
        };
        const handleLeave = () => {
            pointer.x = OFFSCREEN;
            pointer.y = OFFSCREEN;
        };
        // Pointer Events: mouse, pen and touch alike.
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerleave', handleLeave);
        window.addEventListener('pointercancel', handleLeave);
        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerleave', handleLeave);
            window.removeEventListener('pointercancel', handleLeave);
        };
    }, []);

    // Turning motion off asks for a fresh still frame.
    useLayoutEffect(() => {
        if (!animate) stillSizeRef.current = '';
    }, [animate]);

    useAnimationLoop((dt) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;
        const sizeKey = `${canvas.width}x${canvas.height}`;
        if (!animate && stillSizeRef.current === sizeKey) return; // still frame already drawn

        const { width, height } = beginFrame(ctx);
        const particles = particlesRef.current;
        if (particles.length === 0) {
            for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle(width, height));
        }

        if (animate) {
            // Trail effect: slight fade instead of clear.
            ctx.fillStyle = 'rgba(10, 10, 20, 0.1)';
            ctx.fillRect(0, 0, width, height);
        } else {
            ctx.fillStyle = 'rgb(10, 10, 20)';
            ctx.fillRect(0, 0, width, height);
        }
        drawConnections(ctx, particles);
        const frames = animate ? dt * REFERENCE_FPS : 0;
        for (const p of particles) {
            if (animate) p.update(width, height, pointerRef.current, frames);
            p.draw(ctx);
        }
        if (!animate) stillSizeRef.current = sizeKey;
    });

    return (
        <>
            <SimulationCanvas canvasRef={canvasRef} aria-hidden="true" className={styles.canvas} />
            {!reducedMotion && (
                <button
                    type="button"
                    className={styles.toggle}
                    onClick={() => setPaused((p) => !p)}
                    aria-pressed={paused}
                >
                    {paused ? '▶ Play background animation' : '⏸ Pause background animation'}
                </button>
            )}
        </>
    );
};

export default PhysicsBackground;
