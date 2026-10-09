// Colour mapping for the wave field. Field values are quantised to
// 1/FIELD_GAIN and looked up in a per-theme table instead of running the
// theme switch for every pixel every frame.

export const FIELD_GAIN = 120; // field amplitude → 0..255 brightness
export const LUT_HALF = 300; // covers |val| ≤ 2.5 (two unit sources sum to ≤ 2)

/** RGB for a signed field value `val` and brightness `intensity` (0..255). */
function themeColor(theme, val, intensity) {
    switch (theme) {
        case 'laser-red':
            return [intensity, intensity > 200 ? (intensity - 200) * 2 : 0, 0];
        case 'laser-green': {
            const w = intensity > 200 ? intensity - 200 : 0;
            return [w, intensity, w];
        }
        case 'cyan-magenta':
            return val > 0 ? [0, intensity, intensity] : [intensity, 0, intensity];
        case 'golden-fire':
            return val > 0 ? [intensity, intensity * 0.8, 0] : [intensity * 0.8, 0, 0];
        case 'electric-blue':
            return [intensity * 0.2, intensity * 0.6, intensity];
        case 'sunset':
            return val > 0
                ? [intensity, intensity * 0.5, intensity * 0.2]
                : [intensity * 0.5, 0, intensity * 0.5];
        case 'rainbow': {
            const hue = (((val + 1) * 180) % 360 + 360) % 360;
            const c = intensity / 255;
            const xc = c * (1 - Math.abs(((hue / 60) % 2) - 1));
            const [r, g, b] =
                hue < 60 ? [c, xc, 0] :
                    hue < 120 ? [xc, c, 0] :
                        hue < 180 ? [0, c, xc] :
                            hue < 240 ? [0, xc, c] :
                                hue < 300 ? [xc, 0, c] : [c, 0, xc];
            return [r * 255, g * 255, b * 255];
        }
        case 'grayscale':
        default:
            return [intensity, intensity, intensity];
    }
}

/** Lookup table of RGB triplets for brightness 0..255 of a non-negative quantity (intensity). */
export function buildIntensityLut(theme) {
    const lut = new Uint8ClampedArray(256 * 3);
    for (let b = 0; b < 256; b++) {
        const [r, g, bl] = themeColor(theme, b / 255, b);
        lut[b * 3] = r;
        lut[b * 3 + 1] = g;
        lut[b * 3 + 2] = bl;
    }
    return lut;
}

/** Lookup table of RGB triplets for quantised field values −LUT_HALF..LUT_HALF. */
export function buildFieldLut(theme) {
    const lut = new Uint8ClampedArray((2 * LUT_HALF + 1) * 3);
    for (let q = -LUT_HALF; q <= LUT_HALF; q++) {
        const val = q / FIELD_GAIN;
        const intensity = Math.min(255, Math.floor(Math.abs(val) * FIELD_GAIN));
        const [r, g, b] = themeColor(theme, val, intensity);
        const o = (q + LUT_HALF) * 3;
        lut[o] = r;
        lut[o + 1] = g;
        lut[o + 2] = b;
    }
    return lut;
}
