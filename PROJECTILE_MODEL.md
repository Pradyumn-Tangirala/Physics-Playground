# Projectile Model

The Projectile Lab (`#/projectile`) flies one launch three ways at once:

| Trajectory | How it is computed |
|---|---|
| **Analytical, no drag** | Closed-form equations, evaluated at each frame. No timestep. |
| **Numerical, no drag** | The same physics integrated step by step (explicit Euler, symplectic Euler or RK4, fixed Δt). |
| **Numerical, quadratic drag** | Air resistance added, using the same integrator and Δt. This case has no closed form. |

Comparing the first two measures the **numerical error**, because the exact answer is known. Comparing the second and third measures the **physical effect of drag**. The "Ideal only" mode keeps the original single analytical shot.

Every number below was measured with the code in this repository (Node 22, double precision). The tests listed in [§13](#13-tests) check them automatically.

---

## 1. Coordinates and state

- Units are SI throughout: m, s, kg, m/s, m/s².
- Ground is the line y = 0. The launch point is (0, y₀), with launch speed v₀ at angle θ above the horizontal.
- The state vector is **y = [x, y, vx, vy]**, positions first and velocities second. This layout is what lets the generic integrators in `src/physics/integrators.js` apply unchanged, symplectic Euler included, since it needs dq/dt = v.

## 2. Ideal model (no drag)

The acceleration is constant at (0, −g), so the motion integrates exactly:

```
x(t) = v₀ cos θ · t
y(t) = y₀ + v₀ sin θ · t − ½ g t²
vx   = v₀ cos θ,     vy(t) = v₀ sin θ − g t
```

Derived quantities (`src/physics/projectile/projectile.js`):

| Quantity | Formula |
|---|---|
| Time of flight | T = (v₀ sin θ + √((v₀ sin θ)² + 2g·y₀)) / g, the positive root of y(T) = 0 |
| Range | R = v₀ cos θ · T |
| Max height | H = y₀ + (v₀ sin θ)² / 2g (or y₀ when launched level or downward) |
| Impact speed | \|v\| = √(v₀² + 2g·y₀), from energy conservation |
| Impact angle | atan(−vy(T) / vx), below the horizontal |

With y₀ = 0 these reduce to the familiar T = 2v₀ sin θ / g and R = v₀² sin 2θ / g.

## 3. Quadratic drag model

The drag force opposes the velocity and grows with its square:

```
F_drag = −½ ρ C_d A |v| v
```

Here ρ is the air density (kg/m³), C_d the drag coefficient (dimensionless), A the cross-sectional area (m²) and m the mass (kg). Dividing by m and adding gravity:

```
ax = −k |v| vx
ay = −g − k |v| vy             k = ρ C_d A / (2m)   [1/m]
```

`src/physics/projectile/drag.js` implements this as `derivative({ g, k })`, which maps `[x, y, vx, vy]` to `[vx, vy, ax, ay]`.

- **Coupling:** |v| = √(vx² + vy²) ties the horizontal and vertical motion together, so unlike the ideal case they cannot be solved separately. There is no closed-form solution in 2-D; this is why the drag trajectory is integrated numerically.
- **Terminal speed:** drag balances weight when k·v² = g, giving v_t = √(g/k). With the defaults (a baseball-sized sphere: m = 0.145 kg, A = 0.0042 m², C_d = 0.47, ρ = 1.225 kg/m³) this works out to k = 8.34×10⁻³ m⁻¹ and v_t = 34.3 m/s.
- **Energy:** mechanical energy is E = ½m|v|² + mgy. Drag removes it at the rate P = F·v = −m·k·|v|³, which is never positive.
- **Exact 1-D solutions,** used only for validation:
  - Vertical launch, going up: v′ = −g(1 + v²/v_t²). Integrating gives the apex height h = (v_t²/2g)·ln(1 + v₀²/v_t²), reached at t = (v_t/g)·atan(v₀/v_t).
  - Falling from rest: v(t) = v_t·tanh(g t / v_t).

## 4. Numerical method

`src/physics/projectile/flight.js` runs a flight on any integrator from the shared framework (see [NUMERICAL_METHODS.md](NUMERICAL_METHODS.md) for the methods themselves).

- **Fixed step, integer clock.** Time is `steps × Δt`, never a running sum. Round-off never builds up in t, and numerical states are compared with the analytical solution at exactly the same instants.
- **Event location.** The landing (y = 0) and the apex (vy = 0) almost always fall *inside* a step. Within that step the state is rebuilt by **cubic Hermite interpolation**, which uses both endpoint states and their derivatives f(y). Bisection then finds the crossing (`hermite` / `locateCrossing` in `src/physics/analysis.js`).
  - Hermite is exact for cubic polynomials, and the ideal trajectory is quadratic, so the landing point carries no interpolation error. With drag, its error is O(Δt⁴), the same order as RK4.
  - Linear interpolation would add an O(Δt²) error of its own and hide RK4's accuracy.
- **Instability detection.** The exact solution never moves faster than max(v₀, min(v_t, drag-free impact speed)): above v_t the speed can only fall, and drag only removes energy. It also never reverses horizontally, because vx′ = −k|v|vx cannot change the sign of vx. A numerical state that exceeds 1.5× that speed or reverses vx is flagged `diverged`, and its metrics become NaN, so a blown-up run is never reported as a landing. A test checks that no stable run, across all methods and step sizes, is ever flagged.
- **Live animation and the metrics table** both run the same function on the same steps. A test checks that the live landing point equals the predicted one *bit for bit*, at 30, 60 and 144 fps and at playback speeds of 0.5×, 1× and 10×.

## 5. Validation: numerical vs analytical (no drag)

**Theory.** Without drag the acceleration is constant, so:

- **Velocity** is linear in t, and all three methods integrate it exactly. Any velocity error is round-off.
- **Explicit Euler** moves the position with the velocity from the *start* of each step, so its points sit on y₀ + (vy + ½gΔt)·t − ½gt². That is too high by exactly **½·g·Δt·t**. Launched from the ground, it lands one step late (T + Δt) and long by vx·Δt.
- **Symplectic Euler** uses the velocity from the *end* of the step, so it is too low by the same amount. It lands one step early, short by vx·Δt.
- **RK4** reproduces any solution that is a polynomial of degree ≤ 4. The trajectory is a parabola, so RK4 has **no truncation error at all**; what remains is round-off.

**Measured** (v₀ = 60 m/s, θ = 45°, g = 9.8, Δt = 10 ms; exact range 367.347 m, T = 8.6585 s):

| Method | max \|Δr\| (m) | max \|Δv\| (m/s) | ΔRange (m) | ΔT (s) | Δ\|v_impact\| (m/s) |
|---|---|---|---|---|---|
| Explicit Euler | 4.24e-1 | 4.5e-13 | +4.24e-1 | +1.00e-2 | +6.93e-2 |
| Symplectic Euler | 4.23e-1 | 4.5e-13 | −4.24e-1 | −1.00e-2 | −6.93e-2 |
| RK4 | 4.2e-12 | 4.5e-13 | −1.7e-12 | +4.8e-14 | +7.1e-15 |

These match the theory:
- ½·9.8·0.01·8.6585 = 0.4243 m.
- vx·Δt = 42.43 × 0.01 = 0.4243 m.
- ΔT = Δt.

From a 30 m tower (v₀ = 25 m/s, θ = 40°) the Euler errors are ±0.149 m in range and ±7.76 ms in time. RK4's range error is 6×10⁻¹³ m.

The velocity error is round-off, and it *grows* as Δt shrinks (1.0e-11 at 0.5 ms), because more steps mean more roundings.

## 6. Energy behaviour

**No drag** (m = 0.145 kg, E₀ = 261 J, Δt = 10 ms). Over the flight, ΔE matches the prediction to 1.2×10⁻¹² J:

| Method | ΔE at landing | Prediction |
|---|---|---|
| Explicit Euler | +0.603 J | +½·m·g²·Δt·t (linear growth) |
| Symplectic Euler | −0.602 J | −½·m·g²·Δt·t (linear decay) |
| RK4 | 6×10⁻¹⁴ J | 0 |

Symplectic Euler does **not** keep the energy error bounded here, unlike the pendulum. Symplectic methods conserve a slightly *modified* energy, H̃ = H − ½·Δt·m·g·vy. The difference from H is proportional to vy, which stays bounded only for periodic motion. A projectile in free fall is not periodic, so the energy error grows with |vy|.

**With drag**, energy decreases at every step (tested at Δt = 5 ms). The test also checks the work–energy theorem: it augments the state with the accumulated drag work W (dW/dt = −m·k·|v|³) and integrates both with RK4. Over 5 s at Δt = 10 ms, E(t) − E₀ = W(t) to 2×10⁻¹¹·E₀.

## 7. Validation of the drag solver

No closed form exists in 2-D, so the drag solver is checked against the exact 1-D solutions (RK4, defaults):

| Test | Δt = 10 ms | Δt = 1 ms |
|---|---|---|
| Vertical apex height, v₀ = 20 m/s (exact 17.5648 m) | rel. error 1.9e-12 | 4e-15 |
| Vertical apex height, v₀ = 50 m/s (exact 68.3655 m) | 1.3e-11 | 6e-16 |
| Vertical apex height, v₀ = 100 m/s (exact 135.0490 m, ideal 510.2 m) | 6.2e-11 | 1.2e-14 |
| Fall from rest, max \|v − v_t·tanh(gt/v_t)\| over 20 s | 3.4e-11 m/s | — |

After 20 s of falling the speed is 34.2816 m/s, with v_t = 34.2823 m/s. As k → 0 the drag solution approaches the ideal one: at k = 10⁻⁹ m⁻¹ the range differs by less than 10⁻⁵ relative.

## 8. Convergence experiment

The lab's "timestep convergence" experiment (`convergenceStudy` in `src/physics/projectile/experiments.js`) flies the current launch with every method at Δt = 0.5, 1, 2, 5, 10, 20, 50 and 100 ms. It measures three errors against a reference:

- the range error |ΔR|
- the maximum position error |Δr| at equal times
- the maximum velocity error |Δv| at equal times

**The reference:**
- **Without drag:** the analytical solution.
- **With drag:** RK4 at Δt = 0.05 ms, stored every 0.5 ms and Hermite-interpolated to any time. Halving its step again changes the range by 3.4×10⁻¹² m and the apex height by 4×10⁻¹⁴ m. It is converged far beyond the errors it is used to judge.

The **observed order** is the least-squares slope of log(error) against log(Δt). It leaves out errors below 10⁻¹¹ × the trajectory size (measured round-off reaches about 10⁻¹⁰ m after about 10⁴ steps), and reports "round-off only" when fewer than two points remain.

**Range error |ΔR| (m), default launch:**

| Δt | Euler, no drag | Symplectic, no drag | RK4, no drag | Euler, drag | Symplectic, drag | RK4, drag |
|---|---|---|---|---|---|---|
| 0.5 ms | 2.12e-2 | 2.12e-2 | 5.6e-12 | 8.11e-4 | 3.14e-2 | 1.7e-12 |
| 1 ms | 4.24e-2 | 4.24e-2 | 1.2e-11 | 1.62e-3 | 6.29e-2 | 2.4e-12 |
| 2 ms | 8.49e-2 | 8.49e-2 | 2.6e-11 | 3.26e-3 | 1.26e-1 | 4.0e-12 |
| 5 ms | 2.12e-1 | 2.12e-1 | 1.3e-11 | 8.20e-3 | 3.15e-1 | 7.9e-11 |
| 10 ms | 4.24e-1 | 4.24e-1 | 1.7e-12 | 1.66e-2 | 6.29e-1 | 1.23e-9 |
| 20 ms | 8.49e-1 | 8.49e-1 | 3.4e-13 | 3.41e-2 | 1.26 | 1.99e-8 |
| 50 ms | 2.12 | 2.12 | 4.0e-13 | 9.20e-2 | 3.16 | 8.04e-7 |
| 100 ms | 4.24 | 4.24 | 1.7e-13 | 2.07e-1 | 6.35 | 1.36e-5 |
| **Observed order** | **1.00** | **1.00** | round-off only | **1.04** | **1.00** | **4.05** |

Position and velocity errors give the same orders: with drag, Euler 1.00 / 1.01, symplectic Euler 1.00 / 1.01 and RK4 4.04 / 3.98. Without drag, every velocity error is round-off.

**Reading the results:**
- **The first-order methods** halve their error when Δt halves.
- **RK4's error** drops 16× per halving until it reaches the round-off floor of about 10⁻¹² m near Δt = 2 ms; smaller steps cannot improve it.
- **Cost comparison:** RK4 at 10 ms (4 evaluations per step, 610 steps) is about 7×10⁵ times more accurate than explicit Euler at 0.5 ms (1 evaluation, 12 200 steps), for about a fifth of the work.
- **Drag and the Euler methods.** With drag, explicit Euler happens to beat symplectic Euler by about 40×. Drag depends only on velocity, so both methods produce *identical* velocity sequences; they differ only in which velocity, start or end of the step, moves the position. For this launch, explicit Euler's two error terms partly cancel and symplectic Euler's add. That's a coincidence of signs, not a general advantage. Symplectic Euler's real strength is long-term energy behaviour in conservative oscillatory systems.

The whole study (24 flights plus the reference) takes about 75 ms in Node and about 110 ms in the browser, so it runs on a button press rather than on every slider change.

## 9. Effects of drag (defaults: 60 m/s, 45°, baseball-sized sphere)

| C_d | k (m⁻¹) | Range (m) | Max height (m) | Flight time (s) | Impact speed (m/s) | Impact angle |
|---|---|---|---|---|---|---|
| 0 (ideal) | 0 | 367.35 | 91.84 | 8.658 | 60.00 | 45.0° |
| 0.10 | 1.77e-3 | 249.97 | 73.53 | 7.731 | 42.73 | 54.3° |
| 0.25 | 4.44e-3 | 176.09 | 58.60 | 6.874 | 33.09 | 61.0° |
| **0.47** | **8.34e-3** | **126.71** | **46.51** | **6.099** | **26.65** | **66.1°** |
| 0.80 | 1.42e-2 | 91.53 | 36.51 | 5.382 | 21.78 | 70.0° |
| 1.20 | 2.13e-2 | 69.72 | 29.55 | 4.829 | 18.49 | 72.7° |
| 2.00 | 3.55e-2 | 48.31 | 21.98 | 4.153 | 14.88 | 75.6° |

- **Range:** at the default C_d of 0.47, drag cuts the range by 65.5%, and the range falls steadily as C_d rises.
- **Shape:** the path is no longer symmetric. Drag has removed horizontal speed by the time the ball comes down, so it lands at 66° after launching at 45°.
- **Best launch angle:** with drag it is about **37°**, not 45° (range 129.9 m against 126.7 m at 45°, searched in 0.5° steps).

## 10. Stiffness and stability with strong drag

The decay rate of the drag term is about 2k·|v|, so explicit methods need 2k·v·Δt below their stability limit: 2 for explicit and symplectic Euler, 2.79 for RK4 on the negative real axis. The lab shows this number and warns above 1.

A deliberately extreme case is ρ = 2, C_d = 2, A = 0.05 m², m = 0.01 kg, which gives k = 10 m⁻¹ at v₀ = 60 m/s. Sweeping Δt in 2% steps:

| Method | Last stable Δt (2k·v₀·Δt) | First flagged Δt (2k·v₀·Δt) |
|---|---|---|
| Explicit Euler | 1.66 ms (1.997) | 1.70 ms (2.04) |
| Symplectic Euler | 1.66 ms (1.997) | 1.70 ms (2.04) |
| RK4 | 4.06 ms (4.87) | 4.14 ms (4.97) |

The Euler methods fail exactly at the linear limit of 2. That's where vx·(1 − k|v|Δt) changes sign and the projectile starts moving backwards.

RK4 is *not* flagged until about 4.9, well past its linear limit of 2.79. The drag is nonlinear: the first step cuts the speed sharply, which pulls 2k·v·Δt back inside the stability region. The solution is still wrong, though. Against a reference at Δt = 1 µs, RK4's range error is:

| 2k·v₀·Δt | 0.5 | 1 | 2 | 2.79 | 3.5 | 4.8 |
|---|---|---|---|---|---|---|
| RK4 relative range error | 1.1e-5 | 2.9e-4 | 1.1e-2 | 6.7e-2 | 1.0e-1 | 4.2e-2 |

"Not flagged" therefore does not mean "accurate". The lab's warning says so, and asks for a smaller Δt.

## 11. Model assumptions

- **Point mass.** No size or orientation: no spin, so no Magnus force or lift. Size enters only through the drag area A.
- **Constant gravity.** Uniform g pointing straight down, over flat ground. Real g falls by about 0.03% per 100 m of height. Earth's curvature and rotation (Coriolis) are ignored; both are negligible at these ranges.
- **No wind.** The air is at rest, so drag opposes the velocity relative to the ground.
- **Drag model.** Purely quadratic drag with a constant C_d. For a sphere this holds roughly for Reynolds numbers between 10³ and 2×10⁵. Left out:
  - the linear (viscous) term, which matters only for very small or slow objects
  - the drag crisis, a sudden drop in C_d above about 3×10⁵
  - any dependence of C_d on speed or surface roughness

  The default launch (60 m/s, 7.3 cm ball) is at Re ≈ 3×10⁵, at the edge of this range; real baseballs have C_d ≈ 0.3–0.5 that varies with speed.
- **Atmosphere.**
  - Constant air density ρ at every height; the real atmosphere loses about 1% per 100 m.
  - No buoyancy: air is hundreds of times less dense than a ball.
  - Incompressible flow, valid well below the speed of sound (100 m/s ≈ Mach 0.3).
- **Ground.** The flight ends at the first crossing of y = 0, with no bounce.
- **Numerics.** Fixed step Δt from 0.5 to 100 ms. Flights that haven't landed after 600 s are abandoned.

## 12. Code map

| File | Role |
|---|---|
| `src/physics/projectile/projectile.js` | Closed-form ideal model (now with launch height and impact velocity) |
| `src/physics/projectile/drag.js` | k, v_t, derivative, energy, drag power, exact 1-D solutions, stiffness |
| `src/physics/projectile/flight.js` | Numerical flight: stepping, event location, instability detection, metrics |
| `src/physics/projectile/experiments.js` | References, error measurement, convergence study, observed order |
| `src/physics/analysis.js` | `hermite`, `locateCrossing`: generic event location |
| `src/simulation/projectileSimulation.js` | Live simulation (ideal / compare modes) and full-flight predictions |
| `src/rendering/projectileRenderer.js` | Scene, auto-scaling camera, trails, live readout |
| `src/rendering/convergenceRenderer.js` | Log–log error vs Δt chart |
| `src/components/ProjectileModelNotes.jsx` | In-app equations, assumptions and the "why RK4 is exact" note |
| `src/pages/ProjectileLab.jsx` (+ `src/pages/projectile/`) | The lab page and its result sections |

## 13. Tests

Every requested test category, and where it lives:

| Requirement | Test file → test |
|---|---|
| Zero-drag numerical vs analytical | `flight.test.js` → "zero drag: numerical vs analytical" (RK4 matches to round-off on 4 launches; velocity exact for every method; Euler ±½gΔt·t; landing T ± Δt). Also `experiments.test.js` → "no drag: RK4 and every velocity error are at round-off" |
| Gravity validation | `flight.test.js` → "gravity" (a = (0, −g) exactly; drops land after √(2h/g) on the Moon, Earth and Jupiter; R·g constant) |
| Energy behaviour | `flight.test.js` → "energy" (RK4 conserves; Euler ±½mg²Δt·t; drag lowers E every step; ΔE = drag work) |
| Drag reduces range | `drag.test.js` → "drag reduces the range under equivalent conditions" (4 launches, including from a height) |
| Higher C_d reduces range | `drag.test.js` → "increasing the drag coefficient steadily reduces the range" (also ρ, A and m) |
| Timestep convergence | `experiments.test.js` → "timestep convergence" (Euler methods order ≈ 1, RK4 order ≈ 4 with drag, monotone error decrease, halving Δt halves the Euler error) |

Also tested:
- the drag solver against the exact vertical apex and the tanh fall speed
- the best angle below 45° with drag
- the k → 0 limit
- the reference's own accuracy
- Hermite exactness
- instability flagging, with no false alarms across methods and step sizes
- the live simulation landing exactly where the prediction says, at any frame rate

## 14. What this model does not do

- **No closed-form drag trajectory.** None exists in 2-D, and none is pretended.
- **"Error" is defined against a reference.** With drag, the reference is numerical, so errors below about 10⁻¹¹ m can't be resolved.
- **No wind, spin, lift, altitude-dependent air or variable C_d.** These would be natural extensions; each would change the model, not the numerics.
