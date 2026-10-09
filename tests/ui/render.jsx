// Rendering helpers for page-level UI tests.

import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { runFrames } from './frames';

/**
 * Renders a page inside a router at `path` (plus an optional query, e.g. an
 * experiment link), with a stub landing page so Home navigation is observable.
 */
export function renderPage(element, path = '/page', search = '') {
    return render(
        <MemoryRouter initialEntries={[path + search]}>
            <Routes>
                <Route path="/" element={<h1>Landing page</h1>} />
                <Route path={path} element={element} />
            </Routes>
        </MemoryRouter>,
    );
}

/**
 * The drawing commands a canvas issued during the next frame, as a string.
 * Two equal signatures mean the frame drew exactly the same picture.
 */
export function nextFrameSignature(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.calls.length = 0;
    runFrames(1);
    return JSON.stringify(ctx.calls);
}

/** The text drawn on a canvas during the next frame. */
export function textOnNextFrame(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.calls.length = 0;
    runFrames(1);
    return ctx.calls.filter(([m]) => m === 'fillText').map(([, t]) => String(t));
}

/**
 * Checksum of the pixels a canvas blitted from an offscreen ImageData during
 * the next frame (the wave renderers draw the field that way). Compares the
 * actual picture, not the drawing calls.
 */
export function nextFramePixels(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.calls.length = 0;
    runFrames(1);
    const blit = ctx.calls.find(([m]) => m === 'drawImage');
    const source = blit?.[1];
    const put = source?.getContext('2d').calls.filter(([m]) => m === 'putImageData').at(-1);
    const data = put?.[1]?.data;
    if (!data) return null;
    let hash = 0;
    for (let i = 0; i < data.length; i++) hash = (hash * 31 + data[i]) | 0;
    return hash;
}
