// Complete elliptic integral and Jacobi elliptic functions, used for the exact
// solution of the undamped nonlinear pendulum. Parameter convention: m = k²
// (Abramowitz & Stegun, chapters 16–17), valid for 0 ≤ m < 1.

/** Relative tolerance at which the AGM iteration is considered converged (double precision). */
const AGM_TOLERANCE = 1e-15;
/** The AGM converges quadratically, so even m = 1 − 10⁻¹² needs fewer than 10 iterations. */
const AGM_MAX_ITERATIONS = 40;

/** Arithmetic–geometric mean of a and b. */
export function agm(a, b) {
    for (let i = 0; i < AGM_MAX_ITERATIONS && Math.abs(a - b) > AGM_TOLERANCE * a; i++) {
        [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
    }
    return (a + b) / 2;
}

/** Complete elliptic integral of the first kind, K(m) = π / (2·AGM(1, √(1 − m))). */
export const ellipticK = (m) => Math.PI / (2 * agm(1, Math.sqrt(1 - m)));

/**
 * Jacobi elliptic functions sn, cn, dn of argument u and parameter m, by the
 * descending Landen (AGM) method of A&S 16.4: run the AGM forward recording
 * cₙ/aₙ, then recover the amplitude φ = am(u|m) backwards. Accurate to a few
 * ulps for 0 ≤ m < 1 and any real u.
 */
export function jacobiElliptic(u, m) {
    if (!(m >= 0 && m < 1)) throw new RangeError(`jacobiElliptic needs 0 ≤ m < 1 (got ${m})`);
    if (m < 1e-16) return { sn: Math.sin(u), cn: Math.cos(u), dn: 1 };

    const a = [1];
    const ratios = [Math.sqrt(m)]; // cₙ/aₙ
    let b = Math.sqrt(1 - m);
    let c = Math.sqrt(m);
    while (Math.abs(c) > AGM_TOLERANCE && a.length < AGM_MAX_ITERATIONS) {
        const an = a[a.length - 1];
        c = (an - b) / 2;
        const next = (an + b) / 2;
        b = Math.sqrt(an * b);
        a.push(next);
        ratios.push(c / next);
    }
    const n = a.length - 1;
    let phi = 2 ** n * a[n] * u;
    for (let i = n; i > 0; i--) phi = (phi + Math.asin(ratios[i] * Math.sin(phi))) / 2;

    const sn = Math.sin(phi);
    return { sn, cn: Math.cos(phi), dn: Math.sqrt(1 - m * sn * sn) };
}
