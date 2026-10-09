# Production readiness

How Physics Playground is built, tested, deployed and kept healthy, and what it does not do. Every number here was measured on the current code; how to reproduce each one is in [TESTING.md](TESTING.md).

## 1. CI/CD

Two GitHub Actions workflows, both using `npm ci` against the committed `package-lock.json`, with Node from `.nvmrc` (22).

**`ci.yml`** runs on every pull request and on pushes to branches other than `main`.

| Job | Steps |
|---|---|
| `verify` | `npm ci` → `npm run lint` → `npm run test:coverage` (fails below the coverage floors) → `npm run build`; uploads the coverage report |
| `e2e` (matrix, after `verify`) | Playwright against the production build in **chromium, firefox, edge (msedge), mobile (Pixel 7), tablet (Galaxy Tab S4)**; `fail-fast: false`, so every browser reports; uploads the HTML report on failure |
| `performance` (after `verify`) | Frame-time, loop-count and memory-leak checks (Playwright `performance` project) and the kernel benchmarks (`npm run test:perf`); uploads `perf-*.json` |

**`deploy.yml`** runs on push to `main` (and by hand).

| Job | Steps |
|---|---|
| `build` | `npm ci` → lint → `npm test` → `npm run build` → `configure-pages` → `upload-pages-artifact` (`dist/`) |
| `e2e` | Downloads the Pages artifact from `build`, unpacks it into `dist/` and runs the Chromium end-to-end tests against it (`E2E_PREBUILT=1` makes Playwright serve that `dist/` instead of building) |
| `deploy` | Needs `build` and `e2e`. `deploy-pages` publishes the same artifact the `e2e` job tested. Runs with `pages: write` and `id-token: write` permissions only |

- **Concurrency:** deployments queue rather than race (`group: pages`, no cancellation). CI runs on a branch cancel older runs on the same ref.
- **One-time repository setting:** Settings → Pages → Build and deployment → Source: **GitHub Actions**.

### Deployment architecture

```
push to main ──► deploy.yml: build (lint, test, vite build) ──► Pages artifact (dist/)
                         └──► e2e (Chromium, on that artifact)   ──┐
                                                                   ▼
                                                   deploy-pages ──► https://pradyumn-tangirala.github.io/Physics-Playground/
```

- **Static files only.** Vite produces `dist/` with `base: '/Physics-Playground/'`.
- **No server rewrites needed.** Routing uses the hash (`#/shm?…`), so deep links and reloads work on GitHub Pages. Experiment links carry their parameters in the hash query.
- **No backend, accounts, cookies, analytics or browser storage.** The page touches the clipboard and saves files only when the user clicks Copy Experiment Link or Export.
- **Removed:** the old `gh-pages` package and `npm run deploy`. A manual deploy could publish an untested local build.

## 2. Dependency management

- **Small runtime footprint:** three dependencies (`react`, `react-dom`, `react-router-dom`). Everything else is development tooling.
- **Reproducible installs:** `npm ci` from the lockfile, everywhere. `engines` requires Node `^22.13.0 || >=24.0.0`, which is what Vitest 5 and jsdom 29 need.
- **Dependabot** (`.github/dependabot.yml`):
  - **npm, weekly.** Minor and patch updates are grouped into one PR for dev tooling and one for runtime. Major versions arrive as separate PRs, so a breaking upgrade is reviewed on its own.
  - **GitHub Actions, monthly.**
- **Audit:** `npm audit` reports 0 vulnerabilities (checked at the end of Phase 9).

## 3. Error handling

- **`ErrorBoundary`** wraps every route. It resets when the route changes.
  - **A lab chunk fails to download** (offline, or a new deployment replaced the file): it shows "This page could not be loaded" with **Reload page**.
  - **Any other render error:** it shows "Something went wrong on this page" with **Try again** and **Back to home**.
  - Users never see a stack trace. In development the message appears in a `<details>`.
  - Both screens use `role="alert"`, and are tested in jsdom and in the real browser (by aborting the chunk request).
- **Unknown address:** a "Page not found" page with a way home.
- **Numerical failures are results, not crashes.** An unstable integration is detected and shown as "unstable" or "blew up" (projectile divergence, FDTD CFL violation), never as a number.
- **Experiment links with bad values:** the defaults are kept and an alert names each rejected value with the reason. Nothing is clamped silently.

## 4. Performance

Measured on the development machine, in the production build in Chromium, at device-pixel ratio 1:

| Measurement | Result |
|---|---|
| Entry bundle (React, router, landing page) | 277.8 kB, 89.4 kB gzipped; each lab is a separate chunk (10–26 kB) loaded on first visit |
| Analytical wave lab, frame time | 1.67 ms (precompute after a parameter change: 4.7 ms) |
| FDTD lab | 0.45 ms per solver step; 1.85 ms per drawn frame |
| Kernel speed-ups against the pre-optimisation code (same inputs) | Wave field 2.7× (8.4× with wide slits), FDTD step 1.5×, blow-up check 6.1× |
| Animation loops | Exactly one per mounted page, zero after leaving it (counted across 3 tours of 6 pages) |
| Memory | JS heap +1.6 MB after 20 round trips through every lab (120 page changes), against a 15 MB budget |
| Accuracy-vs-cost experiment (24 timed runs of 10 s simulated time) | Runs in a Web Worker. Longest frame gap during a run: 33 ms, against 167 ms with the study on the main thread (E2E test, budget 100 ms) |

How these are kept low:
- **One rAF loop per page**, driven by its timestamps. React is never on the per-frame path. Text readouts refresh four times a second.
- **Render caches** in renderer closures: one `ImageData`, an offscreen canvas and colour lookup tables per page. Nothing is allocated per frame.
- **Precompute only on parameter change** for the analytical field.
- **Device-pixel ratio capped at 2**, so a 3× phone does not do 2.25× the pixel work for no visible gain.

The budgets in the performance tests are several times the measured values. They catch regressions; they do not promise these exact numbers on other machines.

## 5. Accessibility

- **Audit:** an axe-core WCAG 2.1 A/AA audit runs on every route in Chromium, with no serious or critical violations allowed. It found contrast failures and keyboard-unreachable scrolling tables, both fixed.
- **Keyboard:**
  - Every control is reachable and operable from the keyboard.
  - Sliders support arrows, PageUp/PageDown and Home/End, and have a numeric field with inline validation (`aria-invalid` plus an `aria-describedby` error).
  - The wave lab's measurement chart has a keyboard cursor: arrows move between fringes, Enter places a marker, Escape clears.
  - Wide tables scroll inside focusable, labelled regions.
  - A global `:focus-visible` outline shows focus.
- **Screen readers:**
  - Canvases are `role="img"` with descriptive labels.
  - Every number that matters is also in the DOM (verification panels, tables, readouts).
  - Live status messages use `role="status"` or `aria-live`.
  - Buttons have specific names ("Launch Projectile Motion", not "Launch").
- **Motion:**
  - `prefers-reduced-motion` stops the decorative background and card tilt, and disables CSS transitions and smooth scrolling.
  - The background animation also has a pause button (WCAG 2.2.2).
- **Touch:** primary buttons are at least 44 px high.

## 6. Responsive design and input

- **Layouts.** Three layouts are tested end-to-end:
  - desktop (1440 × 900)
  - phone (Pixel 7, 412 px, touch, DPR 2.6)
  - tablet (Galaxy Tab S4, 712 px)
- **Phones.** Below 900 px the labs stack the canvas first, at a usable height, with the controls after it. The oscillator canvas switches to a compact arrangement (stacked graphs, small energy bars). No page scrolls horizontally (checked on every route).
- **Pointer Events with `setPointerCapture`.** Dragging the pendulum bob or the spring block works the same with mouse, touch and pen. E2E drives all three through the Chromium input pipeline.
- **High-DPI.** Canvases keep their backing store at CSS size × devicePixelRatio (capped at 2) and follow DPR changes, for example when a window moves to another screen.

## 7. Browser compatibility

| Browser | How it is tested | Result |
|---|---|---|
| Chromium (desktop) | Local and CI | 77/77 functional, plus 4 performance tests |
| Microsoft Edge | Local and CI (`channel: msedge`) | All pass (some Chromium-only checks, such as axe and synthetic touch, are skipped) |
| Mobile (Pixel 7 emulation, Chromium) | Local and CI | All pass |
| Tablet (Galaxy Tab S4 emulation, Chromium) | Local and CI | All pass |
| Firefox | CI only | Runs in the CI matrix on Ubuntu. **Not verified locally:** Playwright's Firefox build fails to start on the development machine (a Windows "side-by-side configuration" error that persists after a reinstall) |
| Safari / WebKit | Not tested | Not in the Playwright matrix (see §8) |

Code uses standard APIs only: Canvas 2D, `ImageData`, Pointer Events, `ResizeObserver`, `matchMedia`, the async Clipboard API (with a manual-copy fallback), `Blob` downloads and CSS Modules. There are no polyfills.

## 8. Known limitations

- **WebKit (Safari) is not in the test matrix.** The code avoids Chromium-only APIs, but nothing proves it runs in Safari.
- **Firefox has been verified only by CI.** It could not be run on the development machine (§7).
- **Emulated devices.** The phone and tablet runs are Chromium emulations (viewport, DPR, touch, user agent), not real devices.
- **Machine-dependent timings.** The numbers in §4 are from one machine. The performance tests use loose budgets, and `npm run test:perf` is not a gate.
- **Canvas content is not readable by screen readers.** The important numbers are mirrored in the DOM, but trajectories and fields are visual only.
- **Data logging lives in memory.** It is capped at 200 000 rows. Logs survive navigation within the tab, and the browser asks before a reload or close discards unexported rows.
- **Optical wavelengths cannot be drawn to scale.** The analytical wave lab computes the laser screen pattern exactly but cannot draw the 2-D field at that scale. The FDTD lab is limited to macroscopic waves.
- **No offline support (no service worker).** After a new deployment, a tab that was already open may fail to load a lab chunk. The error boundary then offers Reload.
- **The live site updates only through `deploy.yml`.** Merging to `main` deploys; nothing else does.
