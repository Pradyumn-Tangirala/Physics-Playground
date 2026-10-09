# Architecture

Physics Playground is a static React single-page app. Each simulation is built from five layers, and each layer only depends on the layers below it:

```
PHYSICS MODEL      src/physics/      pure functions in SI units: equations, integrators, solvers
      ↓
SIMULATION STATE   src/simulation/   lifecycle definitions: init / step / sync, plus events
      ↓
ANIMATION LOOP     src/simulation/   one requestAnimationFrame chain per page, real elapsed time
      ↓
CANVAS RENDERING   src/rendering/    turns a state snapshot into pixels; never mutates state
      ↓
REACT UI           src/pages/, src/components/   parameters, buttons, layout, orchestration
```

Beside the simulation layer, `src/experiments/` describes what each lab can be configured with: parameter schemas (ranges, defaults, link names), experiment links, guided presets and model cards. It is pure data and functions, used by the pages. `src/utils/` is shared by every layer: unit conversion, clamping, validation, time stepping, formatting and CSV.

## Directory layout

```
src/
  physics/
    constants.js              named physical constants with units (standard gravity, air density, wave speeds…)
    integrators.js            explicitEuler, symplecticEuler, rk4: step(y, f, h, t) on state vectors
    elliptic.js               AGM, K(m), Jacobi sn/cn/dn: the exact pendulum solution
    analysis.js               period detector, relative energy error, errorAgainst (abs/rel error),
                              Hermite interpolation + crossing location
    projectile/               projectile.js (closed-form ideal model), drag.js (quadratic drag: derivative,
                              energy, exact 1-D solutions), flight.js (numerical flight + apex/landing events),
                              experiments.js (references, error measurement, convergence study), solver.js
    pendulum/                 pendulum.js (derivative, energy, small-angle + exact period, exactMotion θ(t)),
                              experiments.js (measurePeriod, periodVsAmplitude, accuracyVsCost), solver.js
    spring/                   spring.js (derivative, energy, exact solution for all damping regimes)
    waves/                    interference.js (analytical phasor sum, Fraunhofer formulas, fringe measurement
                              and fringeComparison),
                              field.js (2-D phasor field for the view), fdtd.js (finite-difference wave
                              equation solver), doubleSlit.js (worked "Calc" solution)
  simulation/
    useAnimationLoop.js       the only animation loop hook
    simulationState.js        createSimulation(): framework-free lifecycle controller
    useSimulation.js          React adapter: controller in a ref + loop + pause UI state
    projectileSimulation.js   idle → flying → landed; ideal / compare modes; predictFlights for previews;
                              flightReport (every step of every trajectory, for CSV)
    oscillatorSimulation.js   pendulum/spring, selectable integrator + Δt, period detection, phase history,
                              release tracking for the exact references, validation rows, log rows
    integratorComparison.js   the same pendulum through all three integrators in lock-step, each measured
                              against the exact solution (or RK4 at Δt/20 when damped), evaluation counts
    dataLog.js                start / stop / clear / sample; rows stored at the simulation's own steps
    dataLogStore.js           keeps the logs above the routes (one per lab and mode), so a remount does not lose them
    studies.js, runStudy.js   the long studies, run on a Web Worker (studyWorker.js) with a main-thread fallback
    useLiveValue.js           re-reads a value a few times a second for text readouts
    waveSimulation.js         analytical lab: accumulated display phase ωt
    fdtdSimulation.js         numerical lab: FDTD grid, sources, detector average, blow-up detection
  rendering/
    camera.js                 fitScale (auto-zoom)
    projectileRenderer.js     ground, grid, launch tower, predicted paths, trails, live readout; auto-scaling camera
    convergenceRenderer.js    log–log error vs Δt chart for the projectile convergence study
    oscillatorLayout.js       screen geometry shared by renderers and pointer hit-testing
    pendulumRenderer.js, springRenderer.js, oscillatorRenderer.js (graph + energy bars)
    colorThemes.js            theme → RGB, per-theme lookup table
    canvasSize.js             device-pixel-ratio support: beginFrame() draws in CSS px at full resolution
    charts.js                 small line/scatter chart (linear or log axes, clipping, legend)
    accuracyCostRenderer.js   work–precision diagram: error against derivative evaluations
    comparisonRenderer.js     three pendulums, ΔE/E₀ and angle-error charts, phase portrait with exact orbit
    periodExperimentRenderer.js  T/T₀ vs θ₀: exact curve, small-angle line, simulated points
    waveRenderer.js           analytical field → ImageData, screen chart with measurement cursor (render caches)
    fdtdRenderer.js           FDTD field → ImageData, detector chart vs the analytical model
  experiments/
    urlParams.js              schema-driven encode/decode of parameters ⇄ query string; rejects, never clamps
    labs.js                   the parameter schema of every lab (ranges, defaults, link names); experimentPath
    waveSetups.js             wave lab setups, media and slider ranges per regime
    presets.js                the eight guided experiments ("Look for" figures are tested)
    modelCards.js             equations, assumptions, units and limitations of every model
    useExperiment.js          read the experiment from the URL once; keep the address bar in step
    shownExperiment.js        which query each route is showing (tells page writes from navigations)
  components/
    ParamSlider.jsx           accessible slider + validated numeric field
    SimulationControls.jsx    control panel shell (inline card / right sidebar)
    SimulationCanvas.jsx      canvas whose backing store tracks CSS size × devicePixelRatio (capped at 2)
    ExperimentBar.jsx         guided-experiment picker, Copy Experiment Link, rejected-value notice
    ExperimentRoute.jsx       remounts a lab when the address changes to a different experiment
    ValidationPanel.jsx       analytical vs simulated, absolute and relative error
    DataLogPanel.jsx          start / stop / clear / export CSV for a data log
    DataLogProvider.jsx       session-wide log store; asks before a reload discards unexported rows
    ModelCard.jsx             renders a model card; ExplainerSections.jsx renders the longer explanations
    SimulateLink.jsx          "Simulate this" from a solver, or the reason it is not possible
    SolverPage.jsx            layout pieces shared by the three solver pages
    ScrollRegion.jsx          focusable, labelled horizontal scroller for wide tables
    ErrorBoundary.jsx         recovery screens (chunk-load failure, render error); no stack traces
    NumericalMethodsExplainer.jsx, ProjectileModelNotes.jsx, WaveModelNotes.jsx, FdtdNotes.jsx
    HomeButton.jsx, TiltCard.jsx, PhysicsBackground.jsx, useReducedMotion.js, download.js, chatbot/
  pages/                      one component per route (lazy-loaded except the landing page):
                              OscillatorLab, NumericalMethodsLab, ProjectileLab (+ projectile/ sections),
                              WaveInterferenceLab (+ waves/useScreenMeasurement), WaveEquationLab,
                              ProjectileSolver, PendulumSolver, DoubleSlitSolver, ExperimentsPage, LandingPage
  utils/                      math, units, validation, format, csv, timeStep (TIMESTEP_OPTIONS, maxStepsFor)
```

### Layer rules (checked with grep, see "Verification")
| Layer | May import | Must not |
|---|---|---|
| `physics/` | other `physics/` modules, `utils/` | React, Canvas, DOM, `window` |
| `simulation/*Simulation.js`, `simulationState.js` | `physics/`, `utils/` | React, Canvas |
| `simulation/use*.js` | React, `simulation/`, `utils/` | Canvas |
| `rendering/` | `physics/` (to evaluate the model at state.t), `simulation/` constants, `utils/` | React, mutating state |
| `experiments/` (except the `use*` hooks) | `physics/`, `simulation/` constants, `utils/` | React, Canvas, `rendering/` |
| `pages/`, `components/` | everything above | physics equations inline |

---

## Physics architecture

- **Pure and deterministic.** Every function maps inputs to outputs with no hidden state, no time source and no randomness. For example, `pendulum.step(state, params, h)` returns a new `{x, v}`, so the same inputs always give the same output, which the tests check.
- **SI units only.** Conversions such as px → m, degrees → radians and nm → m happen at the boundary, in the page or the simulation definition, using `utils/units.js`.
- **Shared model interface for the oscillators.** `pendulum.js` and `spring.js` both export `derivative(params)`, which returns f(y) for the state vector `y = [position, velocity]`, and `energy(y, params)`, which returns `{ ke, pe, total }`. `oscillatorSimulation.js` selects one with `modelFor(params)` and never branches on the formula itself. A new oscillator, such as a double pendulum or a driven oscillator, is one more module with the same two functions.
- **Integrators are separate from models.** `integrators.js` exports `explicitEuler`, `symplecticEuler` and `rk4`, all with `step(y, f, h, t)`. They know nothing about pendulums: the simulation passes `model.derivative(physics)` as `f`, and the selected integrator comes from `params.integrator`. Adding a method such as Verlet means adding one object here. Details, error analysis and measured results are in [NUMERICAL_METHODS.md](NUMERICAL_METHODS.md).
- **Closed-form models stay closed-form.** The ideal projectile is evaluated exactly at time `t` (`stateAt(launch, t)`); it is never integrated. The drag projectile, which has no closed form, uses the same integrators as the oscillators through `drag.derivative({ g, k })` on the state `[x, y, vx, vy]`; with k = 0 the same code integrates the ideal model, which is how numerical error is measured against the exact answer. Details in [PROJECTILE_MODEL.md](PROJECTILE_MODEL.md).
- **Two wave modules, never mixed.** The analytical model (`interference.js`, `field.js`) is time-harmonic: the complex field U is computed once per parameter change, the instantaneous value is `Re U·cos ωt + Im U·sin ωt`, and intensity is `|U|²`, so the simulation only advances ωt. The numerical solver (`fdtd.js`) steps the wave equation itself on a grid. The FDTD lab compares its detector line with the analytical model for the same geometry. Details and measurements are in [WAVE_MODEL.md](WAVE_MODEL.md).
- **Solvers** (`*/solver.js`, `waves/doubleSlit.js`) validate input with `utils/validation.js` and return either `{ error }` or `{ ...results, steps }`. Steps are un-numbered; the page numbers them when rendering.

---

## Simulation lifecycle

`simulation/simulationState.js` defines a small contract that every simulation follows:

| Lifecycle step | Where it happens |
|---|---|
| **initialize** | `definition.init(params) → state` when the page mounts (`createSimulation`) |
| **step** | `definition.step(state, params, dt, sample?) → event?` once per frame, mutating state, skipped while paused. `sample(t, data)` is called after every integration step; the pages use it for data logging |
| **sync** | `definition.sync?(state, params)` every frame, *even while paused*: keeps derived values (energies, the energy reference) consistent with the current parameters and with drag edits |
| **render** | the page's `render(state)` callback, which calls a renderer from `rendering/` |
| **pause / resume** | `controller.pause()` / `resume()`; `useSimulation` mirrors this in React state for the button label |
| **reset** | `controller.reset(params)` → `init(params)` again |
| **cleanup** | `useAnimationLoop` cancels its single pending frame on unmount; `SimulationCanvas` disconnects its `ResizeObserver`; components remove their listeners |

Events let a simulation tell the UI something happened without the UI polling state. For example, `projectileSimulation.step` returns `{ type: 'landed' }` once every trajectory has landed (or gone unstable), and the page re-enables its controls.

Actions specific to one simulation are plain functions that build or modify state, such as `launch(params)` for a projectile shot and `holdAt(state, x)` while dragging a pendulum. The page applies them through `simRef.current.setState(...)` or `getState()`.

---

## Render loop

```
requestAnimationFrame(tick)            ← exactly one chain per mounted page (useAnimationLoop)
  └─ tick(now)
       dt = frameDelta(now, last)      ← real seconds, clamped to MAX_FRAME_DT = 0.1 s
       callbackRef.current(dt)         ← latest callback from the most recent React render
         ├─ event = controller.tick(dt, params)
         │     ├─ if !paused: definition.step(state, params, dt)
         │     │     └─ advanceFixed(...)              ← fixed, user-selected h (oscillators default 5 ms,
         │     │                                          projectile 10 ms), accumulator, at most
         │     │                                          ⌈0.1 s × playback / Δt⌉ + 1 steps per frame
         │     └─ definition.sync?(state, params)
         ├─ if event: onEvent(event)   → React setState (rare: landing)
         └─ render(state, params)      → rendering/*: draw to canvas
       requestAnimationFrame(tick)
```

- **Timing** comes only from rAF timestamps. Nothing uses `setInterval`, `setTimeout` or `Date.now`, and there are no per-frame constants like `t += 0.02`.
- **Fixed-step physics** (oscillators, numerical projectile): the frame's `dt` (times the playback speed, for the projectile) goes into an accumulator, and the physics advances in exact steps of the selected Δt (0.5–100 ms, default 5 ms) with the selected integrator. The result is the same at 30, 60, 144 or 240 Hz. The per-frame step cap scales with Δt so small steps still keep up with real time; after a long stall the backlog is dropped instead of being simulated all at once.
- **Exact evaluation** (analytical projectile, analytical wave phase): closed-form models are exact at any time. The analytical projectile is evaluated at the same clock (`steps × Δt`) as the numerical shots flying beside it; the wave phase just adds `ω·dt` at a fixed display rate.
- **Fixed steps per frame** (FDTD): the wave-equation solver takes `stepsPerFrame` steps of its CFL-limited Δt each frame (slow motion), rather than tracking wall time; the frame's dt is ignored.
- **Resizing** is handled by `SimulationCanvas`, which uses a `ResizeObserver` to set `canvas.width/height` from its CSS box. It never touches simulation state and never starts a loop; the next frame simply draws at the new size.
- **Render-side caches** live inside renderers. The wave renderers keep the precomputed field, one `ImageData` buffer, an offscreen canvas and the colour lookup tables in a closure keyed by parameters and size; nothing is allocated per frame. These are memoization only and never feed back into the model.

---

## State management

| Kind of state | Lives in | Why |
|---|---|---|
| User-editable parameters (velocity, length, theme…) | React `useState` in the page | Shown in the UI; changing them should re-render controls |
| UI-only flags (`isFlying`, `isSidebarOpen`, `isDragging`) and experiment results (convergence study, period-vs-amplitude) | React `useState` | Drive what the UI shows |
| Paused flag | controller (authoritative) + React mirror (`isPaused`) | The loop reads the controller; the button label reads React |
| Simulation state (positions, velocities, `t`, history, accumulator, energy reference) | controller object held in `useSimulation`'s ref | Changes 60–240×/s; must not trigger renders; must survive renders |
| Render caches (wave field, `ImageData`, lookup tables) | renderer closure (`useState(createWaveRenderer)` / `createFdtdRenderer`) | Created once per page, keyed internally |
| Interaction bookkeeping (drag offsets, chat drag) | `useRef` | Needed across events, irrelevant to rendering |

**Avoiding stale closures.** `useAnimationLoop` stores the callback in a ref that's updated after every render, and the loop always calls `callbackRef.current`. The callback created in the latest render already closes over the latest `params`, `render` and `onEvent`, so a slider change reaches the next frame without restarting the loop or adding `params` to an effect's dependencies. This is the bug class that made Pause reset the old SHM lab.

---

## Data flow

```
user drags slider ──► ParamSlider.onChange(value) ──► page setState ──► re-render
                                                                      │
                                         new params object ◄──────────┘
                                                │ (captured by the latest loop callback)
next frame: controller.tick(dt, params) ──► state mutated in place ──► render(state, params) ──► pixels
                         │
                         └── event (e.g. landed) ──► onEvent ──► page setState ──► results card

user clicks Pause ──► controller.pause() + setIsPaused(true)
user drags bob   ──► pointer handler ──► holdAt(state, θ) (+ setLength/setStartAngle for the sliders)
window resizes   ──► ResizeObserver ──► canvas.width/height only
```

Data flows down (parameters → simulation → renderer). The only path back up is events and explicit actions.

### Experiment links (Phase 8)

```
opening #/shm?mode=pendulum&angle=40…
  └─ ExperimentRoute (key changes on navigation) ─► page mounts
       └─ useExperimentFromUrl(lab): decodeParams(schema, search) once ─► initial useState
            └─ rejected values ─► ExperimentBar alert (defaults kept, nothing clamped)

user changes a parameter ──► page setState ──► useExperimentUrl: 500 ms after the last change,
                             history.replaceState(#/shm?…new query), only if the address still
                             shows what this page wrote (otherwise the user has navigated: skip)

preset / Back / edited address ──► router location changes ──► ExperimentRoute sees a query the
                                    page did not write ──► remount ──► fresh state from the new URL
```

The page never merges a new URL into live state. A different experiment is a fresh mount with fresh initial conditions, which is what "open this experiment" means.

### Data logging and validation

```
integration step ──► definition.step calls sample(t, y) ──► recordSample(log, t, makeRows)
                                                              └─ only if logging and a sample is due
DataLogPanel: Start / Stop / Clear / Export ──► toCsv(metadata + header + rows) ──► download

every 250 ms: useLiveValue(() => validationRows(state, params)) ──► ValidationPanel
              (exact period / exact θ(t) / exact x(t) / energy at release vs the simulation)
```

Validation references are withdrawn, not faked, when they stop applying. If a physical parameter changes mid-motion, the exact solution no longer describes the motion: `sync` clears the release, and the panel says why the row is unavailable. A change while the bob is still held at its release point (no simulated time has passed, as during a drag) is a new release instead, so the outcome does not depend on whether React delivers the new parameters before or after the next frame.

The logs live in `DataLogProvider` (above the routes), not in the pages. A preset or the Back button remounts the lab with fresh state, but the log carries on: the simulation clock restarts at 0, so the next sample starts a new run number.

### Long studies (Web Worker)

```
Run button ──► runStudy(name, args) ──► one shared Worker (studyWorker.js) ──► STUDIES[name](args)
                    │                         integrators are sent by id; results are plain numbers
                    └─ no Worker / worker fails to load ──► the same function on the main thread
```

---

## Component architecture

- **Pages** (`pages/*`) own the parameters and wire one simulation definition and one renderer together through `useSimulation`. They contain no equations. Their initial parameters come from the URL (`useExperimentFromUrl`), and their slider ranges come from the lab schema in `experiments/labs.js`. `OscillatorLab` does pointer hit-testing with `rendering/oscillatorLayout.js`, using Pointer Events and `setPointerCapture` for mouse, touch and pen.
- **Routing:** `App.jsx` lazy-loads every page except the landing page, so the landing page downloads no simulation code. Each lab route is wrapped in `ExperimentRoute`. Every route is inside an `ErrorBoundary` that resets on navigation.
- **`ParamSlider`**: a native `<input type="range">` plus a numeric field.
  - *Accessibility:* the slider has a `<label htmlFor>`, an `aria-valuetext` with the unit, and a visible focus ring. The numeric field has an `aria-label`, plus `aria-invalid` and `aria-describedby` pointing at the inline error.
  - *Keyboard:* the slider supports ←/→/↑/↓ (one step), PageUp/PageDown and Home/End natively; the numeric field supports ↑/↓ and typing.
  - *Validation:* `utils/validation.validateBoundedInput` applies typed values live when they're in range, snapped to the step. Out-of-range values show an inline error and are clamped on Enter or blur; non-numbers revert; Escape cancels the edit.
- **`SimulationControls`**: the panel shell in two placements: an inline card in the page flow (projectile, wave and integrator labs) and a right sidebar (oscillators). Panel buttons share classes from `SimulationControls.module.css`.
- **`SimulationCanvas`**: a canvas whose backing store is its CSS box × devicePixelRatio (capped at 2). The ratio is recorded in `data-dpr`, and the canvas follows ratio changes through a `matchMedia` listener. Renderers call `beginFrame(ctx)` and draw in CSS pixels. The component passes pointer, keyboard and aria props through (the wave chart's measurement cursor uses them). The wave field itself is computed at reduced resolution into an offscreen `ImageData` and scaled up with `drawImage`, so labels stay sharp.
- **`HomeButton`**: uses `useNavigate('/')`, so it works under the GitHub Pages base path.
- **`PhysicsBackground`**: decorative; it also uses `useAnimationLoop` and scales particle motion by `dt`.

---

## Why React does not own the simulation timestep

1. **Rate.** Physics runs at 240 Hz and drawing runs at the display rate (60–240 Hz). Running these through React state would mean 60–240 reconciliations per second for data that only ever reaches a canvas.
2. **Correctness.** React batches and schedules renders. A simulation advanced in render or effect code would advance whenever React decides to render, not when time passes. Its speed would depend on unrelated re-renders, and pause/resume and frame-rate independence would be hard to guarantee.
3. **Effect lifecycles reset state.** Before Phase 1, the loop lived in a `useEffect` that depended on every parameter. Any slider change tore the loop down and rebuilt it with `time = 0` (Pause reset the pendulum), and resizes stacked duplicate loops. With a single loop created once and reading parameters through a ref, a parameter change is just data for the next frame.
4. **Testability.** The timestep logic (`advanceFixed`, `frameDelta`, `controller.tick`) is plain JavaScript and is unit-tested without a browser.

React still owns everything a human interacts with: parameters, buttons, panels and results.

## Why refs are used

- **The simulation controller** is held in a ref because it's mutable, changes every frame, and must keep its identity across renders. Putting it in state would trigger a render for every change; recreating it would lose the motion.
- **The loop callback** is held in a ref so the single long-lived rAF chain always calls the newest closure (see "Avoiding stale closures").
- **Canvas elements** are reached through refs because drawing is imperative.
- **Drag bookkeeping** (`dragRef`, chat drag offsets) is per-gesture state that the UI never displays.

Refs are never read during render to decide what JSX to output. The `react-hooks/refs` lint rule enforces this, and that's why slider handlers that restart the simulation go through named event handlers rather than closures stored in slider configs.

## Why Canvas instead of DOM/SVG for pixel-heavy rendering

- **The wave fields are per-pixel images.** At 1080p the analytical view at half resolution is about 800×540 ≈ 430k values per frame, and the FDTD grid is up to 250k cells. Canvas `ImageData` writes them straight into a typed array and uploads it once. Expressing that as DOM or SVG nodes would mean hundreds of thousands of elements, which isn't feasible.
- **Everything else redraws completely every frame** (trajectory, trail, bob, spring coils, graphs). With an immediate-mode canvas, each frame is just a function from state to pixels, which is exactly the renderer contract. DOM/SVG is retained-mode, so every frame would need diffing and attribute updates, which costs more and adds a second source of truth.
- **No layout or style recalculation** happens per frame on a canvas. SVG elements take part in layout, hit-testing and style resolution.
- **Trade-offs accepted:** canvas content isn't accessible to screen readers (each canvas has `role="img"` and an `aria-label`, and the numbers that matter are also in the DOM: sliders, results card, solver pages). Pointer hit-testing is done by hand using `oscillatorLayout.js`. The controls, panels and text remain ordinary React DOM, where accessibility and layout come for free.

---

## Adding a new simulation (the foundation for Phase 3)

1. **Physics:** add `src/physics/<model>/<model>.js` with pure functions in SI units, plus tests (invariants, analytic limits, energy).
2. **Simulation:** add `src/simulation/<model>Simulation.js` exporting `{ init, step, sync? }`, any actions, and events.
3. **Rendering:** add `src/rendering/<model>Renderer.js` exporting `render<Model>(ctx, state, params)`.
4. **Experiment schema:** add the lab's parameters to `experiments/labs.js` (range, default, link name, label), a model card to `experiments/modelCards.js`, and any guided presets to `experiments/presets.js`, with the numbers they quote added to `tests/validation/presets.test.js`.
5. **Page:** start from `useExperimentFromUrl(lab)`, keep parameters in `useState`, call `useSimulation(definition, params, { render, onEvent, onSample })`, and lay out with `SimulationCanvas`, `SimulationControls`, `ParamSlider` (fed by `sliderProps(field)`), `ExperimentBar`, `ValidationPanel`, `DataLogPanel` and `ModelCard`. Wrap the route in `ExperimentRoute` in `App.jsx`.

Phase 3 followed exactly this path: the integrator comparison is a new definition (`integratorComparison.js`), new renderers (`comparisonRenderer.js`, `charts.js`) and a new page. The loop, the lifecycle controller, `SimulationCanvas` and `ParamSlider` were reused unchanged.

Phase 4 did the same for the projectile: new physics modules (`drag.js`, `flight.js`, `experiments.js`), a rewritten definition and renderer, a new chart renderer, and the lab page. The integrators, the event location in `analysis.js`, the loop, the controller and the controls were reused; the only shared-code changes were a log x-axis and a legend position in `charts.js`, and moving `TIMESTEP_OPTIONS` / `maxStepsFor` into `utils/timeStep.js`.

Phase 5 added the wave modules the same way: new physics (`interference.js`, `fdtd.js`, a rewritten `field.js`), two simulation definitions, two renderers and two pages. The only shared-code changes were an intensity colour table in `colorThemes.js` and removing the left-sidebar placement of `SimulationControls` (and the `HomeButton` link variant) once the wave page no longer used them.

---

## Verification

Current test counts, coverage and measurements are in [TESTING.md](TESTING.md) and [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md). The layer rules above were re-checked with grep at the end of Phase 9: `physics/` imports only `physics/` and `utils/`; React appears in `simulation/` only in the `use*` hooks; `experiments/` no longer imports from `rendering/` (the oscillator range limits moved to `oscillatorSimulation.js`).

### Phase 2 record

- **Automated:** `npm run lint` reports 0 errors and 0 warnings. `npm run build` passes. `npm test` runs **101 tests in 11 files**, covering physics, utils, renderer math, and the lifecycle and simulation definitions:
  - pause freezes state, resume continues, reset re-initializes
  - projectile lands exactly at T, uses its launch snapshot, and has the same duration at 30 Hz and 144 Hz
  - graph sampling is frame-rate independent
  - E_ref is re-taken on parameter changes; `holdAt` syncs energy while paused
  - wave phase is frozen while paused or with the laser off
- **Layer boundaries** (grep): `physics/` has no React, Canvas, DOM or `window` references and imports only `physics/` and `utils/`. Only `useAnimationLoop.js` and `useSimulation.js` import React in `simulation/`. `rendering/` never imports React.
- **Manual, in the production build** (`vite preview` at `/Physics-Playground/`, rAF driven by a manual frame scheduler because the browser pane was hidden):
  - exactly one rAF loop on each simulation page, zero after leaving, unchanged after switching routes
  - all six Home buttons return to the landing page
  - SHM pause froze the bob for 120 frames, resume continued from it, and the pixel positions matched the Phase 1 build frame for frame
  - gravity and length changes are continuous; start angle restarts; mode switching keeps separate parameters
  - projectile wall time to land is 4.333 s at 30, 60, 144 and 240 Hz (expected 4.329); sliders are locked in flight; default and v=100/g=1 shots land at x = 860 px, inside the drawing area
  - wave: the main field animates, the screen and profile get one draw call and then none; theme changes redraw the screen; the laser toggle, the sidebar toggle (with `inert`) and the chatbot (wave page only) work
  - `ParamSlider` with real key presses: → ×3 gives 9.8 → 10.1, End gives 25; typing 30 shows "Must be between 1 and 25." with `aria-invalid`, and Enter clamps to 25; 12.34 applies live as 12.3; an empty field shows "Enter a number."; Escape reverts
  - viewport resize 1280×720 → 1000×640: the canvas backing store followed through `ResizeObserver`; the paused pendulum kept its angle (4.59°) and length; one loop afterwards; wave canvases became 340×320, 180×640 and 50×640 as expected; a resize mid-flight didn't restart the projectile (it landed after exactly 260 frames at 60 Hz, as computed)
