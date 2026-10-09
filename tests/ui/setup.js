// Browser APIs that jsdom lacks, replaced by small deterministic stand-ins.
//
// - Canvas 2D: a recording context. Every drawing call is stored, so a test
//   can assert *what* was drawn (e.g. that the phase-space chart's title was
//   written) without pixels.
// - requestAnimationFrame: a manual scheduler (see frames.js), so a test
//   decides exactly how many frames run and with what timestamps.
// - ResizeObserver, ImageData, scrollIntoView: minimal implementations.
// - Element sizes: jsdom lays nothing out, so canvases report 800 × 400.

import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installFrameScheduler, resetFrames } from './frames.js';

afterEach(() => {
    cleanup();
    resetFrames();
});

installFrameScheduler();

class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;

if (typeof globalThis.ImageData === 'undefined') {
    globalThis.ImageData = class ImageData {
        constructor(width, height) {
            this.width = width;
            this.height = height;
            this.data = new Uint8ClampedArray(width * height * 4);
        }
    };
}

Element.prototype.scrollIntoView = function scrollIntoView() {}; // used by the chatbot

Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 400 });

/** A 2-D context that records method calls as [name, ...args] and accepts any property. */
function createRecordingContext(canvas) {
    const calls = [];
    const state = { canvas, font: '10px sans-serif', calls };
    const special = {
        measureText: (text) => ({ width: String(text).length * 6 }),
        createLinearGradient: () => ({ addColorStop() {} }),
        createImageData: (w, h) => new ImageData(w, h),
        getImageData: (x, y, w, h) => new ImageData(w, h),
    };
    return new Proxy(state, {
        get(target, prop) {
            if (prop in target) return target[prop];
            if (prop in special) {
                return (...args) => {
                    calls.push([prop, ...args]);
                    return special[prop](...args);
                };
            }
            if (typeof prop === 'symbol') return undefined;
            return (...args) => {
                calls.push([prop, ...args]);
            };
        },
        set(target, prop, value) {
            target[prop] = value;
            return true;
        },
    });
}

const contexts = new WeakMap();
HTMLCanvasElement.prototype.getContext = function getContext() {
    if (!contexts.has(this)) contexts.set(this, createRecordingContext(this));
    return contexts.get(this);
};

/** Every text a canvas has drawn with fillText. */
export const drawnText = (canvas) => canvas.getContext('2d').calls.filter(([m]) => m === 'fillText').map(([, text]) => String(text));
