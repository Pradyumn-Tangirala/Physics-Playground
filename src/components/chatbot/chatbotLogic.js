// Rule-based FAQ for the Wave Lab. Rules are checked in order; each pattern
// matches whole words only (\b boundaries), so "hi" no longer matches "this",
// "which" or "think".

import { clamp } from '../../utils/math.js';

export const FAQ_RULES = [
    {
        pattern: /\b(diffract\w*|bend\w*)\b/,
        answer: "Diffraction is the spreading of waves as they pass through an opening or around an obstacle. It's strongest when the opening is about the size of the wavelength.",
    },
    {
        pattern: /\b(interfer\w*|constructive|destructive|fringes?)\b/,
        answer: "Interference happens when waves overlap. Where crests meet crests the waves add (constructive, bright fringe); where crests meet troughs they cancel (destructive, dark fringe).",
    },
    {
        pattern: /\b(single|double|experiment|sinc)\b/,
        answer: "Choose Double slit or Single slit under Experiment. A single slit gives the sinc² diffraction pattern, with a bright centre twice as wide as the side lobes. A double slit gives cos² fringes inside that envelope.",
    },
    {
        pattern: /\b(slits?|separation|spacing|width)\b/,
        answer: "Slit separation d sets the fringe spacing β = λD/d, so slits further apart give closer fringes. Slit width a sets the single-slit envelope, whose first zeros are at a·sin θ = ±λ. Use the cursor on the chart to measure fringe positions.",
    },
    {
        pattern: /\b(frequency|colou?rs?|wavelengths?|speed)\b/,
        answer: "Wavelength, frequency and wave speed are linked by c = fλ. A shorter wavelength packs the fringes closer together (β = λD/d). The animation is slowed to a fixed display rate, and the panel shows the real frequency and the slow-motion factor.",
    },
    {
        pattern: /\b(phase|shift)\b/,
        answer: "The phase difference φ gives slit 2's wave a head start. It slides the whole pattern by φ/2π of a fringe, and at φ = 180° the centre of the screen goes dark.",
    },
    {
        pattern: /\b(wall|barrier|fdtd|numerical|solver)\b/,
        answer: "This page evaluates the analytical model, with the barrier treated as an ideal thin screen. To see a real numerical solution of the wave equation, with reflections from the barrier, open the Wave Equation Lab (FDTD) from the home page.",
    },
    {
        pattern: /\b(screen|intensity|graph|profile)\b/,
        answer: "The chart shows the time-averaged intensity I = |U|² on the screen, which is what a detector records. It is not the instantaneous wave height. The solid curve is the phasor-sum simulation, the dashed one is the Fraunhofer formula, and the strip above it shows what the screen looks like.",
    },
    {
        pattern: /\b(who are you|what are you|your name|are you (an )?ai)\b/,
        answer: "I'm a simple rule-based help bot for the Wave Lab. I match keywords in your question to a short list of answers. I'm not an AI.",
    },
    {
        pattern: /\b(hi|hello|hey)\b/,
        answer: 'Hello! Ask me about diffraction, interference, the slits, wavelength, phase or the screen.',
    },
];

export const FALLBACK_ANSWER =
    "I don't have an answer for that. Try asking about 'diffraction', 'interference', 'slit separation', 'wavelength', 'phase' or the 'screen'.";

export function answerFor(query) {
    const text = query.toLowerCase();
    const rule = FAQ_RULES.find(({ pattern }) => pattern.test(text));
    return rule ? rule.answer : FALLBACK_ANSWER;
}

// ---------- floating window layout ----------

export const FAB_SIZE = 60;
export const EDGE = 10; // min gap to the viewport edge
const WINDOW_GAP = 20; // gap between button and chat window
const MAX_WINDOW = { width: 350, height: 500 };

/** Places the chat window above (or else below) the button, fully inside the viewport. */
export function chatWindowRect(fab, viewport) {
    const width = Math.min(MAX_WINDOW.width, viewport.width - 2 * EDGE);
    const height = Math.min(MAX_WINDOW.height, viewport.height - 2 * EDGE);

    const left = clamp(fab.x + FAB_SIZE - width, EDGE, viewport.width - width - EDGE);
    const above = fab.y - WINDOW_GAP - height;
    const below = fab.y + FAB_SIZE + WINDOW_GAP;
    const top = above >= EDGE
        ? above
        : below + height <= viewport.height - EDGE
            ? below
            : clamp(above, EDGE, viewport.height - height - EDGE);

    return { left, top, width, height };
}
