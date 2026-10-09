import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the *production build* served under its real
// base path (/Physics-Playground/), exactly as GitHub Pages serves it.
const PORT = 4173;
const BASE = `http://localhost:${PORT}/Physics-Playground/`;
const DESKTOP = { width: 1440, height: 900 };

// Functional specs run in every browser and form factor; the performance spec
// runs on its own afterwards (it needs Chromium's CDP and an idle CPU).
const FUNCTIONAL = { testIgnore: /performance\.spec\.js/ };

export default defineConfig({
    testDir: 'e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
    use: {
        baseURL: BASE,
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'chromium', ...FUNCTIONAL, use: { ...devices['Desktop Chrome'], viewport: DESKTOP } },
        { name: 'firefox', ...FUNCTIONAL, use: { ...devices['Desktop Firefox'], viewport: DESKTOP } },
        { name: 'edge', ...FUNCTIONAL, use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: DESKTOP } },
        // Phone and tablet: real mobile emulation (touch, device pixel ratio, mobile UA).
        { name: 'mobile', ...FUNCTIONAL, use: { ...devices['Pixel 7'] } },
        { name: 'tablet', ...FUNCTIONAL, use: { ...devices['Galaxy Tab S4'] } },
        {
            // Timing and memory measurements run after the Chromium functional
            // tests, one at a time, so they never compete for the CPU.
            name: 'performance',
            testMatch: /performance\.spec\.js/,
            dependencies: ['chromium'],
            fullyParallel: false,
            use: { ...devices['Desktop Chrome'], viewport: DESKTOP },
        },
    ],
    webServer: {
        // E2E_PREBUILT=1 serves the dist/ that is already there instead of building
        // one: the deploy workflow unpacks the exact artifact it is about to publish.
        command: `${process.env.E2E_PREBUILT ? '' : 'npm run build && '}npx vite preview --port ${PORT} --strictPort`,
        url: BASE,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
