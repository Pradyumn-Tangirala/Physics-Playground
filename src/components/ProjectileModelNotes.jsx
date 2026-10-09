import ExplainerSections from './ExplainerSections';

// What the projectile model includes and leaves out. Kept in step with
// PROJECTILE_MODEL.md, which gives the derivations and measured results.
const SECTIONS = [
    {
        id: 'validation',
        title: 'Why RK4 matches the analytical solution exactly without drag',
        body: (
            <>
                <p>
                    Without drag the acceleration is constant, so the exact trajectory is a polynomial of degree 2 in t.
                    RK4 reproduces any solution that is a polynomial of degree ≤ 4 exactly, so its remaining error is
                    floating-point round-off (about 10⁻¹¹ m). For the same reason the velocity, which is linear in t, is
                    exact for all three methods.
                </p>
                <p>
                    The Euler methods get the position wrong by exactly ½·g·Δt·t: explicit Euler moves with the velocity
                    from the start of each step (too high), symplectic Euler with the velocity from the end (too low).
                    Launched from the ground, explicit Euler lands almost exactly one step late and symplectic Euler one
                    step early. To see RK4's fourth-order convergence, turn drag on in the convergence study: there the
                    solution is not a polynomial.
                </p>
            </>
        ),
    },
];

export default function ProjectileModelNotes() {
    return <ExplainerSections id="projectile-notes" title="Why the numbers come out as they do" sections={SECTIONS} />;
}
