import { defineConfig } from 'vitest/config';

// Performance comparisons (before vs after optimisation). Kept out of `npm test`
// because timings depend on the machine; run with `npm run test:perf`.
export default defineConfig({
    test: {
        name: 'perf',
        environment: 'node',
        include: ['tests/perf/**/*.perf.js'],
        fileParallelism: false, // measurements must not compete for the CPU
        testTimeout: 60_000,
    },
});
