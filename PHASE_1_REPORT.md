# Phase 1 Report: Bug Fixes and Stability

> **Note:** Phase 2 reorganized the source tree. The file paths below are the Phase 1 locations; see [ARCHITECTURE.md](ARCHITECTURE.md) for the current layout. For example, `src/hooks/useAnimationLoop.js` is now `src/simulation/useAnimationLoop.js`, and `src/physics/oscillators.js` is split into `src/physics/{integrators,pendulum/pendulum,spring/spring}.js` plus `src/utils/timeStep.js`.

**Branch:** `phase-1-stability` (uncommitted working tree, based on `main` @ `bc0c278`)
**Scope:** fix the confirmed bugs and reliability issues from the project evaluation. No new physics features.

## Summary

| Check | Before | After |
|---|---|---|
| `npm run lint` | 17 errors, 2 warnings | **0 errors, 0 warnings** |
| `npm run build` | passes | **passes** |
| `npm test` | no test runner | **76 tests passing** (Vitest, 5 files) |
| Production dependency audit (`npm audit --omit=dev`) | 2 high (react-router) | **0 vulnerabilities** |
| `window.location.href` in `src/` | 3 | **0** |
| rAF loops per simulation page (measured) | 1–N (grew with every resize) | **exactly 1**, 0 after leaving the page |
| Home buttons under `/Physics-Playground/` | 3 of 6 went to a 404 | **6 of 6 return to the landing page** |

---

## Bugs fixed

### 1. Production Home navigation (B1)
- **Root cause:** `ProjectileSimulator`, `SHMSimulator` and `WaveInterference` used `window.location.href = '/'`. That does a full page load of the domain root, ignoring both Vite's `base: "/Physics-Playground/"` and the HashRouter. On GitHub Pages this went to `pradyumn-tangirala.github.io/`, which is a 404 (confirmed on the live site before the fix). In dev it worked by accident, because `/` is the app root there.
- **Fix:** All three now use the router: `const navigate = useNavigate(); … navigate('/')`. The other three pages already did this.
- **Files:** `src/ProjectileSimulator.jsx`, `src/SHMSimulator.jsx`, `src/WaveInterference.jsx`

### 2. Animation loop architecture (B3, plus the root cause of B2 and B4)
- **Root cause:** Each simulation's loop lived inside a `useEffect` that depended on every parameter. Any slider change, pause or drag tore down the loop and rebuilt it with `time = 0`. On top of that:
  - The Projectile page scheduled `render` twice on start (from `resizeCanvas()` and again from an if/else with identical branches). That made two chains sharing `t`, so flight ran at double speed.
  - Every window resize mid-flight added another chain.
  - `animationId` only held the newest frame id, so cleanup left orphaned loops running with stale values.
  - The SHM page did the same while paused.
- **Fix:** A new shared hook, `src/hooks/useAnimationLoop.js`:
  - It creates **one** `requestAnimationFrame` chain per component, in an effect with `[]` dependencies, and cancels that single pending frame on unmount.
  - It calls the latest callback (stored in a ref) with real elapsed time `dt` in seconds, clamped to 0.1 s so returning from a background tab doesn't cause a huge jump.
  - Re-renders never restart the loop.
  - `useFullWindowCanvas` handles resizing. It only changes the canvas pixel size and never touches simulation state.
  - Simulation state now lives in refs (`simRef`, `cacheRef`), separate from React render state.
- **Files:** `src/hooks/useAnimationLoop.js` (new), all three simulators

### 3. SHM pause/resume (B2)
- **Root cause:** `isAnimating` was an effect dependency, so clicking Pause re-ran the effect, set `time = 0` and wiped the graph. "Pause" was really "reset and freeze". Every other slider did the same.
- **Fix:**
  - The oscillator state `{x, v}`, the integrator accumulator, the graph history and the energy reference all live in `simRef`.
  - Pause stops advancing the state; the loop keeps drawing the frozen frame. Resume continues from exactly that state.
  - Changing L, g, k, m or damping applies to the motion in progress.
  - Only the *initial-condition* controls (start angle / amplitude) restart from rest, which the UI now explains. There's also an explicit ↺ Reset button.
- **Files:** `src/SHMSimulator.jsx`, `src/physics/oscillators.js` (new)

### 4. Projectile simulation (B4, B5, frame-rate dependence)
- **Root causes:**
  - `t += 0.02` per frame (doubled by the duplicate loop), so speed depended on the display's refresh rate.
  - `t` belonged to the effect, so moving a slider mid-flight restarted the shot.
  - A fixed 5 px/m scale put the default landing point at x = 1,887 px, off-screen on most displays. At v=100, g=1 the range is 10 km, or 50,000 px.
  - Landing was detected one frame late, so the HUD showed an overshoot position that disagreed with the results card.
- **Fix:**
  - `sim.t += dt × playbackSpeed` uses real elapsed time. A visible "Playback speed" selector (0.5×–10× real time, default 2×) keeps long flights watchable; the HUD shows simulated time.
  - Fire snapshots the launch parameters. The sliders are **disabled during flight**, and the Fire button becomes ■ Stop.
  - The ball lands exactly at the analytic flight time T, so the HUD, ball position and results card all agree.
  - **Auto-scaling camera:** `fitScale(range, maxHeight, availableWidth, availableHeight)` fits both the next shot's preview and the active/landed shot into the area left of the control panel. Axis ticks in metres use 1/2/5×10ⁿ steps, so the changing scale stays readable.
  - The motion trail is now a recorded path instead of a translucent-clear smear.
  - The predicted path is sampled exactly from 0 to T.
- **Files:** `src/ProjectileSimulator.jsx`, `src/physics/projectile.js` (new)

### 5. Pendulum (B6, B7, B8, B10)
- **Root causes:**
  - `amplitude` defaulted to 100, the spring's pixel value, and was read as 100° in pendulum mode, outside the ±90° control (the slider showed 90, the number box 100).
  - The graph plotted radians as pixels, so a 30° swing moved the line ±0.5 px.
  - The motion used the small-angle formula, while PE used the exact `mgL(1−cos θ)`. Displayed KE reached 1.23× the total energy at 90° and 1.30× at the 100° default, and `safeMax` hid the overflow.
  - "Damping" was a decaying envelope with no frequency shift, and the velocity ignored the envelope's derivative.
- **Fix:**
  - Separate default per model: pendulum start angle 30°, spring amplitude 100 px.
  - Motion is now integrated from state with fixed-step RK4 (Δt = 1/240 s, plus an accumulator), using the **full nonlinear equation** θ″ = −(g/L)·sin θ − 2γθ′. KE = ½m(Lθ′)² and PE = mgL(1−cos θ) are therefore consistent. Measured energy drift stays below 10⁻⁶ over 30 s at 90° amplitude (see tests).
  - Damping is a real damping term, with γ in s⁻¹ shown in the UI.
  - Energy bars are scaled to `E_ref`, the energy at release or at the last parameter change. **There is no clamping**: a value above E_ref would visibly overshoot its track. A third bar shows E = KE + PE, with a numeric "E = … J, …% of E_ref" readout.
  - The graph samples on simulated time (30 Hz, 10 s window), converts to degrees (or px for the spring), and auto-scales to the visible peak with a ±value label.
- **Files:** `src/SHMSimulator.jsx`, `src/physics/oscillators.js`

### 6. Spring mode (B11, shared state)
- **Root cause:** The gravity slider had no effect in spring mode. Pendulum and spring shared one `amplitude` state with different units (degrees vs px).
- **Fix:**
  - Gravity appears only in pendulum mode, with a note: for a vertical spring measured from equilibrium, gravity only shifts the equilibrium point.
  - Separate state: `startAngle/length/gravity` for the pendulum, `amplitude/mass/k` for the spring. The unused `springMntY` variable is removed.
  - The spring uses the same RK4 integrator (x″ = −(k/m)x − 2γx′).
  - Shadow and fill styles no longer leak between drawing steps.

### 7. Wave simulation (B9, labels)
- **Root cause:** The "screen" and "DIFFRACTION INTENSITY" graph showed the *instantaneous* |amplitude| at the right edge, so they flickered every frame. A real screen records the time-averaged intensity ⟨u²⟩. Also, "Frequency" only changed the wavenumber (ω was fixed), and hover labels like "DOUBLE SLIT" appeared even with the barrier off.
- **Fix:**
  - The field is written as u(t) = P·cos ωt − Q·sin ωt, with P = Σwᵢ·sin aᵢ and Q = Σwᵢ·cos aᵢ computed once whenever the parameters or size change (`src/physics/waves.js`).
  - The screen and profile show **⟨u²⟩ = (P²+Q²)/2**, normalized to the brightest point, and are redrawn only when the field or theme changes. Verified: no pixel changes across 90 frames, while the main field animates.
  - Side effect: each frame now needs 2 multiplies and a color-table lookup per pixel, instead of 2× sqrt, atan2, cos, pow and sin. The two duplicated ~45-line theme switch blocks became one `themeColor()` plus a per-theme lookup table, which also fixed the 12 `no-case-declarations` lint errors.
  - ω = c·k, so "Frequency" now changes temporal frequency and wavelength together at a fixed wave speed. Time advances by real `dt`, and the phase continues across parameter changes.
  - New labels: "Slit/Source Separation (relative)", "Frequency (relative)", "Phase Shift of Slit 2 (°)", "TIME-AVERAGED INTENSITY (I / Iₘₐₓ)", plus a legend explaining the main view (instantaneous |u|) versus the screen (⟨u²⟩).
  - Hover labels appear only in barrier mode. Number inputs are clamped to their ranges.
- **Files:** `src/WaveInterference.jsx`, `src/physics/waves.js` (new)

### 8. Chatbot (B12, "AI" claim, placement)
- **Root cause:** `query.includes('hi')` matched "t**hi**s", "w**hi**ch" and "t**hi**nk", so "What is this?" got a greeting. It was presented as "Speed, your AI physics assistant", used a fake 1–1.5 s "typing" delay, and was mounted on every route even though it only knew Wave Lab topics.
- **Fix:**
  - Rules live in `src/chatbotLogic.js` as whole-word regexes (`\b…\b`) with word forms (`interfer\w*`, `slits?`, `colou?rs?`), checked in priority order so topic words win over greetings.
  - Renamed to "Wave Lab Help", described as a keyword-based FAQ and "not an AI". The fake delay is gone.
  - Mounted only on `/simulation`.
- **Files:** `src/Chatbot.jsx`, `src/chatbotLogic.js` (new), `src/App.jsx`

### 9. Chat window (B13)
- **Root cause:** The window was positioned `right:0; bottom:80px` relative to the floating button, so dragging the button toward the top-left pushed the window off-screen. Drag state was stored by mutating `e.target.dataset`. Global `mousemove`/`mouseup` listeners depended on stale closures.
- **Fix:**
  - `chatWindowRect()` places the window above the button, or below if there's no room, clamps it inside the viewport, and shrinks it on small screens. It's unit-tested at all four corners and on a 320×480 viewport.
  - Dragging uses Pointer Events with `setPointerCapture`, which works for mouse, pen and touch. Interaction state lives in a ref. A press counts as a drag after 5 px of movement, so a plain click or a keyboard Enter toggles the window.
  - The button is now a real `<button>` with an aria-label, and the closed window is `inert`, so its hidden input can't be reached with Tab.
  - Message ids come from a counter instead of `Date.now()`.

### 10. Problem solvers (B14)
- **Root cause:**
  - The fringe-width solution jumped from step 4 to "6.", because steps were hand-numbered and a "6." step was appended to every problem type.
  - `borderRadius: 8px` inside a CSS string is invalid CSS and was silently ignored.
  - There was no input validation: d=0 gave `Infinity`, L<0 gave `NaN`, g=0 gave `Infinity`. `Number('')` silently turned empty fields into 0.
  - Solver pages overflowed horizontally (`width:100vw` plus padding with no `box-sizing`).
- **Fix:**
  - Calculations moved into pure functions in `src/physics/solvers.js`. They return either `{ error }` or a result with *un-numbered* steps, and the pages number the steps when rendering (`<ol>`), so numbering can't skip.
  - Validation: positive λ, d, D, v and g; 0 ≤ θ ≤ 90; maxima order is an integer ≥ 0 (n = 0 is the central maximum); minima order is an integer ≥ 1.
  - Inputs are kept as text and parsed on Calculate.
  - CSS moved into valid class rules.
  - The pendulum solver notes the limit of the small-angle approximation (within 1% up to about 23°).
- **Files:** `src/ProblemSolver.jsx`, `src/ProjectileProblemSolver.jsx`, `src/SHMProblemSolver.jsx`, `src/physics/solvers.js` (new)

### 11. PhysicsBackground (B15)
- **Root cause:**
  - Anonymous window `mousemove`/`mouseout` listeners were never removed, so each landing-page visit leaked a pair.
  - The connection loop started at `j = i`, pairing each particle with itself.
  - Mouse repulsion divided by distance even when it was 0, producing NaN particles.
  - Particles left outside a shrunken canvas jittered.
  - A `class` declared inside the effect triggered a lint warning.
- **Fix:** Named handlers that are removed on cleanup; `j = i + 1`; a `distance > 0` guard; positions clamped on bounce; `Particle` moved to module scope with named constants.

### 12. React architecture (B16)
- **Root cause:** `useTilt` and `TiltCard` were defined inside `LandingPage`, giving them a new component identity on every render. `expandedTopic` was dead state.
- **Fix:**
  - `topics`, `useTilt` and `TiltCard` moved to module scope, dead state removed, unused `React` imports removed.
  - `// Force Update 2` removed from `App.jsx`.
  - Inaccurate copy corrected: "quantum nature of light", "orbital mechanics", "Phase Diagrams", "high-precision physics engines", and the typos "constructve" and "Scrolldown".

### 13 & 14. Lint and build
- `npm run lint` reports 0 errors and 0 warnings. `npm run build` passes.
- Removed the untouched Vite template folder `wave-sim/` (13 files, including a 2.9k-line lockfile) and the unused `src/assets/react.svg`.
- Renamed the package and page title from `wave-interference-demo` to `physics-playground` / "Physics Playground".
- Ran `npm audit fix`: react-router-dom 7.12 → 7.18.4, vite 7.3.1 → 7.3.7.

### Additional issues found and fixed during implementation
- The projectile HUD and results card disagreed (overshoot frame vs analytic values).
- Pendulum `shadowBlur` leaked onto the pivot; the spring support was drawn with a leftover `fillStyle`.
- The wave main canvas allocated a new `ImageData` every frame (about 0.7 MB at 720p, 1.7 MB at 1080p); the buffer is now reused.
- The trails toggle and chat buttons were emoji-only with no accessible label.

---

## Validation performed

### Automated
- **`npm run lint`:** 0 problems.
- **`npm run build`:** passes (bundle 301 KB, 94 KB gzipped).
- **`npm test`:** 76 tests across 5 files:
  - `solvers.test.js`: β = λD/d; maxima nλD/d including n = 0; minima (n−½)λD/d; step numbering; projectile R/H/T against the closed form; complementary-angle range symmetry; pendulum period; rejection of 15 invalid inputs; ordinal suffixes; empty-input parsing.
  - `projectile.test.js`: lands at (R, 0) at time T; apex at T/2; R(45°) = v²/g; θ = 0/90° edge cases; **camera fit for default and extreme valid values** (v=100/g=1 at 45° and 90°, v=10/g=25 at 0° and 89°); default shot no longer off-screen; tick-step selection.
  - `oscillators.test.js`: small-angle period within 0.1% of 2π√(L/g); **90° period = 1.18034·T₀** (elliptic integral); **energy drift < 10⁻⁶** (pendulum, 90°, 30 s) and < 10⁻⁸ (spring, 20 s); **KE never exceeds release energy** (regression test for B8); damped spring matches the analytic underdamped solution to 10⁻⁸; **accumulator is frame-rate independent** (60 Hz vs 144 Hz); zero elapsed time means no motion (pause); catch-up cap.
  - `waves.test.js`: (P²+Q²)/2 equals the numerical time average of u²; screen symmetric for in-phase slits; bright center at 0°, **dark center at 180°**; screen deterministic (no time dependence); wall mask has exactly two openings; color-table endpoints.
  - `chatbotLogic.test.js`: "What is this?", "which one", "I think so" are **not** greetings; topic beats greeting; word forms; honesty answer; fallback; window stays inside the viewport at four corners plus mid-screen, and on a phone viewport.

### Production build in the browser
I ran `vite preview` on `http://localhost:4173/Physics-Playground/#/…`, which uses the same base path and HashRouter setup as GitHub Pages. Because the browser pane was hidden, which pauses `requestAnimationFrame`, I replaced it with a manual frame scheduler and pumped frames at chosen rates. That makes these checks exact rather than timing-dependent.

| Check | Result |
|---|---|
| Home button on all 6 routes | all go to `/Physics-Playground/#/` and show the landing page |
| Live rAF loops: Projectile / SHM / Wave / Landing, idle | 1 / 1 / 1 / 1 |
| …after 5 resize events | 1 / 1 / 1 / 1 |
| Projectile mid-flight, after 5 resizes | 1 |
| After switching routes back and forth | 1; 0 on pages without a simulation |
| Projectile wall time to land at 30 / 60 / 144 / 240 Hz (2× speed, T = 8.66 s) | 4.33 / 4.33 / 4.38* / 4.33 s (*10-frame pump granularity) |
| Results card (v=60, θ=45°, g=9.8) | H 91.84 m, R 367.35 m, T 8.66 s (matches closed form) |
| Sliders during flight / after landing | disabled / re-enabled |
| Landing ball x on a 1280 px canvas: default and v=100/g=1 | 860 px for both (exactly the right edge of the drawing area, left of the panel) |
| SHM defaults | start angle 30 (number box and slider agree), length 200, g 9.8, γ 0 |
| SHM pause: bob position at pause, after 2 s paused, after 3 resizes | identical (472.2, 298.0) |
| SHM resume, one frame later | (468.6, 298.4): continues, not reset to the start (547.5, 272.7) |
| Gravity changed mid-swing | bob moves 3 px (continuous), no snap back |
| Wave: main field / screen / profile over 90 frames | animates / unchanged / unchanged |
| Wave: brightest screen row (phase 0) | row 360 of 720 (center) |
| Chat button present on `/`, `/projectile`, `/shm`, `/problems`, `/simulation` | only `/simulation` |
| Chat answers to "What is this?", "which one" | fallback, not a greeting |
| Real pointer drag of the chat button to the top-left corner | button clamped at (10, 10); window flips below it, `left 10, top 90, bottom 592` inside 1280×720; drag didn't toggle; a plain click closes it (`inert` when closed) |
| Solver pages | steps numbered 1–5 with no gaps; d=0, g=0 and empty L show error messages; invalid CSS gone |

### Code searches
- `window.location` / `location.href` in `src/`: **none**.
- `requestAnimationFrame`: only in `useAnimationLoop.js` (one chain, used by all three simulations) and `PhysicsBackground.jsx` (one chain with matching cancel). No other loops.
- `addEventListener` vs `removeEventListener`: balanced in every file (Chatbot 1/1, LandingPage 2/2, PhysicsBackground 3/3, hook 1/1).
- Timing literals (`+= 0.0x`, `time +=`, `setTimeout`, `setInterval`, `Date.now`): **none**. Simulation timing now comes from named constants: `MAX_FRAME_DT = 0.1 s`, `FIXED_DT = 1/240 s`, `MAX_STEPS_PER_FRAME = 60`, `GRAPH_SAMPLE_DT = 1/30 s`, `WAVE_SPEED`, `PLAYBACK_SPEEDS`.
- Unused exports: none. Constants used only inside `waves.js` and the hook were un-exported.

---

## Files changed

**New:** `src/hooks/useAnimationLoop.js`, `src/physics/projectile.js`, `src/physics/oscillators.js`, `src/physics/waves.js`, `src/physics/solvers.js`, `src/chatbotLogic.js`, five `*.test.js` files, `PHASE_1_REPORT.md`, `.claude/launch.json` (local preview config for the Claude desktop app, which you can leave uncommitted).

**Modified:** `src/App.jsx`, `src/Chatbot.jsx`, `src/LandingPage.jsx`, `src/PhysicsBackground.jsx`, `src/ProblemSolver.jsx`, `src/ProjectileProblemSolver.jsx`, `src/ProjectileSimulator.jsx`, `src/SHMProblemSolver.jsx`, `src/SHMSimulator.jsx`, `src/WaveInterference.jsx`, `index.html`, `package.json`, `package-lock.json`.

**Deleted:** `wave-sim/` (unused Vite template), `src/assets/react.svg`.

## Behavior changes users will notice
- **SHM runs in real time** (it ran about 3× fast before). Damping is now γ in s⁻¹ (0–1) instead of a unitless 0–5. A Reset button was added.
- **Projectile** has a playback-speed selector (default 2×). Launch sliders lock during flight, and Fire becomes Stop.
- **Wave**: "Frequency" now also changes how fast the wave oscillates (fixed wave speed). The screen no longer flickers.
- **Chatbot** appears only in the Wave Lab and is honestly labeled as a keyword FAQ.

---

## Remaining known issues (out of Phase 1 scope)
1. **The live GitHub Pages site still has the old bugs** until it's redeployed (`npm run deploy`). I verified the fix with `vite preview` under the same base path, but deploying is your call.
2. **README still overclaims.** It mentions Runge-Kutta for the projectile (the projectile is closed-form; RK4 now exists only in the SHM lab), a "wave equation solver", single slit, CSS Modules and React 18. This needs a README pass (planned for Phase 6, or sooner).
3. **Wave model is still qualitative:** relative units, no slit width or single-slit envelope, ad hoc 1/(1+0.005d) attenuation and cos^1.5 directional factor. The main view's brightness is |u| at each instant (labeled as such). Real units and λD/d agreement are Phase 3.
4. **No HiDPI handling:** canvases ignore `devicePixelRatio`, so they look soft on Retina screens.
5. **Mobile layout:** fixed-width side panels still cover the canvas on phones. SHM dragging and the chat button now use Pointer Events, so touch works, but the layout isn't responsive.
6. **Styling debt:** mostly inline styles remain. Slider markup was consolidated into config arrays per page, but there's no shared `<ParamSlider>` component or CSS modules yet (Phase 2).
7. **PhysicsBackground** particles still move a fixed amount per frame, so their drift speed depends on refresh rate. It's decorative and has one correctly cancelled loop.
8. **Dev-only audit findings:** `gh-pages` → `braces` (5 high). The suggested fix is a breaking change to the deploy tool and doesn't affect the shipped bundle. Production dependencies show 0 vulnerabilities.
9. **No component or end-to-end tests yet.** The browser checks above were run as one-off scripts, not committed (Playwright is Phase 4).
10. **The favicon is still the Vite logo**, and `src/index.css` is still the Vite template stylesheet.
