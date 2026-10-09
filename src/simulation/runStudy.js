// Runs a study (studies.js) on a Web Worker, so a run of a few hundred
// milliseconds does not freeze the page or its animation. One worker is
// started on first use and reused. Where workers are unavailable (jsdom in
// the unit tests) or the worker fails to start, the study runs on the main
// thread instead: slower to respond, same result.

import { STUDIES } from './studies.js';

let worker = null;
let workersFailed = false;
let nextId = 0;
const pending = new Map(); // id → { name, args, resolve, reject }

const runHere = ({ name, args, resolve, reject }) => {
    try {
        resolve(STUDIES[name](args));
    } catch (error) {
        reject(error);
    }
};

function studyWorker() {
    if (workersFailed || typeof Worker === 'undefined') return null;
    if (!worker) {
        worker = new Worker(new URL('./studyWorker.js', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data: { id, result, error } }) => {
            const job = pending.get(id);
            pending.delete(id);
            if (error === undefined) job.resolve(result);
            else job.reject(new Error(error));
        };
        worker.onerror = (event) => {
            // The worker script did not load or crashed: finish what was queued here.
            event.preventDefault();
            workersFailed = true;
            worker.terminate();
            worker = null;
            const jobs = [...pending.values()];
            pending.clear();
            jobs.forEach(runHere);
        };
    }
    return worker;
}

/** Runs STUDIES[name](args) off the main thread when possible; resolves with its result. */
export function runStudy(name, args) {
    return new Promise((resolve, reject) => {
        const job = { name, args, resolve, reject };
        const w = studyWorker();
        if (!w) {
            setTimeout(() => runHere(job), 0); // let the "Running…" state paint first
            return;
        }
        const id = nextId++;
        pending.set(id, job);
        w.postMessage({ id, name, args });
    });
}
