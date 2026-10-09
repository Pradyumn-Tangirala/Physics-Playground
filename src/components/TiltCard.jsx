import { useRef, useEffect } from 'react';
import { useReducedMotion } from './useReducedMotion';

// 3D tilt effect: writes the transform straight to the element so pointer
// movement never causes React re-renders. Uses Pointer Events but only tilts
// for mouse and pen — under a finger, tilting would fight with scrolling — and
// not at all for users who prefer reduced motion.
const useTilt = (enabled) => {
    const ref = useRef(null);

    useEffect(() => {
        const card = ref.current;
        if (!card || !enabled) return undefined;

        const handleMove = (e) => {
            if (e.pointerType === 'touch') return;
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

        card.addEventListener('pointermove', handleMove);
        card.addEventListener('pointerleave', handleLeave);
        card.addEventListener('pointercancel', handleLeave);

        return () => {
            card.removeEventListener('pointermove', handleMove);
            card.removeEventListener('pointerleave', handleLeave);
            card.removeEventListener('pointercancel', handleLeave);
            handleLeave();
        };
    }, [enabled]);

    return ref;
};

function TiltCard({ children, style, className }) {
    const reducedMotion = useReducedMotion();
    const ref = useTilt(!reducedMotion);
    return (
        <div ref={ref} className={className} style={style}>
            {children}
        </div>
    );
}

export default TiltCard;
