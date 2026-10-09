import { useEffect } from 'react';
import { MAX_PIXEL_RATIO } from '../rendering/canvasSize.js';

/**
 * A canvas whose backing store tracks its rendered CSS size × devicePixelRatio,
 * so drawings stay sharp on high-DPI screens. The ratio is stored in
 * data-dpr for the renderers (see rendering/canvasSize.js). Resizing — of the
 * element, or of the ratio when the window moves to another screen or the
 * page is zoomed — only changes pixel dimensions; it never touches
 * simulation state, and the animation loop redraws on its next frame.
 *
 * Extra props (pointer handlers, aria attributes) are passed to the <canvas>.
 */
export default function SimulationCanvas({ canvasRef, style, ...rest }) {
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const resize = () => {
            const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
            const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
            const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
            if (canvas.width !== width) canvas.width = width;
            if (canvas.height !== height) canvas.height = height;
            canvas.dataset.dpr = String(ratio);
        };

        // ResizeObserver does not fire when only the pixel ratio changes, so
        // also watch a media query for the current ratio (re-armed after each change).
        let query = null;
        const onRatioChange = () => {
            resize();
            watchRatio();
        };
        const watchRatio = () => {
            query?.removeEventListener('change', onRatioChange);
            query = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`) ?? null;
            query?.addEventListener('change', onRatioChange);
        };

        resize();
        watchRatio();
        const observer = new ResizeObserver(resize);
        observer.observe(canvas);
        return () => {
            observer.disconnect();
            query?.removeEventListener('change', onRatioChange);
        };
    }, [canvasRef]);

    return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', ...style }} {...rest} />;
}
