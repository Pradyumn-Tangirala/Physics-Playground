# Code quality

The conventions this codebase follows, and what the Phase 9 audit changed to meet them. [ARCHITECTURE.md](ARCHITECTURE.md) describes the structure; this document describes how code inside it is written.

## 1. Architecture principles

- **Dependencies point one way.** `physics → simulation → rendering → pages/components`. `experiments/` (parameter schemas, links, presets, model cards) sits beside `simulation/` and is used by pages. `utils/` is shared by all. A lower layer never imports a higher one. The layer rules are listed in ARCHITECTURE.md and are checked with grep (§ Verification there).
- **One model, used everywhere.** An equation is written once, in `src/physics/`. Solvers, simulations, verification panels, presets and tests all call that function. For example, `fringeSpacing()` in `interference.js` serves the double-slit solver, the wave lab, its verification panel and the tests. Before Phase 8 the solver had its own copy. `tests/validation/presets.test.js` checks that a solved problem and its simulation give the same answer. Because both call the same function, that test checks the hand-off of parameters through the link, not the physics; the physics is checked against independent references in the physics tests.
- **Pure where possible.** Physics, experiments (`urlParams.js`, `labs.js`, `presets.js`) and simulation definitions are plain functions on plain data. React lives only in pages, components and the `use*` hooks.
- **Single sources of truth.** A lab's parameter ranges, defaults and link names are in `experiments/labs.js`. Sliders, links, presets and "Simulate this" all read them, so they cannot disagree. Physical reference values are in `physics/constants.js`.
- **Extract by responsibility, not by size.** A component is split when it does several separable things (the projectile page's metrics table, validation section and convergence study are now three components). It is not split just to make files shorter.

## 2. Naming conventions

| Thing | Convention | Examples |
|---|---|---|
| Page components | What the page is called in the UI, ending in `Lab`, `Solver` or `Page` | `OscillatorLab`, `ProjectileLab`, `WaveInterferenceLab`, `DoubleSlitSolver`, `PendulumSolver`, `ExperimentsPage` |
| Other components | Noun, PascalCase, one component per file (plus small private helpers) | `ValidationPanel`, `DataLogPanel`, `ScrollRegion` |
| Hooks | `use` + what it provides | `useSimulation`, `useExperimentFromUrl`, `useScreenMeasurement`, `useLiveValue` |
| Physics functions | The physical quantity or operation, no `get`/`calc` prefixes | `exactPeriod`, `fringeSpacing`, `terminalSpeed`, `exactMotion` |
| Quantities with units | Unit suffix when the unit is not SI base, or when the UI unit differs | `lengthM`, `startAngleDeg`, `wavelengthNm` (solver input), `dt` (always s) |
| Constants | `UPPER_SNAKE_CASE` with the unit in the doc comment | `STANDARD_GRAVITY` (m/s²), `MAX_LOG_ROWS`, `URL_SYNC_DELAY_MS` |
| Event handlers | `handle…` for DOM events on the page, verb phrases for actions | `handlePointerDown`, `switchMode`, `restartWith`, `exportReport` |
| CSS | CSS Modules, camelCase class names describing the role | `styles.canvasCard`, `controls.actionButton`, `styles.chartLarge` |

Route paths were kept as they were (`/simulation`, `/problems`, `/shm`) because experiment links and the deployed site already use them. The components behind them have the consistent names above.

## 3. Physics coding conventions

- **SI units inside the physics layer, always.** Conversion happens at the boundary with `utils/units.js`, for example degrees in a slider becoming radians in `initialPosition()`.
- **Every physical constant is named, has a unit and says where it comes from**, in `physics/constants.js`:

  | Constant | Value | Unit | Meaning |
  |---|---|---|---|
  | `STANDARD_GRAVITY` | 9.81 | m/s² | standard gravity to 3 s.f. |
  | `SEA_LEVEL_AIR_DENSITY` | 1.225 | kg/m³ | ISA, 15 °C |
  | `SMOOTH_SPHERE_DRAG_COEFFICIENT` | 0.47 | — | Re ≈ 10³–2×10⁵ |
  | `BASEBALL` | 0.145, 0.0042 | kg, m² | mass, cross-section |
  | `SPEED_OF_LIGHT` | 2.998×10⁸ | m/s | vacuum |
  | `SPEED_OF_SOUND_AIR` | 343 | m/s | dry air, 20 °C |
  | `RIPPLE_TANK_WAVE_SPEED` | 0.25 | m/s | shallow water waves |

  Model-specific constants stay with their model, documented the same way, for example `BOB_MASS` (kg) in `pendulum.js`.
- **The model's equation and assumptions open the file.** Each model file starts with the governing equation and its assumptions. For example, `pendulum.js` opens with θ″ = −(g/L)·sin θ − 2γθ′, and states a point mass, a rigid rod and viscous damping. The same content is shown to users through `experiments/modelCards.js`.
- **Exact references are separate functions** (`exactPeriod`, `exactMotion`, `spring.exactPosition`, `flightSummary`), so validation never compares a method with itself.
- **Formula coefficients stay literal.** The ½ in ½mv², or the 4 in 4√(L/g)·K, is part of the formula and is not given a name. Tuning values are named: `SOURCES_PER_WAVELENGTH`, `BISECTION_STEPS`, the `SCREEN` layout factors.

## 4. Numerical coding conventions

- **Integrators know nothing about models.** Every method is `step(y, f, h, t)` on a state vector. A model supplies only `f`.
- **Fixed steps, an accumulator and a cap.** Simulations advance in exact steps of the selected Δt (`utils/timeStep.advanceFixed`), independent of frame rate, and drop any backlog after a stall instead of spiralling.
- **Time is counted in steps where it matters.** In `flight.js`, t = steps·h, so the analytical and numerical runs are compared at exactly the same instants.
- **Every tolerance is explained.** It says why it has its size. For example, `REVERSAL_TOLERANCE` (m/s) separates a real sign reversal from round-off, and `TIME_EPSILON` stops a sample at t = 0.03 being skipped as 0.0299999.
- **Stability is detected, not assumed.** Diverged runs are flagged (`flight.diverged`, FDTD blow-up events) and shown as "unstable" or "blew up", never as numbers.
- **The error measure is stated wherever an error is shown:** absolute or relative, and relative to what. For example, θ(t) error is relative to θ₀ because θ passes through zero (`errorAgainst(reference, simulated, scale)`).
- **Cost is counted in derivative evaluations**, which is machine-independent. Wall-clock times are reported as measurements of this run, with their averaging method (`secondsPerRun` repeats a run until 5 ms have passed).

## 5. Rendering conventions

- **Renderers are functions from state to pixels.** They read simulation state and never write it. Render-side caches (wave field, `ImageData`, colour tables) live in a renderer closure created once per page.
- **CSS pixels in, device pixels out.** Every renderer starts with `beginFrame(ctx)`, which applies the device-pixel-ratio transform, so drawing code never multiplies by DPR.
- **One animation loop per page** (`useAnimationLoop`), driven by rAF timestamps. Readouts that change every frame reach React at most four times a second (`useLiveValue`), never per frame.
- **Static styles go in CSS Modules.** Inline `style` is kept for values that come from data:
  - a method's colour, so the table matches the canvas line
  - per-lab accent colours passed as CSS variables
  - dynamic geometry (the chat window's position)
- **Charts are composed from small drawing functions** in `charts.js`: frame, ticks, labels, series, legend. Spacing constants are named.

## 6. Testing conventions

- **Test against something independent.** Use closed forms, conservation laws, limits and symmetries, or a second implementation. Never a number copied from a previous run.
- **Tolerances come from theory.** A tolerance says what it is derived from, for example "RK4 at Δt vs Δt/20: the difference is RK4's own error".
- **Numbers quoted to users are tested.** Every figure in a preset's "Look for" text is checked by `tests/validation/presets.test.js`.
- **UI tests act like a user**, through roles and labels (React Testing Library). Canvas output is checked through the recording context, and time through the manual frame scheduler.
- **E2E runs the production build under its real base path**, in Chromium, Edge, Firefox (in CI), a phone and a tablet.
- **A test that found a bug stays**, with a comment naming the bug.

See [TESTING.md](TESTING.md) for commands, counts and coverage.

## 7. Phase 9 audit: what changed

| Finding | Change |
|---|---|
| Three solver pages each repeated the same layout in 15–22 inline styles, one with an injected `<style>` tag | `components/SolverPage.jsx` (page, card, field, result tiles, steps) with a CSS module; the pages shrank to their inputs and results |
| The FAQ helper styled itself with inline styles and a `<style>` tag | `Chatbot.module.css`; named `MAX_QUESTION_LENGTH`, `FAB_START_INSET` |
| Four explainer components repeated the same render code | `ExplainerSections` |
| `ProjectileLab` was 434 lines doing four things | Split into `FlightMetrics`, `NumericalValidation`, `ConvergenceStudy` and `useConvergenceStudy` (page now 228 lines) |
| Fringe-table physics computed inside the wave page | Moved to `interference.fringeComparison()`, with tests; the cursor and marker logic became `useScreenMeasurement` with named constants |
| `drawChart` was one 150-line function with section comments | Split into `chartFrame`, `drawXTicks`, `drawYTicks`, `drawLabels`, `drawSeries` and `drawLegend`; tick spacings and dash patterns named |
| Inconsistent page names (`SHMSimulator`, `ProblemSolver`, `ProjectileProblemSolver`) and headings (`PHYSICS SOLVER`) | Renamed to `OscillatorLab`, `DoubleSlitSolver`, `ProjectileSolver` and so on; the heading is now "Double-Slit Solver"; every solver button reads "Calculate" |
| Gravity defaulted to 9.8 in some labs and 9.81 in others; reference values were unexplained literals | `physics/constants.js`; every default is now `STANDARD_GRAVITY` (gravity sliders step 0.01 m/s²) |
| `PENDULUM_MASS` was defined twice | `pendulum.BOB_MASS` |
| Wave speeds were duplicated between the FDTD page, the lab schema and the wave media | `WAVE_MEDIA` and `FDTD_MEDIA` built from the constants |
| 27 exports were used only inside their own module | Made module-private. None were dead code; every one has an internal use |
| Static inline layout styles in the lab pages (canvas heights, button padding, link colours) | Classes in `LabPage.module.css` and `SimulationControls.module.css`; link colour set globally (the old Vite default, #646cff, had low contrast) |
| A leftover `// Force Update 2` comment in `main.jsx`; route comments that restated the routes | Removed |
| The URL sync navigated through the router, so a pending update could land after the user had left the page (found by the tablet E2E run) | Writes the history entry directly and checks the address first; documented in `useExperiment.js` |

Not changed, on purpose:
- **Formula coefficients and canvas drawing offsets** stay literal. They are clearer inline than as names.
- **Route URLs** keep working links.
- **The long explanatory comments in the physics files.** They state assumptions and numerical decisions, which is what comments are for.
