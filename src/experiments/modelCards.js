// The model behind every lab, in one fixed shape: equations, assumptions,
// units and limitations. Rendered by components/ModelCard.jsx. The longer
// explanations and measurements live in the *_MODEL.md documents.

export const MODEL_CARDS = {
    pendulum: {
        title: 'Model: damped nonlinear pendulum',
        equations: [
            'θ″ = −(g/L)·sin θ − 2γ·θ′',
            'E = ½·m·L²·θ′² + m·g·L·(1 − cos θ)',
            'Small-angle period  T₀ = 2π·√(L/g)',
            'Exact period (γ = 0)  T = 4·√(L/g)·K(sin²(θ₀/2))',
            'Exact motion (γ = 0)  sin(θ/2) = sin(θ₀/2)·cd(√(g/L)·t | sin²(θ₀/2))',
        ],
        assumptions: [
            'Point mass on a massless, rigid rod; frictionless pivot.',
            'Uniform gravitational field.',
            'Viscous (linear) damping, rate γ; air drag proportional to speed², if present, is not modelled.',
            'Motion in one vertical plane.',
        ],
        units: [
            ['θ', 'angle from the vertical', 'rad (shown in °)'],
            ['L', 'length', 'm'],
            ['g', 'gravitational acceleration', 'm/s²'],
            ['γ', 'damping rate', 's⁻¹'],
            ['m', 'bob mass (1 kg; it cancels out of the motion)', 'kg'],
            ['E', 'mechanical energy', 'J'],
        ],
        limitations: [
            'Release angles are limited to ±90° here so the bob stays in view; the Numerical Methods Lab goes up to 170°.',
            'With damping there is no closed-form solution, so position and period are not validated when γ > 0.',
            'The exact references (K, cd) assume release from rest; dragging the bob releases it from rest.',
        ],
    },
    spring: {
        title: 'Model: damped spring–mass oscillator',
        equations: [
            'x″ = −(k/m)·x − 2γ·x′',
            'E = ½·m·x′² + ½·k·x²',
            'T₀ = 2π·√(m/k),  damped T_d = 2π / √(k/m − γ²)',
            'x(t) = x₀·e^(−γt)·[cos ω_d t + (γ/ω_d)·sin ω_d t],  ω_d = √(k/m − γ²)',
        ],
        assumptions: [
            'Ideal massless spring obeying Hooke’s law at every extension.',
            'Displacement measured from equilibrium: gravity only shifts the equilibrium of a vertical spring.',
            'Viscous (linear) damping, rate γ.',
        ],
        units: [
            ['x', 'displacement from equilibrium', 'm'],
            ['k', 'spring constant', 'N/m'],
            ['m', 'mass', 'kg'],
            ['γ', 'damping rate', 's⁻¹'],
            ['E', 'mechanical energy', 'J'],
        ],
        limitations: [
            'No spring mass, no coil contact, no plastic deformation.',
            'Linear, so it cannot show amplitude-dependent behaviour; use the pendulum for that.',
        ],
    },
    methods: {
        title: 'Model: the comparison problem',
        equations: [
            'θ″ = −(g/L)·sin θ − 2γ·θ′,  state y = [θ, ω]',
            'Explicit Euler      y₁ = y₀ + Δt·f(y₀)',
            'Symplectic Euler    ω₁ = ω₀ + Δt·a(θ₀, ω₀),  θ₁ = θ₀ + Δt·ω₁',
            'RK4                 y₁ = y₀ + Δt/6·(k₁ + 2k₂ + 2k₃ + k₄)',
            'Error  |θ_method(t) − θ_exact(t)|,  energy drift  (E − E₀)/E₀',
        ],
        assumptions: [
            'All three methods start from the same state and take the same fixed steps Δt in lock-step.',
            'Undamped reference: the exact Jacobi elliptic-function solution. Damped reference: RK4 with Δt/20.',
            'Cost is counted in evaluations of f, the expensive part of a real simulation; timings are measured in this browser.',
        ],
        units: [
            ['θ, ω', 'angle, angular velocity', 'rad, rad/s'],
            ['Δt', 'timestep', 's'],
            ['ΔE/E₀', 'relative energy error', 'dimensionless'],
        ],
        limitations: [
            'Fixed-step methods only: no adaptive step control, no implicit methods.',
            'The fine-step damped reference has its own (tiny) error, about 10⁻⁵ of RK4’s error at Δt.',
            'Measured times depend on the browser, the device and other load; the evaluation counts do not.',
        ],
    },
    projectile: {
        title: 'Model: projectile with quadratic drag',
        equations: [
            'Ideal:  x = v₀ cos θ·t,  y = y₀ + v₀ sin θ·t − ½gt²',
            'Range (y₀ = 0)  R = v₀²·sin 2θ / g,  height  H = v₀² sin²θ / 2g,  time  T = 2v₀ sin θ / g',
            'Drag:  a = −g·ŷ − k·|v|·v,  k = ρ·C_d·A / (2m)',
            'Terminal speed  v_t = √(g/k)',
        ],
        assumptions: [
            'Point mass: no spin, so no Magnus force or lift.',
            'Uniform gravity over flat ground; Earth’s curvature and rotation ignored.',
            'Still air of constant density; quadratic drag with constant C_d (no drag crisis).',
            'The flight ends at the first crossing of y = 0, located inside the last step by cubic Hermite interpolation.',
        ],
        units: [
            ['x, y', 'position', 'm'],
            ['v₀', 'launch speed', 'm/s'],
            ['θ', 'launch angle', '° (rad internally)'],
            ['ρ', 'air density', 'kg/m³'],
            ['C_d', 'drag coefficient', 'dimensionless'],
            ['A, m', 'cross-section, mass', 'm², kg'],
            ['k', 'drag constant', 'm⁻¹'],
        ],
        limitations: [
            'Drag has no closed form in 2-D: drag runs are validated against a fine-step RK4 reference, not an exact solution.',
            'Constant C_d is realistic for a smooth sphere only between Reynolds numbers of about 10³ and 2×10⁵.',
            'No wind, bounce or rolling.',
        ],
    },
    waves: {
        title: 'Model: Huygens–Fresnel interference (analytical)',
        equations: [
            'U(x, y) = Σⱼ (Aⱼ/n)·√(D/rⱼ)·e^{i(k rⱼ + φⱼ)},  k = 2π/λ',
            'Intensity  I = |U|²  (time average of u², up to a constant)',
            'Fringe spacing (small angle)  β = λD/d',
            'Fraunhofer  I(θ) = cos θ·[A₁² + A₂² + 2A₁A₂ cos(kd sin θ + φ)]·sinc²(ka sin θ / 2)',
        ],
        assumptions: [
            'Scalar, monochromatic, fully coherent waves in two dimensions.',
            'Each slit is a row of coherent point sources (Kirchhoff boundary conditions).',
            'Cylindrical spreading √(D/r) from each source.',
        ],
        units: [
            ['λ', 'wavelength', 'm (shown in mm or nm)'],
            ['d, a', 'slit separation, slit width', 'm'],
            ['D', 'slit-to-screen distance', 'm'],
            ['c, f', 'wave speed, frequency', 'm/s, Hz'],
            ['φ', 'phase difference', 'rad (shown in °)'],
            ['I', 'intensity', 'relative (|U|², arbitrary units)'],
        ],
        limitations: [
            'No reflections from the barrier, no barrier thickness, no polarisation.',
            'β = λD/d ignores the sloping envelope and sin θ ≠ tan θ, so it differs from the simulated pattern at large λ/d.',
            'The 2-D field view cannot be drawn to scale for light; the screen pattern still is.',
            'This evaluates a solution formula: it does not solve the wave equation (the FDTD lab does).',
        ],
    },
    fdtd: {
        title: 'Model: 2-D scalar wave equation (FDTD)',
        equations: [
            '∂²u/∂t² = c²·(∂²u/∂x² + ∂²u/∂y²)',
            'uⁿ⁺¹ = 2uⁿ − uⁿ⁻¹ + C²·(sum of 4 neighbours − 4uⁿ),  C = cΔt/Δx',
            'Stability (CFL):  C ≤ 1/√2',
            'Phase-speed error from the discrete dispersion relation: −0.56% along the grid axes at 15 cells per λ and C = 0.5',
        ],
        assumptions: [
            'Scalar waves (water surface, sound pressure), lossless medium.',
            'Rigid barrier: u = 0 on wall cells.',
            'Absorbing boundary: a graded sponge layer plus a first-order Mur condition.',
            'Sources are driven cells (a column for a plane wave, one cell for a point source).',
        ],
        units: [
            ['u', 'wave displacement', 'arbitrary'],
            ['x, y, Δx', 'position, grid spacing', 'm'],
            ['t, Δt', 'time, timestep', 's'],
            ['c', 'wave speed', 'm/s'],
            ['C', 'Courant number', 'dimensionless'],
        ],
        limitations: [
            'A wavelength must span many cells, so light at optical scales is out of reach.',
            'The barrier is at least two cells thick and slit edges are staircased.',
            'Residual reflection from the absorbing boundary, and numerical dispersion that grows at coarse resolution.',
            'The detector shows a running average that needs a few periods to settle.',
        ],
    },
};
