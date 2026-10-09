// Web Worker that runs one study per message: { id, name, args } → { id, result } or { id, error }.

import { STUDIES } from './studies.js';

self.onmessage = ({ data: { id, name, args } }) => {
    try {
        self.postMessage({ id, result: STUDIES[name](args) });
    } catch (error) {
        self.postMessage({ id, error: String(error?.message ?? error) });
    }
};
