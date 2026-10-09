# Wave Model

The wave section has two separate modules. They answer different questions and are computed in completely different ways.

| | **Wave Interference: analytical model** (`#/simulation`) | **Numerical Wave Equation Lab** (`#/waves/fdtd`) |
|---|---|---|
| What it computes | The Huygens–Fresnel phasor sum for one or two slits | The 2-D wave equation, stepped in time by finite differences (FDTD) |
| Time | Exact time-harmonic solution; only the phase rotates | Explicit leapfrog steps of Δt |
| Barrier | Ideal, infinitely thin, no reflections (Kirchhoff) | Rigid wall cells (u = 0), two cells thick, with reflections |
| Scales | Any, including visible light | Macroscopic only (λ must span many cells) |
| Code | `src/physics/waves/interference.js`, `field.js` | `src/physics/waves/fdtd.js` |

The analytical page is **not** a wave-equation solver and doesn't say it is. Each module is validated on its own, and then they are checked against each other ([§8](#8-fdtd-vs-the-analytical-model)).

Every number below was measured with this code (Node 24, double precision unless stated). [§11](#11-tests) maps every requested test to the test that covers it.

---

## 1. Analytical model

**Geometry** (SI units):
- The slit plane is x = 0 and the screen is the line x = D.
- In double-slit mode, slit 1 is centred at y = +d/2 and slit 2 at y = −d/2. In single-slit mode one slit is centred at y = 0.
- Each slit has width a.

**Parameters:**

| Symbol | Meaning | Notes |
|---|---|---|
| λ | wavelength | slider |
| c | wave speed | water 0.25 m/s, sound 343 m/s, light 2.998×10⁸ m/s |
| f = c/λ | frequency | derived, so the three are always consistent |
| d | slit separation | |
| a | slit width | a = 0 gives a point source |
| D | screen distance | |
| φ | phase difference | slit 2's phase lead |
| A₁, A₂ | source amplitudes | |

**Presets** (all real setups):
- Ripple tank: λ = 20 mm, d = 100 mm, a = 10 mm, D = 1 m
- Microwaves: 10.5 GHz, λ = 28.5 mm
- Sound: 17 kHz, λ = 20 mm
- He-Ne laser: λ = 632.8 nm, d = 0.25 mm, a = 0.05 mm, D = 1 m

## 2. Phasor formulation

Every open point of a slit re-radiates a cylindrical wave (2-D Huygens–Fresnel). Each slit is split into n coherent sub-sources at the midpoints of n equal parts. The complex field at a point is

```
U(x, y) = Σⱼ (Aⱼ / n) · √(D / rⱼ) · e^{i(k rⱼ + φⱼ)},     k = 2π/λ
```

Here rⱼ is the distance to sub-source j, and √(D/r) is the 2-D spreading, normalised so a slit far away on the axis contributes amplitude Aⱼ. The physical field is u(x, y, t) = Re(U·e^{−iωt}).

**Precompute once, animate cheaply.** U depends only on position, so the 2-D view computes it once per parameter change (`buildField`). Each frame then evaluates

```
u = Re U · cos ωt + Im U · sin ωt
```

That's two multiplications per pixel plus a colour-table lookup, with no trigonometry per pixel per frame.

**Faster precompute.** The field view places one sub-source on every grid row inside an opening, the same rows drawn open in the barrier. The wave from a source at row r_s, seen from row r, is then a single kernel K(|r − r_s|, x) = √(D/ρ)·e^{ikρ}, shifted. The kernel is computed once (all the trigonometry), and each source then costs one complex multiply-add per cell. Measured on a 495 × 211 grid:

| Case | Direct sum | Kernel | Speed-up |
|---|---|---|---|
| Defaults | 24 ms | 8–15 ms | ≈2× |
| Wide slits (a = 60 mm, λ = 5 mm, about 50 sub-sources) | 250 ms | 28–53 ms | ≈6× |

**Screen pattern precision.** The screen pattern uses the phase relative to the axis:

```
k(r − D) = k · Δy² / (r + D)
```

At optical scale k·r ≈ 10⁷ rad. Evaluating cos(k·r) directly is slow (large-argument reduction) and cancels about 7 significant digits. The common factor e^{ikD} doesn't change |U|². This brought the laser case from 530 ms to under 20 ms.

**Sub-source spacing.** For the screen, the spacing is λ/(50·sin θ_max), where θ_max is the widest angle shown. The phase step between neighbours is then below π/25 everywhere, and the midpoint rule differs from the exact slit integral by less than 10⁻³ in amplitude.

## 3. Intensity

A detector, an eye or a camera measures the **time average of u²**:

```
⟨u²⟩ = |U|² / 2
```

The page uses **I = |U|²**. The ½ is dropped because only ratios and positions are compared. The instantaneous amplitude |u(t)| is never called intensity: it is zero everywhere twice per cycle. The animated field view shows u(t) itself and is labelled as such. The chart, the screen strip and the "time-averaged intensity" field view all use |U|².

A test checks this directly: the average of u(t)² over a cycle equals |U|²/2 to 6 digits.

## 4. Single-slit diffraction

Integrating across a slit of width a gives, in the far field:

```
I(θ) = cos θ · A² · sinc²(k a sin θ / 2),    sinc x = sin x / x
```

The cos θ factor is the 2-D spreading on a flat screen, since r = D/cos θ.

- **Zeros** fall at a sin θ = mλ (m ≠ 0).
- **Central maximum width** is 2λD/a for small angles.
- **Side lobes** are 4.72% and 1.65% of the centre.
- **A slit narrower than λ** has no zeros: the wave spreads in every direction.

**Measured** (He-Ne laser, a = 0.1 mm, D = 1 m):

| Quantity | Small-angle formula | Fraunhofer curve | Simulated |
|---|---|---|---|
| Central maximum width | 25.312 mm (2λD/a) | 25.314 mm | 25.314 mm |

- Error against 2λD/a: +0.0096%.
- RMS profile error against cos θ·sinc²: 0.0009% of the peak.
- First three zeros match D·tan(asin(mλ/a)) to better than 10⁻³.

In the ripple tank, with a = 60 mm and λ = 20 mm, the small-angle formula is off by **6.1%**. sin θ = 1/3 is not a small angle. The exact Fraunhofer value differs by only 0.05%.

## 5. Double-slit interference

In the far field, at angle θ:

```
I(θ) = cos θ · [A₁² + A₂² + 2A₁A₂ cos(k d sin θ + φ)] · sinc²(k a sin θ / 2)
```

- **Bright fringes** satisfy d sin θ = (m − φ/2π)λ. For small angles they are spaced **β = λD/d**.
- **The phase difference φ** shifts the pattern by −φ/2π fringes. At φ = π the centre is dark (tested to 10⁻⁶).
- **Unequal amplitudes:** dark fringes are no longer black. The visibility is 2A₁A₂/(A₁² + A₂²), tested to 4 digits.
- **Missing orders:** when d/a is a whole number, an order falls on an envelope zero and disappears. With d = 3a the 3rd order is suppressed to below 10⁻⁴ of the centre.

**Measuring the spacing.** The sloping sinc² envelope pulls every *bright* fringe slightly towards the centre. For the laser preset the first bright fringe sits 1.35% inside λD/d. The *dark* fringes of equal slits are exact zeros, which the envelope multiplies by zero and so cannot move. The "measured β" is therefore the mean spacing of adjacent dark fringes near the centre. The same procedure is applied to the Fraunhofer curve, so the comparison is like for like. Bright-fringe positions appear separately in the fringe table, with the envelope pull included in the Fraunhofer column.

**Measured fringe spacing** (equal amplitudes, φ = 0):

| Setup | λD/d | Fraunhofer | Simulated | Sim vs λD/d | Sim vs Fraunhofer | D / (L²/λ) |
|---|---|---|---|---|---|---|
| He-Ne laser | 2.5312 mm | 2.5313 mm | 2.5313 mm | +0.002% | 0.0000% | 7.0 |
| Ripple tank, D = 1 m | 20.00 cm | 20.97 cm | 20.99 cm | +4.95% | +0.115% | 1.65 |
| Ripple tank, D = 3 m | 60.00 cm | 62.90 cm | 62.91 cm | +4.84% | +0.013% | 4.96 |
| Ripple tank, D = 20 m | 4.000 m | 4.193 m | 4.193 m | +4.83% | +0.0003% | 33 |
| Microwaves (λ = 28.5 mm, d = 12 cm), D = 1 m | 23.75 cm | 25.42 cm | 25.46 cm | +7.20% | +0.163% | 1.45 |

**Reading the table.** Two separate approximations are visible:

1. **"Sim vs λD/d"** contains the **small-angle approximation**. With λ/d = 0.2 it costs about 5%, at any distance.
2. **"Sim vs Fraunhofer"** contains only **near-field (Fresnel) effects**. It shrinks as D grows past the Fraunhofer distance L²/λ, where L is the aperture size: from 0.1% at 1.65 × L²/λ to 0.0003% at 33 ×. The simulation includes curved wavefronts exactly; the formula does not.

**Near-field asymmetry.** With unequal amplitudes (A₂ = 0.4) the pattern tilts slightly towards the brighter slit, giving a profile error of 0.46% against 0.01% for equal slits. This is physical. Each slit's own diffraction envelope is centred on that slit (y = ±d/2), not on the axis, and the stronger slit's envelope dominates. Swapping A₁ and A₂ mirrors the error exactly. It vanishes in the Fraunhofer limit.

## 6. FDTD formulation

`src/physics/waves/fdtd.js` solves

```
∂²u/∂t² = c²(∂²u/∂x² + ∂²u/∂y²) − σ(x, y) ∂u/∂t + F(x, y, t)
```

on square cells of size Δx with steps of Δt. Central differences in space and time (leapfrog) give

```
uⁿ⁺¹ = keep·(2uⁿ + C²·(u_E + u_W + u_N + u_S − 4u)ⁿ) − carry·uⁿ⁻¹
keep = 1/(1 + b),   carry = (1 − b)/(1 + b),   b = σΔt/2,   C = cΔt/Δx
```

The scheme is second-order accurate in space and time. `keep` and `carry` are precomputed per cell, so the inner loop has no division and no branch.

**Walls.** Wall cells, the barrier, are zeroed from an index list after each step. That makes a rigid wall (u = 0).

**Sources.** Sources are *soft*: each step adds a·sin(2πft) at the source cells, ramped on over two periods. A column of them launches a plane wave; one cell launches a cylindrical wave.

**Boundaries:**
- **Reflective:** the outer ring is held at u = 0, so waves reflect with their sign inverted. The scheme's discrete energy, ½Σ((uⁿ⁺¹ − uⁿ)/Δt)² + ½(c/Δx)²Σ(Δuⁿ⁺¹)(Δuⁿ), is conserved to **2×10⁻⁷** over 2000 steps (float32 round-off).
- **Absorbing:** a sponge in which σ grows quadratically over three wavelengths, plus a first-order Mur condition on the outermost ring, uⁿ⁺¹_edge = uⁿ_in + (C − 1)/(C + 1)·(uⁿ⁺¹_in − uⁿ_edge). The strength was chosen by measurement: a harmonic point source at 15 cells per λ, waves hitting the edges at 0–90°, RMS difference from a free-space reference:

  | Boundary | Error vs free space |
  |---|---|
  | Rigid edge only | 230% (standing waves) |
  | Mur only | 7.2% |
  | Sponge only, 2λ thick, strong | 2.3% |
  | Mur + sponge, 2λ, strength 6 | 2.2% |
  | **Mur + sponge, 3λ, strength 6 (used)** | **1.2%** |

  A stronger sponge reflects off its own gradient. A perfectly matched layer would do better, and is listed as a limitation. A pulse leaving the domain leaves **6×10⁻⁶** of its energy behind after 800 steps.

## 7. CFL condition and numerical dispersion

**Stability.** For the shortest wave on the grid (a checkerboard) the leapfrog update has amplification factors g satisfying g² − (2 − 8C²)g + 1 = 0. Once C² > ½, |g| > 1 and that mode grows every step. In 2-D the CFL limit is therefore **C ≤ 1/√2 ≈ 0.7071**.

Measured from random noise on a 64 × 64 rigid box:

| C | 0.69 | 0.70 | 0.7071 | 0.71 | 0.72 | 0.75 |
|---|---|---|---|---|---|---|
| Result | stable | stable | stable (2000 steps) | ×10⁶ after 92 steps | after 41 | after 22 |

The lab shows a warning as soon as C > 1/√2. If the field passes 10⁶, it stops stepping and reports how many steps it lasted.

**Numerical dispersion.** On the grid, waves travel slower than c, by an amount that depends on direction. Along an axis the scheme obeys sin²(ωΔt/2)/(cΔt)² = sin²(kΔx/2)/Δx². The resulting phase-speed error (from `phaseVelocityError`):

| Cells per λ | C = 0.3 axis / diagonal | C = 0.5 axis / diagonal | C = 0.7 axis / diagonal |
|---|---|---|---|
| 6 | −4.55% / −1.96% | −3.77% / −1.20% | −2.58% / −0.05% |
| 10 | −1.54% / −0.69% | −1.27% / −0.42% | −0.87% / −0.02% |
| 15 | −0.67% / −0.30% | −0.56% / −0.18% | −0.38% / −0.01% |
| 30 | −0.17% / −0.08% | −0.14% / −0.05% | −0.09% / −0.00% |

Halving Δx cuts the error about fourfold (second order).

**Measured wavelength** (20 cells per λ, C = 0.5, lock-in phase between two probes): **19.930 cells**. That is −0.35% from c/f = 20 and only −0.04% from the dispersion relation's 19.938. The scheme does exactly what its theory says.

**Measured propagation speed** (Gaussian pulse, σ = 4 cells): within 1% of c along both the axis and the diagonal.

## 8. FDTD vs the analytical model

The FDTD lab averages u² over about four periods along a detector line. It compares this with the analytical phasor sum for the **same geometry as built on the grid**: snapped slit widths and centres, with the barrier's far face as the slit plane. The two share no code beyond the geometry.

| Scene (defaults: λ = 3 cm, d = 10 cm, D ≈ 0.6 m, C = 0.5) | Cells per λ | Fringe spacing, FDTD vs analytical | RMS profile difference |
|---|---|---|---|
| Plane wave → double slit (a = 1.2 cm) | 10 | +6.4% | 7.9% |
| | **15 (default)** | **+2.9%** | 5.0% |
| | 24 | +1.7% | 5.0% |
| Two point sources | 15 | +2.6% to +2.8% | 3.2% |
| Plane wave → single slit (a = 8 cm) | 10 | — | 1.7% |
| | 15 | — | 0.8% |

**The fringe-spacing gap is discretisation error.** It falls roughly as 1/(cells per λ)², and it doesn't change with longer averaging (2.6% → 2.8% → 2.8% for 4, 20 and 40 extra periods), so it isn't a start-up transient. It is larger than the plain axis phase-speed error (0.56% at 15 cells per λ) because the grid's wave speed depends on direction. The two waves that meet at a fringe arrive from slightly different directions, so the anisotropy shifts the fringes directly.

An isolated test, two point sources in grid units with the time average taken over exactly four periods, puts the first dark fringe at path difference 0.506λ (16 cells per λ) and 0.501λ (32 cells per λ), against an exact 0.5λ.

**The remaining profile difference** comes from physics the analytical model leaves out: reflections from the barrier (the standing wave visible in front of it), its finite thickness, the staircased slit edges, and about 1% residual boundary reflection.

## 9. Performance

Measured on the development machine. Browser figures come from the built-in browser pane, driven by a manual frame scheduler because the pane was hidden.

| Operation | Time | Notes |
|---|---|---|
| Analytical field precompute (495 × 211) | 8–15 ms default, 28–53 ms worst | Once per parameter change (kernel method, §2) |
| Analytical frame (rotate phase + LUT + draw) | ≈ 5 ms | `ImageData` allocated once and reused; scaled with `drawImage` |
| Screen analysis (1601 samples) | 2–9 ms (ripple), 7–19 ms (laser) | Once per parameter change |
| FDTD step, 500 × 301 cells (Node) | ≈ 1.0 ms (≈145 M cell-updates/s) | Branch-free inner loop |
| FDTD step, same grid (browser) | ≈ 1.9–2.1 ms | |
| FDTD frame, 3 steps + detector + draw (browser) | ≈ 12 ms | Was 21 ms before optimisation |

**FDTD optimisations, measured.**
- **Inner loop:** division-free and branch-free, 0.93 ms against 1.40–1.60 ms per step for the original in a side-by-side benchmark.
- **Blow-up check:** `maxAbs` went from 1.34 ms (a `for…of` loop over the typed array) to 0.30 ms (an indexed loop with a cheap NaN test).
- **Brightness gain:** computed from the RMS sampled on every third cell, within the region behind the barrier.
- **Rendering:** the `ImageData`, offscreen canvas and colour tables are allocated once and reused; nothing is allocated per frame in the solver.
- **WebGL:** not used, because the Canvas 2D path holds the frame budget.

## 10. Numerical limitations

- **Analytical model.**
  - Uses scalar waves with Kirchhoff boundary conditions: the barrier is an ideal thin screen with no reflections.
  - There's no polarisation and no exact edge diffraction.
  - The 2-D field view snaps sub-sources to grid rows (at most λ/2 apart) and is drawn only when that's valid. At optical scales it shows an explanation instead of an aliased picture.
- **FDTD.**
  - Scalar waves only.
  - Requires many cells per wavelength, so it's limited to macroscopic setups.
  - Has direction-dependent numerical dispersion (§7), which makes fringes about 3% too wide at 15 cells per λ.
  - The barrier is at least two cells thick, with staircased slit edges.
  - The absorbing boundary reflects about 1%; a perfectly matched layer would do better.
  - The detector needs a few periods after the wave arrives to settle (shown on the chart).
- **Grid size:** capped at 250 000 cells (≈1 ms per step). Above that, Δx is coarsened and the panel says so.

## 11. Tests

Requested categories, and where each lives:

| Requirement | Test |
|---|---|
| Propagation speed | `fdtd.test.js` → "a pulse travels at c (within 1%) along the axis and the diagonal" |
| CFL stability | `fdtd.test.js` → "the 2-D limit is C = 1/√2", "random noise stays bounded for C ≤ 1/√2", "blows up just above the limit"; `fdtdSimulation.test.js` → unstable run is reported and stops, C = 0.7 stays stable |
| Boundary behaviour | `fdtd.test.js` → rigid edges conserve energy and reflect inverted; absorbing boundary leaves < 10⁻³ of the energy; wall cells stay zero and block the wave except at the slits |
| Wavelength consistency | `fdtd.test.js` → λ within 1% of c/f and 0.2% of the dispersion relation; dispersion converges at second order. `field.test.js` → the analytical field's phase advances 2π per λ |
| Interference maxima | `fdtd.test.js` → FDTD maxima where the path difference is a whole number of wavelengths; `interference.test.js` → bright and dark fringes at integer and half-integer path differences |
| Fringe spacing | `interference.test.js` → laser within 0.01% of λD/d; scales as λ, D, 1/d; small-angle vs near-field separation; dark fringes are unbiased. `fdtdSimulation.test.js` → FDTD spacing within 4% of the analytical model and converging |
| Single-slit envelope | `interference.test.js` → cos θ·sinc² within 0.01%, zeros at a sin θ = mλ, side lobes 4.72% / 1.65%, no zeros for a < λ. `fdtdSimulation.test.js` → FDTD single slit within 3% RMS of the analytical envelope |

Also tested:
- intensity = |U|², not |u|
- phase shift and φ = π
- amplitude scaling and fringe visibility
- missing orders
- cancellation-free optical phases
- the 2-D view agreeing with the screen calculation to 10⁻⁷
- refusing to draw unresolvable scales
- symmetric snapping of sources to grid rows (a real bug this caught: ±5 cm sources had landed at +4.8 / −5.2 cm)
- grid-size capping
- restart rules
