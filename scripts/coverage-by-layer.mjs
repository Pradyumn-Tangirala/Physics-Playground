// Summarises coverage/coverage-summary.json (written by `npm run test:coverage`)
// per source layer: src/physics, src/simulation, src/rendering, ...
// Usage: node scripts/coverage-by-layer.mjs

import { readFileSync } from 'node:fs';

const summary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
const layers = {};
for (const [file, metrics] of Object.entries(summary)) {
    if (file === 'total') continue;
    const layer = file.replaceAll('\\', '/').match(/src\/([a-z]+)\//)?.[1] ?? 'root';
    layers[layer] ??= { lines: [0, 0], branches: [0, 0], functions: [0, 0] };
    for (const key of ['lines', 'branches', 'functions']) {
        layers[layer][key][0] += metrics[key].covered;
        layers[layer][key][1] += metrics[key].total;
    }
}
const pct = ([covered, total]) => (total ? `${((100 * covered) / total).toFixed(1)}%` : '—');
console.log('layer'.padEnd(12), 'lines'.padStart(8), 'branches'.padStart(9), 'functions'.padStart(10));
for (const [layer, m] of Object.entries(layers).sort()) {
    console.log(layer.padEnd(12), pct(m.lines).padStart(8), pct(m.branches).padStart(9), pct(m.functions).padStart(10));
}
const t = summary.total;
console.log('total'.padEnd(12), `${t.lines.pct}%`.padStart(8), `${t.branches.pct}%`.padStart(9), `${t.functions.pct}%`.padStart(10));
