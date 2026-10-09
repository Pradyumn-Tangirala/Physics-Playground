# Numerical Methods

This document describes the numerical integration in Physics Playground: the model, the three integrators, their error and stability properties, how they were validated, and the measured results. Every number below comes from running the code in this repository (`src/physics/*`) under Node.js with IEEE-754 double precision. Nothing is quoted from a textbook without being checked against a measurement.

Where to see it:
- **Numerical Methods Lab** (`/#/numerical-methods`): all three methods side by side from identical initial conditions; angle error against the exact solution, energy drift, a phase portrait, measured periods, live derivative-evaluation counts, and the accuracy-vs-cost and period-vs-amplitude experiments.
- **Oscillator Lab** (`/#/shm`): pendulum and spring with an integrator selector, a Δt selector, a phase-space inset and a measured-period readout.
- **Projectile Lab** (`/#/projectile`): the same integrators applied to a projectile with quadratic drag, validated against the exact no-drag solution, with a timestep convergence study. Documented separately in [PROJECTILE_MODEL.md](PROJECTILE_MODEL.md).

---

## 1. Mathematical model

### Nonlinear damped pendulum
A point mass m on a massless rigid rod of length L, uniform gravity g, a frictionless pivot, and linear (viscous) damping at rate γ:

```
θ'' = −(g/L)·sin θ − 2γ·θ'
```

**Assumptions:**
- There is no small-angle approximation: `sin θ` is evaluated exactly.
- Damping is proportional to angular velocity. That's the simplest dissipative model, not a detailed model of air drag.
- θ isn't wrapped inside the integrator, so a pendulum that goes over the top keeps accumulating angle. Displays wrap θ to (−180°, 180°].

**Energy** (PE measured from the lowest point):

```
E = ½·m·L²·ω² + m·g·L·(1 − cos θ)
```

With γ = 0, E is exactly conserved by the true solution, so any change in E is numerical error. The labs report the **relative energy error ΔE/E₀ = (E − E₀)/E₀**, which doesn't depend on m (m = 1 kg in the labs).

**Reference periods:**

| Quantity | Formula | Source |
|---|---|---|
| Small-angle period | T₀ = 2π√(L/g) | linearised model, sin θ ≈ θ |
| Exact period (γ = 0, release from rest at θ₀) | T = 4√(L/g)·K(k), k = sin(θ₀/2) | complete elliptic integral of the first kind |
| K(k) | K = π / (2·AGM(1, √(1−k²))) | arithmetic–geometric mean, converges quadratically to machine precision |

### Linear spring-mass (reference problem)
```
x'' = −(k/m)·x − 2γ·x'        ω₀ = √(k/m)
```
This system has a closed-form solution for all three damping regimes (`spring.exactPosition`), so it's the reference used to measure integrator error directly. The regimes are underdamped (γ < ω₀), critically damped (γ = ω₀, x = x₀(1 + ω₀t)e^(−ω₀t)) and overdamped (γ > ω₀).

## 2. State representation

Each second-order equation is written as a first-order system with state vector **y = [position, velocity]**:

```
y = [θ, ω]                dy/dt = f(y) = [ ω,  −(g/L)·sin θ − 2γ·ω ]
y = [x, v]                dy/dt = f(y) = [ v,  −(k/m)·x − 2γ·v ]
```

States are plain JavaScript arrays of doubles. Models expose `derivative(params)`, which returns `f`, plus `energy(y, params)`. Integrators never see the model, only `f`.

## 3. Integrators

All integrators live in `src/physics/integrators.js` and share one API:

```js
integrator.step(y, f, h, t = 0) → y_next      // pure: y is not modified
```

| Method | Update | Derivative evaluations / step | Order (global) |
|---|---|---|---|
| Explicit Euler | y₁ = y₀ + h·f(y₀) | 1 | 1 |
| Symplectic Euler | v₁ = v₀ + h·a(q₀, v₀); q₁ = q₀ + h·v₁ | 1 | 1 |
| RK4 | see below | 4 | 4 |

### Explicit Euler
It follows the slope at the start of the step. That matches the Taylor series through the h¹ term, so the local truncation error is O(h²) and the global error O(h).

### Symplectic (semi-implicit) Euler
It updates velocity first, then moves the position using the **new** velocity ("kick, then drift"). This requires the state layout `[q…, v…]` with dq/dt = v, which holds for every model here, and the requirement is documented in the code. With no damping, the step map has a Jacobian determinant of exactly 1, so it preserves phase-space area (it's symplectic). The test `symplectic Euler preserves phase-space area` checks the determinant numerically.

### RK4 (classical fourth-order Runge–Kutta)
It performs **four derivative evaluations per step**, and a unit test spies on `f` to confirm it's called exactly four times, at t, t + h/2, t + h/2 and t + h:

```
k₁ = f(y₀,          t₀)          slope at the start
k₂ = f(y₀ + h/2·k₁, t₀ + h/2)    slope at the midpoint, predicted with k₁
k₃ = f(y₀ + h/2·k₂, t₀ + h/2)    slope at the midpoint, predicted with k₂
k₄ = f(y₀ + h·k₃,   t₀ + h)      slope at the end, predicted with k₃
y₁ = y₀ + h/6·(k₁ + 2k₂ + 2k₃ + k₄)
```

**How to explain it in an interview:** Euler takes one slope and follows it in a straight line. RK4 asks "what is the slope at the start, at the middle (twice, each time using a better guess of where the middle is), and at the end?" It then takes a weighted average with the middle counted double, like Simpson's rule. For the linear test equation y′ = λy, one RK4 step multiplies y by exactly 1 + z + z²/2 + z³/6 + z⁴/24 (z = λh), the first five terms of eᶻ. A unit test checks that identity to 15 digits. Matching the exact solution's Taylor series through h⁴ gives a local error of O(h⁵) and a global error of O(h⁴).

**Not done:** there is no closed-form sampling labeled as RK4. The projectile simulator is still evaluated in closed form (it has an exact solution and no integrator), and it isn't described as RK4 anywhere.

## 4. Error characteristics

### Truncation error and convergence order
The test problem is a harmonic oscillator with ω = 2 rad/s, x(0) = 1, v(0) = 0, error |x_numerical(2 s) − cos 4|.

| Method | h = 20 ms | 10 ms | 5 ms | 2.5 ms | 1.25 ms | Observed order |
|---|---|---|---|---|---|---|
| Explicit Euler | 5.61e-2 | 2.71e-2 | 1.33e-2 | 6.59e-3 | 3.28e-3 | **1.02** |
| Symplectic Euler | 1.53e-2 | 7.62e-3 | 3.80e-3 | 1.90e-3 | 9.47e-4 | **1.00** |
| RK4 | 6.27e-8 | 3.98e-9 | 2.50e-10 | 1.57e-11 | 9.83e-13 | **3.99** |

Halving h halves the Euler errors and cuts the RK4 error by 15.8–16.0×. The tests require each RK4 ratio to fall between 15 and 17.

### Energy error: why the methods behave differently
For small swings the pendulum is a harmonic oscillator θ″ = −ω₀²θ. One step of each method is a 2×2 matrix acting on (θ, ω):

| Method | Step matrix | Determinant | Consequence |
|---|---|---|---|
| Explicit Euler | [[1, h], [−ω₀²h, 1]] | **1 + ω₀²h²** | Area grows every step; energy is multiplied by exactly (1 + ω₀²h²) per step, so E(t) ≈ E₀·e^(ω₀²·h·t); the orbit spirals outward |
| Symplectic Euler | [[1 − ω₀²h², h], [−ω₀²h, 1]] | **1** | Area preserved; a slightly modified ("shadow") energy is conserved exactly, so the true energy oscillates in a band of half-width ≈ ω₀h/2 and never drifts |
| RK4 | 4th-degree polynomial in ω₀h | **1 − (ω₀h)⁶/72 + …** | Very slightly dissipative; secular drift over time t ≈ t·ω₀⁶·h⁵/72 (∝ h⁵) |

**Why explicit Euler gains energy:** it uses the velocity and acceleration at the *start* of the step. On a circular phase-space orbit, the tangent at the start always points slightly outside the circle, so every step lands on a larger orbit. The test `explicit Euler multiplies energy by exactly (1 + ω²h²) every step` checks this to 9 digits on the linear oscillator.

**Why symplectic Euler is better for Hamiltonian systems:** Hamiltonian flows preserve phase-space area (Liouville's theorem). A method that also preserves area can't spiral outward or inward, so energy errors stay bounded for arbitrarily long runs. It's still only first-order accurate in position.

### Measured energy drift: pendulum, γ = 0, 30 simulated seconds
Values are the maximum |ΔE/E₀| over the run. The "small-angle prediction" columns use the harmonic-oscillator formulas above with ω₀ = √(g/L) = 3.132 rad/s.

| θ₀ | Δt | Explicit Euler | Symplectic Euler | RK4 | Prediction: Euler / SE / RK4 |
|---|---|---|---|---|---|
| 30° | 1 ms | 3.23e-1 | 1.54e-3 | 3.79e-13 | 3.42e-1 / 1.57e-3 / 3.93e-13 |
| 30° | 5 ms | 2.81e+0 | 7.76e-3 | 1.13e-9 | 3.36e+0 / 7.83e-3 / 1.23e-9 |
| 30° | 10 ms | 9.48e+0 | 1.56e-2 | 3.57e-8 | 1.80e+1 / 1.57e-2 / 3.93e-8 |
| 30° | 50 ms | 5.42e+1 | 8.32e-2 | 1.10e-4 | (linear model invalid) / 7.83e-2 / 1.23e-4 |
| 90° | 1 ms | 2.04e-1 | 1.38e-3 | 5.45e-13 | — |
| 90° | 10 ms | 1.56e+0 | 1.39e-2 | 2.57e-8 | — |
| 90° | 50 ms | 7.67e+0 | 7.23e-2 | 7.11e-5 | — |

Observations:
- **Explicit Euler** gains energy at every step (tested as monotonic) and ends +32% after 30 s even at Δt = 1 ms. The linear prediction is accurate at small Δt. Once Euler has pumped in enough energy the motion is no longer small-angle and grows more slowly than e^(ω₀²ht). Over 300 s at 5 ms, Euler's pendulum went over the top and ended at θ ≈ −99,721°.
- **Symplectic Euler** stays inside a band set by ω₀Δt/2 (1.57e-3 predicted vs 1.54e-3 measured at 1 ms). Over 300 s at 5 ms, the maximum error in the first 10 s and in the last 10 s were both **7.76e-3**: no growth.
- **RK4** drift matches t·ω₀⁶·h⁵/72 to within about 4–11% at 30°. Halving Δt cuts it by about 32× (2⁵), which is also tested. Over 300 s at 5 ms it reached −1.1e-8.

### Period error vs the exact elliptic-integral period (γ = 0)
The relative error is (T_sim − T_exact)/T_exact, with one period measured from rest. "n/a" means Euler pumped in enough energy that the pendulum went over the top before completing a period.

| θ₀ | Exact T (L = 1 m, g = 9.81) | T/T₀ | Euler 1 ms | Euler 10 ms | Sympl. 1 ms | Sympl. 10 ms | RK4 1 ms | RK4 10 ms |
|---|---|---|---|---|---|---|---|---|
| 1° | 2.00610 s | 1.00002 | 3.6e-6 | 3.3e-4 | −4.1e-7 | −4.1e-5 | 7.2e-13 | 8.0e-9 |
| 10° | 2.00989 s | 1.00191 | 3.2e-5 | 6.3e-4 | −4.0e-7 | −4.0e-5 | 7.1e-13 | 7.9e-9 |
| 30° | 2.04099 s | 1.01741 | 2.6e-4 | 3.1e-3 | −3.5e-7 | −3.5e-5 | 6.4e-13 | 7.1e-9 |
| 60° | 2.15287 s | 1.07318 | 1.1e-3 | 1.2e-2 | −2.0e-7 | −2.0e-5 | 4.4e-13 | 5.2e-9 |
| 90° | 2.36784 s | 1.18034 | 2.7e-3 | 3.0e-2 | −2.7e-11* | 1.4e-7* | 2.9e-13 | 3.5e-9 |
| 120° | 2.75409 s | 1.37288 | 6.1e-3 | 7.4e-2 | 2.0e-7 | 2.0e-5 | 2.6e-13 | 2.8e-9 |
| 150° | 3.53510 s | 1.76220 | 1.9e-2 | n/a | 3.5e-7 | 3.6e-5 | 3.9e-13 | 1.3e-9 |
| 170° | 4.89352 s | 2.43936 | n/a | n/a | 4.0e-7 | 4.0e-5 | 4.5e-13 | −1.8e-8 |

Crossing times are located by cubic Hermite interpolation inside the step. An earlier version used linear interpolation, and its own error dominated the RK4 columns: about 10⁻¹¹ at 1 ms and 10⁻⁷ at 10 ms. With Hermite, the RK4 error drops by about 10⁴ from 10 ms to 1 ms, which is the fourth order showing through.

\* Symplectic Euler's period error changes sign near 90°, so the small value there is a zero crossing of the error, not extra accuracy.

**Nonlinear period:** the period grows with amplitude, 0.19% longer than T₀ at 10°, 18% at 90° and 144% at 170°, diverging as θ₀ → 180°. The small-angle formula is within 1% only up to about 23° (from T/T₀ ≈ 1 + θ₀²/16).

## 5. Stability

Linear stability on the undamped oscillator, with s = ω₀h:

| Method | Stable when | Measured (1000 steps from E₀, final E/E₀) |
|---|---|---|
| Explicit Euler | **never** (|amplification|² = 1 + s² > 1) | s = 0.01: 1.11; s = 0.1: 2.10e4 (= 1.01¹⁰⁰⁰ exactly) |
| Symplectic Euler | s < 2 | s = 1.99: 1.28e2 (bounded but distorted); s = 2.01: 2.45e175 (blows up) |
| RK4 | s < 2√2 ≈ 2.828 | s = 2.82: 3.7e-19 (stable, strongly damped); s = 2.84: 1.6e25 (blows up) |

Notes:
- Near its limit, symplectic Euler is stable, but the conserved shadow energy is a very stretched ellipse, so the true energy swings by large factors (×128 at s = 1.99) while staying bounded.
- Near its limit RK4 is stable but heavily dissipative. "Stable" doesn't mean "accurate".
- In the UI, ω₀Δt ≤ √(25/0.2)·0.1 ≈ 1.1, so symplectic Euler and RK4 are always stable there. Explicit Euler always grows. The Numerical Methods Lab shows the current ω₀Δt next to the limits.

## 6. Timestep discussion

- **Accuracy vs cost.** Truncation error scales as Δt (Euler, symplectic Euler) or Δt⁴ (RK4); cost scales as (1/Δt) × evaluations per step. Measured on the pendulum at 60°, error in θ at t = 10 s against an RK4 reference at Δt = 0.1 ms:

  | Method | Δt | f evaluations | Error in θ (rad) |
  |---|---|---|---|
  | Explicit Euler | 10 ms | 1,000 | 8.7e-1 |
  | Explicit Euler | 0.1 ms | 100,000 | 1.1e-2 |
  | Symplectic Euler | 0.1 ms | 100,000 | 1.2e-4 |
  | RK4 | 10 ms | 4,000 | 1.1e-7 |
  | RK4 | 1 ms | 40,000 | 1.3e-11 |

  RK4 with 4,000 evaluations is about 10⁵ times more accurate than explicit Euler with 100,000. The extra evaluations per step pay for themselves many times over.
- **The round-off floor.** Doubles carry about 16 significant digits, and every step adds rounding error. On the spring reference, RK4's error falls as h⁴ down to **4.4e-16 at Δt = 0.1 ms** and then *rises* again (1.8e-15 at 0.05 ms) as accumulated round-off takes over. Smaller steps aren't always better.
- **Fixed step in the app.** The animation loop measures real elapsed time, and the physics advances in exact steps of the selected Δt through an accumulator (`utils/timeStep.advanceFixed`). Results therefore don't depend on the display's refresh rate (tested at 60 vs 144 Hz). The per-frame step cap scales with Δt (`maxStepsFor(dt) = ⌈0.1 s / Δt⌉ + 1`), so even at Δt = 0.5 ms the simulation keeps up with real time. A test checks that completed steps plus the carried remainder equal the frame time.
- **What the animation shows** is the most recent computed state, with no interpolation between steps. At Δt = 50–100 ms the motion visibly jumps, and that reflects the real step size.

## 7. Validation methodology

1. **Exact references:** the linear spring's closed-form solution in all damping regimes, the pendulum's elliptic-integral period, and energy conservation for γ = 0.
2. **Convergence tests:** measure the error at several step sizes and check the ratio between successive halvings (2 for first order, 16 for fourth order).
3. **Invariant tests:** energy (exact multiplicative growth for Euler, a bounded band for symplectic Euler, h⁵ drift for RK4), and phase-space area (Jacobian determinant = 1 for symplectic Euler).
4. **Structural tests:** RK4 calls `f` exactly 4 times at the right times; integrators don't mutate their input; an integrator works on an unrelated ODE (exponential decay), showing it isn't coupled to the pendulum.
5. **Period measurement:** zero-crossing detection, with the crossing located on the cubic Hermite interpolant of the step (error O(h⁴)). Linear interpolation has an O(h²)·|x''| error, and x'' ≠ 0 at a crossing once there is damping: on a damped spring at Δt = 10 ms it put 1.7×10⁻⁶ on RK4's period, against 1.7×10⁻⁹ with Hermite. Tested on an exact damped solution (`analysis.test.js`).
6. **System-level tests** of the simulations: lock-step comparison runs, identical initial conditions, frame-rate independence, and period events matching the exact value.
7. **In-browser checks** of the production build with a manual frame scheduler (see "Results" below).

### Required tests and where they are
| Requirement | Test |
|---|---|
| RK4 convergence | `integrators.test.js` → "RK4 is fourth order: halving h cuts the error ≈ 16×" |
| Energy conservation (undamped pendulum) | `pendulum.test.js` → "RK4 conserves energy: \|ΔE/E₀\| < 1e-8 at Δt = 5 ms"; "RK4 energy drift scales as Δt⁵" |
| Euler energy drift | `integrators.test.js` → "multiplies energy by exactly (1 + ω²h²)", "gains energy at every step"; `pendulum.test.js` → "explicit Euler drifts…" |
| Symplectic Euler bounded energy | `integrators.test.js` → "no secular drift over 1000 periods", "preserves phase-space area"; `pendulum.test.js` → "error band does not grow" |
| Small-angle period agreement | `pendulum.test.js` → "small-angle period agrees with T₀ (θ₀ = 1°, within 0.01%)" |
| Nonlinear period increase | `pendulum.test.js` → "nonlinear period increases with amplitude and matches the elliptic-integral value"; `analysis.test.js` → period-vs-amplitude sweep |
| Critical damping | `spring.test.js` → "RK4 matches x₀(1 + ω₀t)e^(−ω₀t)", "never overshoot; underdamped does", "faster than overdamping", small-angle pendulum at γ = √(g/L) |

## 8. Results

**Automated:** `npm test` passes **140 tests** in 13 files. `npm run lint` and `npm run build` pass.

**Critical damping** (spring, ω₀ = 3 rad/s, RK4 at 1 ms over 6 s): the maximum deviation from x₀(1 + ω₀t)e^(−ω₀t) is **7.8e-13**, and x never goes below zero (minimum 2.9e-7 at t = 6 s).

**Browser verification** (production build, 1440×900, frames driven deterministically at 60 Hz):
- *Numerical Methods Lab, θ₀ = 60°, Δt = 10 ms, 20 s:*
  - The energy chart (log scale) shows Euler climbing to about 10⁰, symplectic Euler oscillating in a fixed 10⁻³–10⁻² band, and RK4 near 10⁻⁸.
  - In the phase portrait, Euler spirals outward off the axes, while symplectic Euler and RK4 lie on the exact dashed orbit.
  - Measured periods: RK4 2.15287 s and symplectic Euler 2.15283 s, both matching the exact 2.15287 s. Euler measured 2.70659 s (+25.7%, because its amplitude had grown).
- *Period-vs-amplitude experiment:*
  - RK4 at 10 ms matched the exact period within about 1e-7 from 10° to 170° (measured with linear crossing interpolation at the time; with Hermite it is within 2e-8, table above).
  - Explicit Euler at 10 ms showed points increasingly above the exact curve, and no completed period beyond 145°.
- *Oscillator Lab:*
  - With RK4 at 5 ms, the measured period was 2.8879 s against an exact 2.8879 s (relative difference 3.6e-9; L = 2 m, θ₀ = 30°).
  - Switching to explicit Euler at 20 ms drove E to 249% of E_ref within 10 s. The bars visibly overshoot their tracks, with no clamping, and the phase inset spirals.
  - The spring with symplectic Euler stayed at 100.6% of E_ref (bounded band), and its period matched 2π√(m/k) to 5e-6.

### Accuracy against cost (exact reference)

Since Phase 8 the lab measures each method against the exact solution of the undamped pendulum, θ(t) = 2·asin(k·cd(ω₀t | k²)) with k = sin(θ₀/2), evaluated with Jacobi elliptic functions (`physics/elliptic.js`, checked against fine-step RK4 to 10⁻⁹ rad). The "Accuracy vs cost" experiment (`accuracyVsCost` in `pendulum/experiments.js`) runs every method at every Δt for 10 s. Measured at θ₀ = 60°, L = 1 m, g = 9.81 m/s²:

| Method, Δt | Derivative evaluations | Largest \|θ − θ_exact\| (rad) |
|---|---|---|
| Explicit Euler, 0.5 ms | 20 000 | 5.6×10⁻² |
| Symplectic Euler, 0.5 ms | 20 000 | 7.8×10⁻⁴ |
| RK4, 100 ms | 400 | 7.3×10⁻⁴ |
| RK4, 10 ms | 4 000 | 1.4×10⁻⁷ |
| RK4, 0.5 ms | 80 000 | 9.3×10⁻¹³ |

With 50 times fewer derivative evaluations, RK4 matches symplectic Euler's error and beats explicit Euler's by a factor of 77. Halving Δt divides RK4's error by about 16 and the Euler methods' by 2, as the orders predict (tested in `pendulum/experiments.test.js`). Wall-clock times are measured too (about 25–60 ns per Euler step and 210–280 ns per RK4 step in Node on the development machine), but they depend on the machine. The evaluation counts do not.

## 9. Limitations and honest caveats

- All arithmetic is IEEE-754 double precision (about 16 significant digits). The best observed RK4 accuracy is around 1e-13 to 1e-16, and only at small Δt on short runs. The project doesn't claim "high precision" beyond the numbers in the tables.
- Error estimates are for the specific test problems above (ω₀ = 2–3.1 rad/s). Stiffer or chaotic systems behave differently.
- The damping model is linear. Real air drag is closer to quadratic in speed.
- With γ > 0, ΔE/E₀ includes real physical energy loss and is no longer a pure error measure (the chart says so), and the reference periods in the period table assume γ = 0.
- Symplectic Euler is symplectic only for velocity-independent forces. With damping it's just a first-order semi-implicit method.
- The wave and projectile simulations don't use these integrators: the wave field is an analytic phasor sum, and the projectile has a closed-form solution.
