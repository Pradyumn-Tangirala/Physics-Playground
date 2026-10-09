import ExplainerSections from './ExplainerSections';

// How the FDTD solver works. Kept in step with WAVE_MODEL.md.
const SECTIONS = [
    {
        id: 'scheme',
        title: 'The finite-difference scheme',
        body: (
            <>
                <p>
                    The field u is stored at the centres of square cells of size Δx and advanced in time steps of Δt.
                    Both second derivatives are replaced by central differences, which gives the "leapfrog" update:
                </p>
                <pre>uⁿ⁺¹ = 2uⁿ − uⁿ⁻¹ + C²·(u_E + u_W + u_N + u_S − 4u)ⁿ,     C = cΔt/Δx</pre>
                <p>
                    Each new value needs only the current value, the previous one and the four neighbours, so a step
                    costs a few operations per cell. The scheme is second-order accurate in both space and time.
                </p>
            </>
        ),
    },
    {
        id: 'cfl',
        title: 'CFL condition: why C must stay below 1/√2',
        body: (
            <p>
                In one step the true solution can only move a distance cΔt, and the scheme can only move information
                one cell. If cΔt is too large, the update cannot represent what really happens. For the
                shortest wave the grid holds (a checkerboard), the update multiplies its amplitude by a factor
                whose size exceeds 1 once C² &gt; ½. That mode then grows every step until it swamps everything.
                In 2-D the limit is C ≤ 1/√2 ≈ 0.707. The tests confirm it: random noise stays bounded at C = 0.7071
                and blows up at 0.71.
            </p>
        ),
    },
    {
        id: 'dispersion',
        title: 'Numerical dispersion',
        body: (
            <p>
                On a grid, waves travel slightly slower than c, and the shorter the wave the slower. How much
                slower depends on direction. The scheme obeys sin²(ωΔt/2)/(cΔt)² = sin²(kΔx/2)/Δx² along an axis,
                so a source at frequency f makes waves a little shorter than c/f. At 15 cells per wavelength the
                error is about 0.5% along the axes and less along the diagonals. Doubling the resolution cuts it about
                fourfold (second order).
            </p>
        ),
    },
    {
        id: 'boundaries',
        title: 'Boundaries, walls and sources',
        body: (
            <ul>
                <li>
                    <strong>Reflective:</strong> the edge is held at u = 0, so waves bounce back inverted, like a rope tied
                    to a wall. Energy is conserved exactly by the scheme.
                </li>
                <li>
                    <strong>Absorbing:</strong> a damping layer (−σ ∂u/∂t, with σ growing quadratically into the layer)
                    three wavelengths thick, plus a first-order Mur condition on the outermost cells. Measured residual
                    reflection is about 1% for a harmonic wave. It is not perfect: a perfectly matched layer would do
                    better.
                </li>
                <li>
                    <strong>Wall mask:</strong> barrier cells are held at u = 0, a rigid wall. Slits are openings snapped to
                    whole cells, and the panel shows the width actually built.
                </li>
                <li>
                    <strong>Sources:</strong> soft sources add a·sin(2πft) to u each step, turned on smoothly over two periods.
                    A column of them makes a plane wave; a single cell makes a cylindrical wave.
                </li>
            </ul>
        ),
    },
];

export default function FdtdNotes() {
    return <ExplainerSections id="fdtd-notes" title="How the solver works" sections={SECTIONS} />;
}
