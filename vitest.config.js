import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Tests are grouped by responsibility (see TESTING.md). Run one group with
//   npx vitest run --project physics
// Performance benchmarks live in vitest.perf.config.js and are not part of `npm test`.
export default defineConfig({
    plugins: [react()],
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: 'physics',
                    environment: 'node',
                    include: ['src/physics/**/*.test.js'],
                },
            },
            {
                extends: true,
                test: {
                    name: 'simulation',
                    environment: 'node',
                    include: ['src/simulation/**/*.test.js', 'src/rendering/**/*.test.js'],
                },
            },
            {
                extends: true,
                test: {
                    name: 'validation',
                    environment: 'node',
                    include: ['src/utils/**/*.test.js', 'src/experiments/**/*.test.js', 'tests/validation/**/*.test.js'],
                },
            },
            {
                extends: true,
                test: {
                    name: 'ui',
                    environment: 'jsdom',
                    include: ['tests/ui/**/*.test.{js,jsx}', 'src/components/**/*.test.{js,jsx}'],
                    setupFiles: ['tests/ui/setup.js'],
                },
            },
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text-summary', 'text', 'html', 'json-summary'],
            reportsDirectory: 'coverage',
            include: ['src/**/*.{js,jsx}'],
            exclude: ['src/**/*.test.{js,jsx}', 'src/main.jsx'],
            // Floors for the code whose correctness the project depends on; the
            // UI is covered by behaviour (UI + E2E tests), not by a line count.
            // (Measured at the time of writing: physics 99.7% lines, simulation 98.4%,
            // utils and experiments 100%; the floors sit a little below so CI catches regressions.)
            thresholds: {
                'src/physics/**': { lines: 95, functions: 95, branches: 88 },
                'src/simulation/**': { lines: 92, functions: 92, branches: 80 },
                'src/utils/**': { lines: 95, functions: 95, branches: 90 },
                'src/experiments/**': { lines: 95, functions: 95, branches: 90 },
            },
        },
    },
});
