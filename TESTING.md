# Testing

Physics Playground is tested at four levels. Each level answers a different question:

| Level | Tool | Question it answers | Where |
|---|---|---|---|
| Physics and numerics | Vitest (Node) | Is the model right, and is the numerical method as accurate as theory says? | `src/physics/**/*.test.js` |
| Simulation and validation | Vitest (Node) | Does the lifecycle work? Are bad inputs always rejected? Do links, presets and solvers agree with the labs? | `src/simulation`, `src/rendering`, `src/utils`, `src/experiments`, `tests/validation` |
| UI behaviour | Vitest + React Testing Library (jsdom) | Do the controls, buttons and modes do what they say? | `tests/ui` |
| End to end | Playwright (Chromium, Edge, Firefox in CI, phone, tablet) | Does the real production build work in real browsers under its real base path? | `e2e/` |

Performance has its own suites (§6). Timings depend on the machine, so they never gate the ordinary test run.

## 1. Commands

| Command | What it runs |
|---|---|
| `npm test` | All Vitest projects: physics, simulation, validation, ui. **537 tests in 34 files, about 15 s.** |
| `npx vitest run --project physics` | One group (`physics`, `simulation`, `validation` or `ui`) |
| `npm run test:coverage` | The same, with coverage. Fails if a coverage floor is broken (§7). Report in `coverage/`. |
| `npm run test:e2e` | Playwright against the production build. Builds, starts `vite preview` under `/Physics-Playground/`, then runs 77 tests in each of 5 browser/device projects, plus 4 performance tests. With `E2E_PREBUILT=1` it serves the existing `dist/` instead of building (the deploy workflow uses this to test the artifact it publishes). |
| `npx playwright test --project=mobile` | One project: `chromium`, `firefox`, `edge`, `mobile`, `tablet` or `performance` |
| `npm run test:perf` | Before/after kernel benchmarks. Writes `test-results/perf-kernels.json`. |
| `npm run test:ci` | Lint, then tests with coverage, then E2E. **The single command for CI.** |

First-time setup for E2E: `npx playwright install chromium firefox` (Edge uses the installed Microsoft Edge).

`node scripts/coverage-by-layer.mjs` summarises the last coverage run per source layer.

## 2. Test groups

The Vitest groups are configured as *projects* in `vitest.config.js`, each with the right environment.

| Project | Environment | Tests | Contents |
|---|---|---|---|
| `physics` | node | 192 | Integrators, elliptic functions, pendulum (incl. the exact solution), spring, projectile (ideal, drag, flight, experiments), waves (interference, fringe comparison, field, FDTD), accuracy-vs-cost, solvers |
| `simulation` | node | 66 | Lifecycle controller, every simulation definition, data logging, verification readouts, exported data, the study runner (worker and main-thread fallback), renderer geometry |
| `validation` | node | 180 | Input validation across every solver; utilities and CSV; experiment-link encoding; presets; solver → simulation agreement |
| `ui` | jsdom | 99 | `ParamSlider`, `useSimulation`, every lab page, solver pages, routing, error boundary, links, presets, logging and export |
| E2E | 5 browser/device projects | 77 each + 4 | `chromium`, `edge`, `firefox`, `mobile` (Pixel 7), `tablet` (Galaxy Tab S4); then `performance` (serial, Chromium) |

### Physics, by your checklist

| Area | Covered by |
|---|---|
| **Projectile** | 45° is the maximum range (scan of 1°–89°), and the optimum is below 45° from a height; complementary angles give equal range; analytical trajectory, landing, apex and impact speed; numerical vs analytical (RK4 exact to round-off, Euler ±½gΔt·t); convergence orders; drag reduces range; higher C_d reduces range; parameter validation |
| **Pendulum** | Small-angle period (within 10⁻⁴); nonlinear period against the elliptic integral (within 10⁻⁸, 10°–170°); RK4 convergence (order 4.00 at 30°, and climbing towards 4 at 120°, §4); Euler drift; symplectic Euler bounded; RK4 conservation; damping removes energy; underdamped decay e^(−γt) and lengthened period; critical damping; overdamping |
| **Spring** | Analytical period; numerical period from zero crossings (within 10⁻⁸); damped period; energy (Euler grows, symplectic bounded, RK4 conserves); energy decay as e^(−2γt); critical and overdamped exact solutions |
| **Waves** | Wavelength (FDTD within 0.2% of its dispersion relation, measured −0.04%); propagation speed (within 1%); interference maxima (path difference = mλ); fringe spacing (laser within 0.01% of λD/d); single-slit sinc² envelope; FDTD stability; CFL limit exactly 1/√2; boundaries; FDTD against the analytical model |
| **Solver validation** | Every field of every solver against zero, negative, −10⁻³⁰⁰, NaN, ±Infinity, undefined, empty, non-numeric and overflowing text; inclusive range bounds; tiny and huge valid values must give finite results; garbage must never throw |

### UI, by your checklist

| Behaviour | Covered by (`tests/ui`) |
|---|---|
| Controls update | `ParamSlider.test.jsx` (slider, typing, out-of-range error with `aria-invalid`, clamp on Enter, revert on Escape or blur, disabled); every lab page changes a control and checks a readout |
| Pause / resume | `useSimulation.test.jsx` (state frozen, resumes from where it stopped); Oscillator Lab, Numerical Methods Lab and Wave Interference pages |
| Reset | Oscillator Lab (the frame after reset is identical to the frame after mount); Numerical Methods Lab (periods cleared); FDTD restart |
| Mode switching | Pendulum ↔ spring; projectile ideal ↔ compare; double ↔ single slit; wave presets |
| Solver validation messages | All three solver pages: `role="alert"` messages for bad input, and output for good input |
| Phase diagram | The Oscillator Lab draws "Phase space" with θ/ω axes; the Numerical Methods Lab draws all three methods' orbits |

### End to end, by your checklist

| Flow | Spec |
|---|---|
| Every route loads with no console errors and no failed requests | `routes.spec.js` |
| Home navigation: every landing-page button opens its page, and Home comes back | `routes.spec.js` |
| Simulation starts, pauses, resumes, resets | `simulations.spec.js`: the Oscillator, Numerical Methods, Wave and FDTD labs, plus a projectile shot landing |
| Parameters change correctly | `parameters-and-solvers.spec.js`: real arrow, End and typed input; projectile range; wave fringe spacing |
| Solver produces output | `parameters-and-solvers.spec.js`: all three solvers |
| Production base path | `routes.spec.js`: assets served from `/Physics-Playground/assets/`; deep link and reload work |
| Experiment sharing and export | `experiments.spec.js`: a link opens the exact experiment; changes reach the address bar and survive reload; presets and Back; clipboard (Chromium); CSV download; "Simulate this" |
| Production engineering | `production.spec.js`: code splitting, chunk-load failure recovery, not-found page, DPR-sized canvases |
| Input methods | `interaction.spec.js`: dragging the pendulum with mouse, touch and pen |
| Accessibility | `accessibility.spec.js`: axe-core WCAG 2.1 A/AA on every route, keyboard-only navigation, focus visibility, reduced motion |
| Layout | `responsive.spec.js`: no horizontal overflow on any route, stacked phone layout, 44 px touch targets |

### Experiments layer (Phase 8)

| Behaviour | Covered by |
|---|---|
| Links round-trip every lab's parameters exactly; malformed or out-of-range values are rejected with a reason, never clamped; ranges that depend on other parameters (the wave setup) | `src/experiments/urlParams.test.js` |
| Every preset opens exactly as written, and every number its "Look for" text quotes is what the model gives | `tests/validation/presets.test.js` |
| A solved problem opened with "Simulate this" gives the same analytical answer in the lab (one shared model); values the lab cannot show are reported | `tests/validation/presets.test.js`, `tests/ui/Experiments.test.jsx` |
| Data log: start, stop, clear, sampling interval, a new run after a reset, the row cap | `src/simulation/dataLog.test.js` |
| Validation readouts against the exact pendulum and spring solutions; withdrawn when a parameter changes mid-motion | `src/simulation/experimentData.test.js` |
| CSV: RFC 4180 quoting, full precision, metadata block; exported rows match the predicted flight | `src/utils/utils.test.js`, `src/simulation/experimentData.test.js` |

## 3. Physics validation methodology

Nothing is validated against the code itself (no "golden" numbers copied from a previous run). Every physics test compares the model with something independent:

1. **Closed-form solutions.**
   - the ideal projectile
   - spring motion in all three damping regimes
   - a vertical launch and a fall from rest with quadratic drag
   - the elliptic-integral pendulum period
   - Fraunhofer diffraction
2. **Conservation laws.**
   - energy in undamped systems
   - the work–energy theorem with drag (the drag work is integrated alongside the motion)
   - the FDTD scheme's conserved discrete energy (rigid edges, no source; float32 round-off only)
3. **Limits and symmetries.**
   - k → 0 recovers the ideal projectile
   - small angles recover T₀
   - complementary launch angles give equal range
   - φ = π darkens the centre of the pattern
   - θ = 0° and 90° give zero range
4. **Known numerical behaviour.** The tests check the *signature* each method should have, not just "small error":
   - Euler's energy grows by exactly (1 + ω²Δt²) per step.
   - Symplectic Euler preserves phase-space area (determinant 1).
   - Without drag, Euler lands exactly one step late.
   - RK4 reproduces degree-4 polynomials exactly.
5. **Cross-model checks.** Two independent implementations must agree:
   - the live simulation against the full-flight prediction (bit for bit)
   - the 2-D wave field against the screen calculation (to 10⁻⁷)
   - FDTD against the analytical phasor model (§4)

Tolerances come from the theory, not from what happened to pass. Where a result is *expected* to differ, the test asserts the difference: the ripple tank's 5% small-angle error, and FDTD fringes converging towards the analytical model.

## 4. Numerical convergence testing

**Observed order.** Run at Δt, Δt/2, Δt/4 … against a reference, and take log₂(e(Δt)/e(Δt/2)). The reference is either an exact solution or a much finer run that is itself checked for convergence: halving the projectile reference's step changes the range by 3×10⁻¹² m.

| Case | Expected | Measured |
|---|---|---|
| Euler / symplectic Euler | 1 | 1.00 |
| RK4, harmonic oscillator | 4 | 15.9–16.0× per halving |
| RK4, pendulum at 30° | 4 | 4.00 |
| RK4, projectile with drag | 4 | 4.05 |
| FDTD dispersion | 2 | ≈ 4× per halving of Δx |

**Error measure.** Errors are measured as a distance in phase space (position and velocity together). One component on its own can pass through zero at the chosen instant and fake a good or bad order; a first draft of the pendulum test did exactly that.

**Round-off floor.** Points below about 10⁻¹¹ × the problem size are excluded from order fits, and reported as "round-off only" rather than as a fake order.

**Pre-asymptotic regime.** At θ₀ = 120° RK4's observed order is 3.04, 3.58, 3.82, 3.92, 3.97 as Δt halves. The test asserts that it *climbs towards* 4, which is the true behaviour of a strongly nonlinear problem with large steps. It does not assert a constant 4 that would only pass with small steps.

**Stability limits.** These are tested on both sides: the FDTD CFL limit (stable at C = 1/√2, blows up at 0.71) and the projectile's stiff-drag limits (2k·v·Δt = 2 for the Euler methods).

## 5. How the UI and E2E tests observe a canvas

- **jsdom (UI tests).** jsdom has no canvas, so `tests/ui/setup.js` installs a *recording* 2-D context: every drawing call is stored. Tests assert what was drawn, for example "the frame after Reset issues exactly the same drawing calls as the frame after mount". For the wave fields, they hash the `ImageData` actually blitted.
- **Animation frames (UI tests).** `requestAnimationFrame` is replaced by a manual scheduler (`tests/ui/frames.js`), so a test chooses exactly how many frames run. It also counts live loops, which is how the tests check there is one loop per page and none after leaving.
- **Real browser (E2E tests).** Tests fingerprint the canvas pixels. The top and bottom 30 CSS px (scaled by the canvas's pixel ratio) are excluded because they show live frame-time numbers.
  - *Animating:* the fingerprint changes.
  - *Paused:* it stays identical for 600 ms.

## 6. Performance tests

| Test | What it measures | Result on the development machine |
|---|---|---|
| `npm run test:perf` | The pre-optimisation implementations (kept as baselines in `tests/perf/waves.perf.js`) against the current code, same inputs | Analytical field 2.7× faster (8.4× with wide slits); FDTD step 1.5×; blow-up check 6.1× (development machine). On the GitHub Actions runner the FDTD step measured 0.73×, so CI records these numbers without failing on them |
| E2E `performance` project: frame time | The wave renderers' own smoothed frame time, published on the canvas (`data-frame-ms`) | Analytical frame 1.67 ms, precompute 4.7 ms; FDTD 0.45 ms per step, 1.85 ms per draw |
| E2E: animation loops | `requestAnimationFrame` wrapped to count live loops across 3 rounds of 6 pages | Always exactly 1 |
| E2E: memory | JS heap after a forced garbage collection, before and after 20 navigation round trips (120 page changes) | +1.6 MB (budget 15 MB; the FDTD page alone allocates about 5 MB, so a leaked page would show at once) |

The performance tests run in their own Playwright project, after the functional tests and one at a time, because timing assertions fail when other workers load the CPU. An earlier, parallel draft failed for exactly that reason. The budgets are several times the measured values, and below the pre-optimisation numbers.

## 7. Coverage

Run `npm run test:coverage` (V8 provider). The HTML report is in `coverage/index.html`.

| Area | Lines | Branches | Functions | Floor enforced (lines / functions / branches) |
|---|---|---|---|---|
| `src/physics` | 99.7% | 93.4% | 99.4% | 95 / 95 / 88 |
| `src/simulation` | 97.2% | 89.6% | 97.1% | 92 / 92 / 80 |
| `src/utils` | 100% | 97.8% | 100% | 95 / 95 / 90 |
| `src/experiments` | 100% | 97.7% | 100% | 95 / 95 / 90 |
| `src/rendering` | 89.6% | 63.2% | 87.5% | — |
| `src/components` | 84.9% | 78.9% | 82.9% | — |
| `src/pages` | 81.3% | 72.5% | 77.2% | — |
| Whole project | 91.7% | 78.9% | 88.7% | — |

The floors cover only the code whose *correctness* the project depends on. Page components are covered by behaviour (UI and E2E tests), not chased to a percentage. The lowest-covered UI files are deliberate gaps (§9).

## 8. Bugs these tests found

Writing the tests surfaced real defects, each now fixed and pinned by a test:

- **Energy reference after Reset or drag.** It was captured one frame *after* release, so with explicit Euler about 0.07% of the drift was hidden. Found by the UI reset test; I confirmed the new unit tests fail without the fix.
- **Paused FDTD field.** It kept changing for about a second after pausing, because the auto-gain was still easing towards its target. Found by the E2E freeze test.
- **Ambiguous landing-page buttons.** All five were named "Launch" and "Calc". They now say which lab they open.
- Earlier phases found asymmetric source snapping, a bogus projectile "landing" at 180 000 m/s, and an aliased laser field view the same way.
- **Phase 7 (cross-browser and devices):**
  - Wide tables on phones scrolled but could not be reached by keyboard (axe).
  - Several colours failed contrast (axe).
  - Two helpers assumed device pixels equal CSS pixels, which only showed on high-DPR tablets.
- **Phase 8 (links):**
  - URL updates went through the router, so a pending update could land after the user clicked Home and pull them back into the lab (tablet run).
  - A pending update from one experiment could overwrite the address of the next one on the same route (phone run, Back button).
  - Each address write now checks that the address is still the one this page wrote.
- **Phase 8 (presets):** the "Nonlinear pendulum" preset used 150°, outside the Oscillator Lab's ±90° range. The preset test caught it before it shipped.

## 9. Known limitations

- **WebKit is not covered, and Firefox only in CI.** WebKit (Safari) is not in the Playwright projects. Firefox runs in CI, but its Playwright build does not start on the development machine (a Windows side-by-side configuration error), so it has not been run locally.
- **Some checks are Chromium-only by design.** The axe audit (one engine is enough), synthesised touch and pen (they need the Chromium DevTools protocol) and clipboard permissions are skipped in the other projects.
- **No pixel checks in jsdom.** UI tests check drawing *calls* and blitted buffers, not rendered pixels, so a canvas regression that issues the same calls with wrong styling would pass. The E2E fingerprints catch "nothing drawn" or "not animating", but there are no screenshot comparisons, which would be brittle across fonts and GPUs.
- **Interactions tested only end to end.** Dragging the pendulum bob is tested in the browser with mouse, touch and pen. It is not tested in jsdom, which has no layout. Chatbot dragging and the landing-page card tilt have no automated tests.
- **Machine-dependent timings.** The performance budgets are loose on purpose, and `test:perf` is not part of `test:ci`.
- **Untested at full scale.** The FDTD tests use small grids for speed. The full 500 × 301 lab grid is exercised by the end-to-end FDTD-vs-analytical tests (about 3 s) and by E2E.
- **No mutation testing.** Test strength is argued from §3 and §8 rather than measured.
