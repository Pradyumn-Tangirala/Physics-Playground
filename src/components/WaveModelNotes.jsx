import ExplainerSections from './ExplainerSections';

// What the analytical wave model computes, and what it does not. Kept in step
// with WAVE_MODEL.md, which has the derivations and measured results.
const SECTIONS = [
    {
        id: 'phasor',
        title: 'Phasors: how the field is computed',
        body: (
            <>
                <p>
                    Each open slit is split into many coherent point sources (Huygens–Fresnel). A harmonic wave from
                    source j reaches a point at distance r<sub>j</sub> with phase k·r<sub>j</sub> + φ<sub>j</sub>, so the
                    whole field is one complex number per point, the <em>phasor</em>:
                </p>
                <pre>U(x, y) = Σⱼ (Aⱼ/n) · √(D/rⱼ) · e^(i(k rⱼ + φⱼ)),     k = 2π/λ</pre>
                <p>
                    √(D/r) is the spreading of a 2-D (cylindrical) wave. U depends only on position, so it is computed once
                    whenever the geometry changes. The animation then only rotates the time phase:
                    u(t) = Re(U·e<sup>−iωt</sup>) = Re U·cos ωt + Im U·sin ωt, which costs two multiplications per pixel per
                    frame and no trigonometry.
                </p>
            </>
        ),
    },
    {
        id: 'intensity',
        title: 'Intensity is |U|², not |u|',
        body: (
            <p>
                A detector, an eye or a camera responds to the time average of the squared field,
                ⟨u²⟩ = |U|²/2. The instantaneous amplitude |u(t)| changes sign twice per cycle and is zero everywhere
                at some instant, so it is not an intensity. The chart, the screen strip and the intensity map all use
                |U|² (the constant ½ is dropped because only ratios are compared). The animated field view shows u(t)
                itself, labelled as such.
            </p>
        ),
    },
    {
        id: 'double',
        title: 'Double slit: fringe spacing β = λD/d',
        body: (
            <>
                <p>
                    Far from the slits the two waves reach angle θ with path difference d·sin θ. Bright fringes need a
                    whole number of wavelengths, d sin θ = mλ (shifted by φ/2π orders if slit 2 has a phase lead φ). For
                    small angles sin θ ≈ tan θ = y/D, which gives fringes every β = λD/d.
                </p>
                <p>
                    With unequal amplitudes the dark fringes are no longer black: the fringe visibility is
                    2A₁A₂/(A₁² + A₂²). Finite slit width multiplies the pattern by the single-slit envelope, and an order
                    that lands on an envelope zero disappears (a <em>missing order</em>, when d/a is a whole number).
                </p>
            </>
        ),
    },
    {
        id: 'single',
        title: 'Single slit: the sinc² envelope',
        body: (
            <p>
                Adding up the waves from every point across a slit of width a gives an amplitude proportional to
                sinc(β′) = sin β′/β′ with β′ = (π a sin θ)/λ, so the intensity is I ∝ sinc²(π a sin θ/λ). Zeros fall at
                a sin θ = mλ (m ≠ 0), and the central maximum is twice as wide as the others: 2λD/a for small angles.
                A slit narrower than λ has no zeros at all and spreads the wave over every direction.
            </p>
        ),
    },
    {
        id: 'limits',
        title: 'Why measured and predicted differ',
        body: (
            <ul>
                <li>
                    <strong>Small-angle approximation.</strong> β = λD/d assumes sin θ ≈ tan θ. With λ/d = 0.2 (the
                    ripple-tank preset) that is off by about 5%. The Fraunhofer column uses the exact angles.
                </li>
                <li>
                    <strong>Far field.</strong> The Fraunhofer formulas hold for D ≫ L²/λ, where L is the aperture size.
                    Closer to the slits the wavefronts are still curved (Fresnel region). The simulation includes this
                    exactly and the formula does not, so their difference shrinks as D grows.
                </li>
                <li>
                    <strong>Discretisation.</strong> Each slit is a finite number of point sources. For the screen they
                    are close enough together that this costs less than 0.1%. The 2-D field view uses fewer, for speed.
                </li>
                <li>
                    <strong>Not modelled:</strong> reflections from the barrier, its thickness, polarisation, and the
                    exact boundary conditions at the slit edges (Kirchhoff's approximation is assumed). The
                    Numerical Wave Equation Lab solves for those by finite differences.
                </li>
            </ul>
        ),
    },
    {
        id: 'scale',
        title: 'Why the laser preset has no 2-D picture',
        body: (
            <p>
                The field view is drawn to scale. At λ = 633 nm and D = 1 m the screen is 1.6 million wavelengths
                away, so a wavelength would be less than a thousandth of a pixel and any picture would be aliasing, not
                physics. The screen pattern needs only one dimension, so it is still computed exactly. The
                macroscopic presets (ripple tank, microwaves, sound) obey the same equations at a scale that can be
                drawn.
            </p>
        ),
    },
];

export default function WaveModelNotes() {
    return <ExplainerSections id="wave-model" title="How the model works" sections={SECTIONS} />;
}
