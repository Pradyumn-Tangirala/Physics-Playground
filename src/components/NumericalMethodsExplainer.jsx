import ExplainerSections from './ExplainerSections';

// Short, interview-ready explanations of what the comparison lab shows.
// Every claim here is backed by a test or a measurement in NUMERICAL_METHODS.md.
const SECTIONS = [
    {
        id: 'euler',
        title: 'What is (explicit) Euler?',
        body: (
            <>
                <p>
                    Write the motion as a first-order system <code>y = [θ, ω]</code>, <code>dy/dt = f(y)</code>.
                    Euler takes one slope at the start of the step and follows it in a straight line:
                </p>
                <pre>y₁ = y₀ + Δt · f(y₀)</pre>
                <p>
                    That is the first two terms of the Taylor series, so each step makes an error of order
                    Δt² (local error) and the errors add up to order Δt over a fixed time (global error):
                    halve Δt and the error halves. It costs one derivative evaluation per step.
                </p>
            </>
        ),
    },
    {
        id: 'gain',
        title: 'Why does Euler gain energy in oscillatory systems?',
        body: (
            <>
                <p>
                    For small swings the pendulum is a harmonic oscillator, θ″ = −ω₀²θ. One Euler step maps
                    (θ, ω) through the matrix
                </p>
                <pre>[ 1      Δt ]{'\n'}[ −ω₀²Δt  1 ]     determinant = 1 + ω₀²Δt²  &gt; 1</pre>
                <p>
                    A determinant above 1 means every step stretches phase-space area, so the orbit spirals
                    outward. In the linear limit the energy grows by exactly (1 + ω₀²Δt²) per step, about
                    e<sup>ω₀²·Δt·t</sup> over time. The cause is that Euler uses the slope at the start of the
                    step, which always points slightly outward from the circular orbit. Making Δt smaller only
                    slows the growth; for an undamped oscillator explicit Euler is unstable at every step size.
                </p>
            </>
        ),
    },
    {
        id: 'symplectic',
        title: 'Why is symplectic Euler better for Hamiltonian systems?',
        body: (
            <>
                <p>Update the velocity first, then move the position with the <em>new</em> velocity:</p>
                <pre>ω₁ = ω₀ + Δt · α(θ₀)        (kick){'\n'}θ₁ = θ₀ + Δt · ω₁             (drift)</pre>
                <p>
                    It is still first order and costs one evaluation, but the step matrix
                    [[1, Δt], [−ω₀²Δt, 1 − ω₀²Δt²]] has determinant exactly 1: phase-space area is preserved
                    (the method is <em>symplectic</em>). Such methods exactly conserve a slightly modified
                    energy, so the true energy oscillates within a band of width ≈ ω₀Δt instead of drifting.
                    It is stable for ω₀Δt &lt; 2. With damping (γ &gt; 0) the system is no longer Hamiltonian,
                    and energy decreases as it physically should.
                </p>
            </>
        ),
    },
    {
        id: 'rk4',
        title: 'Why does RK4 have lower local and global truncation error?',
        body: (
            <>
                <p>RK4 samples the slope four times per step and averages them with weights 1, 2, 2, 1:</p>
                <pre>
                    k₁ = f(y₀){'\n'}k₂ = f(y₀ + Δt/2 · k₁){'\n'}k₃ = f(y₀ + Δt/2 · k₂){'\n'}k₄ = f(y₀ + Δt · k₃){'\n'}y₁ = y₀ + Δt/6 · (k₁ + 2k₂ + 2k₃ + k₄)
                </pre>
                <p>
                    These weights make the step agree with the exact solution's Taylor series through the Δt⁴
                    term, so the local error is O(Δt⁵) and the global error O(Δt⁴): halving Δt cuts the error
                    by about 16×. The tests measure ratios of 15.9–16.0. It costs four evaluations per step.
                    RK4 is not symplectic, so energy drifts slowly downward: per step the energy shrinks by about
                    (ω₀Δt)⁶/72, so over a time t the drift is ≈ t·ω₀⁶·Δt⁵/72. Measured over 30 s at θ₀ = 30°: about
                    10⁻¹³ at Δt = 1 ms, 10⁻⁹ at 5 ms and 10⁻⁴ at 50 ms.
                </p>
            </>
        ),
    },
    {
        id: 'dt',
        title: 'What does the timestep Δt do?',
        body: (
            <>
                <ul>
                    <li><strong>Accuracy:</strong> truncation error scales as Δt (Euler, symplectic Euler) or Δt⁴ (RK4).</li>
                    <li><strong>Cost:</strong> the number of steps per simulated second is 1/Δt, times the evaluations per step.</li>
                    <li>
                        <strong>Stability:</strong> for an undamped oscillator, explicit Euler grows at any Δt; symplectic
                        Euler is stable for ω₀Δt &lt; 2; RK4 for ω₀Δt &lt; 2√2 ≈ 2.83.
                    </li>
                    <li>
                        <strong>Round-off:</strong> every step adds about 10⁻¹⁶ relative error (double precision). With very
                        small Δt and many steps this floor can show in RK4 results; it does not limit Euler.
                    </li>
                    <li>
                        <strong>What you see:</strong> the animation draws the latest computed state, so at large Δt motion
                        looks stepped. That is the real step size, not a rendering glitch.
                    </li>
                </ul>
            </>
        ),
    },
];

export default function NumericalMethodsExplainer() {
    return <ExplainerSections id="explainer" title="How the methods work" sections={SECTIONS} />;
}
